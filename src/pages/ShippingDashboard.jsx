import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AppSnackbar from "../components/AppSnackbar";
import ShippingInvoiceEditDialog from "../components/ShippingInvoiceEditDialog";
import { useLogoutConfirmation } from "../components/LogoutConfirmDialog";
import OrderCalculatedTableDialog from "../components/OrderCalculatedTableDialog";
import ShippingDashboardView from "./ShippingDashboard/ShippingDashboardView";
import {
  getAllOrders,
  subscribeToAllOrders,
  updateOrderStatus as updateOrderStatusInSupabase,
  patchOrderShippingInvoice,
  clearOrderShippingInvoice,
  fetchOrderShippingInvoice,
  getCurrentUser,
  getAdminByUid,
  supabase,
} from "../services/supabaseService";
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  canTransitionOrderStatus,
  appendOrderStatusHistory,
  orderHasShippingInvoice,
  getOrderShippingInvoices,
  mergeOrdersPreservingInvoices,
  upsertOrderInCokeOrdersLocalStorage,
  isOrderVisibleOnShippingDashboard,
  isOrderAwaitingApprovalOnShipping,
} from "../utils/orderStatus";
import { readShippingInvoiceFiles } from "../utils/shippingInvoiceFile";
import {
  buildShippingInvoicePatch,
  buildClearShippingInvoicePatch,
  mergeShippingInvoices,
} from "../utils/shippingInvoiceStorage";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import {
  playShippingNotificationSound,
  postShippingBrowserNotification,
  unlockShippingNotificationAudio,
} from "../utils/shippingNotifications";
import { useTheme, useMediaQuery } from "@mui/material";

const isSupabaseConfigured = supabase !== null;

function getOrderId(order) {
  if (order?.orderNumber) return `ORD-${order.orderNumber}`;
  if (order?.id) return order.id;
  if (order?.timestamp && order?.distributorCode) {
    return `${order.timestamp}_${order.distributorCode}`;
  }
  return order?.timestamp || JSON.stringify(order);
}

function getOrderStatus(order) {
  return normalizeOrderStatus(order?.status || ORDER_STATUS.PENDING);
}

/** YYYY-MM-DD in local timezone for date-range filters. */
function getOrderDateKey(order) {
  const raw =
    order?.created_at ||
    order?.createdAt ||
    order?.timestamp ||
    order?.status_updated_at ||
    order?.statusUpdatedAt;
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function orderMatchesSearch(order, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    order?.orderNumber,
    order?.distributorName,
    order?.distributorCode,
    order?.id,
    getOrderId(order),
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return parts.some((p) => p.includes(q));
}

function persistOrdersToLocalStorage(orders) {
  try {
    localStorage.setItem("coke_orders", JSON.stringify(orders));
  } catch (e) {
    console.warn("Could not persist orders to localStorage:", e);
  }
}

function mergeOrderPatch(orders, orderId, patch) {
  return orders.map((o) => (getOrderId(o) === orderId ? { ...o, ...patch } : o));
}

function ShippingDashboard({ onLogout }) {
  const { requestLogout, logoutConfirmDialog } = useLogoutConfirmation(onLogout);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [deliveringId, setDeliveringId] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const pendingUploadOrderKeyRef = useRef(null);
  const pendingUploadOrderRef = useRef(null);
  const ordersRef = useRef([]);
  const invoiceSaveLockRef = useRef(0);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const previousOrderIdsRef = useRef(new Set());
  const newOrderIdsNotifyInitRef = useRef(false);
  const previousOrderStatusesRef = useRef({});
  const statusNotifyInitRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [deliverConfirmOrder, setDeliverConfirmOrder] = useState(null);
  const [invoiceEditOrder, setInvoiceEditOrder] = useState(null);
  const [deliverPendingFiles, setDeliverPendingFiles] = useState([]);
  const deliverFileInputRef = useRef(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [currentUser, setCurrentUser] = useState({ name: "Shipping", email: "", role: "shipping" });
  const shippingActorRef = useRef({ name: "Shipping", email: "", role: "shipping" });
  const [toast, setToast] = useState({
    open: false,
    message: "",
    title: "",
    severity: "info",
    duration: 4000,
  });

  const showToast = useCallback((message, severity = "info", title = "", duration = 4000) => {
    setToast({ open: true, message, severity, title, duration });
  }, []);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedEmail = localStorage.getItem("admin_email") || "";
      let name = localStorage.getItem("userName") || "Shipping";
      let email = storedEmail;
      let role = localStorage.getItem("userRole") || "shipping";

      try {
        const user = await getCurrentUser();
        if (user && !cancelled) {
          email = user.email || storedEmail || email;
          const admin = await getAdminByUid(user.id);
          name = admin?.name || user.user_metadata?.name || email.split("@")[0] || "Shipping";
          role = admin?.role || role;
        }
      } catch (e) {
        console.warn("Could not load shipping user profile:", e);
      }

      if (!cancelled) {
        const profile = { name, email: email || "Shipping user", role };
        setCurrentUser(profile);
        shippingActorRef.current = profile;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logShippingActivity = useCallback((type, description, metadata = {}) => {
    const actor = shippingActorRef.current;
    void logActivity(type, description, {
      userEmail: actor.email,
      userName: actor.name,
      role: actor.role || "shipping",
      ...metadata,
    });
  }, []);

  const resolveOrderByKey = useCallback(
    (orderKey) => {
      if (!orderKey) return null;
      return (
        ordersRef.current.find((o) => getOrderId(o) === orderKey) ||
        null
      );
    },
    []
  );

  const orderIdentityFallback = useCallback((order) => {
    if (
      order?.distributorCode != null &&
      String(order.distributorCode).trim() !== "" &&
      order?.orderNumber != null &&
      String(order.orderNumber).trim() !== ""
    ) {
      return {
        distributorCode: order.distributorCode,
        orderNumber: order.orderNumber,
      };
    }
    return null;
  }, []);

  const pushNotification = useCallback(
    (message, type = "info", headline = "", soundVariant = null) => {
      setNotifications((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          message,
          headline:
            headline ||
            (type === "success" ? "Update" : type === "error" ? "Alert" : "Notice"),
          type,
          at: new Date().toLocaleString(),
        },
        ...prev,
      ].slice(0, 50));
      setUnreadNotifications((prev) => prev + 1);
      playShippingNotificationSound(type, soundVariant);
    },
    []
  );

  useEffect(() => {
    const unlock = () => unlockShippingNotificationAudio();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!Array.isArray(orders)) return;

    const idsNow = new Set(orders.map((o) => getOrderId(o)));

    if (!newOrderIdsNotifyInitRef.current) {
      previousOrderIdsRef.current = idsNow;
      newOrderIdsNotifyInitRef.current = true;
      return;
    }

    const newlyAdded = orders.filter((o) => !previousOrderIdsRef.current.has(getOrderId(o)));
    const incoming = newlyAdded.filter((o) =>
      isOrderAwaitingApprovalOnShipping(getOrderStatus(o))
    );

    if (incoming.length > 0) {
      const lines = incoming.slice(0, 3).map((o) => {
        const name = o.distributorName || o.distributorCode || "Distributor";
        const num = o.orderNumber != null ? `#${o.orderNumber}` : getOrderId(o);
        return `${name} — ${num}`;
      });
      const summary =
        incoming.length === 1
          ? `New incoming order: ${lines[0]}`
          : `${incoming.length} new incoming orders`;
      pushNotification(summary, "info", "Incoming orders", "incoming");
      showToast(
        incoming.length === 1 ? lines[0] : `${incoming.length} new orders awaiting GM approval`,
        "info",
        "Incoming",
        6000
      );
      void postShippingBrowserNotification(
        incoming.length === 1 ? "Incoming order" : `${incoming.length} incoming orders`,
        summary,
        "coke-shipping-incoming"
      );
    }

    previousOrderIdsRef.current = idsNow;
  }, [orders, pushNotification, showToast]);

  useEffect(() => {
    if (!Array.isArray(orders)) return;

    const next = {};
    orders.forEach((order) => {
      next[getOrderId(order)] = getOrderStatus(order);
    });

    if (!statusNotifyInitRef.current) {
      statusNotifyInitRef.current = true;
      previousOrderStatusesRef.current = next;
      return;
    }

    const prev = previousOrderStatusesRef.current;
    const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);

    ids.forEach((id) => {
      const was = prev[id];
      const now = next[id];
      if (now === undefined || was === now) return;

      if (now === ORDER_STATUS.APPROVED && was !== ORDER_STATUS.APPROVED) {
        const msg = `Order ${id} approved — upload invoice and deliver when ready.`;
        pushNotification(msg, "success", "Ready to ship", "approved");
        showToast(msg, "success", "Order approved", 6000);
        void postShippingBrowserNotification("Order approved", msg, "coke-shipping-approved");
      }
    });

    previousOrderStatusesRef.current = next;
  }, [orders, pushNotification, showToast]);

  const loadOrders = useCallback(async () => {
    if (invoiceSaveLockRef.current > 0) return;
    try {
      if (isSupabaseConfigured) {
        const remote = await getAllOrders();
        setOrders((prev) => mergeOrdersPreservingInvoices(prev, remote || [], getOrderId));
      } else {
        const stored = localStorage.getItem("coke_orders");
        setOrders(stored ? JSON.parse(stored) : []);
      }
      setLastRefreshedAt(new Date());
    } catch (e) {
      console.error("Error loading orders for shipping:", e);
      showToast("Could not load orders", "error", "Shipping");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const onStorage = (e) => {
        if (e.key === "coke_orders") loadOrders();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    const unsub = subscribeToAllOrders((next) => {
      if (invoiceSaveLockRef.current > 0) return;
      setOrders((prev) => mergeOrdersPreservingInvoices(prev, next || [], getOrderId));
      setLastRefreshedAt(new Date());
    });
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadOrders();
    }, 5000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [loadOrders]);

  const saveInvoicesOnOrder = async (order, newInvoices, { merge = true } = {}) => {
    invoiceSaveLockRef.current += 1;
    try {
      const orderId = getOrderId(order);
      const mergedFiles = merge
        ? mergeShippingInvoices(order, newInvoices)
        : Array.isArray(newInvoices)
          ? newInvoices
          : [];
      const clearing = mergedFiles.length === 0;
      const patch = clearing
        ? buildClearShippingInvoicePatch()
        : buildShippingInvoicePatch(mergedFiles);
      if (!clearing && !patch.shipping_invoice_data) {
        throw new Error("No invoice file data to save");
      }
      let mergedOrder = { ...order, ...patch };

      const applyPatchToState = () => {
        setOrders((prev) => {
          const next = mergeOrderPatch(prev, orderId, patch);
          persistOrdersToLocalStorage(next);
          ordersRef.current = next;
          return next;
        });
        mergedOrder = { ...mergedOrder, ...patch };
      };

      applyPatchToState();

      if (isSupabaseConfigured) {
        const identityFallback = orderIdentityFallback(order);

        if (!order.id && !identityFallback) {
          throw new Error(
            "This order cannot be matched in the database (missing id and order number). Refresh the page and try again."
          );
        }

        if (clearing) {
          await clearOrderShippingInvoice(order.id ?? null, identityFallback);
        } else {
          await patchOrderShippingInvoice(
            order.id ?? null,
            {
              shipping_invoice_data: patch.shipping_invoice_data,
              shipping_invoice_file_name: patch.shipping_invoice_file_name,
              shipping_invoice_mime_type: patch.shipping_invoice_mime_type,
            },
            identityFallback
          );
        }

        const refetched = await fetchOrderShippingInvoice(order.id ?? null, identityFallback);
        if (refetched) {
          if (refetched.id) {
            patch.id = refetched.id;
            mergedOrder.id = refetched.id;
          }
          if (!clearing && orderHasShippingInvoice(refetched)) {
            const dbPatch = buildShippingInvoicePatch(getOrderShippingInvoices(refetched));
            Object.assign(patch, dbPatch);
            mergedOrder = { ...mergedOrder, ...dbPatch };
          }
        }

        applyPatchToState();
      }

      upsertOrderInCokeOrdersLocalStorage(mergedOrder, patch, getOrderId);
      const count = mergedFiles.length;
      const distributorLabel = order.distributorName || order.distributorCode || "";
      if (clearing) {
        logShippingActivity(
          ACTIVITY_TYPES.SHIPPING_INVOICE_CLEARED,
          `Shipping cleared invoice files for order ${orderId}${distributorLabel ? ` (${distributorLabel})` : ""}`,
          { orderId, distributorCode: order.distributorCode, distributorName: order.distributorName }
        );
        pushNotification(`Invoice files removed for ${orderId}`, "info", "Invoice cleared");
        showToast(
          "Invoice files removed. Upload the correct files before delivering.",
          "success",
          "Invoice cleared"
        );
      } else if (!merge) {
        logShippingActivity(
          ACTIVITY_TYPES.SHIPPING_INVOICE_UPDATED,
          `Shipping updated invoice files for order ${orderId} (${count} file${count !== 1 ? "s" : ""})`,
          {
            orderId,
            distributorCode: order.distributorCode,
            distributorName: order.distributorName,
            fileCount: count,
          }
        );
        pushNotification(
          count === 1
            ? `Invoice updated for ${orderId}`
            : `${count} invoice files saved for ${orderId}`,
          "success",
          "Invoices updated",
          "upload"
        );
        showToast(
          count === 1 ? "Invoice file list updated." : `${count} invoice files saved.`,
          "success",
          "Invoices updated"
        );
      } else {
        logShippingActivity(
          ACTIVITY_TYPES.SHIPPING_INVOICE_UPLOADED,
          `Shipping uploaded invoice for order ${orderId} (${count} file${count !== 1 ? "s" : ""})`,
          {
            orderId,
            distributorCode: order.distributorCode,
            distributorName: order.distributorName,
            fileCount: count,
          }
        );
        pushNotification(
          count === 1 ? `Invoice uploaded for ${orderId}` : `${count} invoices saved for ${orderId}`,
          "success",
          "Invoices uploaded",
          "upload"
        );
        showToast(
          count === 1
            ? "Invoice saved. Click Deliver when the shipment goes out."
            : `${count} invoice files saved. Click Deliver when ready.`,
          "success",
          "Invoices uploaded"
        );
      }
      return mergedOrder;
    } finally {
      invoiceSaveLockRef.current = Math.max(0, invoiceSaveLockRef.current - 1);
    }
  };

  const snapshotInputFiles = (input) => {
    const files = Array.from(input?.files ?? []);
    if (input) input.value = "";
    return files;
  };

  const handleFilesChosen = async (pickedFiles) => {
    const files = Array.from(pickedFiles ?? []).filter(Boolean);
    if (files.length === 0) return;

    const order =
      pendingUploadOrderRef.current ||
      resolveOrderByKey(pendingUploadOrderKeyRef.current);
    pendingUploadOrderRef.current = null;
    pendingUploadOrderKeyRef.current = null;

    if (!order) {
      showToast("Select an order again, then upload the invoice", "warning", "Invoice");
      return;
    }
    const orderId = getOrderId(order);
    setUploadingId(orderId);
    try {
      const invoices = await readShippingInvoiceFiles(files);
      await saveInvoicesOnOrder(order, invoices);
    } catch (e) {
      if (e?.partialResults?.length) {
        try {
          await saveInvoicesOnOrder(order, e.partialResults);
          showToast(e.message, "warning", "Partial upload");
          return;
        } catch {
          /* fall through */
        }
      }
      showToast(e.message || "Upload failed", "error", "Invoice");
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeliverPendingFilesPick = (pickedFiles) => {
    const fileList = Array.from(pickedFiles ?? []).filter(Boolean);
    if (fileList.length === 0) return;
    setDeliverPendingFiles((prev) => {
      const next = [...prev];
      const seen = new Set(next.map((f) => `${f.name}:${f.size}`));
      for (const f of fileList) {
        const key = `${f.name}:${f.size}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(f);
        if (next.length >= 10) break;
      }
      return next;
    });
    showToast(
      fileList.length === 1
        ? `Added ${fileList[0].name}`
        : `Added ${fileList.length} files — tap "Save & deliver" when ready`,
      "success",
      "Invoice files"
    );
  };

  const triggerFilePick = (order, useCamera) => {
    if (getOrderStatus(order) !== ORDER_STATUS.APPROVED) {
      showToast("Only approved orders can receive an invoice", "warning", "Shipping");
      return;
    }
    pendingUploadOrderRef.current = order;
    pendingUploadOrderKeyRef.current = getOrderId(order);
    const input = useCamera ? cameraInputRef.current : fileInputRef.current;
    if (!input) {
      showToast("File picker is not ready — refresh the page", "error", "Invoice");
      return;
    }
    input.click();
  };

  const handleDeliver = async (order) => {
    const orderId = getOrderId(order);
    const current = getOrderStatus(order);
    if (current !== ORDER_STATUS.APPROVED) {
      showToast("Only approved orders can be marked delivered", "warning", "Shipping");
      return;
    }
    if (!orderHasShippingInvoice(order)) {
      showToast("Upload an invoice before marking delivered", "warning", "Shipping");
      return;
    }
    if (!canTransitionOrderStatus(current, ORDER_STATUS.DELIVERED)) {
      showToast("Cannot mark this order delivered", "warning", "Shipping");
      return;
    }

    setDeliveringId(orderId);
    const deliveredAt = new Date().toISOString();
    const history = appendOrderStatusHistory(order, ORDER_STATUS.DELIVERED, {
      source: "shipping_dashboard",
      actor: "shipping",
    });
    const patch = {
      status: ORDER_STATUS.DELIVERED,
      statusUpdatedAt: deliveredAt,
      deliveredAt,
      delivered_at: deliveredAt,
      dispatchedAt: deliveredAt,
      dispatched_at: deliveredAt,
      statusHistory: history,
    };

    try {
      setOrders((prev) => {
        const next = mergeOrderPatch(prev, orderId, patch);
        if (!isSupabaseConfigured) persistOrdersToLocalStorage(next);
        return next;
      });

      const identityFallback = orderIdentityFallback(order);
      if (isSupabaseConfigured) {
        if (!order.id && !identityFallback) {
          throw new Error(
            "Cannot mark delivered: order is not linked to the database. Refresh the page and try again."
          );
        }
        await updateOrderStatusInSupabase(
          order.id ?? null,
          ORDER_STATUS.DELIVERED,
          {
            status_updated_at: deliveredAt,
            dispatched_at: deliveredAt,
            delivered_at: deliveredAt,
            status_history: history,
          },
          identityFallback
        );
      } else {
        const stored = localStorage.getItem("coke_orders");
        if (stored) {
          persistOrdersToLocalStorage(mergeOrderPatch(JSON.parse(stored), orderId, patch));
        }
      }

      upsertOrderInCokeOrdersLocalStorage(order, patch, getOrderId);
      logShippingActivity(
        ACTIVITY_TYPES.ORDER_DELIVERED,
        `Order delivered: ${orderId} (${order.distributorName || order.distributorCode || ""})`,
        {
          orderId,
          distributorCode: order.distributorCode,
          distributorName: order.distributorName,
          status: ORDER_STATUS.DELIVERED,
        }
      );

      const deliveredMsg = `Order ${orderId} marked delivered.`;
      pushNotification(deliveredMsg, "success", "Delivered", "delivered");
      showToast(
        `Order ${orderId} is now delivered. Admin and distributor dashboards will update automatically.`,
        "success",
        "Delivered",
        6000
      );
      void postShippingBrowserNotification("Order delivered", deliveredMsg, "coke-shipping-delivered");
      setStatusTab("delivered");
    } catch (e) {
      console.error(e);
      showToast(e.message || "Could not mark delivered", "error", "Shipping");
      await loadOrders();
    } finally {
      setDeliveringId(null);
      setDeliverConfirmOrder(null);
    }
  };

  const statusChipColor = (status) => {
    if (status === ORDER_STATUS.APPROVED) return "info";
    if (status === ORDER_STATUS.DELIVERED) return "success";
    if (status === ORDER_STATUS.SENT) return "info";
    if (status === ORDER_STATUS.REJECTED) return "error";
    if (status === ORDER_STATUS.CANCELED) return "warning";
    return "default";
  };

  const shippingRelevantOrders = useMemo(
    () => orders.filter((o) => isOrderVisibleOnShippingDashboard(getOrderStatus(o))),
    [orders]
  );

  const dateSearchFiltered = useMemo(() => {
    let list = shippingRelevantOrders;
    if (dateFrom) {
      list = list.filter((o) => {
        const key = getOrderDateKey(o);
        return key && key >= dateFrom;
      });
    }
    if (dateTo) {
      list = list.filter((o) => {
        const key = getOrderDateKey(o);
        return key && key <= dateTo;
      });
    }
    if (searchQuery.trim()) {
      list = list.filter((o) => orderMatchesSearch(o, searchQuery));
    }
    return list;
  }, [shippingRelevantOrders, dateFrom, dateTo, searchQuery]);

  const { incomingCount, approvedCount, deliveredCount } = useMemo(() => {
    let incoming = 0;
    let approved = 0;
    let delivered = 0;
    dateSearchFiltered.forEach((o) => {
      const s = getOrderStatus(o);
      if (isOrderAwaitingApprovalOnShipping(s)) {
        incoming += 1;
      } else if (s === ORDER_STATUS.APPROVED) {
        approved += 1;
      } else if (s === ORDER_STATUS.DELIVERED) {
        delivered += 1;
      }
    });
    return {
      incomingCount: incoming,
      approvedCount: approved,
      deliveredCount: delivered,
    };
  }, [dateSearchFiltered]);

  const filteredOrders = useMemo(() => {
    if (statusTab === "incoming") {
      return dateSearchFiltered.filter((o) =>
        isOrderAwaitingApprovalOnShipping(getOrderStatus(o))
      );
    }
    if (statusTab === "approved") {
      return dateSearchFiltered.filter((o) => getOrderStatus(o) === ORDER_STATUS.APPROVED);
    }
    if (statusTab === "delivered") {
      return dateSearchFiltered.filter((o) => getOrderStatus(o) === ORDER_STATUS.DELIVERED);
    }
    return dateSearchFiltered;
  }, [dateSearchFiltered, statusTab]);

  const hasActiveFilters = Boolean(searchQuery.trim() || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) => {
        const sa = getOrderStatus(a);
        const sb = getOrderStatus(b);
        const rank = (s) => {
          if (s === ORDER_STATUS.APPROVED) return 0;
          if (isOrderAwaitingApprovalOnShipping(s)) return 1;
          if (s === ORDER_STATUS.DELIVERED) return 2;
          return 3;
        };
        const ra = rank(sa);
        const rb = rank(sb);
        if (ra !== rb) return ra - rb;
        return new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0);
      }),
    [filteredOrders]
  );

  const handleConfirmDeliver = async () => {
    let order = deliverConfirmOrder
      ? resolveOrderByKey(getOrderId(deliverConfirmOrder)) || deliverConfirmOrder
      : null;
    if (!order) return;
    const orderId = getOrderId(order);
    const hasExisting = orderHasShippingInvoice(order);
    const hasPending = deliverPendingFiles.length > 0;

    if (!hasExisting && !hasPending) {
      showToast("Select at least one invoice file (PNG, JPG, or PDF)", "warning", "Delivery");
      return;
    }

    try {
      if (hasPending) {
        setUploadingId(orderId);
        const invoices = await readShippingInvoiceFiles(deliverPendingFiles);
        order = await saveInvoicesOnOrder(order, invoices);
        setDeliverPendingFiles([]);
      }
      await handleDeliver(order);
    } catch (e) {
      if (e?.partialResults?.length) {
        try {
          order = await saveInvoicesOnOrder(order, e.partialResults);
          setDeliverPendingFiles([]);
          await handleDeliver(order);
          showToast(e.message, "warning", "Partial upload");
          return;
        } catch {
          /* fall through */
        }
      }
      showToast(e.message || "Could not complete delivery", "error", "Shipping");
    } finally {
      setUploadingId(null);
    }
  };

  useEffect(() => {
    if (!deliverConfirmOrder) setDeliverPendingFiles([]);
  }, [deliverConfirmOrder]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.pdf,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const files = snapshotInputFiles(e.target);
          if (files.length) void handleFilesChosen(files);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const files = snapshotInputFiles(e.target);
          if (files.length) void handleFilesChosen(files);
        }}
      />
      <input
        ref={deliverFileInputRef}
        type="file"
        multiple
        accept=".png,.pdf,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const files = snapshotInputFiles(e.target);
          if (files.length) handleDeliverPendingFilesPick(files);
        }}
      />

      <ShippingDashboardView
        loading={loading}
        isMobile={isMobile}
        lastRefreshedAt={lastRefreshedAt}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        hasActiveFilters={hasActiveFilters}
        clearFilters={clearFilters}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        incomingCount={incomingCount}
        approvedCount={approvedCount}
        deliveredCount={deliveredCount}
        sortedOrders={sortedOrders}
        shippingRelevantOrders={shippingRelevantOrders}
        notifications={notifications}
        notificationsOpen={notificationsOpen}
        setNotificationsOpen={setNotificationsOpen}
        unreadNotifications={unreadNotifications}
        onNotificationsOpen={() => {
          setNotificationsOpen(true);
          setUnreadNotifications(0);
        }}
        onNotificationsClose={() => setNotificationsOpen(false)}
        loadOrders={loadOrders}
        requestLogout={requestLogout}
        currentUser={currentUser}
        getOrderShippingInvoices={getOrderShippingInvoices}
        deliverPendingFiles={deliverPendingFiles}
        setDeliverPendingFiles={setDeliverPendingFiles}
        onPickDeliverFiles={() => deliverFileInputRef.current?.click()}
        onUploadFile={(order) => triggerFilePick(order, false)}
        onUploadCamera={(order) => triggerFilePick(order, true)}
        onEditInvoices={(order) => {
          const fresh = resolveOrderByKey(getOrderId(order)) || order;
          setInvoiceEditOrder(fresh);
        }}
        onRequestDeliver={setDeliverConfirmOrder}
        onRowClick={(order) => {
          setPreviewOrder(order);
          setPreviewOpen(true);
        }}
        getOrderId={getOrderId}
        getOrderStatus={getOrderStatus}
        statusChipColor={statusChipColor}
        orderHasShippingInvoice={orderHasShippingInvoice}
        uploadingId={uploadingId}
        deliveringId={deliveringId}
        deliverConfirmOrder={deliverConfirmOrder}
        setDeliverConfirmOrder={setDeliverConfirmOrder}
        onConfirmDeliver={handleConfirmDeliver}
        logoutConfirmDialog={logoutConfirmDialog}
      />

      <OrderCalculatedTableDialog
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewOrder(null);
        }}
        order={previewOrder}
        distributorName={
          previewOrder?.distributorName || previewOrder?.distributorCode || "Distributor"
        }
        getOrderStatus={getOrderStatus}
      />

      <ShippingInvoiceEditDialog
        open={Boolean(invoiceEditOrder)}
        order={invoiceEditOrder}
        orderLabel={
          invoiceEditOrder?.orderNumber
            ? `#${invoiceEditOrder.orderNumber}`
            : invoiceEditOrder
              ? getOrderId(invoiceEditOrder)
              : ""
        }
        busy={uploadingId != null || deliveringId != null}
        onClose={() => setInvoiceEditOrder(null)}
        onSave={async (files) => {
          const order =
            resolveOrderByKey(getOrderId(invoiceEditOrder)) || invoiceEditOrder;
          if (!order) return;
          const orderId = getOrderId(order);
          setUploadingId(orderId);
          try {
            await saveInvoicesOnOrder(order, files, { merge: false });
          } finally {
            setUploadingId(null);
          }
        }}
      />

      <AppSnackbar
        open={toast.open}
        message={toast.message}
        title={toast.title}
        severity={toast.severity}
        duration={toast.duration}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </>
  );
}

export default ShippingDashboard;
