import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Typography,
  Box,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  AppBar,
  Toolbar,
  LinearProgress,
  Alert,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AppSnackbar from "./AppSnackbar";
import { getWorkspaceInventory, saveWorkspaceInventory } from "../services/supabaseService";
import {
  writeWorkspaceInventoryToLocalStorage,
  readWorkspaceInventoryFromLocalStorage,
} from "../utils/workspaceInventoryStorage";
import {
  createEmptyInventoryRow,
  createInventoryRowFromCatalogProduct,
  findCatalogProductForInventoryRow,
  mergeInventoryWithCatalog,
  normalizeInventoryRow,
  normalizeInventoryPayload,
} from "../utils/workspaceInventory";
import { mfgDateToInputValue } from "../utils/shippingFifoLots";
import { ensureProductCatalog, getActiveProducts } from "../utils/productCatalog";
import { tableHeadRowSx, tableHeadCellSx } from "../theme/contrastSurfaces";
import { useOrganization } from "../context/OrganizationProvider";
import { useBrand } from "../hooks/useBrand";

const DENSE_CELL = { py: 0.5, px: 0.75, fontSize: "0.75rem", lineHeight: 1.25 };
const READONLY_CELL = {
  ...DENSE_CELL,
  fontWeight: 600,
  color: "text.primary",
  whiteSpace: "normal",
  textTransform: "uppercase",
  lineHeight: 1.35,
};
const COMPACT_FIELD = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", height: 32 },
  "& .MuiInputBase-input": { py: 0.35, px: 0.75 },
  "& .MuiSelect-select": { py: 0.35, minHeight: "unset !important" },
  "& input[type='date']::-webkit-calendar-picker-indicator": {
    margin: 0,
    padding: 0,
    cursor: "pointer",
  },
};

function formatSavedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

function inventoryRowHasLotData(row) {
  return (
    row.quantity > 0 ||
    Boolean(String(row.mfgDate || "").trim()) ||
    Boolean(String(row.batchNo || "").trim()) ||
    Boolean(String(row.bbdDate || "").trim())
  );
}

export default function InventoryDialog({ open, onClose, productRates = null, onInventoryUpdated }) {
  const theme = useTheme();
  const brand = useBrand();
  const { organization } = useOrganization();
  const dialogJustOpenedRef = useRef(false);

  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(true);
  const [lastSavedLabel, setLastSavedLabel] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [hasChanges, setHasChanges] = useState(false);

  const activeCatalogProducts = useMemo(
    () => getActiveProducts(ensureProductCatalog(productRates)),
    [productRates]
  );

  const catalogEmpty = activeCatalogProducts.length === 0;

  const applyCatalog = useCallback(
    (savedRows) => mergeInventoryWithCatalog(productRates, savedRows),
    [productRates]
  );

  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    [rows]
  );

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const cloud = await getWorkspaceInventory();
      if (cloud?.rows) {
        setRows(applyCatalog(cloud.rows.map((r) => normalizeInventoryRow(r))));
        setCloudSynced(true);
        setLastSavedLabel(formatSavedAt(cloud.updatedAt));
        writeWorkspaceInventoryToLocalStorage(cloud, organization?.id);
        return;
      }
      const local = readWorkspaceInventoryFromLocalStorage(organization?.id);
      if (local?.rows) {
        setRows(applyCatalog(local.rows.map((r) => normalizeInventoryRow(r))));
        setCloudSynced(false);
        setLastSavedLabel(formatSavedAt(local.updatedAt));
        return;
      }
      setRows(applyCatalog([]));
      setCloudSynced(true);
      setLastSavedLabel(null);
    } catch (e) {
      console.error(e);
      const local = readWorkspaceInventoryFromLocalStorage(organization?.id);
      if (local?.rows) {
        setRows(applyCatalog(local.rows.map((r) => normalizeInventoryRow(r))));
        setCloudSynced(false);
      } else {
        setRows(applyCatalog([]));
      }
      setSnackbar({ open: true, message: e.message || "Could not load inventory", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [organization?.id, applyCatalog]);

  useEffect(() => {
    if (!open) {
      dialogJustOpenedRef.current = false;
      return;
    }
    if (!dialogJustOpenedRef.current) {
      dialogJustOpenedRef.current = true;
      setHasChanges(false);
      loadInventory();
    }
  }, [open, loadInventory]);

  const productRatesRef = useRef(productRates);

  useEffect(() => {
    if (!open) {
      productRatesRef.current = productRates;
      return;
    }
    if (productRatesRef.current === productRates || loading) return;
    productRatesRef.current = productRates;
    setRows((prev) => applyCatalog(prev));
  }, [open, productRates, applyCatalog, loading]);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setHasChanges(true);
  };

  const handleAddLot = (catalogProductId) => {
    const product = activeCatalogProducts.find((p) => p.id === catalogProductId);
    if (!product) return;
    const newRow = createInventoryRowFromCatalogProduct(product);
    setRows((prev) => {
      const idx = prev.map((r) => r.catalogProductId).lastIndexOf(catalogProductId);
      const next = [...prev];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
    setHasChanges(true);
  };

  const handleRemoveRow = (id) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (!row) return prev;

      const sameProductRows = prev.filter((r) => r.catalogProductId === row.catalogProductId);
      if (sameProductRows.length <= 1 && row.catalogProductId) {
        const product = findCatalogProductForInventoryRow(row, activeCatalogProducts);
        if (product) {
          return prev.map((r) =>
            r.id === id ? createInventoryRowFromCatalogProduct(product, { id: r.id }) : r
          );
        }
        return prev.map((r) =>
          r.id === id
            ? {
                ...createEmptyInventoryRow(),
                id: r.id,
                catalogProductId: row.catalogProductId,
                productName: row.productName,
                sku: row.sku,
                category: row.category,
              }
            : r
        );
      }

      return prev.filter((r) => r.id !== id);
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    const normalized = rows
      .map((r) => normalizeInventoryRow(r))
      .filter((r) => r.sku || r.productName)
      .filter((r) => inventoryRowHasLotData(r));

    setSaving(true);
    try {
      const payload = normalizeInventoryPayload({ rows: normalized, updatedBy: brand?.appName || "" });
      writeWorkspaceInventoryToLocalStorage(payload, organization?.id);
      const saved = await saveWorkspaceInventory(payload);
      setRows(applyCatalog(saved.rows.map((r) => normalizeInventoryRow(r))));
      setHasChanges(false);
      setCloudSynced(true);
      setLastSavedLabel(formatSavedAt(saved.updatedAt));
      onInventoryUpdated?.(saved);
      setSnackbar({ open: true, message: "Inventory saved to Supabase.", severity: "success" });
    } catch (e) {
      console.error(e);
      setCloudSynced(false);
      setSnackbar({ open: true, message: e.message || "Could not save inventory", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullScreen>
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: "primary.main" }}>
          <Toolbar variant="dense" sx={{ gap: 1, minHeight: { xs: 52, sm: 56 } }}>
            <Inventory2OutlinedIcon sx={{ color: "primary.contrastText" }} />
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 800, fontSize: { xs: "1rem", sm: "1.1rem" } }}>
              Inventory
            </Typography>
            <Chip
              size="small"
              icon={cloudSynced ? <CloudDoneOutlinedIcon /> : <CloudOffOutlinedIcon />}
              label={cloudSynced ? "Saved to Supabase" : "Offline cache only"}
              sx={{ bgcolor: alpha("#fff", 0.12), color: "primary.contrastText", fontWeight: 700 }}
            />
            {lastSavedLabel ? (
              <Typography variant="caption" sx={{ color: alpha("#fff", 0.85), display: { xs: "none", sm: "block" } }}>
                Saved {lastSavedLabel}
              </Typography>
            ) : null}
            <Tooltip title="Reload">
              <IconButton color="inherit" onClick={loadInventory} disabled={loading || saving}>
                <RefreshOutlinedIcon />
              </IconButton>
            </Tooltip>
            <Button
              color="inherit"
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving || !hasChanges || catalogEmpty}
              sx={{ borderColor: alpha("#fff", 0.5), fontWeight: 700 }}
            >
              Save
            </Button>
            <IconButton edge="end" color="inherit" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
          {loading || saving ? <LinearProgress color="secondary" /> : null}
        </AppBar>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1400, mx: "auto", width: "100%" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Products come from Product &amp; Rate Master. Enter MFG date, batch, BBD, and quantity for each stock lot.
              Quantities reduce when orders are dispatched.
            </Typography>
            <Chip label={`${activeCatalogProducts.length} product${activeCatalogProducts.length === 1 ? "" : "s"}`} size="small" />
            <Chip label={`${totalQty.toLocaleString()} cases total`} size="small" color="primary" variant="outlined" />
          </Stack>

          {catalogEmpty && !loading ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No products in the catalogue. Add products in <strong>Product &amp; Rate Master</strong> first — they will
              appear here automatically.
            </Alert>
          ) : null}

          {!catalogEmpty ? (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    {["", "Product name", "SKU", "Category", "MFG date", "Batch no.", "BBD", "Qty (cases)"].map(
                      (label) => (
                        <TableCell
                          key={label || "actions"}
                          sx={{ ...tableHeadCellSx(), ...DENSE_CELL, whiteSpace: "nowrap" }}
                        >
                          {label}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={DENSE_CELL}>
                        <Stack direction="row" spacing={0.25} alignItems="center">
                          <Tooltip title="Clear lot / remove extra lot">
                            <IconButton size="small" color="error" onClick={() => handleRemoveRow(row.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Add another lot for this product">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleAddLot(row.catalogProductId)}
                              disabled={!row.catalogProductId}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                      <TableCell sx={READONLY_CELL}>{row.productName || "—"}</TableCell>
                      <TableCell sx={READONLY_CELL}>{row.sku || "—"}</TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <Chip label={row.category || "CSD"} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          type="date"
                          fullWidth
                          inputProps={{ "aria-label": "Manufacturing date" }}
                          value={mfgDateToInputValue(row.mfgDate)}
                          onChange={(e) => updateRow(row.id, { mfgDate: e.target.value })}
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.batchNo || ""}
                          onChange={(e) => updateRow(row.id, { batchNo: e.target.value })}
                          placeholder="Batch"
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          type="date"
                          fullWidth
                          inputProps={{ "aria-label": "Best before date" }}
                          value={mfgDateToInputValue(row.bbdDate)}
                          onChange={(e) => updateRow(row.id, { bbdDate: e.target.value })}
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          type="number"
                          fullWidth
                          inputProps={{ min: 0, step: 1 }}
                          value={row.quantity === "" || row.quantity == null ? "" : row.quantity}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(row.id, { quantity: v === "" ? "" : Math.max(0, parseInt(v, 10) || 0) });
                          }}
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </Box>
      </Dialog>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
