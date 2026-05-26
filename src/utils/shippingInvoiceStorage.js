/** @typedef {{ data: string, fileName: string, mimeType: string }} ShippingInvoiceFile */

export const SHIPPING_INVOICE_BUNDLE_MIME = "application/vnd.coke.shipping-invoices+json";
export const MAX_SHIPPING_INVOICE_FILES = 10;

const BUNDLE_VERSION = 1;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeInvoiceItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw.data ?? raw.shipping_invoice_data;
  if (!isNonEmptyString(data)) return null;
  return {
    data: String(data).trim(),
    fileName: String(raw.fileName ?? raw.file_name ?? raw.shipping_invoice_file_name ?? "invoice").trim(),
    mimeType: String(raw.mimeType ?? raw.mime_type ?? raw.shipping_invoice_mime_type ?? "application/octet-stream").trim(),
  };
}

function tryParseBundle(dataStr) {
  if (!isNonEmptyString(dataStr) || !dataStr.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(dataStr);
    if (!parsed || typeof parsed !== "object") return null;
    const list = Array.isArray(parsed.files)
      ? parsed.files
      : Array.isArray(parsed.items)
        ? parsed.items
        : null;
    if (!list) return null;
    const files = list.map(normalizeInvoiceItem).filter(Boolean);
    return files.length > 0 ? files : null;
  } catch {
    return null;
  }
}

/**
 * All invoice attachments on an order row (supports legacy single-file columns).
 * @param {object|null|undefined} order
 * @returns {ShippingInvoiceFile[]}
 */
export function getOrderShippingInvoices(order) {
  if (!order || typeof order !== "object") return [];

  const data = order.shippingInvoiceData ?? order.shipping_invoice_data;
  if (data == null) return [];

  if (typeof data === "string") {
    const bundle = tryParseBundle(data);
    if (bundle) return bundle;
    if (!isNonEmptyString(data)) return [];
    return [
      {
        data: data.trim(),
        fileName:
          order.shippingInvoiceFileName ??
          order.shipping_invoice_file_name ??
          "invoice",
        mimeType:
          order.shippingInvoiceMimeType ??
          order.shipping_invoice_mime_type ??
          "application/octet-stream",
      },
    ];
  }

  if (Array.isArray(data)) {
    return data.map(normalizeInvoiceItem).filter(Boolean);
  }

  return [];
}

/** First invoice (legacy callers). */
export function getOrderShippingInvoiceFirst(order) {
  const list = getOrderShippingInvoices(order);
  return list.length > 0 ? list[0] : null;
}

export function orderHasShippingInvoices(order) {
  return getOrderShippingInvoices(order).length > 0;
}

/**
 * @param {ShippingInvoiceFile[]} files
 * @returns {{ data: string, fileName: string, mimeType: string }}
 */
export function serializeShippingInvoicesForStorage(files) {
  const items = (Array.isArray(files) ? files : [])
    .map(normalizeInvoiceItem)
    .filter(Boolean)
    .slice(0, MAX_SHIPPING_INVOICE_FILES);

  if (items.length === 0) {
    return { data: "", fileName: "", mimeType: "" };
  }

  if (items.length === 1) {
    return {
      data: items[0].data,
      fileName: items[0].fileName,
      mimeType: items[0].mimeType,
    };
  }

  const names = items.map((f) => f.fileName).filter(Boolean);
  const summary =
    names.length <= 2
      ? names.join(", ")
      : `${names[0]}, ${names[1]} +${names.length - 2} more`;

  return {
    data: JSON.stringify({ v: BUNDLE_VERSION, files: items }),
    fileName: summary.slice(0, 240),
    mimeType: SHIPPING_INVOICE_BUNDLE_MIME,
  };
}

/**
 * Merge new uploads with existing order invoices (dedupe by fileName).
 * @param {object} order
 * @param {ShippingInvoiceFile[]} newFiles
 * @returns {ShippingInvoiceFile[]}
 */
export function mergeShippingInvoices(order, newFiles) {
  const existing = getOrderShippingInvoices(order);
  const incoming = (Array.isArray(newFiles) ? newFiles : []).map(normalizeInvoiceItem).filter(Boolean);
  const seen = new Set(existing.map((f) => f.fileName.toLowerCase()));
  const merged = [...existing];
  for (const f of incoming) {
    const key = f.fileName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
    if (merged.length >= MAX_SHIPPING_INVOICE_FILES) break;
  }
  return merged;
}

/**
 * Patch object for order state / Supabase (snake + camel).
 * @param {ShippingInvoiceFile[]} files
 */
export function buildShippingInvoicePatch(files) {
  const stored = serializeShippingInvoicesForStorage(files);
  return {
    shippingInvoiceData: stored.data,
    shippingInvoiceFileName: stored.fileName,
    shippingInvoiceMimeType: stored.mimeType,
    shipping_invoice_data: stored.data,
    shipping_invoice_file_name: stored.fileName,
    shipping_invoice_mime_type: stored.mimeType,
  };
}

/** Clear all shipping invoice columns on an order row. */
export function buildClearShippingInvoicePatch() {
  return {
    shippingInvoiceData: null,
    shippingInvoiceFileName: null,
    shippingInvoiceMimeType: null,
    shipping_invoice_data: null,
    shipping_invoice_file_name: null,
    shipping_invoice_mime_type: null,
  };
}

/**
 * Remove one file from a list by index (edit dialog).
 * @param {ShippingInvoiceFile[]} files
 * @param {number} index
 */
export function removeShippingInvoiceAtIndex(files, index) {
  const list = Array.isArray(files) ? files : [];
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

/**
 * Append new files to a draft list (dedupe by fileName).
 * @param {ShippingInvoiceFile[]} existing
 * @param {ShippingInvoiceFile[]} incoming
 */
export function appendShippingInvoices(existing, incoming) {
  const base = Array.isArray(existing) ? existing : [];
  const seen = new Set(base.map((f) => f.fileName.toLowerCase()));
  const merged = [...base];
  for (const f of Array.isArray(incoming) ? incoming : []) {
    const item = normalizeInvoiceItem(f);
    if (!item) continue;
    const key = item.fileName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= MAX_SHIPPING_INVOICE_FILES) break;
  }
  return merged;
}
