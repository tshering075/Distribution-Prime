import * as XLSX from "xlsx";

function normCell(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
}

/** Map common header spellings to canonical keys. */
function headerKey(cell) {
  const h = normCell(cell);
  if (!h) return null;
  if (h === "description" || h === "desc" || h.includes("description")) return "description";
  if (h.includes("mfg") && h.includes("date")) return "mfgDate";
  if (h === "mfg date" || h === "manufacturing date" || h === "manuf date" || h === "prod date") return "mfgDate";
  if (h.includes("batch")) return "batchNo";
  if (h === "quantity" || h === "qty" || h === "qnty" || h === "qnt" || h.endsWith(" qty") || h.startsWith("qty"))
    return "quantity";
  if (
    h.includes("expiry") ||
    h.includes("exp date") ||
    h.includes("expire") ||
    h.includes("expiration") ||
    (h.includes("exp") && h.includes("date"))
  )
    return "expiry";
  return null;
}

/**
 * Parse first sheet of opening-stock workbook; finds header row by required columns.
 * @returns {{ rows: Array<{ description: string, mfgDate: string, batchNo: string, quantity: number, expiry: string }>, errors: string[] }}
 */
export function parseFgOpeningStockWorkbookArrayBuffer(buffer) {
  const errors = [];
  if (!buffer) {
    errors.push("Empty file.");
    return { rows: [], errors };
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  } catch (e) {
    errors.push(e?.message || "Could not read Excel file.");
    return { rows: [], errors };
  }

  const name = workbook.SheetNames[0];
  if (!name) {
    errors.push("No sheet found in workbook.");
    return { rows: [], errors };
  }

  const sheet = workbook.Sheets[name];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  if (!matrix.length) {
    errors.push("Sheet is empty.");
    return { rows: [], errors };
  }

  let headerRowIndex = -1;
  const colMap = {};

  const maxScan = Math.min(matrix.length, 80);
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const temp = {};
    row.forEach((cell, c) => {
      const key = headerKey(cell);
      if (key && temp[key] === undefined) temp[key] = c;
    });
    if (temp.description != null && temp.quantity != null) {
      headerRowIndex = r;
      Object.assign(colMap, temp);
      break;
    }
  }

  if (headerRowIndex < 0) {
    errors.push(
      'Could not find a header row with "Description" and "Quantity". Check the template row labels.'
    );
    return { rows: [], errors };
  }

  const required = ["description", "quantity"];
  const missingRequired = required.filter((k) => colMap[k] === undefined);
  if (missingRequired.length) {
    errors.push(
      `Missing required column(s): ${missingRequired.join(", ")}. Need a row with headers for Description and Quantity (plus optional MFG Date, Batch, Expiry).`
    );
    return { rows: [], errors };
  }

  const optionalKeys = ["mfgDate", "batchNo", "expiry"];
  const missingOptional = optionalKeys.filter((k) => colMap[k] === undefined);
  missingOptional.forEach((k) => {
    colMap[k] = null;
  });
  if (missingOptional.length) {
    errors.push(
      `Optional column(s) not found (${missingOptional.join(", ")}). MFG Date, Batch, and/or Expiry will be blank where missing.`
    );
  }

  const rows = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const desc = row[colMap.description];
    if (desc == null || String(desc).trim() === "") continue;

    const qtyRaw = row[colMap.quantity];
    const qtyNum =
      typeof qtyRaw === "number" && Number.isFinite(qtyRaw)
        ? qtyRaw
        : parseFloat(String(qtyRaw).replace(/,/g, "").trim());
    if (!Number.isFinite(qtyNum)) continue;

    const formatCell = (v) => {
      if (v == null || v === "") return "";
      if (v instanceof Date && !Number.isNaN(v.getTime())) {
        const d = v.getDate().toString().padStart(2, "0");
        const m = (v.getMonth() + 1).toString().padStart(2, "0");
        const y = v.getFullYear();
        return `${d}/${m}/${y}`;
      }
      return String(v).trim();
    };

    const col = (idx) => (idx == null ? "" : row[idx]);
    rows.push({
      description: String(desc).trim(),
      mfgDate: colMap.mfgDate == null ? "" : formatCell(col(colMap.mfgDate)),
      batchNo: colMap.batchNo == null ? "" : String(col(colMap.batchNo) ?? "").trim(),
      quantity: Math.round(qtyNum),
      expiry: colMap.expiry == null ? "" : formatCell(col(colMap.expiry)),
    });
  }

  if (rows.length === 0) {
    errors.push("No data rows found below the header.");
  }

  return { rows, errors };
}
