import React, { useMemo, useState } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Paper,
  TextField,
  InputAdornment,
  Slide,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  FormControlLabel,
  Checkbox,
  Divider,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import TableChartIcon from "@mui/icons-material/TableChart";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StockLiftingRecordsTable from "./StockLiftingRecordsTable";
import StockLiftingSkuDialog, {
  formatStockLiftSkuDialogDate,
  stockLiftRowToSalesRecord,
} from "./StockLiftingSkuDialog";
import { parseTargetPeriodBounds } from "../utils/targetPeriod";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const REGION_OPTIONS = ["All", "Southern", "Western", "Eastern", "PLING", "THIM"];

const REGION_ALIAS = { South: "Southern", West: "Western", East: "Eastern", PLING: "PLING", THIM: "THIM" };

function normRegion(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function resolvedRegionFilterKey(selected) {
  if (selected === "All") return null;
  return REGION_ALIAS[selected] || selected;
}

function saleInvoiceDate(sale) {
  const raw = sale?.invoiceDate;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapSaleToRecord(sale, distributorLabel) {
  const inv = saleInvoiceDate(sale);
  return {
    id: sale.id,
    invoiceDate: inv,
    date: inv ? inv.toISOString().split("T")[0] : null,
    csdPC: Number(sale.csdPC) || 0,
    csdUC: Number(sale.csdUC) || 0,
    waterPC: Number(sale.waterPC) || 0,
    waterUC: Number(sale.waterUC) || 0,
    distributorLabel,
    source: sale.source,
    products: Array.isArray(sale.products) ? sale.products : [],
    distributorCode: sale.distributorCode,
  };
}

function saleToSalesRecord(sale) {
  if (!sale) return null;
  return {
    id: sale.id,
    invoiceDate: saleInvoiceDate(sale),
    products: Array.isArray(sale.products) ? sale.products : [],
    csdPC: sale.csdPC,
    csdUC: sale.csdUC,
    waterPC: sale.waterPC,
    waterUC: sale.waterUC,
  };
}

/**
 * Admin: browse stock lifting rows from `sales_data` (same source as distributor Stock lifting),
 * filtered by region and distributor.
 */
export default function AdminStockLiftingRecordsDialog({
  open,
  onClose,
  distributors = [],
  allSalesData = [],
  targetPeriod = null,
}) {
  const theme = useTheme();
  const [regionFilter, setRegionFilter] = useState("All");
  const [distributorCode, setDistributorCode] = useState("__all__");
  const [search, setSearch] = useState("");
  const [limitToTargetPeriod, setLimitToTargetPeriod] = useState(true);
  const [skuDialog, setSkuDialog] = useState(null);

  const codeToDistributor = useMemo(() => {
    const m = new Map();
    for (const d of distributors) {
      const c = d?.code != null ? String(d.code).trim() : "";
      if (c) m.set(c, d);
    }
    return m;
  }, [distributors]);

  const distributorsInRegion = useMemo(() => {
    const want = resolvedRegionFilterKey(regionFilter);
    const wantNorm = want ? normRegion(want) : null;
    const list = Array.isArray(distributors) ? [...distributors] : [];
    const filtered = !wantNorm
      ? list
      : list.filter((d) => normRegion(d.region) === wantNorm);
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    return filtered;
  }, [distributors, regionFilter]);

  const allowedCodes = useMemo(() => {
    const s = new Set();
    for (const d of distributorsInRegion) {
      const c = d?.code != null ? String(d.code).trim() : "";
      if (c) s.add(c);
    }
    return s;
  }, [distributorsInRegion]);

  const periodBounds = useMemo(() => {
    if (!targetPeriod?.start || !targetPeriod?.end) return { start: null, end: null };
    return parseTargetPeriodBounds(targetPeriod.start, targetPeriod.end);
  }, [targetPeriod]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = [];

    for (const sale of allSalesData || []) {
      if (!sale) continue;
      const code = sale.distributorCode != null ? String(sale.distributorCode).trim() : "";
      if (!code || !allowedCodes.has(code)) continue;

      if (distributorCode !== "__all__" && code !== distributorCode) continue;

      const d = codeToDistributor.get(code);
      const label = d
        ? `${d.name || code}${d.region ? ` · ${d.region}` : ""} (${code})`
        : `${sale.distributorName || "Unknown"} (${code})`;

      if (q) {
        const hay = `${label} ${code} ${sale.distributorName || ""}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      if (limitToTargetPeriod && periodBounds.start && periodBounds.end) {
        const dt = saleInvoiceDate(sale);
        if (!dt || dt < periodBounds.start || dt > periodBounds.end) continue;
      }

      rows.push(mapSaleToRecord(sale, distributorCode === "__all__" ? label : `${d?.name || sale.distributorName || code} (${code})`));
    }

    rows.sort((a, b) => {
      const ta = a.invoiceDate ? a.invoiceDate.getTime() : 0;
      const tb = b.invoiceDate ? b.invoiceDate.getTime() : 0;
      return tb - ta;
    });

    return rows;
  }, [
    allSalesData,
    allowedCodes,
    codeToDistributor,
    distributorCode,
    limitToTargetPeriod,
    periodBounds.end,
    periodBounds.start,
    search,
  ]);

  const liftTotals = useMemo(() => {
    let csdPC = 0;
    let csdUC = 0;
    let waterPC = 0;
    let waterUC = 0;
    for (const r of filteredRecords) {
      csdPC += Number(r.csdPC) || 0;
      csdUC += Number(r.csdUC) || 0;
      waterPC += Number(r.waterPC) || 0;
      waterUC += Number(r.waterUC) || 0;
    }
    return { csdPC, csdUC, waterPC, waterUC };
  }, [filteredRecords]);

  const showDistributorColumn = distributorCode === "__all__";

  const salesRecordsForFilteredRows = useMemo(() => {
    const ids = new Set(filteredRecords.map((r) => r.id).filter(Boolean));
    return (allSalesData || [])
      .filter((s) => s?.id && ids.has(s.id))
      .map(saleToSalesRecord)
      .filter(Boolean);
  }, [allSalesData, filteredRecords]);

  const handleLiftRowClick = (record) => {
    const sale = (allSalesData || []).find((s) => s?.id === record?.id);
    const salesRecord = sale ? saleToSalesRecord(sale) : stockLiftRowToSalesRecord(record);
    if (!salesRecord) return;
    setSkuDialog({
      title: "SKU liftings · one lift",
      subtitle: record.distributorLabel || "",
      salesRecords: [salesRecord],
      liftDateLabel: formatStockLiftSkuDialogDate(record),
    });
  };

  const handleTotalsClick = () => {
    if (salesRecordsForFilteredRows.length === 0) return;
    const distLabel =
      distributorCode === "__all__"
        ? `All distributors in view (${filteredRecords.length} lift row(s))`
        : filteredRecords[0]?.distributorLabel || "";
    setSkuDialog({
      title: "SKU liftings · all lifts in table",
      subtitle: distLabel,
      salesRecords: salesRecordsForFilteredRows,
      liftDateLabel: `${filteredRecords.length} lifting row(s) · current filters`,
    });
  };

  const resetFilters = () => {
    setRegionFilter("All");
    setDistributorCode("__all__");
    setSearch("");
    setLimitToTargetPeriod(true);
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
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 1.25, sm: 1.5 },
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          boxShadow: "0 4px 12px rgba(142, 0, 0, 0.35)",
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TableChartIcon sx={{ fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" }, lineHeight: 1.2 }}>
            Stock lifting records
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.25, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>
            Rows come from sales data (admin Excel upload). Filter by region and distributor; totals update for the visible rows.
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: "#fff" }} size="large">
          <CloseIcon />
        </IconButton>
      </Box>

      <Paper
        elevation={1}
        sx={{
          flexShrink: 0,
          mx: { xs: 1.5, sm: 2 },
          mt: 2,
          mb: 0,
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.75 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.02, mb: 1.25 }}>
            Filters
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap alignItems={{ sm: "flex-start" }}>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
                <InputLabel id="admin-sl-region">Region</InputLabel>
                <Select
                  labelId="admin-sl-region"
                  label="Region"
                  value={regionFilter}
                  onChange={(e) => {
                    setRegionFilter(e.target.value);
                    setDistributorCode("__all__");
                  }}
                >
                  {REGION_OPTIONS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 280 }, flex: { sm: "1 1 240px" } }}>
                <InputLabel id="admin-sl-dist">Distributor</InputLabel>
                <Select
                  labelId="admin-sl-dist"
                  label="Distributor"
                  value={distributorCode}
                  onChange={(e) => setDistributorCode(e.target.value)}
                >
                  <MenuItem value="__all__">All in {regionFilter === "All" ? "all regions" : regionFilter}</MenuItem>
                  {distributorsInRegion.map((d) => {
                    const c = String(d.code || "").trim();
                    if (!c) return null;
                    return (
                      <MenuItem key={c} value={c}>
                        {d.name || c} ({c})
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Search name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: { sm: "1 1 200px" }, minWidth: { xs: "100%", sm: 180 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="outlined"
                size="medium"
                startIcon={<RestartAltIcon />}
                onClick={resetFilters}
                sx={{ minWidth: { xs: "100%", sm: "auto" }, alignSelf: { sm: "stretch" }, fontWeight: 700, borderRadius: 2 }}
              >
                Reset
              </Button>
            </Stack>
            <Divider flexItem sx={{ borderColor: "divider" }} />
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} useFlexGap>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={limitToTargetPeriod}
                    onChange={(e) => setLimitToTargetPeriod(e.target.checked)}
                    disabled={!targetPeriod?.start || !targetPeriod?.end}
                  />
                }
                label="Limit to target period"
              />
              {targetPeriod?.start && targetPeriod?.end ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${targetPeriod.start} → ${targetPeriod.end}`}
                  sx={{ fontWeight: 600 }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Set target period under Targets to enable date filtering.
                </Typography>
              )}
              <Chip
                size="small"
                color="primary"
                label={`${filteredRecords.length} row${filteredRecords.length !== 1 ? "s" : ""}`}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: { xs: 1.5, sm: 2 },
          py: 2,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            mb: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.1 : 0.04),
            borderColor: alpha(theme.palette.info.main, 0.25),
          }}
        >
          <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.55 }}>
            Each row is one invoice / lifting line tied to a distributor code (same data distributors see under{" "}
            <strong>Stock lifting</strong>). Use <strong>Region</strong> then <strong>All in …</strong> to scan every outlet in
            that area, or pick one distributor for a focused list.
          </Typography>
        </Paper>

        {filteredRecords.length > 0 ? (
          <Paper
            variant="outlined"
            elevation={0}
            sx={{
              p: { xs: 1.25, sm: 1.5 },
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06),
              borderColor: alpha(theme.palette.primary.main, 0.35),
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.06, display: "block", mb: 1 }}>
              Totals for visible rows
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                gap: { xs: 1, sm: 1.5 },
              }}
            >
              {[
                { label: "CSD PC", value: liftTotals.csdPC },
                { label: "CSD UC", value: liftTotals.csdUC },
                { label: "Water PC", value: liftTotals.waterPC },
                { label: "Water UC", value: liftTotals.waterUC },
              ].map(({ label, value }) => (
                <Box
                  key={label}
                  sx={{
                    borderRadius: 1.5,
                    px: 1.25,
                    py: 1,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block" }}>
                    {label}
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                    {Math.round(value).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        ) : null}

        {(!allSalesData || allSalesData.length === 0) && (
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No dispatch lifting records yet. They appear when shipping marks orders dispatched.
          </Typography>
        )}

        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Records
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Click a <strong>lift date</strong> for that row’s SKUs, or click <strong>Total</strong> for all visible lifts combined.
        </Typography>
        <StockLiftingRecordsTable
          records={filteredRecords}
          stickyHeader
          stickyTotals
          totalsRowVariant="primary"
          maxHeight="min(62vh, 560px)"
          headerLayout="flat"
          showDistributorColumn={showDistributorColumn}
          emptyMessage="No rows match your filters. Try another region, set distributor to “All”, or turn off “Limit to target period”."
          onLiftRowClick={filteredRecords.length > 0 ? handleLiftRowClick : undefined}
          onTotalsClick={filteredRecords.length > 0 ? handleTotalsClick : undefined}
        />
      </Box>

      <StockLiftingSkuDialog
        open={Boolean(skuDialog)}
        onClose={() => setSkuDialog(null)}
        title={skuDialog?.title}
        subtitle={skuDialog?.subtitle}
        salesRecords={skuDialog?.salesRecords || []}
        liftDateLabel={skuDialog?.liftDateLabel}
      />

      <Paper
        elevation={8}
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 1,
          bgcolor: "background.paper",
          borderRadius: 0,
        }}
      >
        <Button onClick={onClose} variant="contained" color="primary" size="large" sx={{ minWidth: 120, borderRadius: 2, fontWeight: 700 }}>
          Done
        </Button>
      </Paper>
    </Dialog>
  );
}
