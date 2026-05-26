/**
 * View / download shipping invoice attachments (data URL from Supabase or localStorage).
 */

function guessMimeFromFileName(fileName) {
  const ext = String(fileName || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

/** Ensure payload is a valid data URL (some DB rows store raw base64 only). */
export function normalizeInvoiceDataUrl(data, mimeType, fileName) {
  if (data == null) return null;
  const s = String(data).trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  const mime = (mimeType || guessMimeFromFileName(fileName)).split(";")[0].trim();
  const b64 = s.replace(/\s/g, "");
  return `data:${mime};base64,${b64}`;
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1).replace(/\s/g, "");
  const mimeMatch = /^data:([^;,]+)/i.exec(header);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const isBase64 = /;base64/i.test(header);

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  try {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return new Blob([payload], { type: mime });
  }
}

export function invoiceIsPdf(invoice) {
  const mime = (invoice?.mimeType || "").toLowerCase();
  const name = String(invoice?.fileName || "").toLowerCase();
  if (mime.includes("vnd.coke.shipping-invoices")) return false;
  return mime.includes("pdf") || name.endsWith(".pdf");
}

/**
 * Blob URLs render PDFs/images reliably in iframes and new tabs (long data: URLs often show blank).
 * @returns {{ url: string|null, revoke: () => void }}
 */
export function createInvoicePreviewUrl(invoice) {
  const dataUrl = normalizeInvoiceDataUrl(
    invoice?.data,
    invoice?.mimeType,
    invoice?.fileName
  );
  if (!dataUrl) return { url: null, revoke: () => {} };

  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return { url: dataUrl, revoke: () => {} };
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => URL.revokeObjectURL(url),
    };
  } catch {
    return { url: dataUrl, revoke: () => {} };
  }
}

export function openShippingInvoice(invoice) {
  const { url } = createInvoicePreviewUrl(invoice);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function downloadShippingInvoice(invoice) {
  const href = normalizeInvoiceDataUrl(
    invoice?.data,
    invoice?.mimeType,
    invoice?.fileName
  );
  if (!href) return;
  const link = document.createElement("a");
  link.href = href;
  link.download = invoice.fileName || "shipping-invoice";
  if (invoice.mimeType) link.type = invoice.mimeType;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Download each invoice file (staggered so the browser allows multiple saves). */
export function downloadAllShippingInvoices(invoices) {
  const list = Array.isArray(invoices) ? invoices.filter((inv) => inv?.data) : [];
  if (list.length === 0) return 0;
  list.forEach((inv, index) => {
    window.setTimeout(() => downloadShippingInvoice(inv), index * 450);
  });
  return list.length;
}
