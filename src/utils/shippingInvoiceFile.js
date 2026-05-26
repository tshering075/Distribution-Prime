const MAX_INVOICE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/pdf",
]);

/**
 * Read invoice file (PNG/JPEG/PDF) as base64 data URL payload.
 * @param {File} file
 * @returns {Promise<{ data: string, fileName: string, mimeType: string }>}
 */
export const MAX_SHIPPING_INVOICE_FILES = 10;

/**
 * @param {FileList|File[]|null|undefined} fileList
 * @returns {Promise<Array<{ data: string, fileName: string, mimeType: string }>>}
 */
export async function readShippingInvoiceFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (files.length === 0) {
    throw new Error("No files selected");
  }
  if (files.length > MAX_SHIPPING_INVOICE_FILES) {
    throw new Error(`You can attach up to ${MAX_SHIPPING_INVOICE_FILES} files at once`);
  }
  const results = [];
  const errors = [];
  for (const file of files) {
    try {
      results.push(await readShippingInvoiceFile(file));
    } catch (e) {
      errors.push(`${file.name}: ${e?.message || e}`);
    }
  }
  if (results.length === 0) {
    throw new Error(errors[0] || "Could not read selected files");
  }
  if (errors.length > 0) {
    const err = new Error(
      `Uploaded ${results.length} of ${files.length} file(s). ${errors.join("; ")}`
    );
    err.partialResults = results;
    throw err;
  }
  return results;
}

export function readShippingInvoiceFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }
    const mime = (file.type || "").toLowerCase();
    const name = file.name || "invoice";
    const ext = name.split(".").pop()?.toLowerCase();
    const extOk =
      ext === "png" || ext === "pdf" || ext === "jpg" || ext === "jpeg";
    if (!ALLOWED_MIME.has(mime) && !extOk) {
      reject(new Error("Only PNG, JPG, or PDF files are allowed"));
      return;
    }
    if (file.size > MAX_INVOICE_BYTES) {
      reject(new Error("File must be 5 MB or smaller"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      resolve({
        data: result,
        fileName: name,
        mimeType: mime || (ext === "pdf" ? "application/pdf" : "image/png"),
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
