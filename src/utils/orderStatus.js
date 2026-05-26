import {
  getOrderShippingInvoices,
  getOrderShippingInvoiceFirst,
  orderHasShippingInvoices,
  buildShippingInvoicePatch,
} from "./shippingInvoiceStorage";

export { getOrderShippingInvoices, buildShippingInvoicePatch };

export const ORDER_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  APPROVED: "approved",
  /** Shipment completed (was previously stored as `dispatched` in some DBs). */
  DELIVERED: "delivered",
  REJECTED: "rejected",
  CANCELED: "canceled",
  PENDING_EMAIL_FAILED: "pending_email_failed",
};

/** Default hours GM has to reply before we treat the order as overdue (admin reminders). */
export const DEFAULT_ORDER_APPROVAL_SLA_HOURS = 48;

const SLA_HOURS_STORAGE_KEY = "order_approval_sla_hours";

/**
 * Configurable SLA (hours). Stored in localStorage; clamped to a sane range.
 * @returns {number}
 */
export function getOrderApprovalSlaHours() {
  try {
    const raw = localStorage.getItem(SLA_HOURS_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 720) return Math.floor(n);
  } catch {
    /* ignore */
  }
  return DEFAULT_ORDER_APPROVAL_SLA_HOURS;
}

/**
 * ISO timestamp for deadline = now + hours.
 * @param {number} hours
 * @returns {string}
 */
export function isoDeadlineFromNowHours(hours) {
  const h = Number(hours);
  const safe = Number.isFinite(h) && h > 0 ? h : DEFAULT_ORDER_APPROVAL_SLA_HOURS;
  return new Date(Date.now() + safe * 3600000).toISOString();
}

/**
 * Parse approval due time from order row (Supabase snake_case or camelCase).
 * @param {object} order
 * @param {number} [slaHoursFallback]
 * @returns {number|null} epoch ms, or null if unknown
 */
export function getOrderApprovalDueMs(order, slaHoursFallback = getOrderApprovalSlaHours()) {
  if (!order || typeof order !== "object") return null;
  const dueRaw = order.approval_due_at ?? order.approvalDueAt;
  if (dueRaw) {
    const t = Date.parse(dueRaw);
    if (!Number.isNaN(t)) return t;
  }
  const sentRaw = order.approval_sent_at ?? order.approvalSentAt;
  if (sentRaw) {
    const t = Date.parse(sentRaw);
    if (!Number.isNaN(t)) return t + Number(slaHoursFallback) * 3600000;
  }
  return null;
}

const TERMINAL_STATUSES = new Set([
  ORDER_STATUS.REJECTED,
  ORDER_STATUS.CANCELED,
  ORDER_STATUS.DELIVERED,
]);

const STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: "Pending",
  [ORDER_STATUS.SENT]: "Sent",
  [ORDER_STATUS.APPROVED]: "Approved",
  [ORDER_STATUS.DELIVERED]: "Delivered",
  [ORDER_STATUS.REJECTED]: "Rejected",
  [ORDER_STATUS.CANCELED]: "Canceled",
  [ORDER_STATUS.PENDING_EMAIL_FAILED]: "Email Failed",
};

export function normalizeOrderStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return ORDER_STATUS.PENDING;
  // Legacy rows from earlier shipping workflow
  if (normalized === "dispatched") return ORDER_STATUS.DELIVERED;
  return Object.values(ORDER_STATUS).includes(normalized)
    ? normalized
    : ORDER_STATUS.PENDING;
}

export function getOrderStatusLabel(status) {
  const normalized = normalizeOrderStatus(status);
  return STATUS_LABELS[normalized] || "Pending";
}

/** Statuses shown on the shipping dashboard (includes new distributor orders before GM approval). */
const SHIPPING_DASHBOARD_VISIBLE_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.SENT,
  ORDER_STATUS.PENDING_EMAIL_FAILED,
  ORDER_STATUS.APPROVED,
  ORDER_STATUS.DELIVERED,
]);

export function isOrderVisibleOnShippingDashboard(status) {
  return SHIPPING_DASHBOARD_VISIBLE_STATUSES.has(normalizeOrderStatus(status));
}

export function isOrderAwaitingApprovalOnShipping(status) {
  const s = normalizeOrderStatus(status);
  return (
    s === ORDER_STATUS.PENDING ||
    s === ORDER_STATUS.SENT ||
    s === ORDER_STATUS.PENDING_EMAIL_FAILED
  );
}

/**
 * Status for UI: prefer `order.status` on the row (Supabase / coke_orders),
 * then optional cache map (legacy local overlay).
 * @param {object|null|undefined} order
 * @param {Record<string, string>} [statusByKey]
 * @param {string|null} [orderIdHint] - e.g. from getOrderId(order)
 */
export function resolveOrderStatus(order, statusByKey = {}, orderIdHint = null) {
  const rowRaw = order?.status;
  if (rowRaw != null && String(rowRaw).trim() !== "") {
    return normalizeOrderStatus(rowRaw);
  }
  if (orderIdHint && statusByKey[orderIdHint] != null) {
    return normalizeOrderStatus(statusByKey[orderIdHint]);
  }
  return ORDER_STATUS.PENDING;
}

/** Build orderId → status map from order rows (for admin localStorage sync). */
export function buildOrderStatusMapFromOrders(orders, getOrderId) {
  const map = {};
  if (!Array.isArray(orders) || typeof getOrderId !== "function") return map;
  orders.forEach((order) => {
    const id = getOrderId(order);
    if (!id) return;
    const rowRaw = order?.status;
    if (rowRaw != null && String(rowRaw).trim() !== "") {
      map[id] = normalizeOrderStatus(rowRaw);
    }
  });
  return map;
}

export function canTransitionOrderStatus(currentStatus, nextStatus) {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);

  if (current === next) return true;
  if (TERMINAL_STATUSES.has(current)) return false;

  if (current === ORDER_STATUS.PENDING) {
    return (
      next === ORDER_STATUS.SENT ||
      next === ORDER_STATUS.APPROVED ||
      next === ORDER_STATUS.REJECTED ||
      next === ORDER_STATUS.CANCELED ||
      next === ORDER_STATUS.PENDING_EMAIL_FAILED
    );
  }

  if (current === ORDER_STATUS.PENDING_EMAIL_FAILED) {
    return (
      next === ORDER_STATUS.SENT ||
      next === ORDER_STATUS.APPROVED ||
      next === ORDER_STATUS.REJECTED ||
      next === ORDER_STATUS.CANCELED
    );
  }

  if (current === ORDER_STATUS.SENT) {
    return (
      next === ORDER_STATUS.APPROVED ||
      next === ORDER_STATUS.REJECTED ||
      next === ORDER_STATUS.CANCELED
    );
  }

  if (current === ORDER_STATUS.APPROVED) {
    return next === ORDER_STATUS.DELIVERED;
  }

  return false;
}

/** Invoice attachment on order (first file; use getOrderShippingInvoices for all). */
export function getOrderShippingInvoice(order) {
  return getOrderShippingInvoiceFirst(order);
}

export function orderHasShippingInvoice(order) {
  return orderHasShippingInvoices(order);
}

/**
 * When GET/realtime omits large invoice TEXT columns, keep invoice fields from prior client state.
 * @param {Array} prev
 * @param {Array} next
 * @param {(order: object) => string} getOrderId
 */
export function mergeOrdersPreservingInvoices(prev, next, getOrderId) {
  if (!Array.isArray(next)) return Array.isArray(prev) ? [...prev] : [];
  if (!Array.isArray(prev) || prev.length === 0) return [...next];

  const keyOf = (o) => {
    if (!o || typeof getOrderId !== "function") return "";
    return String(getOrderId(o) || "");
  };

  const mergedNext = next.map((o) => {
    if (orderHasShippingInvoice(o)) return o;
    const old =
      (o?.id != null && prev.find((p) => p?.id != null && String(p.id) === String(o.id))) ||
      prev.find((p) => {
        const pk = keyOf(p);
        return pk && pk === keyOf(o);
      });
    if (!old || !orderHasShippingInvoice(old)) return o;
    return { ...o, ...buildShippingInvoicePatch(getOrderShippingInvoices(old)) };
  });

  const nextKeys = new Set(mergedNext.map((o) => keyOf(o)).filter(Boolean));
  const prevOnly = prev.filter((p) => {
    const k = keyOf(p);
    return k && !nextKeys.has(k);
  });

  // Keep client-only rows (e.g. just placed) ahead of server list
  return [...prevOnly, ...mergedNext];
}

/** Whether two order rows refer to the same order (localStorage / delete). */
export function orderIdentityMatches(a, b, getOrderKey, distributorCode = "") {
  if (!a || !b) return false;
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true;
  if (typeof getOrderKey === "function" && getOrderKey(a) === getOrderKey(b)) return true;
  const codeA = String(a.distributorCode || distributorCode || "").trim();
  const codeB = String(b.distributorCode || distributorCode || "").trim();
  if (
    a.orderNumber != null &&
    b.orderNumber != null &&
    String(a.orderNumber).trim() !== "" &&
    String(a.orderNumber) === String(b.orderNumber) &&
    codeA === codeB
  ) {
    return true;
  }
  return false;
}

/** Remove one order from shared coke_orders localStorage (all distributors). */
export function removeOrderFromCokeOrdersLocalStorage(order, { distributorCode, getOrderKey }) {
  if (!order || typeof getOrderKey !== "function") return;
  try {
    const stored = localStorage.getItem("coke_orders");
    if (!stored) return;
    const allOrders = JSON.parse(stored);
    if (!Array.isArray(allOrders)) return;
    const filtered = allOrders.filter(
      (o) => !orderIdentityMatches(o, order, getOrderKey, distributorCode)
    );
    localStorage.setItem("coke_orders", JSON.stringify(filtered));
  } catch (e) {
    console.warn("Could not remove order from coke_orders localStorage:", e);
  }
}

/** Merge invoice + status patch into coke_orders localStorage (distributor browser sync). */
export function upsertOrderInCokeOrdersLocalStorage(order, patch, getOrderId) {
  if (!order || typeof getOrderId !== "function") return;
  try {
    const stored = localStorage.getItem("coke_orders");
    const all = stored ? JSON.parse(stored) : [];
    const orderId = getOrderId(order);
    const idx = all.findIndex(
      (o) =>
        (order.id != null && o?.id != null && String(o.id) === String(order.id)) ||
        getOrderId(o) === orderId
    );
    const merged = { ...(idx >= 0 ? all[idx] : order), ...order, ...patch };
    if (idx >= 0) all[idx] = merged;
    else all.push(merged);
    localStorage.setItem("coke_orders", JSON.stringify(all));
  } catch (e) {
    console.warn("Could not update coke_orders localStorage:", e);
  }
}

export function appendOrderStatusHistory(order, nextStatus, meta = {}) {
  const current = normalizeOrderStatus(order?.status);
  const next = normalizeOrderStatus(nextStatus);
  const history = Array.isArray(order?.statusHistory) ? [...order.statusHistory] : [];
  history.push({
    from: current,
    to: next,
    at: new Date().toISOString(),
    source: meta.source || "manual",
    actor: meta.actor || "",
    note: meta.note || "",
  });
  return history;
}
