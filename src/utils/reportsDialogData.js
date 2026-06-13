import { useMemo } from "react";
import { parseFirestoreDate } from "./dateUtils";
import { ensureProductCatalog, getReportSkuSeeds } from "./productCatalog";
import { readProductRatesFromLocalStorage } from "./productRatesStorage";
import { getActiveOrganizationId } from "../services/tenantScope";
import { buildDispatchSalesReportRows, filterDispatchSalesRows } from "./dispatchSalesReport";

function convertPCtoUC(pc, sku) {
  if (!pc || !sku) return 0;
  const pcNum = Number(pc) || 0;
  const s = sku.toString().toLowerCase().trim().replace(/\s+/g, " ");
  if (s.includes("can") || s.includes("tin")) return 0;
  if ((s.includes("200ml") || s.includes("200 ml")) && (s.includes("water") || s.includes("kinley"))) return (pcNum * 4.8) / 5.678;
  if ((s.includes("300ml") || s.includes("300 ml")) && !s.includes("can")) return (pcNum * 7.2) / 5.678;
  if ((s.includes("500ml") || s.includes("500 ml")) && (s.includes("water") || s.includes("kinley"))) return (pcNum * 12) / 5.678;
  if (s.includes("500ml") || s.includes("500 ml")) return (pcNum * 12) / 5.678;
  if (s.includes("1.25l") || s.includes("1.25 l")) return (pcNum * 15) / 5.678;
  if ((s.includes("1l") || s.includes("1 l")) && (s.includes("water") || s.includes("kinley"))) return (pcNum * 12) / 5.678;
  return 0;
}

export function useReportsData({ salesData, orders, distributors, productRates, reportType, startDate, endDate, selectedRegion, performanceSearch, dispatchSearch }) {
  const workspaceCatalog = useMemo(() => productRates != null ? ensureProductCatalog(productRates) : ensureProductCatalog(readProductRatesFromLocalStorage(getActiveOrganizationId())), [productRates]);
  const reportSalesData = useMemo(() => (Array.isArray(salesData) ? salesData : []).filter((r) => String(r?.source || "").toLowerCase() === "order_delivery").map((record) => {
    const invoiceDate = parseFirestoreDate(record.invoiceDate ?? record.invoice_date);
    return { ...record, distributorCode: record.distributorCode ?? record.distributor_code ?? null, distributorName: record.distributorName ?? record.distributor_name ?? "", matchedDistributorName: record.matchedDistributorName ?? record.distributorName ?? record.distributor_name ?? "", invoiceDate: Number.isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate, csdPC: Number(record.csdPC ?? record.csd_pc ?? 0) || 0, csdUC: Number(record.csdUC ?? record.csd_uc ?? 0) || 0, waterPC: Number(record.waterPC ?? record.water_pc ?? 0) || 0, waterUC: Number(record.waterUC ?? record.water_uc ?? 0) || 0, products: Array.isArray(record.products) ? record.products : [] };
  }), [salesData]);

  const filteredSalesData = useMemo(() => {
    let filtered = reportSalesData;
    if (startDate && endDate) { const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999); filtered = filtered.filter((r) => { const d = parseFirestoreDate(r.invoiceDate); return d >= start && d <= end; }); }
    if (reportType === "performance" && selectedRegion !== "All") {
      const norm = (s) => String(s || "").trim().toLowerCase().replace(/[.,\-_]/g, " ").replace(/\s+/g, " ").trim();
      const sel = selectedRegion.toLowerCase().trim();
      filtered = filtered.filter((record) => {
        const distName = record.matchedDistributorName || record.distributorName || "";
        const distCode = record.distributorCode || "";
        let distributor = distCode ? distributors.find((d) => d.code === distCode) : null;
        if (!distributor && distName) { const n = norm(distName); distributor = distributors.find((d) => norm(d.name) === n || norm(d.name).includes(n) || n.includes(norm(d.name))); }
        if (!distributor?.region) return false;
        const reg = String(distributor.region).toLowerCase().trim();
        return reg === sel || (sel === "southern" && reg.includes("south")) || (sel === "western" && reg.includes("west")) || (sel === "eastern" && reg.includes("east"));
      });
    }
    return filtered;
  }, [reportSalesData, startDate, endDate, selectedRegion, distributors, reportType]);

  const dispatchSalesRows = useMemo(() => buildDispatchSalesReportRows(orders, salesData, distributors), [orders, salesData, distributors]);
  const filteredDispatchRows = useMemo(() => filterDispatchSalesRows(dispatchSalesRows, { startDate, endDate, search: dispatchSearch }), [dispatchSalesRows, startDate, endDate, dispatchSearch]);

  const performanceSkuReport = useMemo(() => {
    const catKey = (c) => { const v = (c || "").toLowerCase().trim(); return v === "csd" ? "csd" : v === "water" ? "water" : null; };
    const seededSkus = getReportSkuSeeds(workspaceCatalog); const map = new Map();
    const getGroup = (record) => { const name = record.matchedDistributorName || record.distributorName || "Unknown"; const key = record.distributorCode || name; if (!map.has(key)) { const g = { key, name, csd: new Map(), water: new Map(), totals: { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 } }; seededSkus.csd.forEach((i) => g.csd.set(i.sku, { ...i })); seededSkus.water.forEach((i) => g.water.set(i.sku, { ...i })); map.set(key, g); } return map.get(key); };
    const addSku = (skuMap, sku, pc, uc) => { if (!skuMap.has(sku)) skuMap.set(sku, { sku, pc: 0, uc: 0 }); const cur = skuMap.get(sku); cur.pc += pc; cur.uc += uc; };
    filteredSalesData.forEach((record) => {
      const group = getGroup(record);
      if (record.products?.length) record.products.forEach((p) => { if (!p?.sku) return; const pc = Number(p.quantity) || 0; if (pc <= 0) return; const cat = catKey(p.category); const uc = Number(p.uc) || convertPCtoUC(pc, p.sku); if (cat === "csd") { addSku(group.csd, p.sku, pc, uc); group.totals.csdPC += pc; group.totals.csdUC += uc; } else if (cat === "water") { addSku(group.water, p.sku, pc, uc); group.totals.waterPC += pc; group.totals.waterUC += uc; } });
      else { if (record.csdPC || record.csdUC) { addSku(group.csd, "CSD Total", record.csdPC, record.csdUC); group.totals.csdPC += record.csdPC; group.totals.csdUC += record.csdUC; } if (record.waterPC || record.waterUC) { addSku(group.water, "K WATER Total", record.waterPC, record.waterUC); group.totals.waterPC += record.waterPC; group.totals.waterUC += record.waterUC; } }
    });
    return Array.from(map.values()).map((g) => ({ ...g, csd: Array.from(g.csd.values()).sort((a, b) => a.sku.localeCompare(b.sku)), water: Array.from(g.water.values()).sort((a, b) => a.sku.localeCompare(b.sku)), totals: { csdPC: Math.round(g.totals.csdPC), csdUC: Math.round(g.totals.csdUC * 100) / 100, waterPC: Math.round(g.totals.waterPC), waterUC: Math.round(g.totals.waterUC * 100) / 100 } })).sort((a, b) => (b.totals.csdUC + b.totals.waterUC) - (a.totals.csdUC + a.totals.waterUC));
  }, [filteredSalesData, workspaceCatalog]);

  const { skuReport, waterSkuReport } = useMemo(() => {
    const agg = (cat) => { const skuMap = new Map(); filteredSalesData.forEach((record) => { (record.products || []).forEach((p) => { if (!p?.sku || (p.category || "").toLowerCase() !== cat) return; const pc = Number(p.quantity) || 0; if (!pc) return; const sku = p.sku.toString().trim(); if (!skuMap.has(sku)) skuMap.set(sku, { sku, totalPC: 0, totalUC: 0 }); const d = skuMap.get(sku); d.totalPC += pc; d.totalUC += convertPCtoUC(pc, sku); }); }); return Array.from(skuMap.values()).map((i) => ({ ...i, totalPC: Math.round(i.totalPC), totalUC: Math.round(i.totalUC * 100) / 100 })).sort((a, b) => b.totalPC - a.totalPC); };
    return { skuReport: agg("csd"), waterSkuReport: agg("water") };
  }, [filteredSalesData]);

  const filteredPerformanceSkuReport = useMemo(() => { const n = performanceSearch.trim().toLowerCase(); return n ? performanceSkuReport.filter((g) => (g.name || "").toLowerCase().includes(n)) : performanceSkuReport; }, [performanceSkuReport, performanceSearch]);
  const reportHasRows = reportType === "performance" ? performanceSkuReport.length > 0 : reportType === "dispatch" ? filteredDispatchRows.length > 0 : skuReport.length > 0 || waterSkuReport.length > 0;

  return { reportSalesData, filteredSalesData, dispatchSalesRows, filteredDispatchRows, performanceSkuReport, filteredPerformanceSkuReport, skuReport, waterSkuReport, reportHasRows };
}
