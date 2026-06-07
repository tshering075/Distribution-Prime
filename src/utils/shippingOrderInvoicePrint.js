import { num } from "./orderLineCalculation";
import { COMPANY_NAME } from "../constants/brand";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDisplayDate(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString();
  }
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toLocaleDateString();
    } catch {
      /* fall through */
    }
  }
  return String(value);
}

function formatInr(amount) {
  return num(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Tax / business registration number on distributor master. */
export function resolveDistributorTpn(distributor) {
  if (!distributor) return "";
  const d = distributor;
  return String(
    d.tpn ?? d.TPN ?? d.tpnNo ?? d.tpn_no ?? d.taxNumber ?? d.tax_number ?? ""
  ).trim();
}

/** Dispatch invoice number — explicit field on order, else order number. */
export function resolveDispatchInvoiceNumber(order, orderNo) {
  const explicit = String(
    order?.invoiceNumber ??
      order?.invoice_number ??
      order?.invoiceNo ??
      order?.invoice_no ??
      ""
  ).trim();
  if (explicit) return explicit;

  const fromArg = String(orderNo ?? "").trim();
  if (fromArg) return fromArg;

  return String(order?.orderNumber ?? order?.order_number ?? "").trim() || "—";
}

/** Destination: order override, then distributor destination, then region. */
export function resolveDistributorDestination(distributor, order) {
  const fromOrder = order?.destination ?? order?.Destination;
  if (fromOrder != null && String(fromOrder).trim() !== "") {
    return String(fromOrder).trim();
  }
  if (!distributor) return "";
  return String(distributor.destination ?? distributor.region ?? "").trim();
}

function parseCharges(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function aggregateLinesForPrint(lines) {
  let totalAmountSum = 0;
  let grossBeforeDiscount = 0;
  let totalTonSum = 0;
  let totalDiscountSum = 0;
  let sumCasesDisplay = 0;
  let totalUC_CSD = 0;
  let totalUC_Water = 0;

  (lines || []).forEach((row) => {
    const cases = num(row.cases);
    const lineAmount = num(row.totalAmount);
    const lineDiscount = num(row.discountAmount);
    totalAmountSum += lineAmount;
    grossBeforeDiscount += lineAmount + lineDiscount;
    totalTonSum += num(row.totalTon);
    totalDiscountSum += lineDiscount;
    sumCasesDisplay += cases;
    const category = row.category || "CSD";
    const totalUC = num(row.totalUC);
    if (category === "Water") totalUC_Water += totalUC;
    else totalUC_CSD += totalUC;
  });

  return {
    totalAmountSum,
    grossBeforeDiscount,
    totalTonSum,
    totalDiscountSum,
    sumCasesDisplay,
    totalUC_CSD,
    totalUC_Water,
  };
}

/** Invoice totals: items + transport − discount, then GST on that base. */
export function computeInvoiceTotals(lines, transportationCharges, gstRate = 0.05) {
  const aggregates = aggregateLinesForPrint(lines);
  const transport = parseCharges(transportationCharges);
  const discount = aggregates.totalDiscountSum;
  const subtotalBeforeGst = aggregates.grossBeforeDiscount + transport - discount;
  const gstAmount = subtotalBeforeGst * gstRate;
  const netTotal = subtotalBeforeGst + gstAmount;

  return {
    ...aggregates,
    transportationCharges: transport,
    subtotalBeforeGst,
    gstAmount,
    netTotal,
    showGst: gstAmount > 0,
  };
}

function buildTotalsMainTableHtml(totals) {
  const gstRow = totals.showGst
    ? `<tr><td class="label">GST (5%):</td><td class="num">${formatInr(totals.gstAmount)}</td></tr>`
    : "";

  return `<table class="totals totals-main">
    <tr><td class="label">Gross cases:</td><td class="num">${totals.sumCasesDisplay.toLocaleString()}</td></tr>
    <tr><td class="label">Gross amount (items):</td><td class="num">${formatInr(totals.grossBeforeDiscount)}</td></tr>
    <tr><td class="label">Transportation charges:</td><td class="num">+ ${formatInr(totals.transportationCharges)}</td></tr>
    <tr><td class="label deduct">Less discount:</td><td class="num deduct">− ${formatInr(totals.totalDiscountSum)}</td></tr>
    <tr class="subtotal"><td class="label">Subtotal (before GST):</td><td class="num">${formatInr(totals.subtotalBeforeGst)}</td></tr>
    ${gstRow}
    <tr class="net"><td class="label">Net Total:</td><td class="num">${formatInr(totals.netTotal)}</td></tr>
  </table>`;
}

function buildTotalsSideTableHtml(totals) {
  return `<table class="totals totals-side">
    <tr><td class="label">Total tons:</td><td class="num">${totals.totalTonSum.toFixed(3)}</td></tr>
    <tr><td class="label">CSD UC:</td><td class="num">${totals.totalUC_CSD.toFixed(2)}</td></tr>
    <tr><td class="label">Water UC:</td><td class="num">${totals.totalUC_Water.toFixed(2)}</td></tr>
  </table>`;
}

function buildLineRowsHtml(lines) {
  if (!lines?.length) {
    return `<tr><td colspan="8" style="text-align:center;padding:12px;">No line items</td></tr>`;
  }

  return lines
    .map((row, i) => {
      const cases = num(row.cases);
      const freeCases = num(row.freeCases);
      const qtyLabel =
        freeCases > 0 ? `${cases.toLocaleString()} (+${freeCases} free)` : cases.toLocaleString();
      return `<tr class="${i % 2 ? "stripe" : ""}">
        <td>${i + 1}</td>
        <td class="sku">${escapeHtml(row.sku)}</td>
        <td>${escapeHtml(row.mfgDate || "—")}</td>
        <td>${escapeHtml(row.batchNo || "—")}</td>
        <td class="num">${escapeHtml(qtyLabel)}</td>
        <td class="num">${formatInr(row.rate)}</td>
        <td class="num">${formatInr(row.totalAmount)}</td>
        <td class="num">${num(row.totalTon).toFixed(3)}</td>
      </tr>`;
    })
    .join("");
}

function buildInvoiceHtml(payload) {
  const {
    order,
    distributor,
    distributorName,
    companyName,
    organizationAddress,
    organizationPostNo,
    organizationGstNo,
    transport,
    lines,
    headerDate,
    orderNo,
    gstRate = 0.05,
    transportationCharges: transportationChargesProp,
  } = payload || {};

  const letterheadName = String(companyName || COMPANY_NAME).trim() || COMPANY_NAME;
  const orgAddress = String(organizationAddress ?? "").trim();
  const orgPostNo = String(organizationPostNo ?? "").trim();
  const orgGstNo = String(organizationGstNo ?? "").trim();

  const name =
    distributorName ||
    distributor?.name ||
    order?.distributorName ||
    order?.distributorCode ||
    "Distributor";
  const address = String(distributor?.address ?? order?.distributorAddress ?? "").trim() || "—";
  const tpn = resolveDistributorTpn(distributor) || "—";
  const destination = resolveDistributorDestination(distributor, order) || "—";
  const transportSafe = transport || {};
  const transporterVehicle = String(transportSafe.transporterVehicle ?? "").trim() || "—";
  const vehicleType = String(transportSafe.vehicleType ?? "").trim() || "—";
  const vehicleNo = String(transportSafe.vehicleNo ?? "").trim() || "—";

  const transportCharges =
    transportationChargesProp ??
    transportSafe.transportationCharges ??
    order?.transportationCharges ??
    order?.transportation_charges ??
    0;
  const totals = computeInvoiceTotals(lines, transportCharges, gstRate);
  const totalsMainTableHtml = buildTotalsMainTableHtml(totals);
  const totalsSideTableHtml = buildTotalsSideTableHtml(totals);
  const totalsLayoutHtml = `<div class="totalsGrid">
    <div class="totalsLeft">${totalsSideTableHtml}</div>
    <div class="totalsRight">${totalsMainTableHtml}</div>
  </div>`;
  const printedAt = new Date().toLocaleString();
  const orderNoLabel = escapeHtml(
    String(orderNo ?? order?.orderNumber ?? order?.order_number ?? "").trim() || "—"
  );
  const invoiceNoLabel = escapeHtml(resolveDispatchInvoiceNumber(order, orderNo));
  const dateLabel = escapeHtml(formatDisplayDate(headerDate));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${invoiceNoLabel}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; margin: 16px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .letterhead { text-align: center; margin-bottom: 12px; }
    .letterhead-name { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
    .letterhead-invoice { font-size: 13px; font-weight: 800; margin: 8px 0 4px; letter-spacing: 0.02em; }
    .letterhead-line { font-size: 11px; color: #333; line-height: 1.5; }
    .sub { color: #333; font-size: 11px; margin-bottom: 14px; text-align: center; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 14px; }
    .box { border: 1px solid #bbb; border-radius: 4px; padding: 10px; }
    .box h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 8px; color: #000; }
    .row { display: flex; margin-bottom: 4px; }
    .label { min-width: 118px; font-weight: 700; color: #000; }
    .value { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #bbb; padding: 5px 6px; }
    th { background: #fff; color: #000; font-size: 11px; text-align: left; }
    td.num { text-align: right; white-space: nowrap; }
    td.sku { font-weight: 600; }
    tr.stripe td { background: #f5f5f5; }
    .totalsGrid { margin-top: 10px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .totals { width: 100%; max-width: 360px; }
    .totalsMain { margin-left: auto; }
    .totalsLeft { flex: 0 0 auto; }
    .totalsRight { flex: 1; }
    .totals-main { margin-left: auto; max-width: 360px; }
    .totals-side { margin-left: 0; max-width: 240px; }
    .totals td { border: none; padding: 3px 6px; }
    .totals .label { text-align: right; font-weight: 700; }
    .totals .num { text-align: right; }
    .totals .deduct { color: #000; font-weight: 700; }
    .totals tr.subtotal td { border-top: 1px solid #999; padding-top: 6px; }
    .totals tr.net td { font-weight: 800; font-size: 13px; border-top: 2px solid #333; padding-top: 6px; }
    @media print {
      body { margin: 8mm; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="letterhead">
    <div class="letterhead-name">${escapeHtml(letterheadName)}</div>
    ${orgAddress ? `<div class="letterhead-line">${escapeHtml(orgAddress)}</div>` : ""}
    ${orgPostNo ? `<div class="letterhead-line">Post No.: ${escapeHtml(orgPostNo)}</div>` : ""}
    ${orgGstNo ? `<div class="letterhead-line">GST No.: ${escapeHtml(orgGstNo)}</div>` : ""}
    <div class="letterhead-invoice">Invoice No.: ${invoiceNoLabel}</div>
  </div>
  <div class="sub">Dispatch invoice · Printed ${escapeHtml(printedAt)}</div>

  <div class="grid">
    <div class="box">
      <h2>Bill to</h2>
      <div class="row"><span class="label">Distributor</span><span class="value">${escapeHtml(name)}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${escapeHtml(address)}</span></div>
      <div class="row"><span class="label">TPN No.</span><span class="value">${escapeHtml(tpn)}</span></div>
      <div class="row"><span class="label">Destination</span><span class="value">${escapeHtml(destination)}</span></div>
    </div>
    <div class="box">
      <h2>Order &amp; transport</h2>
      <div class="row"><span class="label">Invoice No.</span><span class="value">${invoiceNoLabel}</span></div>
      <div class="row"><span class="label">Order No.</span><span class="value">${orderNoLabel}</span></div>
      <div class="row"><span class="label">Order date</span><span class="value">${dateLabel}</span></div>
      <div class="row"><span class="label">Transporter vehicle</span><span class="value">${escapeHtml(transporterVehicle)}</span></div>
      <div class="row"><span class="label">Vehicle type</span><span class="value">${escapeHtml(vehicleType)}</span></div>
      <div class="row"><span class="label">Vehicle no.</span><span class="value">${escapeHtml(vehicleNo)}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>SKU</th>
        <th>MFG Date</th>
        <th>Batch No.</th>
        <th style="text-align:right">Qty/Cases</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
        <th style="text-align:right">Tons</th>
      </tr>
    </thead>
    <tbody>
      ${buildLineRowsHtml(lines)}
    </tbody>
  </table>

  ${totalsLayoutHtml}
</body>
</html>`;
}

const MAX_INVOICE_PDF_BYTES = 5 * 1024 * 1024;

/**
 * Fit a canvas image onto portrait A4 PDF page(s); returns a data URI.
 * @param {HTMLCanvasElement} canvas
 * @param {{ orientation?: "p" | "l", jpegQuality?: number }} [options]
 */
async function canvasToPdfDataUrl(canvas, { orientation = "p", jpegQuality = 0.88 } = {}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF(orientation, "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const availableWidth = pdfWidth - margin * 2;
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = availableWidth / imgWidth;
  const imgScaledWidth = availableWidth;
  const imgScaledHeight = imgHeight * ratio;
  const startX = (pdfWidth - imgScaledWidth) / 2;
  const startY = margin;
  const firstPageMaxH = pdfHeight - startY - margin;
  const nextPageMaxH = pdfHeight - 2 * margin;
  const imageFormat = "JPEG";

  const addSlice = (sourceY, sourceHeightPx, destY, destHeightMm) => {
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = imgWidth;
    pageCanvas.height = Math.max(1, Math.ceil(sourceHeightPx));
    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      sourceY,
      imgWidth,
      sourceHeightPx,
      0,
      0,
      imgWidth,
      sourceHeightPx
    );
    const sliceData = pageCanvas.toDataURL("image/jpeg", jpegQuality);
    pdf.addImage(sliceData, imageFormat, startX, destY, imgScaledWidth, destHeightMm);
  };

  if (imgScaledHeight <= firstPageMaxH) {
    const imgData = canvas.toDataURL("image/jpeg", jpegQuality);
    pdf.addImage(imgData, imageFormat, startX, startY, imgScaledWidth, imgScaledHeight);
  } else {
    let yPosition = startY;
    let sourceY = 0;
    let firstSlice = true;

    while (sourceY < imgHeight - 0.25) {
      const pageMaxH = firstSlice ? firstPageMaxH : nextPageMaxH;
      const remainingPx = imgHeight - sourceY;
      const remainingMm = remainingPx * ratio;
      const heightToShowMm = Math.min(remainingMm, pageMaxH);
      let sourceHeightPx = heightToShowMm / ratio;
      if (sourceHeightPx > remainingPx) sourceHeightPx = remainingPx;
      if (sourceHeightPx < 1 && remainingPx > 0) sourceHeightPx = Math.min(remainingPx, 1);

      addSlice(sourceY, sourceHeightPx, yPosition, heightToShowMm);
      sourceY += sourceHeightPx;
      firstSlice = false;

      if (sourceY < imgHeight - 0.25) {
        pdf.addPage("a4", orientation === "l" ? "landscape" : "portrait");
        yPosition = margin;
      }
    }
  }

  return pdf.output("datauristring");
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Render dispatch invoice HTML to a PDF data URL for shipping upload.
 * @param {object} payload — same shape as {@link openShippingOrderInvoicePrint}
 * @returns {Promise<{ data: string, fileName: string, mimeType: string }>}
 */
export async function generateShippingInvoiceFile(payload) {
  const html = buildInvoiceHtml(payload);
  const orderNo = String(payload?.orderNo ?? "order").replace(/[^\w.-]+/g, "_");
  const fileName = `Dispatch_invoice_${orderNo}.pdf`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Invoice render");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:820px;height:10px;border:0;visibility:hidden";
  document.body.appendChild(iframe);

  const loadPromise = new Promise((resolve, reject) => {
    let timeoutId;
    iframe.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    iframe.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Could not render invoice"));
    };
    timeoutId = setTimeout(() => reject(new Error("Invoice render timed out")), 15000);
  });

  iframe.srcdoc = html;

  try {
    await loadPromise;
    await new Promise((r) => setTimeout(r, 150));
    const body = iframe.contentDocument?.body;
    if (!body?.childElementCount) {
      throw new Error("Invoice content did not load");
    }
    const { default: html2canvas } = await import("html2canvas");

    const captureAttempts = [
      { scale: 2, jpegQuality: 0.88 },
      { scale: 1.5, jpegQuality: 0.82 },
      { scale: 1.25, jpegQuality: 0.75 },
    ];

    let data = null;
    for (const attempt of captureAttempts) {
      const canvas = await html2canvas(body, {
        backgroundColor: "#ffffff",
        scale: attempt.scale,
        logging: false,
        useCORS: true,
      });
      data = await canvasToPdfDataUrl(canvas, { jpegQuality: attempt.jpegQuality });
      if (estimateDataUrlBytes(data) <= MAX_INVOICE_PDF_BYTES) break;
    }

    if (!data) {
      throw new Error("Could not build invoice PDF");
    }
    if (estimateDataUrlBytes(data) > MAX_INVOICE_PDF_BYTES) {
      throw new Error("Invoice PDF is too large (max 5 MB). Reduce line items or contact admin.");
    }

    return { data, fileName, mimeType: "application/pdf" };
  } finally {
    document.body.removeChild(iframe);
  }
}

/**
 * Open browser print preview for shipping dispatch invoice.
 * @param {object} payload
 */
export function openShippingOrderInvoicePrint(payload) {
  const html = buildInvoiceHtml(payload);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked. Allow pop-ups for this site to print the invoice.");
  }

  let printed = false;
  const runPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } catch (e) {
      console.warn("Invoice print:", e);
    }
  };

  const cleanup = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };

  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 120000);

  win.addEventListener(
    "load",
    () => {
      setTimeout(runPrint, 400);
    },
    { once: true }
  );

  setTimeout(() => {
    try {
      if (!printed && win.document?.readyState === "complete" && win.document.body?.childElementCount > 0) {
        runPrint();
      }
    } catch {
      if (!printed) runPrint();
    }
  }, 900);
}
