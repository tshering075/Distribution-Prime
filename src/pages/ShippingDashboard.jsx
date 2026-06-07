import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppSnackbar from "../components/AppSnackbar";
import ShippingInvoiceEditDialog from "../components/ShippingInvoiceEditDialog";
import { useLogoutConfirmation } from "../components/LogoutConfirmDialog";
import OrderCalculatedTableDialog from "../components/OrderCalculatedTableDialog";
import ShippingDashboardView from "./ShippingDashboard/ShippingDashboardView";
import {
  getShippingOrders,
  subscribeToAllOrders,
  updateOrderStatus as updateOrderStatusInSupabase,
  buildDeliveredOrderStatusExtras,
  patchOrderFields,
  patchOrderShippingInvoice,
  clearOrderShippingInvoice,
  fetchOrderShippingInvoice,
  getActiveSchemesForDistributor,
  getDistributorByCode,
  getCurrentUser,
  getAdminByUid,
  supabase,
} from "../services/supabaseService";
import { readProductRatesFromLocalStorage } from "../utils/productRatesStorage";
import { getDistributors } from "../utils/distributorAuth";
import { readOrdersCache, writeOrdersCache, ordersCacheStorageKey } from "../utils/ordersLocalStorage";
import { applyDeliveredOrderAchievement, getOrderAchievementTotals } from "../services/deliveredOrderAchievement";
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
import {
  buildTransportPatch,
  getOrderTransport,
  isOrderTransportComplete,
  transportValidationMessage,
} from "../constants/shippingTransport";
import { generateShippingInvoiceFile } from "../utils/shippingOrderInvoicePrint";
import { useBrand } from "../hooks/useBrand";
import { getActiveOrganizationId, getWorkspaceLoginPath } from "../services/tenantScope";
import { loadOrganizationContext } from "../services/organizationService";

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
    writeOrdersCache(orders);
  } catch (e) {
    console.warn("Could not persist orders to localStorage:", e);
  }
}

function mergeOrderPatch(orders, orderId, patch) {
  return orders.map((o) => (getOrderId(o) === orderId ? { ...o, ...patch } : o));
}

function ShippingDashboard({ onLogout }) {
  const navigate = useNavigate();
  const { requestLogout, logoutConfirmDialog } = useLogoutConfirmation(onLogout);
  const brand = useBrand();
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
  const [previewSchemes, setPreviewSchemes] = useState([]);
  const [previewDistributor, setPreviewDistributor] = useState(null);
  const [productRates, setProductRates] = useState(null);
  const [savingPreview, setSavingPreview] = useState(false);
  const [previewDispatchPhase, setPreviewDispatchPhase] = useState(false);
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
  const transportSaveTimerRef = useRef(null);
  const [transportError, setTransportError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [currentUser, setCurrentUser] = useState({ name: "Shipping", email: "", role: "shipping" });
  const shippingActorRef = useRef({ name: "Shipping", email: "", role: "shipping" });
  const [workspaceReady, setWorkspaceReady] = useState(() => Boolean(getActiveOrganizationId()));
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
          const preferredOrg = getActiveOrganizationId();
          const admin = await getAdminByUid(user.id, preferredOrg || undefined);
          name = admin?.name || user.user_metadata?.name || email.split("@")[0] || "Shipping";
          role = admin?.role || role;
          if (admin?.organization_id) {
            await loadOrganizationContext(admin.organization_id);
            if (!cancelled) setWorkspaceReady(true);
          } else if (!getActiveOrganizationId() && !cancelled) {
            navigate(getWorkspaceLoginPath(), { replace: true });
          }
        } else if (!cancelled && getActiveOrganizationId()) {
          setWorkspaceReady(true);
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
  }, [navigate]);

  useEffect(() => {
    setProductRates(readProductRatesFromLocalStorage());
  }, []);

  useEffect(() => {
    if (!previewOpen || !previewOrder?.distributorCode) {
      setPreviewSchemes([]);
      return;
    }
    let cancelled = false;
    const code = previewOrder.distributorCode;
    (async () => {
      try {
        if (isSupabaseConfigured) {
          const schemes = await getActiveSchemesForDistributor(code);
          if (!cancelled) setPreviewSchemes(schemes || []);
          return;
        }
        const stored = localStorage.getItem("schemes");
        if (!stored) {
          if (!cancelled) setPreviewSchemes([]);
          return;
        }
        const allSchemes = JSON.parse(stored);
        const now = new Date();
        const active = (Array.isArray(allSchemes) ? allSchemes : []).filter((scheme) => {
          const startDate = new Date(scheme.startDate);
          const endDate = new Date(scheme.endDate);
          return startDate <= now && endDate >= now && scheme.distributors?.includes(code);
        });
        if (!cancelled) setPreviewSchemes(active);
      } catch (e) {
        console.warn("Could not load schemes for order preview:", e);
        if (!cancelled) setPreviewSchemes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewOpen, previewOrder?.distributorCode]);

  useEffect(() => {
    if (!previewOpen || !previewOrder?.distributorCode) {
      setPreviewDistributor(null);
      return;
    }
    let cancelled = false;
    const code = String(previewOrder.distributorCode).trim();
    (async () => {
      try {
        let dist = null;
        if (isSupabaseConfigured) {
          dist = await getDistributorByCode(code);
        }
        if (!dist) {
          dist = getDistributors().find((d) => String(d?.code ?? "").trim() === code) || null;
        }
        if (!cancelled) setPreviewDistributor(dist || null);
      } catch (e) {
        console.warn("Could not load distributor for invoice print:", e);
        if (!cancelled) setPreviewDistributor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [previewOpen, previewOrder?.distributorCode]);

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
        const msg = `Order ${id} approved — upload invoice and dispatch when ready.`;
        pushNotification(msg, "success", "Ready to ship", "approved");
        showToast(msg, "success", "Order approved", 6000);
        void postShippingBrowserNotification("Order approved", msg, "coke-shipping-approved");
      }
    });

    previousOrderStatusesRef.current = next;
  }, [orders, pushNotification, showToast]);

  const loadOrders = useCallback(async () => {
    if (invoiceSaveLockRef.current > 0) return;
    if (isSupabaseConfigured && !getActiveOrganizationId()) {
      setLoading(false);
      return;
    }
    try {
      if (isSupabaseConfigured) {
        const remote = await getShippingOrders();
        setOrders((prev) => mergeOrdersPreservingInvoices(prev, remote || [], getOrderId));
      } else {
        setOrders(readOrdersCache());
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
    if (!workspaceReady && isSupabaseConfigured) return;
    loadOrders();
  }, [loadOrders, workspaceReady]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const onStorage = (e) => {
        if (e.key === ordersCacheStorageKey()) loadOrders();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    if (!workspaceReady) return undefined;

    const orgId = getActiveOrganizationId();
    const unsub = subscribeToAllOrders(
      (next) => {
        if (invoiceSaveLockRef.current > 0) return;
        setOrders((prev) => mergeOrdersPreservingInvoices(prev, next || [], getOrderId));
        setLastRefreshedAt(new Date());
      },
      { organizationId: orgId, fetchOrders: getShippingOrders }
    );
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadOrders();
    }, 5000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [loadOrders, workspaceReady]);

  const saveInvoicesOnOrder = useCallback(async (order, newInvoices, { merge = true } = {}) => {
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
          "Invoice files removed. Upload the correct files before dispatching.",
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
            ? "Invoice saved. Click Dispatch when the shipment goes out."
            : `${count} invoice files saved. Click Dispatch when ready.`,
          "success",
          "Invoices uploaded"
        );
      }
      return mergedOrder;
    } finally {
      invoiceSaveLockRef.current = Math.max(0, invoiceSaveLockRef.current - 1);
    }
  }, [orderIdentityFallback, showToast, pushNotification]);

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
        : `Added ${fileList.length} files — tap "Save & dispatch" when ready`,
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

  const handleDeliver = useCallback(async (order) => {
    const orderId = getOrderId(order);
    const current = getOrderStatus(order);
    if (current !== ORDER_STATUS.APPROVED) {
      showToast("Only approved orders can be marked dispatched", "warning", "Shipping");
      return;
    }
    if (!orderHasShippingInvoice(order)) {
      showToast("Upload an invoice before marking dispatched", "warning", "Shipping");
      return;
    }
    if (!isOrderTransportComplete(order)) {
      showToast(transportValidationMessage(order), "warning", "Transport required");
      return;
    }
    if (!canTransitionOrderStatus(current, ORDER_STATUS.DELIVERED)) {
      showToast("Cannot mark this order dispatched", "warning", "Shipping");
      return;
    }

    setDeliveringId(orderId);
    const deliveredAt = new Date().toISOString();
    const transportPatch = buildTransportPatch(getOrderTransport(order));
    const history = appendOrderStatusHistory(order, ORDER_STATUS.DELIVERED, {
      source: "shipping_dashboard",
      actor: "shipping",
      ...transportPatch,
    });
    const patch = {
      status: ORDER_STATUS.DELIVERED,
      statusUpdatedAt: deliveredAt,
      deliveredAt,
      delivered_at: deliveredAt,
      dispatchedAt: deliveredAt,
      dispatched_at: deliveredAt,
      statusHistory: history,
      ...transportPatch,
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
            "Cannot mark dispatched: order is not linked to the database. Refresh the page and try again."
          );
        }
        const achievementTotals = getOrderAchievementTotals(order);
        const orderLinePatch = buildDeliveredOrderStatusExtras(order, {
          deliveredAt,
          statusHistory: history,
          achievementTotals,
        });
        await updateOrderStatusInSupabase(
          order.id ?? null,
          ORDER_STATUS.DELIVERED,
          orderLinePatch,
          identityFallback
        );
      } else {
        const cached = readOrdersCache();
        if (cached.length > 0) {
          persistOrdersToLocalStorage(mergeOrderPatch(cached, orderId, patch));
        }
      }

      const deliveredOrder = { ...order, ...patch };
      upsertOrderInCokeOrdersLocalStorage(deliveredOrder, patch, getOrderId);

      try {
        const achievementResult = await applyDeliveredOrderAchievement(
          deliveredOrder,
          identityFallback
        );
        if (achievementResult.applied) {
          const achievementPatch = {
            achievementApplied: true,
            achievement_applied: true,
          };
          setOrders((prev) => mergeOrderPatch(prev, orderId, achievementPatch));
          upsertOrderInCokeOrdersLocalStorage(deliveredOrder, achievementPatch, getOrderId);
        } else if (achievementResult.skipped && achievementResult.reason === "zero_totals") {
          showToast(
            "Order dispatched, but it has no CSD/Water quantities to record as sales. Add line items on the order.",
            "warning",
            "Sales data",
            8000
          );
        }
      } catch (achievementError) {
        console.error("Delivered but sales/achievement save failed:", achievementError);
        showToast(
          achievementError?.message ||
            "Order dispatched, but sales data could not be saved to Supabase. Contact admin.",
          "warning",
          "Sales data",
          8000
        );
      }

      logShippingActivity(
        ACTIVITY_TYPES.ORDER_DELIVERED,
        `Order dispatched: ${orderId} (${order.distributorName || order.distributorCode || ""})`,
        {
          orderId,
          distributorCode: order.distributorCode,
          distributorName: order.distributorName,
          status: ORDER_STATUS.DELIVERED,
        }
      );

      const deliveredMsg = `Order ${orderId} marked dispatched.`;
      pushNotification(deliveredMsg, "success", "Dispatched", "delivered");
      showToast(
        `Order ${orderId} dispatched. Sales recorded in Supabase; admin and distributor dashboards will update.`,
        "success",
        "Dispatched",
        6000
      );
      void postShippingBrowserNotification("Order dispatched", deliveredMsg, "coke-shipping-delivered");
      setStatusTab("delivered");
    } catch (e) {
      console.error(e);
      showToast(e.message || "Could not mark dispatched", "error", "Shipping");
      await loadOrders();
    } finally {
      setDeliveringId(null);
      setDeliverConfirmOrder(null);
    }
  }, [orderIdentityFallback, showToast, pushNotification, loadOrders]);

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

  const previewEditable = useMemo(() => {
    if (!previewOrder) return false;
    return getOrderStatus(previewOrder) !== ORDER_STATUS.DELIVERED;
  }, [previewOrder]);

  const previewNeedsTransport = useMemo(() => {
    if (!previewOrder) return false;
    return getOrderStatus(previewOrder) === ORDER_STATUS.APPROVED;
  }, [previewOrder]);

  const persistOrderTransport = useCallback(
    async (order, transport) => {
      const transportPatch = buildTransportPatch(transport ?? getOrderTransport(order));
      const orderKey = getOrderId(order);
      const merged = { ...order, ...transportPatch };

      if (transportSaveTimerRef.current) {
        clearTimeout(transportSaveTimerRef.current);
        transportSaveTimerRef.current = null;
      }

      setPreviewOrder((prev) =>
        prev && getOrderId(prev) === orderKey ? { ...prev, ...transportPatch } : prev
      );
      setOrders((prev) => {
        const next = mergeOrderPatch(prev, orderKey, transportPatch);
        ordersRef.current = next;
        if (!isSupabaseConfigured) persistOrdersToLocalStorage(next);
        return next;
      });
      setDeliverConfirmOrder((prev) =>
        prev && getOrderId(prev) === orderKey ? { ...prev, ...transportPatch } : prev
      );

      if (isSupabaseConfigured) {
        await patchOrderFields(
          order.id ?? null,
          {
            transporter_vehicle: transportPatch.transporterVehicle,
            vehicle_type: transportPatch.vehicleType,
            vehicle_no: transportPatch.vehicleNo,
            transportation_charges: transportPatch.transportationCharges,
          },
          orderIdentityFallback(order)
        );
      } else {
        upsertOrderInCokeOrdersLocalStorage(merged, transportPatch, getOrderId);
      }

      return merged;
    },
    [orderIdentityFallback]
  );

  const handlePreviewTransportChange = useCallback(
    (nextTransport) => {
      if (!previewOrder) return;
      const patch = buildTransportPatch(nextTransport);
      const orderKey = getOrderId(previewOrder);
      setTransportError("");
      setPreviewOrder((prev) => (prev ? { ...prev, ...patch } : null));
      setOrders((prev) => {
        const next = mergeOrderPatch(prev, orderKey, patch);
        ordersRef.current = next;
        if (!isSupabaseConfigured) persistOrdersToLocalStorage(next);
        return next;
      });
      setDeliverConfirmOrder((prev) =>
        prev && getOrderId(prev) === orderKey ? { ...prev, ...patch } : prev
      );

      if (transportSaveTimerRef.current) clearTimeout(transportSaveTimerRef.current);
      transportSaveTimerRef.current = setTimeout(async () => {
        const order =
          ordersRef.current.find((o) => getOrderId(o) === orderKey) || { ...previewOrder, ...patch };
        try {
          await persistOrderTransport(order, nextTransport);
        } catch (e) {
          console.warn("Could not save transport details:", e);
        }
      }, 600);
    },
    [previewOrder, persistOrderTransport]
  );

  const handleSavePreviewAdjustments = useCallback(
    async (linePatch) => {
      if (!previewOrder) return;
      const orderKey = getOrderId(previewOrder);
      const patch = {
        data: linePatch.data,
        csdUC: linePatch.csdUC,
        waterUC: linePatch.waterUC,
        csdPC: linePatch.csdPC,
        waterPC: linePatch.waterPC,
        totalUC: linePatch.totalUC,
        totaluc: linePatch.totalUC,
      };
      setSavingPreview(true);
      try {
        const merged = { ...previewOrder, ...patch };
        setOrders((prev) => {
          const next = mergeOrderPatch(prev, orderKey, patch);
          ordersRef.current = next;
          if (!isSupabaseConfigured) persistOrdersToLocalStorage(next);
          return next;
        });
        setPreviewOrder(merged);

        if (isSupabaseConfigured) {
          const identityFallback = orderIdentityFallback(previewOrder);
          if (!previewOrder.id && !identityFallback) {
            throw new Error(
              "Cannot save: order is not linked to the database. Refresh and try again."
            );
          }
          const updated = await patchOrderFields(
            previewOrder.id ?? null,
            patch,
            identityFallback
          );
          if (updated) {
            setPreviewOrder((p) => {
              if (!p) return p;
              const keepTransport = buildTransportPatch(getOrderTransport(p));
              return { ...p, ...updated, ...patch, ...keepTransport };
            });
            setOrders((prev) => {
              const next = mergeOrderPatch(prev, orderKey, { ...updated, ...patch });
              const idx = next.findIndex((o) => getOrderId(o) === orderKey);
              if (idx >= 0) {
                const keepTransport = buildTransportPatch(getOrderTransport(next[idx]));
                next[idx] = { ...next[idx], ...keepTransport };
              }
              ordersRef.current = next;
              return next;
            });
          }
        } else {
          upsertOrderInCokeOrdersLocalStorage(previewOrder, patch, getOrderId);
        }

        showToast("Order adjustments saved.", "success", "Saved");
      } catch (e) {
        console.error(e);
        showToast(e.message || "Could not save order adjustments", "error", "Shipping");
        throw e;
      } finally {
        setSavingPreview(false);
      }
    },
    [previewOrder, orderIdentityFallback, showToast]
  );

  const handleSaveAndDispatchFlow = useCallback(
    async ({ payload, transport, headerDate, orderNo, gstRate }) => {
      if (!previewOrder) return;
      const orderKey = getOrderId(previewOrder);
      let merged =
        ordersRef.current.find((o) => getOrderId(o) === orderKey) || previewOrder;
      merged = await persistOrderTransport(merged, transport);
      merged = {
        ...merged,
        data: payload.data,
        csdUC: payload.csdUC,
        waterUC: payload.waterUC,
        csdPC: payload.csdPC,
        waterPC: payload.waterPC,
        totalUC: payload.totalUC,
        totaluc: payload.totalUC,
      };

      setSavingPreview(true);
      try {
        const invoiceFile = await generateShippingInvoiceFile({
          order: merged,
          distributor: previewDistributor,
          distributorName:
            merged.distributorName || merged.distributorCode || "Distributor",
          companyName: brand.companyName,
          organizationAddress: brand.address,
          organizationPostNo: brand.postNo,
          organizationGstNo: brand.gstNo,
          transport,
          lines: payload.data,
          headerDate,
          orderNo,
          gstRate,
        });
        const withInvoice = await saveInvoicesOnOrder(merged, [invoiceFile], { merge: true });
        const readyToDispatch = {
          ...merged,
          ...withInvoice,
          ...buildTransportPatch(getOrderTransport(merged)),
        };
        setPreviewOrder(readyToDispatch);
        setOrders((prev) => {
          const next = mergeOrderPatch(prev, orderKey, readyToDispatch);
          ordersRef.current = next;
          if (!isSupabaseConfigured) persistOrdersToLocalStorage(next);
          return next;
        });
        upsertOrderInCokeOrdersLocalStorage(readyToDispatch, readyToDispatch, getOrderId);
        setPreviewDispatchPhase(true);
        showToast(
          "Order saved and invoice uploaded. Review and mark dispatched.",
          "success",
          "Ready to dispatch",
          6000
        );
      } catch (e) {
        console.error(e);
        showToast(
          e.message || "Could not generate or upload the invoice",
          "error",
          "Dispatch"
        );
        throw e;
      } finally {
        setSavingPreview(false);
      }
    },
    [
      previewOrder,
      previewDistributor,
      showToast,
      persistOrderTransport,
      brand.address,
      brand.companyName,
      brand.gstNo,
      brand.postNo,
      saveInvoicesOnOrder,
    ]
  );

  const handleMarkDispatchedFromPreview = useCallback(
    async ({ transport } = {}) => {
    if (!previewOrder) return;
    const orderKey = getOrderId(previewOrder);
    let order =
      ordersRef.current.find((o) => getOrderId(o) === orderKey) || previewOrder;
    if (previewOrder && getOrderId(previewOrder) === orderKey) {
      order = { ...previewOrder, ...order };
    }
    try {
      order = await persistOrderTransport(
        order,
        transport ?? getOrderTransport(previewOrder)
      );
    } catch (e) {
      showToast(
        e.message || "Could not save transport details before dispatch",
        "error",
        "Transport"
      );
      return;
    }

    if (!orderHasShippingInvoice(order)) {
      showToast("Upload an invoice before marking dispatched", "warning", "Dispatch");
      return;
    }
    if (!isOrderTransportComplete(order)) {
      const msg = transportValidationMessage(order);
      setTransportError(msg);
      showToast(msg, "warning", "Transport required");
      return;
    }
    setTransportError("");

    try {
      await handleDeliver(order);
      setPreviewDispatchPhase(false);
      setPreviewOpen(false);
      setPreviewOrder(null);
      setPreviewSchemes([]);
      setPreviewDistributor(null);
    } catch (e) {
      showToast(e.message || "Could not mark order dispatched", "error", "Shipping");
    }
  },
    [previewOrder, showToast, persistOrderTransport, handleDeliver]
  );

  const handleConfirmDeliver = async () => {
    let order = deliverConfirmOrder
      ? resolveOrderByKey(getOrderId(deliverConfirmOrder)) || deliverConfirmOrder
      : null;
    if (!order) return;
    const orderId = getOrderId(order);
    if (previewOpen && previewOrder && getOrderId(previewOrder) === orderId) {
      order = { ...order, ...buildTransportPatch(getOrderTransport(previewOrder)) };
    }
    const hasExisting = orderHasShippingInvoice(order);
    const hasPending = deliverPendingFiles.length > 0;

    if (!hasExisting && !hasPending) {
      showToast("Select at least one invoice file (PNG, JPG, or PDF)", "warning", "Dispatch");
      return;
    }

    if (!isOrderTransportComplete(order)) {
      const msg = transportValidationMessage(order);
      setTransportError(msg);
      showToast(msg, "warning", "Transport required");
      return;
    }
    setTransportError("");

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
      showToast(e.message || "Could not complete dispatch", "error", "Shipping");
    } finally {
      setUploadingId(null);
    }
  };

  useEffect(() => {
    if (!deliverConfirmOrder) setDeliverPendingFiles([]);
  }, [deliverConfirmOrder]);

  useEffect(() => {
    return () => {
      if (transportSaveTimerRef.current) clearTimeout(transportSaveTimerRef.current);
    };
  }, []);

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
          const fresh = resolveOrderByKey(getOrderId(order)) || order;
          setPreviewOrder(fresh);
          setPreviewDispatchPhase(false);
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
          if (savingPreview || deliveringId != null) return;
          setPreviewOpen(false);
          setPreviewDispatchPhase(false);
          setPreviewOrder(null);
          setPreviewSchemes([]);
          setPreviewDistributor(null);
          setTransportError("");
        }}
        order={previewOrder}
        distributorName={
          previewOrder?.distributorName || previewOrder?.distributorCode || "Distributor"
        }
        getOrderStatus={getOrderStatus}
        fullScreen
        condensed
        editable={previewEditable && !previewDispatchPhase}
        productRates={productRates}
        schemes={previewSchemes}
        onSave={previewEditable && !previewDispatchPhase ? handleSavePreviewAdjustments : undefined}
        saving={savingPreview}
        saveAndDispatch={previewEditable && !previewDispatchPhase}
        onSaveAndDispatch={previewEditable && !previewDispatchPhase ? handleSaveAndDispatchFlow : undefined}
        dispatchPhase={previewDispatchPhase}
        onMarkDispatched={
          previewDispatchPhase ? handleMarkDispatchedFromPreview : undefined
        }
        markingDispatched={
          previewOrder != null && deliveringId === getOrderId(previewOrder)
        }
        distributorDetails={previewDistributor}
        showTransportFields={
          previewNeedsTransport ||
          (previewOrder && getOrderStatus(previewOrder) === ORDER_STATUS.DELIVERED)
        }
        transport={previewOrder ? getOrderTransport(previewOrder) : undefined}
        onTransportChange={
          previewNeedsTransport && !previewDispatchPhase
            ? handlePreviewTransportChange
            : undefined
        }
        transportError={transportError}
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
