import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  Button,
  Typography,
  Box,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment,
  Slide,
  Paper,
  Chip,
  Alert,
  Stack,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PhysicalStockMatrix from "./PhysicalStockMatrix";
import {
  normalizePhysicalStockPayload,
  getRawPhysicalStockFromDistributor,
  aggregatePhysicalStockTotals,
  flattenPhysicalStockRowsForExport,
  resolvePhysicalStockProductLines,
} from "../utils/physicalStockTemplate";
import { getAdminPhysicalStockLastSeenAt, getPhysicalStockUpdatesSince } from "../utils/adminPhysicalStockSignals";
import { alpha, useTheme } from "@mui/material/styles";
import { supabase, fetchDistributorPhysicalStockSnapshots } from "../services/supabaseService";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function distributorRowKey(d) {
  return String(d?.code ?? d?.id ?? d?.name ?? "").trim() || d?.name || "—";
}

export default function PhysicalStockAdminDialog({
  open,
  onClose,
  distributors,
  onOpened,
  productRates = null,
}) {
  const theme = useTheme();
  const productLines = useMemo(
    () => resolvePhysicalStockProductLines(productRates),
    [productRates]
  );
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const openSessionRef = useRef(false);

  const sorted = useMemo(() => {
    const list = Array.isArray(distributors) ? [...distributors] : [];
    list.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    return list;
  }, [distributors]);

  const distributorByCode = useMemo(() => {
    const m = new Map();
    for (const d of sorted) {
      const c = String(d?.code ?? d?.id ?? "").trim();
      if (!c) continue;
      m.set(c, d);
      m.set(c.toUpperCase(), d);
    }
    return m;
  }, [sorted]);

  useEffect(() => {
    if (!open) return;
    const to = new Date().toISOString().slice(0, 10);
    const start = new Date();
    start.setDate(1);
    const from = start.toISOString().slice(0, 10);
    setExportDateFrom(from);
    setExportDateTo(to);
  }, [open]);

  const todayUpdated = useMemo(() => {
    const isSameLocalDay = (isoLike) => {
      if (!isoLike) return false;
      const d = new Date(isoLike);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    };
    return sorted.filter((d) => {
      const raw = getRawPhysicalStockFromDistributor(d);
      return isSameLocalDay(raw?.updatedAt || raw?.reportDate);
    });
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return todayUpdated;
    return todayUpdated.filter(
      (d) =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.code && String(d.code).toLowerCase().includes(q)) ||
        (d.region && String(d.region).toLowerCase().includes(q))
    );
  }, [todayUpdated, query]);

  const displayed = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [filtered]);

  const withDataCount = todayUpdated.length;

  const recentUpdaterKeys = useMemo(() => {
    const s = new Set();
    for (const { distributor: d } of recentUpdates) {
      const k = distributorRowKey(d);
      if (k && k !== "—") s.add(k);
    }
    return s;
  }, [recentUpdates]);

  useEffect(() => {
    if (!open) {
      openSessionRef.current = false;
      setRecentUpdates([]);
      return;
    }
    if (openSessionRef.current) return;
    if (!Array.isArray(distributors) || distributors.length === 0) return;

    const since = getAdminPhysicalStockLastSeenAt();
    const list = getPhysicalStockUpdatesSince(distributors, since);
    setRecentUpdates(list);
    onOpened?.();
    openSessionRef.current = true;
  }, [open, distributors, onOpened]);

  const handleAccordion = (code) => (_, isExp) => {
    setExpanded(isExp ? code : false);
  };

  const resolveDistributor = useCallback(
    (code) => {
      const c = String(code || "").trim();
      if (!c) return { name: "", code: "", region: "" };
      const d = distributorByCode.get(c) || distributorByCode.get(c.toUpperCase());
      return {
        name: d?.name || "",
        code: d?.code || d?.id || c,
        region: d?.region || "",
      };
    },
    [distributorByCode]
  );

  const handleDownloadExcel = async () => {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");
      let summaryRows = [];
      let detailRows = [];
      let usedHistory = false;

      if (supabase && exportDateFrom && exportDateTo && exportDateFrom <= exportDateTo) {
        try {
          const snaps = await fetchDistributorPhysicalStockSnapshots({
            dateFrom: exportDateFrom,
            dateTo: exportDateTo,
          });
          if (snaps.length > 0) {
            usedHistory = true;
            for (const s of snaps) {
              const code = String(s.distributor_code || "").trim();
              const dist = resolveDistributor(code);
              const norm = normalizePhysicalStockPayload(s.payload || {}, productRates);
              const reportDate =
                typeof s.report_date === "string"
                  ? s.report_date.slice(0, 10)
                  : norm.reportDate || "";
              const totals = aggregatePhysicalStockTotals(norm.rows);
              summaryRows.push({
                distributor_name: dist.name,
                distributor_code: dist.code || code,
                region: dist.region,
                report_date: reportDate,
                last_saved: norm.updatedAt || "",
                opening_total: totals.opening,
                primary_total: totals.primary,
                physical_total: totals.physical,
                secondary_total: totals.secondary,
              });
              for (const line of flattenPhysicalStockRowsForExport(norm.rows)) {
                detailRows.push({
                  distributor_name: dist.name,
                  distributor_code: dist.code || code,
                  region: dist.region,
                  report_date: reportDate,
                  product_sku: line.product_sku,
                  fifo_lot_seq: line.fifo_lot_seq,
                  mfg_date: line.mfg_date,
                  batch_no: line.batch_no,
                  bbd_date: line.bbd_date,
                  opening_stock_qty: line.opening_stock_qty,
                  primary_sale: line.primary_sale,
                  physical_stock_qty: line.physical_stock_qty,
                  secondary_sale: line.secondary_sale,
                });
              }
            }
          }
        } catch (fetchErr) {
          console.warn("Physical stock history export:", fetchErr);
        }
      }

      if (summaryRows.length === 0) {
        const distributorsForExport = displayed.filter((d) => !!getRawPhysicalStockFromDistributor(d));
        if (distributorsForExport.length === 0) {
          alert(
            supabase
              ? "No rows for this date range in Supabase, and no physical stock for distributors updated today. Widen the range or ensure distributors have saved stock after adding the snapshots table."
              : "No physical stock data available for today's updated distributors. Connect Supabase and add distributor_physical_stock_snapshots to export by date range."
          );
          return;
        }

        summaryRows = distributorsForExport.map((d) => {
          const raw = getRawPhysicalStockFromDistributor(d);
          const norm = normalizePhysicalStockPayload(raw || {}, productRates);
          const totals = aggregatePhysicalStockTotals(norm.rows);
          return {
            distributor_name: d.name || "",
            distributor_code: d.code || d.id || "",
            region: d.region || "",
            report_date: norm.reportDate || "",
            last_saved: norm.updatedAt || "",
            opening_total: totals.opening,
            primary_total: totals.primary,
            physical_total: totals.physical,
            secondary_total: totals.secondary,
          };
        });

        detailRows = [];
        for (const d of distributorsForExport) {
          const raw = getRawPhysicalStockFromDistributor(d);
          const norm = normalizePhysicalStockPayload(raw || {}, productRates);
          const reportDate = norm.reportDate || "";
          for (const line of flattenPhysicalStockRowsForExport(norm.rows)) {
            detailRows.push({
              distributor_name: d.name || "",
              distributor_code: d.code || d.id || "",
              region: d.region || "",
              report_date: reportDate,
              product_sku: line.product_sku,
              fifo_lot_seq: line.fifo_lot_seq,
              mfg_date: line.mfg_date,
              batch_no: line.batch_no,
              bbd_date: line.bbd_date,
              opening_stock_qty: line.opening_stock_qty,
              primary_sale: line.primary_sale,
              physical_stock_qty: line.physical_stock_qty,
              secondary_sale: line.secondary_sale,
            });
          }
        }

        if (supabase && !usedHistory) {
          console.info(
            "Excel export used today's in-app list only. Historical rows appear after distributors save stock and distributor_physical_stock_snapshots exists in Supabase."
          );
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Distributor Totals");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "SKU Details");

      const tag =
        usedHistory && exportDateFrom && exportDateTo
          ? `${exportDateFrom}_to_${exportDateTo}`
          : new Date().toISOString().split("T")[0];
      const filename = `Physical_Stock_${tag}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Failed to export physical stock excel:", error);
      alert("Failed to export physical stock Excel file.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      TransitionComponent={Transition}
      TransitionProps={{ timeout: 200 }}
      scroll="paper"
      PaperProps={{
        elevation: 0,
        sx: {
          bgcolor: "background.default",
          color: "text.primary",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
          color: "#fff",
          px: { xs: 1.25, sm: 2 },
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <WarehouseOutlinedIcon sx={{ fontSize: 22 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: "0.95rem" }}>
            Physical stock overview
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.88, fontSize: "0.65rem" }}>
            {withDataCount} distributor{withDataCount !== 1 ? "s" : ""} updated today
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: "#fff" }} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Paper
        elevation={0}
        square
        sx={{
          flexShrink: 0,
          px: { xs: 1.25, sm: 2 },
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={0.75}
          alignItems={{ xs: "stretch", md: "center" }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            placeholder="Search name, code, region…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ flex: "1 1 180px", minWidth: { md: 200 } }}
          />
          <TextField
            label="Export from"
            type="date"
            size="small"
            value={exportDateFrom}
            onChange={(e) => setExportDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: "100%", sm: 138 } }}
          />
          <TextField
            label="Export to"
            type="date"
            size="small"
            value={exportDateTo}
            onChange={(e) => setExportDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: "100%", sm: 138 } }}
          />
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: { xs: 1, sm: 1.5 },
          py: 1,
        }}
      >
        {productLines.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 1, py: 0.25, borderRadius: 1.5, fontSize: "0.75rem" }}>
            Add products in <strong>Rate Master</strong> first — physical stock rows follow that catalogue.
          </Alert>
        ) : null}

        {recentUpdates.length > 0 ? (
          <Alert
            icon={<NotificationsActiveOutlinedIcon sx={{ fontSize: 18 }} />}
            severity="success"
            variant="outlined"
            sx={{
              mb: 1,
              py: 0.35,
              borderRadius: 1.5,
              alignItems: "center",
              bgcolor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.12 : 0.06),
              "& .MuiAlert-message": { width: "100%", py: 0.25 },
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 800, display: "block", mb: 0.5 }}>
              New since last visit ({recentUpdates.length})
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5} useFlexGap>
              {recentUpdates.map(({ distributor: d, updatedAt }) => (
                <Chip
                  key={`${distributorRowKey(d)}-${updatedAt}`}
                  size="small"
                  label={`${d.name || d.code || "—"} · ${formatWhen(updatedAt)}`}
                  color="success"
                  sx={{ height: 22, fontWeight: 600, fontSize: "0.65rem" }}
                />
              ))}
            </Stack>
          </Alert>
        ) : null}

        {displayed.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2.5, textAlign: "center", borderRadius: 1.5, bgcolor: "background.paper" }}>
            <Typography variant="body2" color="text.secondary">
              No distributors updated physical stock today.
            </Typography>
          </Paper>
        ) : (
          displayed.map((d) => {
            const raw = getRawPhysicalStockFromDistributor(d);
            const norm = normalizePhysicalStockPayload(raw || {}, productRates);
            const distTotals = aggregatePhysicalStockTotals(norm.rows);
            const code = d.code || d.id || "";
            const rowKey = distributorRowKey(d);
            const expandKey = code || rowKey || d.name;
            const isRecent = recentUpdaterKeys.has(rowKey);
            return (
              <Accordion
                key={rowKey || d.name}
                expanded={expanded === expandKey}
                onChange={handleAccordion(expandKey)}
                disableGutters
                sx={{
                  mb: 0.75,
                  borderRadius: "8px !important",
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  borderLeft: isRecent ? "3px solid" : "1px solid",
                  borderLeftColor: isRecent ? "success.main" : "divider",
                  bgcolor: "background.paper",
                  color: "text.primary",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ fontSize: 20 }} />}
                  sx={{
                    px: { xs: 0.75, sm: 1 },
                    py: 0.35,
                    minHeight: 0,
                    "& .MuiAccordionSummary-content": { my: 0.25, alignItems: "center" },
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" },
                      alignItems: { xs: "stretch", sm: "center" },
                      justifyContent: "space-between",
                      gap: 0.5,
                      width: "100%",
                      pr: 0.25,
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", lineHeight: 1.2 }}>
                        {d.name || "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.62rem", lineHeight: 1.25 }}>
                        {code || "—"}
                        {d.region ? ` · ${d.region}` : ""}
                        {" · "}
                        Rpt {norm.reportDate || "—"}
                        {" · "}
                        {formatWhen(norm.updatedAt)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.35,
                        alignItems: "center",
                        flexShrink: 0,
                        justifyContent: { xs: "flex-start", sm: "flex-end" },
                      }}
                    >
                      {raw ? (
                        <>
                          <Chip
                            label={`P ${distTotals.primary.toLocaleString()}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: "0.62rem",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                          <Chip
                            label={`Phy ${distTotals.physical.toLocaleString()}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: "0.62rem",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                          <Chip
                            label={`S ${distTotals.secondary.toLocaleString()}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontWeight: 700,
                              fontSize: "0.62rem",
                              "& .MuiChip-label": { px: 0.75 },
                            }}
                          />
                        </>
                      ) : (
                        <Chip label="No data" size="small" variant="outlined" sx={{ height: 22, fontSize: "0.62rem" }} />
                      )}
                      {isRecent ? (
                        <Chip
                          label="New"
                          size="small"
                          color="success"
                          sx={{
                            height: 22,
                            fontWeight: 800,
                            fontSize: "0.6rem",
                            "& .MuiChip-label": { px: 0.65 },
                          }}
                        />
                      ) : null}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    pt: 0,
                    px: { xs: 0.5, sm: 1 },
                    pb: 1,
                    bgcolor: "action.hover",
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {!raw ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 1, textAlign: "center" }}>
                      No physical stock submitted yet.
                    </Typography>
                  ) : (
                    <PhysicalStockMatrix
                      rows={norm.rows}
                      readOnly
                      variant="default"
                      maxHeight="min(72vh, 640px)"
                      boldDataValues
                    />
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </Box>

      <Paper
        elevation={4}
        square
        sx={{
          flexShrink: 0,
          px: { xs: 1.25, sm: 2 },
          py: 0.6,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 0.75,
          bgcolor: "background.paper",
        }}
      >
        <Button
          onClick={handleDownloadExcel}
          variant="outlined"
          color="inherit"
          size="small"
          disabled={exporting || !exportDateFrom || !exportDateTo || exportDateFrom > exportDateTo}
          startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ fontWeight: 700, fontSize: "0.75rem", textTransform: "none" }}
        >
          Excel
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          color="error"
          size="small"
          sx={{ fontWeight: 700, fontSize: "0.75rem", textTransform: "none" }}
        >
          Close
        </Button>
      </Paper>
    </Dialog>
  );
}
