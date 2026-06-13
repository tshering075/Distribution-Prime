import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  LinearProgress,
  Slide,
  Chip,
  Paper,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import PhysicalStockMatrix from "./PhysicalStockMatrix";
import {
  normalizePhysicalStockPayload,
  resolvePhysicalStockProductLines,
  getRawPhysicalStockFromDistributor,
  aggregatePhysicalStockTotals,
  localIsoDate,
  resolvePhysicalStockRowsForReportDate,
  saveLocalPhysicalStockSnapshot,
} from "../utils/physicalStockTemplate";
import {
  upsertDistributorPhysicalStockSnapshot,
  fetchLatestDistributorPhysicalStockSnapshot,
} from "../services/supabaseService";
import { savePhysicalStockToSupabase } from "../services/posSupabaseService";
import { getDistributors, saveDistributors } from "../utils/distributorAuth";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import { syncPhysicalStockTraceabilityFromDispatchedOrders } from "../services/deliveredOrderAchievement";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function DistributorPhysicalStockDialog({
  open,
  onClose,
  distributorCode,
  distributorName,
  distributor,
  isSupabaseConfigured,
  setDistributor,
  showToast,
  onDialogOpened,
  onPhysicalStockAcknowledged,
  productRates = null,
  orders = [],
}) {
  const productLines = useMemo(
    () => resolvePhysicalStockProductLines(productRates),
    [productRates]
  );
  const productLinesKey = productLines.join("\u0001");
  const prevProductLinesKeyRef = useRef(productLinesKey);
  const [reportDate, setReportDate] = useState(() => localIsoDate());
  const [rows, setRows] = useState(() => normalizePhysicalStockPayload(null, productLines).rows);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [carriedFromDate, setCarriedFromDate] = useState(null);
  const [matrixReady, setMatrixReady] = useState(false);
  const openRef = useRef(false);
  const dialogOpenedNotifiedRef = useRef(false);
  const loadRequestIdRef = useRef(0);
  const distributorRef = useRef(distributor);
  const sessionLoadedRef = useRef(false);
  distributorRef.current = distributor;

  const distTotals = aggregatePhysicalStockTotals(rows);

  useEffect(() => {
    if (open && !openRef.current) {
      setDirty(false);
    }
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      dialogOpenedNotifiedRef.current = false;
      return;
    }
    if (dialogOpenedNotifiedRef.current) return;
    dialogOpenedNotifiedRef.current = true;
    if (typeof onDialogOpened === "function") {
      onDialogOpened();
    }
  }, [open, onDialogOpened]);

  // Paint header/toolbar first; mount the large grid after idle so the dialog opens instantly.
  useEffect(() => {
    if (!open) {
      setMatrixReady(false);
      return;
    }
    setMatrixReady(false);
    let cancelled = false;
    const run = () => {
      if (!cancelled) setMatrixReady(true);
    };
    let id;
    if (typeof window.requestIdleCallback === "function") {
      id = window.requestIdleCallback(run, { timeout: 400 });
    } else {
      id = window.setTimeout(run, 1);
    }
    return () => {
      cancelled = true;
      if (typeof window.requestIdleCallback === "function") {
        window.cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [open]);

  const fetchLatestSnapshot = useCallback(
    async (code, excludeReportDate) => {
      if (!isSupabaseConfigured) return null;
      try {
        const payload = await fetchLatestDistributorPhysicalStockSnapshot(code, excludeReportDate);
        return payload ? normalizePhysicalStockPayload(payload, productLines) : null;
      } catch (err) {
        console.warn("Could not load latest physical stock snapshot:", err);
        return null;
      }
    },
    [isSupabaseConfigured, productLines]
  );

  const loadRowsForReportDate = useCallback(
    async (targetDate) => {
      const date = String(targetDate || "").slice(0, 10) || localIsoDate();
      const reqId = ++loadRequestIdRef.current;
      setLoadingRows(true);
      try {
        const raw = getRawPhysicalStockFromDistributor(distributorRef.current);
        const { rows: nextRows, carriedFromDate: fromDate } = await resolvePhysicalStockRowsForReportDate({
          targetReportDate: date,
          savedRaw: raw,
          distributorCode,
          fetchLatestSnapshot: isSupabaseConfigured ? fetchLatestSnapshot : undefined,
          productRates,
        });
        if (reqId !== loadRequestIdRef.current) return;
        setReportDate(date);
        setRows(
          syncPhysicalStockTraceabilityFromDispatchedOrders(nextRows, orders, distributorCode)
        );
        setCarriedFromDate(fromDate);
        setDirty(false);
      } finally {
        if (reqId === loadRequestIdRef.current) setLoadingRows(false);
      }
    },
    [distributorCode, fetchLatestSnapshot, isSupabaseConfigured, productRates, orders]
  );

  useEffect(() => {
    if (!open) {
      sessionLoadedRef.current = false;
      return;
    }
    if (dirty || sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;
    loadRowsForReportDate(localIsoDate());
  }, [open, dirty, loadRowsForReportDate]);

  useEffect(() => {
    if (!open || dirty) {
      prevProductLinesKeyRef.current = productLinesKey;
      return;
    }
    if (prevProductLinesKeyRef.current === productLinesKey) return;
    prevProductLinesKeyRef.current = productLinesKey;
    loadRowsForReportDate(reportDate);
  }, [open, dirty, productLinesKey, reportDate, loadRowsForReportDate]);

  const handleRowsChange = useCallback((next) => {
    setDirty(true);
    setRows(next);
  }, []);

  const handleReportDateChange = (e) => {
    const next = e.target.value;
    if (!next || next === reportDate) return;
    sessionLoadedRef.current = true;
    loadRowsForReportDate(next);
  };

  const persistLocal = (payload) => {
    const list = getDistributors();
    const idx = list.findIndex((d) => d.code === distributorCode);
    if (idx >= 0) {
      list[idx] = { ...list[idx], physical_stock: payload };
      saveDistributors(list);
    }
    saveLocalPhysicalStockSnapshot(distributorCode, payload);
  };

  const persistPhysicalStockSnapshot = async (stockPayload) => {
    if (!isSupabaseConfigured || !distributorCode) return;
    try {
      await upsertDistributorPhysicalStockSnapshot(distributorCode, stockPayload);
    } catch (snapErr) {
      const missing =
        snapErr?.code === "MISSING_SNAPSHOTS_TABLE" ||
        (typeof snapErr?.message === "string" &&
          /distributor_physical_stock_snapshots/i.test(snapErr.message));
      if (missing) {
        console.warn(
          "Physical stock history table not found; add distributor_physical_stock_snapshots in Supabase (see ADD_DISTRIBUTOR_PHYSICAL_STOCK_SNAPSHOTS.sql).",
          snapErr
        );
      } else {
        console.warn("Could not save physical stock snapshot row:", snapErr);
      }
    }
  };

  const handleSave = async () => {
    if (!distributorCode) return;
    const payload = normalizePhysicalStockPayload(
      {
        reportDate,
        rows,
      },
      productLines
    );
    payload.updatedAt = new Date().toISOString();
    setSaving(true);
    try {
      let applied = false;
      let localOnlyWarning = false;
      if (isSupabaseConfigured) {
        try {
          const updated = await savePhysicalStockToSupabase(distributorCode, payload);
          const physical_stock = updated?.physical_stock ?? payload;
          persistLocal(physical_stock);
          setDistributor((prev) => (prev ? { ...prev, ...updated, physical_stock } : prev));
          await persistPhysicalStockSnapshot(payload);
          applied = true;
        } catch (err) {
          const msg = typeof err?.message === "string" ? err.message : "";
          const missingColumn =
            err?.code === "PGRST204" || /physical_stock/i.test(msg);
          if (missingColumn) {
            console.warn("physical_stock column may be missing in Supabase; saving locally only.", err);
            localOnlyWarning = true;
            if (showToast) {
              showToast(
                "Saved on this device only. Add column physical_stock (JSONB) on distributors in Supabase to sync.",
                "warning",
                6000,
                "Saved locally"
              );
            }
            persistLocal(payload);
            setDistributor((prev) => (prev ? { ...prev, physical_stock: payload } : prev));
            await persistPhysicalStockSnapshot(payload);
            applied = true;
          } else {
            throw err;
          }
        }
      }
      if (!applied) {
        persistLocal(payload);
        setDistributor((prev) => (prev ? { ...prev, physical_stock: payload } : prev));
      }
      setDirty(false);
      logActivity(
        ACTIVITY_TYPES.PHYSICAL_STOCK_UPDATED,
        `Physical stock updated for ${distributorName || distributorCode} (${distributorCode})`,
        { distributorCode, reportDate: payload.reportDate }
      );
      if (showToast && !localOnlyWarning) {
        showToast(
          "Your stock table and report date are saved. Admins can see this in Physical Stock.",
          "success",
          4500,
          "Physical stock saved"
        );
      }
      if (typeof onPhysicalStockAcknowledged === "function") {
        onPhysicalStockAcknowledged(payload.updatedAt);
      }
      onClose();
    } catch (e) {
      console.error(e);
      if (showToast) {
        showToast(
          e?.message || "Check your connection and try again. Nothing was saved.",
          "error",
          5000,
          "Could not save physical stock"
        );
      }
    } finally {
      setSaving(false);
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
          height: "100%",
          maxHeight: "100dvh",
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
            Physical stock
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.88, fontSize: "0.65rem" }} noWrap>
            {distributorName || "Distributor"} · {distributorCode || "—"}
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
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.75,
          bgcolor: "background.paper",
        }}
      >
        <TextField
          label="Report date"
          type="date"
          size="small"
          value={reportDate}
          onChange={handleReportDateChange}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: "100%", sm: 148 } }}
        />
        <Chip label={`Pri ${distTotals.primary.toLocaleString()}`} size="small" sx={{ height: 22, fontWeight: 700, fontSize: "0.65rem" }} />
        <Chip label={`Phy ${distTotals.physical.toLocaleString()}`} size="small" sx={{ height: 22, fontWeight: 700, fontSize: "0.65rem" }} />
        <Chip label={`Sec ${distTotals.secondary.toLocaleString()}`} size="small" sx={{ height: 22, fontWeight: 700, fontSize: "0.65rem" }} />
        {loadingRows ? <Chip label="Loading…" size="small" variant="outlined" sx={{ height: 22, fontSize: "0.65rem" }} /> : null}
        {dirty ? <Chip label="Unsaved" size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: "0.65rem" }} /> : null}
      </Paper>

      {productLines.length === 0 ? (
        <Alert severity="warning" sx={{ mx: { xs: 1, sm: 1.5 }, mt: 0.75, py: 0.25, flexShrink: 0, borderRadius: 1.5, fontSize: "0.75rem" }}>
          Add products in <strong>Rate Master</strong> first — stock rows follow that catalogue.
        </Alert>
      ) : null}

      {carriedFromDate ? (
        <Alert severity="info" sx={{ mx: { xs: 1, sm: 1.5 }, mt: 0.75, py: 0.25, flexShrink: 0, borderRadius: 1.5, fontSize: "0.75rem" }}>
          MFG / batch / BBD carried from report <strong>{carriedFromDate}</strong>. Enter primary sale and physical stock per lot.
        </Alert>
      ) : null}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          px: { xs: 1, sm: 1.5 },
          py: 0.75,
        }}
      >
        {!matrixReady || loadingRows ? (
          <Box sx={{ py: 1.5, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <LinearProgress sx={{ borderRadius: 1, height: 4, mb: 1 }} />
            <Typography variant="caption" color="text.secondary" align="center">
              {loadingRows ? "Applying previous day stock…" : "Loading stock grid…"}
            </Typography>
          </Box>
        ) : productLines.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
            Stock grid will appear after Rate Master products are configured.
          </Typography>
        ) : (
          <PhysicalStockMatrix
            rows={rows}
            readOnly={false}
            onRowsChange={handleRowsChange}
            variant="fullscreen"
            boldDataValues
            showLotHelp={false}
          />
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
        <Button onClick={onClose} color="inherit" size="small" disabled={saving} sx={{ fontWeight: 700, fontSize: "0.75rem" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
          onClick={handleSave}
          disabled={saving || loadingRows || !distributorCode || productLines.length === 0}
          sx={{ fontWeight: 700, fontSize: "0.75rem" }}
        >
          Save stock
        </Button>
      </Paper>
    </Dialog>
  );
}
