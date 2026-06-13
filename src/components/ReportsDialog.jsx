/** Admin reports — performance, SKU, and dispatch sales. */
import React, { useState, useRef } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Paper,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SaveAltOutlinedIcon from "@mui/icons-material/SaveAltOutlined";
import { logger } from "../utils/logger";
import { useReportsData } from "../utils/reportsDialogData";
import { buildShippingInvoicePrintPayload } from "../utils/dispatchSalesReport";
import { downloadAllShippingInvoices, downloadShippingInvoice } from "../utils/shippingInvoiceActions";
import { generateShippingInvoiceFile, openShippingOrderInvoicePrint } from "../utils/shippingOrderInvoicePrint";
import { useBrand } from "../hooks/useBrand";
import { useOrganizationOptional } from "../context/OrganizationProvider";
import AppSnackbar from "./AppSnackbar";
import {
  REPORT_TABS,
  ReportTabsBar,
  ReportFiltersPanel,
  ReportTableShell,
  ReportEmptyState,
  PerformanceReportTable,
  DispatchReportTable,
  SkuReportTables,
  useReportTableStyles,
} from "./reports/ReportsDialogSections";

export default function ReportsDialog({
  open,
  onClose,
  distributors = [],
  salesData = [],
  orders = [],
  productRates = null,
}) {
  const [reportType, setReportType] = useState("performance");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [performanceSearch, setPerformanceSearch] = useState("");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [invoiceActionKey, setInvoiceActionKey] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [exportingPDF, setExportingPDF] = useState(false);
  const tableRef = useRef(null);
  const theme = useTheme();
  const brand = useBrand();
  const orgCtx = useOrganizationOptional();
  const tableStyles = useReportTableStyles();

  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const data = useReportsData({
    salesData,
    orders,
    distributors,
    productRates,
    reportType,
    startDate,
    endDate,
    selectedRegion,
    performanceSearch,
    dispatchSearch,
  });

  const {
    reportSalesData,
    filteredSalesData,
    dispatchSalesRows,
    filteredDispatchRows,
    filteredPerformanceSkuReport,
    performanceSkuReport,
    skuReport,
    waterSkuReport,
    reportHasRows,
  } = data;

  React.useEffect(() => {
    if (!open) return;
    setPerformanceSearch("");
    setDispatchSearch("");
  }, [open]);

  const validateDateRange = (start, end) => {
    if (!start || !end) {
      setDateError("");
      return true;
    }
    if (new Date(end) < new Date(start)) {
      setDateError("End date must be after start date");
      return false;
    }
    setDateError("");
    return true;
  };

  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedRegion("All");
    setDispatchSearch("");
    setPerformanceSearch("");
    setDateError("");
  };

  const hasFilters = Boolean(
    startDate ||
      endDate ||
      dispatchSearch.trim() ||
      performanceSearch.trim() ||
      (reportType === "performance" && selectedRegion !== "All")
  );

  const filteredCount =
    reportType === "dispatch" ? filteredDispatchRows.length : filteredSalesData.length;

  const activeTabMeta = REPORT_TABS.find((t) => t.value === reportType);

  const handleDownloadExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (reportType === "dispatch") {
        const ws = XLSX.utils.aoa_to_sheet([
          ["Dispatch Sales Report"],
          [startDate && endDate ? `${startDate} to ${endDate}` : "All data"],
          [],
          ["Invoice Date", "Invoice No.", "Vehicle No.", "Distributor", "Order No.", "CSD PC", "CSD UC", "Water PC", "Water UC"],
          ...filteredDispatchRows.map((r) => [
            r.invoiceDateDisplay,
            r.invoiceNo,
            r.vehicleNo,
            r.distributorName,
            r.orderNumber,
            r.csdPC,
            r.csdUC,
            r.waterPC,
            r.waterUC,
          ]),
        ]);
        XLSX.utils.book_append_sheet(wb, ws, "Dispatch Sales");
      } else if (reportType === "performance") {
        const wsData = [["Distributor Performance"], [startDate && endDate ? `${startDate} to ${endDate}` : "All data"], []];
        performanceSkuReport.forEach((g, i) => {
          if (i) wsData.push([]);
          wsData.push([`Distributor: ${g.name}`], ["SKU", "PC", "UC", "SKU", "PC", "UC"]);
          const n = Math.max(g.csd.length, g.water.length);
          for (let j = 0; j < n; j += 1) {
            const c = g.csd[j];
            const w = g.water[j];
            wsData.push([c?.sku || "", c?.pc ?? "", c?.uc ?? "", w?.sku || "", w?.pc ?? "", w?.uc ?? ""]);
          }
          wsData.push(["TOTAL", g.totals.csdPC, g.totals.csdUC, "TOTAL", g.totals.waterPC, g.totals.waterUC]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Performance");
      } else {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["CSD SKU"], [], ["SKU", "PC", "UC"], ...skuReport.map((r) => [r.sku, r.totalPC, r.totalUC])]),
          "CSD"
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([["Water SKU"], [], ["SKU", "PC", "UC"], ...waterSkuReport.map((r) => [r.sku, r.totalPC, r.totalUC])]),
          "Water"
        );
      }

      XLSX.writeFile(wb, `report_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showSnackbar("Excel report downloaded", "success");
    } catch (e) {
      showSnackbar(e.message || "Excel export failed", "error");
    }
  };

  const handlePrintDispatchInvoice = async (row) => {
    if (!row?.order && !row?.hasUploadedInvoice) {
      showSnackbar("No invoice available for this row", "warning");
      return;
    }
    setInvoiceActionKey(row.key);
    try {
      if (row.hasUploadedInvoice && row.invoices?.length) {
        const { createInvoicePreviewUrl } = await import("../utils/shippingInvoiceActions");
        const inv = row.invoices.find((i) => i.mimeType?.includes("pdf")) || row.invoices[0];
        const { url } = createInvoicePreviewUrl(inv);
        const win = window.open(url, "_blank");
        if (!win) throw new Error("Pop-up blocked. Allow pop-ups to print.");
        win.addEventListener("load", () => setTimeout(() => { win.focus(); win.print(); }, 500), { once: true });
      } else {
        openShippingOrderInvoicePrint(
          buildShippingInvoicePrintPayload({ order: row.order, distributor: row.distributor, brand, organization: orgCtx?.organization })
        );
      }
      showSnackbar("Invoice opened for printing", "success");
    } catch (e) {
      showSnackbar(e.message || "Print failed", "error");
    } finally {
      setInvoiceActionKey("");
    }
  };

  const handleSaveDispatchInvoice = async (row) => {
    setInvoiceActionKey(row.key);
    try {
      if (row.hasUploadedInvoice && row.invoices?.length) {
        downloadAllShippingInvoices(row.invoices);
        showSnackbar("Invoice saved", "success");
      } else if (row.order) {
        const file = await generateShippingInvoiceFile(
          buildShippingInvoicePrintPayload({ order: row.order, distributor: row.distributor, brand, organization: orgCtx?.organization })
        );
        downloadShippingInvoice(file);
        showSnackbar("Invoice saved as PDF", "success");
      } else {
        showSnackbar("No invoice available", "warning");
      }
    } catch (e) {
      showSnackbar(e.message || "Save failed", "error");
    } finally {
      setInvoiceActionKey("");
    }
  };

  const handleSaveAllDispatchInvoices = async () => {
    const rows = filteredDispatchRows.filter((r) => r.hasUploadedInvoice || r.order);
    if (!rows.length) {
      showSnackbar("No invoices to save in current filter", "warning");
      return;
    }
    let saved = 0;
    for (const row of rows) {
      try {
        if (row.hasUploadedInvoice) {
          downloadAllShippingInvoices(row.invoices);
          saved += row.invoices.length;
        } else if (row.order) {
          const file = await generateShippingInvoiceFile(
            buildShippingInvoicePrintPayload({ order: row.order, distributor: row.distributor, brand, organization: orgCtx?.organization })
          );
          downloadShippingInvoice(file);
          saved += 1;
          await new Promise((r) => setTimeout(r, 450));
        }
      } catch (e) {
        logger.warn("Save all invoices — row failed:", row.key, e);
      }
    }
    showSnackbar(saved ? `Saved ${saved} file${saved === 1 ? "" : "s"}` : "Could not save invoices", saved ? "success" : "warning");
  };

  const handleDownloadPDF = async () => {
    if (!tableRef.current) return;
    setExportingPDF(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const root = tableRef.current;
      const containers = Array.from(root.querySelectorAll(".MuiTableContainer-root"));
      const restore = [];
      (containers.length ? containers : [root]).forEach((el) => {
        restore.push({ el, maxHeight: el.style.maxHeight, overflow: el.style.overflow });
        el.style.maxHeight = "none";
        el.style.overflow = "visible";
      });
      await new Promise((r) => setTimeout(r, 200));
      const canvas = await html2canvas(root, { scale: 2, useCORS: true, logging: false });
      restore.forEach(({ el, maxHeight, overflow }) => {
        el.style.maxHeight = maxHeight;
        el.style.overflow = overflow;
      });

      const pdf = new jsPDF("l", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const aw = pw - 20;
      const ratio = aw / canvas.width;
      pdf.setFontSize(14);
      pdf.text(activeTabMeta?.label || "Report", pw / 2, 12, { align: "center" });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 18, aw, canvas.height * ratio);
      pdf.save(`Sales_Report_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
      showSnackbar("PDF exported", "success");
    } catch (e) {
      showSnackbar(e.message || "PDF export failed", "error");
    } finally {
      setExportingPDF(false);
    }
  };

  const renderReportBody = () => {
    if (reportType === "performance") {
      if (performanceSkuReport.length === 0) {
        return (
          <ReportEmptyState
            title="No performance data yet"
            message="Dispatch orders from Shipping to record sales lifts, then return here to review distributor performance."
          />
        );
      }
      if (filteredPerformanceSkuReport.length === 0) {
        return (
          <ReportEmptyState
            title="No distributors match your filters"
            message="Try clearing the search box or widening the date range."
          />
        );
      }
      return <PerformanceReportTable groups={filteredPerformanceSkuReport} styles={tableStyles} />;
    }

    if (reportType === "dispatch") {
      if (filteredDispatchRows.length === 0) {
        return (
          <ReportEmptyState
            title={dispatchSalesRows.length ? "Nothing matches these filters" : "No dispatched orders yet"}
            message={
              dispatchSalesRows.length
                ? "Adjust the date range or search terms to see dispatch records."
                : "Mark orders as dispatched in Shipping to populate this report."
            }
          />
        );
      }
      return (
        <DispatchReportTable
          rows={filteredDispatchRows}
          styles={tableStyles}
          invoiceActionKey={invoiceActionKey}
          onPrint={handlePrintDispatchInvoice}
          onSave={handleSaveDispatchInvoice}
        />
      );
    }

    return <SkuReportTables csdRows={skuReport} waterRows={waterSkuReport} styles={tableStyles} />;
  };

  const tableChips =
    reportType === "dispatch" ? (
      <>
        <Chip size="small" label={`${filteredDispatchRows.length} shown`} />
        <Chip size="small" variant="outlined" label={`${dispatchSalesRows.length} total`} />
      </>
    ) : reportType === "performance" ? (
      <Chip size="small" label={`${filteredPerformanceSkuReport.length} distributors`} />
    ) : (
      <>
        <Chip size="small" label={`CSD: ${skuReport.length}`} />
        <Chip size="small" color="info" variant="outlined" label={`Water: ${waterSkuReport.length}`} />
      </>
    );

  const filteredLabel = reportType === "dispatch" ? "orders" : "records";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { display: "flex", flexDirection: "column", bgcolor: "background.default" } }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: "#fff",
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1, color: "inherit" }}>
          <AssessmentOutlinedIcon sx={{ fontSize: 22 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: "0.95rem" }}>
              Reports
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.88, fontSize: "0.65rem", display: "block" }}>
              {distributors?.length ?? 0} dist · {reportSalesData.length} lifts · {filteredCount} {filteredLabel}
            </Typography>
          </Box>
          <IconButton size="small" color="inherit" onClick={onClose} aria-label="Close reports">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Container maxWidth="xl" sx={{ py: 1, pb: 6 }}>
          <Stack spacing={1}>
            <ReportTabsBar reportType={reportType} onChange={setReportType} />

            <ReportFiltersPanel
              reportType={reportType}
              startDate={startDate}
              endDate={endDate}
              dateError={dateError}
              selectedRegion={selectedRegion}
              performanceSearch={performanceSearch}
              dispatchSearch={dispatchSearch}
              filteredCount={filteredCount}
              hasFilters={hasFilters}
              onStartChange={(v) => {
                setStartDate(v);
                validateDateRange(v, endDate);
              }}
              onEndChange={(v) => {
                setEndDate(v);
                validateDateRange(startDate, v);
              }}
              onRegionChange={setSelectedRegion}
              onPerformanceSearchChange={setPerformanceSearch}
              onDispatchSearchChange={setDispatchSearch}
              onReset={resetFilters}
            />

            <ReportTableShell
              title={activeTabMeta?.label || "Report"}
              chips={tableChips}
              tableRef={tableRef}
            >
              {renderReportBody()}
            </ReportTableShell>
          </Stack>
        </Container>
      </Box>

      <Paper
        elevation={4}
        square
        sx={{
          position: "sticky",
          bottom: 0,
          borderTop: 1,
          borderColor: "divider",
          px: { xs: 1.25, sm: 2 },
          py: 0.75,
        }}
      >
        <Container maxWidth="xl" sx={{ px: 0 }}>
          <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
            {reportType === "dispatch" && filteredDispatchRows.length > 0 ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<SaveAltOutlinedIcon fontSize="small" />}
                onClick={handleSaveAllDispatchInvoices}
                sx={{ fontWeight: 700 }}
              >
                Save all
              </Button>
            ) : null}
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon fontSize="small" />}
              onClick={handleDownloadExcel}
              disabled={!reportHasRows}
              sx={{ fontWeight: 700 }}
            >
              Excel
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={exportingPDF ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfIcon fontSize="small" />}
              onClick={handleDownloadPDF}
              disabled={exportingPDF || !reportHasRows}
              sx={{ fontWeight: 700 }}
            >
              {exportingPDF ? "PDF…" : "PDF"}
            </Button>
          </Stack>
        </Container>
      </Paper>

      <AppSnackbar
        open={snackbar.open}
        severity={snackbar.severity}
        message={snackbar.message}
        autoHideDuration={4200}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </Dialog>
  );
}
