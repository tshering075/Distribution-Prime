import { partyNameAggregationKey } from "./distributorNameMatch";

/**
 * UC Conversion Formulas based on product SKU
 * These match the formulas in cokecalculator.jsx
 */
const UC_FORMULAS = {
  // CSD Products - 300ml
  "coca cola 300ml": (pc) => (pc * 7.2) / 5.678,
  "fanta 300ml": (pc) => (pc * 7.2) / 5.678,
  "sprite 300ml": (pc) => (pc * 7.2) / 5.678,
  "charge 300ml": (pc) => (pc * 7.2) / 5.678,
  
  // CSD Products - 500ml
  "coca cola 500ml": (pc) => (pc * 12) / 5.678,
  "fanta 500ml": (pc) => (pc * 12) / 5.678,
  "sprite 500ml": (pc) => (pc * 12) / 5.678,
  
  // CSD Products - 1.25L
  "coca cola 1.25l": (pc) => (pc * 15) / 5.678,
  "coca cola 1.25ltr": (pc) => (pc * 15) / 5.678,
  "fanta 1.25l": (pc) => (pc * 15) / 5.678,
  "fanta 1.25ltr": (pc) => (pc * 15) / 5.678,
  "sprite 1.25l": (pc) => (pc * 15) / 5.678,
  "sprite 1.25ltr": (pc) => (pc * 15) / 5.678,
  
  // Water Products
  "kinley 200ml": (pc) => (pc * 4.8) / 5.678,
  "kinley 500ml": (pc) => (pc * 12) / 5.678,
  "kinley 1l": (pc) => (pc * 12) / 5.678,
  "kinley 1ltr": (pc) => (pc * 12) / 5.678,
};

/**
 * Products that should be excluded from target calculations (cans, etc.)
 * Matches various can product naming formats from Excel
 */
const EXCLUDED_PRODUCTS = [
  "can", "cans", "tin", "tins",
  "coke 300ml can", "diet coke 300ml can", "coke zero 300ml can",
  "coke z can", "coke can",
  "fanta 300ml can", "fanta can",
  "sprite 300ml can", "sprite e can",
  "sprite can",
  "limca 300ml can",
  "thums up 300ml can", "s up 300c an",
  "schweppes tonic water can", "schso da300 mlcan", "sctoni c300m lcan",
  "schweppes soda water can"
];

/**
 * Check if a product is excluded from target calculations
 */
function isExcludedProduct(sku) {
  if (!sku) return true;
  const skuLower = sku.toString().toLowerCase().trim();
  return EXCLUDED_PRODUCTS.some(excluded => skuLower.includes(excluded));
}

/**
 * Get UC formula for a product SKU
 */
function getUCFormula(sku) {
  if (!sku) return null;
  const skuLower = sku.toString().toLowerCase().trim();
  
  // Try exact match first
  if (UC_FORMULAS[skuLower]) {
    return UC_FORMULAS[skuLower];
  }
  
  // Try partial matches
  for (const [key, formula] of Object.entries(UC_FORMULAS)) {
    if (skuLower.includes(key) || key.includes(skuLower)) {
      return formula;
    }
  }
  
  return null;
}

/**
 * Determine if a product is CSD or Water
 * Handles various product name formats from Excel
 */
function getProductCategory(sku) {
  if (!sku) return null;
  const skuLower = sku.toString().toLowerCase().trim();
  
  // Water products - check for water, kinley, k water
  if (skuLower.includes("kinley") || 
      skuLower.includes("k water") ||
      (skuLower.includes("water") && !skuLower.includes("tonic") && !skuLower.includes("soda")) ||
      skuLower.includes("mineral")) {
    return "Water";
  }
  
  // CSD products - check for coke, fanta, sprite, charge, etc.
  if (skuLower.includes("coke") || 
      skuLower.includes("coca") || 
      skuLower.includes("cola") || 
      skuLower.includes("fanta") || 
      skuLower.includes("sprite") || 
      skuLower.includes("charge") || 
      skuLower.includes("charged") ||
      skuLower.includes("limca") ||
      skuLower.includes("thums") ||
      skuLower.includes("schweppes")) {
    return "CSD";
  }

  // Export-style columns that only list size (e.g. "ZA 1200 ML", "TE 500 ML", "A CAN 300")
  if (/\d{2,4}\s*ml|\d+\.?\d*\s*l(tr)?\b/i.test(sku)) {
    if (
      skuLower.includes("water") &&
      !skuLower.includes("tonic") &&
      !skuLower.includes("soda")
    ) {
      return "Water";
    }
    return "CSD";
  }

  return null;
}

/**
 * Enhanced Excel parser that:
 * 1. Matches distributors by name (from "Party Name / Address" column)
 * 2. Reads product SKU columns with quantities
 * 3. Converts PC to UC using formulas
 * 4. Excludes can products
 * 5. Extracts invoice date
 * 6. Returns both aggregated achievements and detailed sales data
 */
export async function parseExcelFile(file) {
  try {
    const XLSX = await import("xlsx");
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error("File size exceeds 10MB. Please upload a smaller file.");
    }
    
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error("Excel file appears to be empty or invalid.");
    }
    
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      throw new Error("Could not read the first sheet from the Excel file.");
    }
    
    // First, read as raw array to find where headers start
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    if (!rawRows || rawRows.length === 0) {
      throw new Error("Excel file contains no data rows.");
    }

    // Find header row by searching for "Party Name" or similar distributor column header
    // Headers can be on row 4 or later (as per user's Excel format)
    let headerRowIndex = 0;
    const normalize = (s) => (s || "").toString().trim().toLowerCase();
    
    // Search for header row — require real header text (not a data row with many numbers).
    // Using only "many non-empty cells" matched invoice data rows and shifted columns, dropping most rows.
    for (let i = 0; i < Math.min(30, rawRows.length); i++) {
      const row = rawRows[i] || [];
      const rowValues = Array.isArray(row) ? row.map(cell => normalize(cell)) : Object.values(row).map(cell => normalize(cell));

      const hasHeaderMarkers = rowValues.some((val) =>
        val.includes("party name") ||
        (val.includes("party") && val.includes("address")) ||
        val.includes("distributor") ||
        val.includes("dealer") ||
        val.includes("inv date") ||
        val.includes("inv no") ||
        val.includes("invoice date") ||
        val.includes("invoice no") ||
        val.includes("bill date") ||
        val.includes("sl no") ||
        val.includes("si no")
      );

      if (hasHeaderMarkers) {
        headerRowIndex = i;
        console.log(`Header row detected at index ${headerRowIndex} (row ${headerRowIndex + 1} in Excel)`);
        break;
      }
    }
    
    if (headerRowIndex === 0 && rawRows.length > 3) {
      const row3 = rawRows[3] || [];
      const row3Values = Array.isArray(row3) ? row3.map(cell => normalize(cell)) : Object.values(row3).map(cell => normalize(cell));
      const row3HasMarkers = row3Values.some((val) =>
        val.includes("party name") ||
        (val.includes("party") && val.includes("address")) ||
        val.includes("distributor") ||
        val.includes("dealer") ||
        val.includes("inv date") ||
        val.includes("inv no") ||
        val.includes("invoice date") ||
        val.includes("sl no") ||
        val.includes("si no")
      );
      if (row3HasMarkers) {
        headerRowIndex = 3;
        console.log(`Header row detected at index ${headerRowIndex} (row ${headerRowIndex + 1} in Excel) - using row 4`);
      }
    }
    
    // Extract header keys from the detected header row
    const headerRow = rawRows[headerRowIndex] || [];
    const headerKeys = Array.isArray(headerRow) 
      ? headerRow.map((h, i) => (h || "").toString().trim() || `Column${i + 1}`) 
      : Object.keys(headerRow);
    
    // Extract data rows starting from row after header
    const rows = rawRows.slice(headerRowIndex + 1)
      .map(row => {
        const rowArray = Array.isArray(row) ? row : Object.values(row);
        const obj = {};
        headerKeys.forEach((key, i) => {
          obj[key] = rowArray[i] !== undefined && rowArray[i] !== null ? rowArray[i] : null;
        });
        return obj;
      })
      .filter(row => {
        // Filter out completely empty rows (all values are null/empty/0)
        return Object.values(row).some(val => 
          val !== null && val !== undefined && val !== "" && String(val).trim() !== ""
        );
      });
    
    if (!rows || rows.length === 0) {
      throw new Error("Excel file contains no data rows after the header row.");
    }

    const aggregated = {};
    const detailedSalesData = []; // Store detailed sales data with invoice dates

    const add = (name, field, value) => {
      // One bucket per logical party — avoids splitting liftings when Excel varies comma/slash/spacing
      const key = partyNameAggregationKey(name);
      if (!key) return;
      if (!aggregated[key]) {
        aggregated[key] = {
          name: name?.toString() || key,
          CSD_PC: 0,
          CSD_UC: 0,
          Water_PC: 0,
          Water_UC: 0,
        };
      }
      aggregated[key][field] = (aggregated[key][field] || 0) + (Number(value) || 0);
    };

    // Get headers from first data row (which is now the actual header row)
    const firstRow = rows[0] || {};
    const headers = Object.keys(firstRow).map(h => h.toLowerCase().trim());
    
    // Find distributor name column - look for "Party Name / Address" or similar
    // This column name can have variations like "Party Name / Address", "Party Name", etc.
    const distributorCol = headers.findIndex(h => {
      const hLower = h.toLowerCase();
      return hLower.includes("party name") || 
             (hLower.includes("party") && hLower.includes("address")) ||
             hLower.includes("distributor") || 
             hLower.includes("dealer") || 
             (hLower.includes("name") && !hLower.includes("product") && !hLower.includes("inv") && !hLower.includes("bill"));
    });
    
    console.log(`Distributor column found at index ${distributorCol}, header name: "${headers[distributorCol]}"`);
    
    // If not found, try common column names
    let distributorColName = null;
    if (distributorCol >= 0) {
      distributorColName = Object.keys(firstRow)[distributorCol];
    } else {
      // Try common variations
      distributorColName = Object.keys(firstRow).find(key => 
        key.toLowerCase().includes("party") || 
        key.toLowerCase().includes("distributor") ||
        key.toLowerCase().includes("dealer")
      ) || Object.keys(firstRow)[0]; // Fallback to first column
    }

    // Find invoice date column
    const invoiceDateCol = headers.findIndex(h => 
      h.includes("invoice date") || h.includes("inv date") || 
      h.includes("bill date") || (h.includes("date") && !h.includes("party"))
    );
    let invoiceDateColName = null;
    if (invoiceDateCol >= 0) {
      invoiceDateColName = Object.keys(firstRow)[invoiceDateCol];
    } else {
      // Try common variations
      invoiceDateColName = Object.keys(firstRow).find(key => 
        key.toLowerCase().includes("invoice date") ||
        key.toLowerCase().includes("inv date") ||
        key.toLowerCase().includes("bill date") ||
        (key.toLowerCase().includes("date") && !key.toLowerCase().includes("party"))
      );
    }

    const invoiceNoCol = headers.findIndex((h) =>
      h.includes("inv no") || h.includes("invoice no") || h.includes("bill no")
    );
    let invoiceNoColName = null;
    if (invoiceNoCol >= 0) {
      invoiceNoColName = Object.keys(firstRow)[invoiceNoCol];
    } else {
      invoiceNoColName = Object.keys(firstRow).find((key) => {
        const kl = key.toLowerCase();
        return kl.includes("inv no") || kl.includes("invoice no");
      });
    }

    // Columns to skip (administrative columns)
    const skipColumns = [
      "si no", "serial", "inv date", "invoice date", "inv no", "invoice no",
      "unit type", "unit", "invoice type", "bill date", "bill no", "truck no", "fda no",
      "total", "sum", "amount", "qty", "quantity"
    ];

    const isMetaSalesColumn = (columnName) => {
      const colNameLower = columnName.toLowerCase().trim();
      if (columnName === distributorColName) return true;
      // Allow "Total"/"Sum" to count as numeric signal (some sheets only fill the total column)
      const metaSkips = skipColumns.filter((s) => s !== "total" && s !== "sum");
      if (metaSkips.some((skip) => colNameLower.includes(skip))) return true;
      if (
        colNameLower.includes("party") ||
        colNameLower.includes("distributor") ||
        colNameLower.includes("dealer") ||
        (colNameLower.includes("name") && !colNameLower.includes("product") && !colNameLower.includes("address"))
      ) {
        return true;
      }
      return false;
    };

    /** True if row has any positive qty in product-like columns (not only party/date/unit). */
    const rowHasQuantityOutsideMeta = (row) =>
      Object.keys(row).some((columnName) => {
        if (isMetaSalesColumn(columnName)) return false;
        return (Number(row[columnName]) || 0) > 0;
      });

    const rowHasInvoiceReference = (row) =>
      invoiceNoColName != null &&
      row[invoiceNoColName] != null &&
      String(row[invoiceNoColName]).trim() !== "";

    const normalizePartyCell = (s) =>
      String(s)
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    /** Raw party text from row (merged cells often leave following rows blank in XLSX). */
    const getRawPartyFromRow = (row) => {
      const tryVals = [
        row[distributorColName],
        row["Party Name / Address"],
        row["Party Name"],
        row.Distributor,
        row.distributor,
        row.Name,
        row.name,
        row["Distributor Name"],
      ];
      for (const v of tryVals) {
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      const firstVal = Object.values(row)[0];
      if (firstVal != null && String(firstVal).trim() !== "") {
        const t = String(firstVal).trim();
        if (!/^\d+(\.\d+)?$/.test(t)) return t;
      }
      return "";
    };

    // Resolve party per row: carry down (merge-top), then carry up (merge-bottom / export quirks)
    const resolvedParties = [];
    let carryParty = "";
    for (let i = 0; i < rows.length; i++) {
      const raw = getRawPartyFromRow(rows[i]);
      if (raw) carryParty = normalizePartyCell(raw);
      resolvedParties[i] = carryParty;
    }
    for (let i = rows.length - 2; i >= 0; i--) {
      if (resolvedParties[i]) continue;
      if (!resolvedParties[i + 1]) continue;
      const row = rows[i];
      if (
        rowHasQuantityOutsideMeta(row) ||
        rowHasInvoiceReference(row)
      ) {
        resolvedParties[i] = resolvedParties[i + 1];
      }
    }

    // Process each row
    rows.forEach((row, rowIndex) => {
      let distributorName = resolvedParties[rowIndex];
      if (!distributorName) return;

      const distLower = distributorName.toLowerCase();
      if (
        distLower === "total" ||
        distLower.includes("grand total") ||
        /^total\b/.test(distLower) ||
        distLower === "sub total" ||
        distLower === "subtotal"
      ) {
        return;
      }

      // Extract invoice date
      let invoiceDate = null;
      if (invoiceDateColName && row[invoiceDateColName]) {
        const dateValue = row[invoiceDateColName];
        // Handle Excel date serial number or date string
        if (typeof dateValue === 'number') {
          // Excel date serial number (days since 1900-01-01)
          try {
            const excelDate = XLSX.SSF.parse_date_code(dateValue);
            if (excelDate) {
              invoiceDate = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
            }
          } catch (e) {
            // If parsing fails, try as regular number (timestamp)
            invoiceDate = new Date((dateValue - 25569) * 86400 * 1000);
          }
        } else if (dateValue instanceof Date) {
          invoiceDate = dateValue;
        } else {
          // Try to parse as date string - handle DD/MM/YYYY format specifically
          const dateStr = dateValue.toString().trim();
          
          // Check for DD/MM/YYYY format (e.g., "22/11/2025")
          const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyyMatch) {
            const day = parseInt(ddmmyyyyMatch[1], 10);
            const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // JavaScript months are 0-indexed
            const year = parseInt(ddmmyyyyMatch[3], 10);
            invoiceDate = new Date(year, month, day);
            if (!isNaN(invoiceDate.getTime())) {
              // Date parsed successfully
            } else {
              invoiceDate = null;
            }
          } else {
            // Try standard Date parsing (handles YYYY-MM-DD, MM/DD/YYYY, etc.)
            invoiceDate = new Date(dateValue);
            if (isNaN(invoiceDate.getTime())) {
              invoiceDate = null;
            }
          }
        }
      }
      // If no invoice date found, use file upload date or current date
      if (!invoiceDate || isNaN(invoiceDate.getTime())) {
        invoiceDate = new Date(); // Use current date as fallback
      }

      // Store products for this row
      const rowProducts = [];
      
      // Process each column (product SKU)
      Object.keys(row).forEach(columnName => {
        const colNameLower = columnName.toLowerCase().trim();
        
        // Skip administrative columns
        if (skipColumns.some(skip => colNameLower.includes(skip))) {
          return;
        }
        
        // Skip distributor name column
        if (columnName === distributorColName || 
            colNameLower.includes("party") ||
            colNameLower.includes("distributor") ||
            colNameLower.includes("dealer") ||
            (colNameLower.includes("name") && !colNameLower.includes("product") && !colNameLower.includes("address"))) {
          return;
        }
        
        const quantity = Number(row[columnName]) || 0;
        if (quantity <= 0) return;
        
        // Column name is the product SKU
        const sku = columnName.toString().trim();
        
        // Skip excluded products (cans) - check for CAN in product name
        if (isExcludedProduct(sku)) {
          return;
        }
        
        // Determine category
        const category = getProductCategory(sku);
        if (!category) {
          // Unknown product, skip
          return;
        }
        
        // Get UC formula and calculate UC
        const ucFormula = getUCFormula(sku);
        let uc = 0;
        
        if (ucFormula) {
          uc = ucFormula(quantity);
        } else {
          // If no formula found, try to infer from product name patterns
          const skuLower = sku.toLowerCase();
          
          if (category === "CSD") {
            // Try to match size patterns
            if (skuLower.includes("300ml") || skuLower.includes("300 ml")) {
              uc = (quantity * 7.2) / 5.678;
            } else if (skuLower.includes("500ml") || skuLower.includes("500 ml")) {
              uc = (quantity * 12) / 5.678;
            } else if (skuLower.includes("1.25") || skuLower.includes("1.25l") || skuLower.includes("1.25 l")) {
              uc = (quantity * 15) / 5.678;
            } else {
              // Default for CSD
              uc = (quantity * 12) / 5.678;
            }
          } else if (category === "Water") {
            // Try to match size patterns
            if (skuLower.includes("200ml") || skuLower.includes("200 ml")) {
              uc = (quantity * 4.8) / 5.678;
            } else if (skuLower.includes("500ml") || skuLower.includes("500 ml") || 
                       skuLower.includes("1l") || skuLower.includes("1 l") || 
                       skuLower.includes("1ltr") || skuLower.includes("1 ltr")) {
              uc = (quantity * 12) / 5.678;
            } else {
              // Default for Water
              uc = (quantity * 12) / 5.678;
            }
          }
        }
        
        // Add to aggregated data
        if (category === "CSD") {
          add(distributorName, "CSD_PC", quantity);
          add(distributorName, "CSD_UC", uc);
        } else if (category === "Water") {
          add(distributorName, "Water_PC", quantity);
          add(distributorName, "Water_UC", uc);
        }

        // Store product details for this row
        rowProducts.push({
          sku,
          category,
          quantity,
          uc: uc || 0,
        });
      });

      // One sales row per invoice line: include rows that only had cans/exotics (qty > 0) so liftings are not dropped
      if (rowProducts.length > 0 || rowHasQuantityOutsideMeta(row)) {
        const csdProducts = rowProducts.filter(p => p.category === "CSD");
        const waterProducts = rowProducts.filter(p => p.category === "Water");
        
        const csdPC = csdProducts.reduce((sum, p) => sum + p.quantity, 0);
        const csdUC = csdProducts.reduce((sum, p) => sum + p.uc, 0);
        const waterPC = waterProducts.reduce((sum, p) => sum + p.quantity, 0);
        const waterUC = waterProducts.reduce((sum, p) => sum + p.uc, 0);

        detailedSalesData.push({
          distributorName,
          invoiceDate,
          products: rowProducts,
          csdPC,
          csdUC,
          waterPC,
          waterUC,
          totalUC: csdUC + waterUC,
        });
      }
    });

    console.log("Excel parsing complete. Aggregated data:", aggregated);
    console.log("Total distributors found in Excel:", Object.keys(aggregated).length);
    console.log("Total sales data records:", detailedSalesData.length);
    if (Object.keys(aggregated).length > 0) {
      console.log("Sample distributor data:", Object.values(aggregated)[0]);
    }

    // Return both aggregated achievements and detailed sales data
    return {
      achievements: aggregated,
      salesData: detailedSalesData
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse Excel file: " + String(error));
  }
}

/**
 * Export distributors array to Excel and trigger download.
 * Expected data: [{ name, region, target: {...}, achieved: {...}, balance: {...} }]
 */
export async function exportToExcel(distributors, filename = "targets-report.xlsx") {
  const [XLSX, { saveAs }] = await Promise.all([
    import("xlsx"),
    import("file-saver"),
  ]);
  const rows = distributors.map(d => ({
    Distributor: d.name,
    Region: d.region,
    Target_CSD_PC: d.target?.CSD_PC ?? 0,
    Target_CSD_UC: d.target?.CSD_UC ?? 0,
    Target_Water_PC: d.target?.Water_PC ?? 0,
    Target_Water_UC: d.target?.Water_UC ?? 0,
    Achieved_CSD_PC: d.achieved?.CSD_PC ?? 0,
    Achieved_CSD_UC: d.achieved?.CSD_UC ?? 0,
    Achieved_Water_PC: d.achieved?.Water_PC ?? 0,
    Achieved_Water_UC: d.achieved?.Water_UC ?? 0,
    Balance_CSD_PC: d.balance?.CSD_PC ?? 0,
    Balance_CSD_UC: d.balance?.CSD_UC ?? 0,
    Balance_Water_PC: d.balance?.Water_PC ?? 0,
    Balance_Water_UC: d.balance?.Water_UC ?? 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
}

export async function exportTableLayout(distributors, filename = "targets-report.xlsx") {
  const [XLSX, { saveAs }] = await Promise.all([
    import("xlsx"),
    import("file-saver"),
  ]);
  // group by region (preserve original order of appearance)
  const regions = Array.from(new Set(distributors.map(d => d.region || "Unknown")));
  const aoa = [];

  regions.forEach(region => {
    // region heading row
    aoa.push([region]);
    // column headers
    aoa.push(["Distributor", "Type", "Target CSD", "Target Water", "Achieved CSD", "Achieved Water", "Balance CSD", "Balance Water"]);

    // rows: two rows per distributor (PC then UC)
    distributors.filter(d => d.region === region).forEach(d => {
      // PC row
      aoa.push([
        d.name,
        "PC",
        d.target?.CSD_PC ?? 0,
        d.target?.Water_PC ?? 0,
        d.achieved?.CSD_PC ?? 0,
        d.achieved?.Water_PC ?? 0,
        d.balance?.CSD_PC ?? 0,
        d.balance?.Water_PC ?? 0,
      ]);
      // UC row (empty Distributor cell to visually group)
      aoa.push([
        "",
        "UC",
        d.target?.CSD_UC ?? 0,
        d.target?.Water_UC ?? 0,
        d.achieved?.CSD_UC ?? 0,
        d.achieved?.Water_UC ?? 0,
        d.balance?.CSD_UC ?? 0,
        d.balance?.Water_UC ?? 0,
      ]);
    });

    // blank row between regions
    aoa.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([wbout], { type: "application/octet-stream" }), filename);
}
