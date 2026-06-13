import { num } from "./orderLineCalculation";
import { saleGrandTotal } from "./posSaleStorage";

export const POS_PRINT_TYPES = {
  receipt: "receipt",
  invoice: "invoice",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNuPrint(amount) {
  return `Nu. ${num(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function paymentLabel(value) {
  const map = {
    cash: "Cash",
    mobile: "Mobile / QR",
    credit: "Credit",
  };
  return map[value] || value || "—";
}

function resolveProfile(sale, profile) {
  return {
    businessName: String(sale?.distributorName || profile?.businessName || "POS Sale").trim(),
    address: String(sale?.distributorAddress || profile?.address || "").trim(),
    gstin: String(sale?.distributorGstin || profile?.gstin || "").trim(),
    tpn: String(sale?.distributorTpn || profile?.tpn || "").trim(),
  };
}

function buildTotalsRows(sale) {
  const gstRatePct = Math.round((Number(sale.gstRate) || 0.05) * 100);
  const rows = [
    `<tr><td class="label">Subtotal</td><td class="value">${formatNuPrint(sale.subtotal)}</td></tr>`,
  ];
  if (Number(sale.discountAmount) > 0) {
    rows.push(
      `<tr><td class="label">Discount</td><td class="value">− ${formatNuPrint(sale.discountAmount)}</td></tr>`
    );
  }
  if (Number(sale.gstAmount) > 0) {
    rows.push(
      `<tr><td class="label">GST (${gstRatePct}%)</td><td class="value">${formatNuPrint(sale.gstAmount)}</td></tr>`
    );
  }
  rows.push(
    `<tr class="net"><td class="label">Total</td><td class="value">${formatNuPrint(saleGrandTotal(sale))}</td></tr>`
  );
  if (Number(sale.changeGiven) > 0) {
    rows.push(
      `<tr><td class="label">Change given</td><td class="value">${formatNuPrint(sale.changeGiven)}</td></tr>`
    );
  }
  return rows.join("");
}

function buildReceiptHtml(sale, profile) {
  const invNo = escapeHtml(sale.invoiceNumber || sale.saleNumber);
  const lines = (sale.lines || [])
    .map(
      (l) =>
        `<tr>
          <td class="product">${escapeHtml(l.name)}</td>
          <td class="qty">${l.qty}</td>
          <td class="num">${formatNuPrint(l.amount)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><title>Receipt ${invNo}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; padding: 16px; max-width: 320px; margin: 0 auto; color: #111; font-size: 12px; }
      .doc-type { text-align: center; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #666; margin-bottom: 8px; }
      .head { text-align: center; margin-bottom: 12px; }
      .head h1 { font-size: 16px; margin: 0 0 4px; font-weight: 800; }
      .head p { margin: 2px 0; color: #555; font-size: 11px; line-height: 1.4; }
      .meta { margin: 10px 0; padding: 8px 0; border-top: 1px dashed #bbb; border-bottom: 1px dashed #bbb; font-size: 11px; }
      .meta .row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
      table.items { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
      table.items th, table.items td { padding: 5px 2px; border-bottom: 1px dashed #ddd; vertical-align: top; }
      table.items th { font-size: 10px; color: #666; font-weight: 700; }
      table.items .product { width: 52%; text-align: left; word-break: break-word; }
      table.items .qty { width: 14%; text-align: center; }
      table.items .num { width: 34%; text-align: right; white-space: nowrap; }
      .totals { width: 100%; margin: 10px 0 0; border-collapse: collapse; }
      .totals td { padding: 3px 0; border: none; }
      .totals .label { text-align: left; font-weight: 700; color: #444; }
      .totals .value { text-align: right; font-weight: 700; white-space: nowrap; }
      .totals tr.net td { border-top: 2px solid #333; padding-top: 6px; font-size: 13px; font-weight: 800; }
      .footer { margin-top: 14px; text-align: center; font-size: 10px; color: #777; }
    </style></head><body>
    <div class="doc-type">RECEIPT</div>
    <div class="head">
      <h1>${escapeHtml(profile.businessName || "POS Receipt")}</h1>
      ${profile.address ? `<p>${escapeHtml(profile.address)}</p>` : ""}
      ${profile.gstin ? `<p>GSTIN: ${escapeHtml(profile.gstin)}</p>` : ""}
    </div>
    <div class="meta">
      <div class="row"><span>Sale</span><span>${escapeHtml(sale.saleNumber)}</span></div>
      ${sale.invoiceNumber ? `<div class="row"><span>Ref</span><span>${invNo}</span></div>` : ""}
      <div class="row"><span>Date</span><span>${escapeHtml(formatTime(sale.createdAt))}</span></div>
      <div class="row"><span>Payment</span><span>${escapeHtml(paymentLabel(sale.paymentMethod))}</span></div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th class="product">Product</th>
          <th class="qty">Qty</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <table class="totals">${buildTotalsRows(sale)}</table>
    ${
      sale.customerName || sale.customerMobile
        ? `<div class="meta" style="border-bottom:none;margin-top:10px;">
            ${sale.customerName ? `<div class="row"><span>Customer</span><span>${escapeHtml(sale.customerName)}</span></div>` : ""}
            ${sale.customerMobile ? `<div class="row"><span>Mobile</span><span>${escapeHtml(sale.customerMobile)}</span></div>` : ""}
          </div>`
        : ""
    }
    <div class="footer">Thank you for your purchase</div>
    </body></html>`;
}

function buildInvoiceHtml(sale, profile) {
  const invNo = escapeHtml(sale.invoiceNumber || sale.saleNumber);
  const gstRatePct = Math.round((Number(sale.gstRate) || 0.05) * 100);
  const lines = (sale.lines || [])
    .map(
      (l, idx) =>
        `<tr>
          <td class="sr">${idx + 1}</td>
          <td class="product">${escapeHtml(l.name)}</td>
          <td class="qty">${l.qty}</td>
          <td class="num">${formatNuPrint(l.rate)}</td>
          <td class="num">${formatNuPrint(l.amount)}</td>
        </tr>`
    )
    .join("");

  const sellerRows = [
    profile.businessName ? `<div><strong>${escapeHtml(profile.businessName)}</strong></div>` : "",
    profile.address ? `<div>${escapeHtml(profile.address)}</div>` : "",
    profile.gstin ? `<div>GSTIN: ${escapeHtml(profile.gstin)}</div>` : "",
    profile.tpn ? `<div>TPN: ${escapeHtml(profile.tpn)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  const buyerRows = [
    sale.customerName ? `<div><strong>${escapeHtml(sale.customerName)}</strong></div>` : "",
    sale.customerMobile ? `<div>Mobile: ${escapeHtml(sale.customerMobile)}</div>` : "",
    sale.customerGstin ? `<div>GSTIN: ${escapeHtml(sale.customerGstin)}</div>` : "",
    sale.customerTpn ? `<div>TPN: ${escapeHtml(sale.customerTpn)}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html><html><head><title>Tax Invoice ${invNo}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; padding: 28px; max-width: 760px; margin: 0 auto; color: #111; font-size: 12px; }
      .doc-type { text-align: center; font-size: 18px; font-weight: 800; letter-spacing: 1px; margin-bottom: 18px; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
      .party { border: 1px solid #ddd; border-radius: 6px; padding: 12px; min-height: 96px; }
      .party h3 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; }
      .party div { margin-bottom: 4px; line-height: 1.45; }
      .inv-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; padding: 12px; background: #f7f7f7; border-radius: 6px; }
      .inv-meta .item label { display: block; font-size: 10px; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 2px; }
      .inv-meta .item span { font-weight: 800; }
      table.items { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 4px; }
      table.items th, table.items td { padding: 8px 6px; border: 1px solid #ddd; vertical-align: top; }
      table.items th { background: #f3f3f3; font-size: 11px; color: #444; font-weight: 700; }
      table.items .sr { width: 36px; text-align: center; }
      table.items .product { text-align: left; word-break: break-word; }
      table.items .qty { width: 64px; text-align: center; }
      table.items .num { width: 110px; text-align: right; white-space: nowrap; }
      .summary { display: grid; grid-template-columns: 1fr 280px; gap: 20px; margin-top: 16px; align-items: start; }
      .summary .notes { font-size: 11px; color: #555; line-height: 1.5; }
      .totals { width: 100%; border-collapse: collapse; }
      .totals td { padding: 5px 0; border: none; }
      .totals .label { text-align: left; font-weight: 700; color: #444; }
      .totals .value { text-align: right; font-weight: 700; white-space: nowrap; }
      .totals tr.net td { border-top: 2px solid #333; padding-top: 8px; font-size: 14px; font-weight: 800; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #777; text-align: center; }
    </style></head><body>
    <div class="doc-type">TAX INVOICE</div>
    <div class="parties">
      <div class="party">
        <h3>From</h3>
        ${sellerRows || "<div>—</div>"}
      </div>
      <div class="party">
        <h3>Bill to</h3>
        ${buyerRows || "<div>Walk-in customer</div>"}
      </div>
    </div>
    <div class="inv-meta">
      <div class="item"><label>Invoice no.</label><span>${invNo}</span></div>
      <div class="item"><label>Sale no.</label><span>${escapeHtml(sale.saleNumber)}</span></div>
      <div class="item"><label>Date &amp; time</label><span>${escapeHtml(formatDateTime(sale.createdAt))}</span></div>
    </div>
    <table class="items">
      <thead>
        <tr>
          <th class="sr">#</th>
          <th class="product">Description</th>
          <th class="qty">Qty (cs)</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="summary">
      <div class="notes">
        <div><strong>Payment:</strong> ${escapeHtml(paymentLabel(sale.paymentMethod))}</div>
        ${
          sale.amountTendered != null && Number(sale.amountTendered) > 0
            ? `<div><strong>Amount received:</strong> ${formatNuPrint(sale.amountTendered)}</div>`
            : ""
        }
        ${Number(sale.gstAmount) > 0 ? `<div style="margin-top:8px;">GST @ ${gstRatePct}% included in total where applicable.</div>` : ""}
      </div>
      <table class="totals">${buildTotalsRows(sale)}</table>
    </div>
    <div class="footer">This is a computer-generated tax invoice.</div>
    </body></html>`;
}

/** @param {'receipt'|'invoice'} type */
export function buildPosSalePrintHtml(sale, profile, type = POS_PRINT_TYPES.receipt) {
  if (!sale) return "";
  const resolvedProfile = resolveProfile(sale, profile);
  if (type === POS_PRINT_TYPES.invoice) {
    return buildInvoiceHtml(sale, resolvedProfile);
  }
  return buildReceiptHtml(sale, resolvedProfile);
}

/** @param {'receipt'|'invoice'} type */
export function printPosSaleDocument(sale, profile, type = POS_PRINT_TYPES.receipt) {
  const html = buildPosSalePrintHtml(sale, profile, type);
  if (!html) return;
  const invNo = sale.invoiceNumber || sale.saleNumber || "POS";
  const isInvoice = type === POS_PRINT_TYPES.invoice;
  const w = window.open("", "_blank", isInvoice ? "width=860,height=920" : "width=380,height=720");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.document.title = `${isInvoice ? "Invoice" : "Receipt"} ${invNo}`;
  w.focus();
  w.print();
}
