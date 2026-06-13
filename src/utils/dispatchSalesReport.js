import {
  coerceOrderLineData,
  resolveOrderDistributorCode,
  resolveOrderNumber,
} from "../services/deliveredOrderAchievement";
import { getOrderTransport, displayVehicleNo } from "../constants/shippingTransport";
import { ORDER_STATUS, resolveOrderStatus } from "./orderStatus";
import { parseFirestoreDate } from "./dateUtils";
import { getOrderShippingInvoices, orderHasShippingInvoices } from "./shippingInvoiceStorage";
import { enrichLineWithMfgBatch } from "./orderLineCalculation";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function salesRecordKey(record) {
  const code = String(record?.distributorCode ?? record?.distributor_code ?? "").trim();
  const on = String(
    record?.orderNumber ??
      record?.order_number ??
      record?.invoiceNumber ??
      record?.invoice_number ??
      ""
  ).trim();
  return code && on ? `${code}|${on}` : "";
}

function orderKey(order) {
  const code = resolveOrderDistributorCode(order);
  const on = resolveOrderNumber(order);
  return code && on ? `${code}|${on}` : "";
}

function parseInvoiceDateFromSources(order, salesRecord) {
  if (salesRecord) {
    const fromSales = parseFirestoreDate(salesRecord.invoiceDate ?? salesRecord.invoice_date);
    if (!Number.isNaN(fromSales.getTime())) return fromSales;
  }
  const raw =
    order?.delivered_at ??
    order?.deliveredAt ??
    order?.dispatched_at ??
    order?.dispatchedAt ??
    order?.status_updated_at ??
    order?.statusUpdatedAt ??
    order?.created_at ??
    order?.timestamp;
  const parsed = parseFirestoreDate(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInvoiceDateYmd(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatInvoiceDateDisplay(date) {
  if (!date || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Build dispatched-order sales rows for admin reports (invoice, vehicle, distributor).
 * @param {object[]} orders
 * @param {object[]} salesData
 * @param {object[]} distributors
 */
export function buildDispatchSalesReportRows(orders = [], salesData = [], distributors = []) {
  const distByCode = new Map(
    (Array.isArray(distributors) ? distributors : [])
      .filter((d) => d?.code)
      .map((d) => [String(d.code).trim(), d])
  );

  const salesByKey = new Map();
  for (const record of Array.isArray(salesData) ? salesData : []) {
    if (String(record?.source || "").toLowerCase() !== "order_delivery") continue;
    const key = salesRecordKey(record);
    if (key) salesByKey.set(key, record);
  }

  const rows = [];
  const seen = new Set();

  for (const order of Array.isArray(orders) ? orders : []) {
    if (resolveOrderStatus(order) !== ORDER_STATUS.DELIVERED) continue;
    const key = orderKey(order);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const sales = salesByKey.get(key);
    const code = resolveOrderDistributorCode(order);
    const distributor = distByCode.get(code);
    const transport = getOrderTransport(order);
    const invoiceDate = parseInvoiceDateFromSources(order, sales);
    const orderNo = resolveOrderNumber(order);

    rows.push({
      key,
      order,
      distributorCode: code,
      distributorName:
        order.distributorName ??
        order.distributor_name ??
        sales?.distributorName ??
        sales?.distributor_name ??
        distributor?.name ??
        code,
      orderNumber: orderNo,
      invoiceNo:
        sales?.invoiceNumber ??
        sales?.invoice_number ??
        order.invoiceNumber ??
        order.invoice_number ??
        orderNo,
      invoiceDate,
      invoiceDateYmd: formatInvoiceDateYmd(invoiceDate),
      invoiceDateDisplay: formatInvoiceDateDisplay(invoiceDate),
      vehicleNo: displayVehicleNo(transport.vehicleNo) || transport.vehicleNo || "—",
      csdPC: num(sales?.csdPC ?? sales?.csd_pc ?? order.csdPC ?? order.csd_pc),
      csdUC: num(sales?.csdUC ?? sales?.csd_uc ?? order.csdUC ?? order.csd_uc),
      waterPC: num(sales?.waterPC ?? sales?.water_pc ?? order.waterPC ?? order.water_pc),
      waterUC: num(sales?.waterUC ?? sales?.water_uc ?? order.waterUC ?? order.water_uc),
      hasUploadedInvoice: orderHasShippingInvoices(order),
      invoices: getOrderShippingInvoices(order),
      distributor,
    });
  }

  for (const [key, sales] of salesByKey) {
    if (seen.has(key)) continue;
    const [code, orderNo] = key.split("|");
    const distributor = distByCode.get(code);
    const invoiceDate = parseInvoiceDateFromSources(null, sales);

    rows.push({
      key,
      order: null,
      distributorCode: code,
      distributorName:
        sales.distributorName ?? sales.distributor_name ?? distributor?.name ?? code,
      orderNumber: orderNo,
      invoiceNo: sales.invoiceNumber ?? sales.invoice_number ?? orderNo,
      invoiceDate,
      invoiceDateYmd: formatInvoiceDateYmd(invoiceDate),
      invoiceDateDisplay: formatInvoiceDateDisplay(invoiceDate),
      vehicleNo: "—",
      csdPC: num(sales.csdPC ?? sales.csd_pc),
      csdUC: num(sales.csdUC ?? sales.csd_uc),
      waterPC: num(sales.waterPC ?? sales.water_pc),
      waterUC: num(sales.waterUC ?? sales.water_uc),
      hasUploadedInvoice: false,
      invoices: [],
      distributor,
    });
  }

  return rows.sort(
    (a, b) => (b.invoiceDate?.getTime() ?? 0) - (a.invoiceDate?.getTime() ?? 0)
  );
}

/** Filter dispatch sales rows by date range and search needle. */
export function filterDispatchSalesRows(rows, { startDate = "", endDate = "", search = "" } = {}) {
  let list = Array.isArray(rows) ? [...rows] : [];

  if (startDate) {
    list = list.filter((row) => row.invoiceDateYmd && row.invoiceDateYmd >= startDate);
  }
  if (endDate) {
    list = list.filter((row) => row.invoiceDateYmd && row.invoiceDateYmd <= endDate);
  }

  const needle = String(search || "").trim().toLowerCase();
  if (needle) {
    list = list.filter((row) => {
      const hay = [
        row.distributorName,
        row.distributorCode,
        row.invoiceNo,
        row.orderNumber,
        row.vehicleNo,
        row.invoiceDateDisplay,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }

  return list;
}

/** Build print payload for a dispatched order invoice. */
export function buildShippingInvoicePrintPayload({ order, distributor, brand, gstRate = 0.05 }) {
  if (!order) return null;
  const lines = coerceOrderLineData(order.data).map((line) => enrichLineWithMfgBatch(line, line));
  const transport = getOrderTransport(order);
  const headerDate =
    order.delivered_at ??
    order.deliveredAt ??
    order.dispatched_at ??
    order.dispatchedAt ??
    order.created_at ??
    order.timestamp ??
    new Date();

  return {
    order,
    distributor: distributor || null,
    distributorName:
      order.distributorName ?? order.distributor_name ?? distributor?.name ?? order.distributorCode,
    companyName: brand?.companyName,
    organizationAddress: brand?.address,
    organizationPostNo: brand?.postNo,
    organizationGstNo: brand?.gstNo,
    transport,
    lines,
    headerDate,
    orderNo: order.orderNumber ?? order.order_number,
    gstRate,
  };
}
