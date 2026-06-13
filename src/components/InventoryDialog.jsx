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
  FormControl,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  AppBar,
  Toolbar,
  LinearProgress,
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
  normalizeInventoryRow,
  normalizeInventoryPayload,
} from "../utils/workspaceInventory";
import { tableHeadRowSx, tableHeadCellSx } from "../theme/contrastSurfaces";
import { useOrganization } from "../context/OrganizationProvider";
import { useBrand } from "../hooks/useBrand";

const DENSE_CELL = { py: 0.5, px: 0.75, fontSize: "0.75rem", lineHeight: 1.25 };
const COMPACT_FIELD = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", height: 32 },
  "& .MuiInputBase-input": { py: 0.35, px: 0.75 },
  "& .MuiSelect-select": { py: 0.35, minHeight: "unset !important" },
};

const CATEGORY_OPTIONS = ["CSD", "Water", "CAN"];

function formatSavedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

export default function InventoryDialog({ open, onClose, onInventoryUpdated }) {
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

  const totalQty = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    [rows]
  );

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const cloud = await getWorkspaceInventory();
      if (cloud?.rows) {
        setRows(cloud.rows.map((r) => normalizeInventoryRow(r)));
        setCloudSynced(true);
        setLastSavedLabel(formatSavedAt(cloud.updatedAt));
        writeWorkspaceInventoryToLocalStorage(cloud, organization?.id);
        return;
      }
      const local = readWorkspaceInventoryFromLocalStorage(organization?.id);
      if (local?.rows) {
        setRows(local.rows.map((r) => normalizeInventoryRow(r)));
        setCloudSynced(false);
        setLastSavedLabel(formatSavedAt(local.updatedAt));
        return;
      }
      setRows([]);
      setCloudSynced(true);
      setLastSavedLabel(null);
    } catch (e) {
      console.error(e);
      const local = readWorkspaceInventoryFromLocalStorage(organization?.id);
      if (local?.rows) {
        setRows(local.rows.map((r) => normalizeInventoryRow(r)));
        setCloudSynced(false);
      }
      setSnackbar({ open: true, message: e.message || "Could not load inventory", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

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

  const updateRow = (id, patch) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    setHasChanges(true);
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyInventoryRow()]);
    setHasChanges(true);
  };

  const handleRemoveRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const normalized = rows
      .map((r) => normalizeInventoryRow(r))
      .filter((r) => r.sku || r.productName);

    for (const row of normalized) {
      if (!row.sku) {
        setSnackbar({ open: true, message: "Each row needs a SKU.", severity: "warning" });
        return;
      }
      if (!row.productName) {
        setSnackbar({ open: true, message: "Each row needs a product name.", severity: "warning" });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = normalizeInventoryPayload({ rows: normalized, updatedBy: brand?.appName || "" });
      writeWorkspaceInventoryToLocalStorage(payload, organization?.id);
      const saved = await saveWorkspaceInventory(payload);
      setRows(saved.rows.map((r) => normalizeInventoryRow(r)));
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
              disabled={saving || !hasChanges}
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
              Company stock lots used by shipping for MFG, batch, BBD, and availability. Quantities reduce when orders are dispatched.
            </Typography>
            <Chip label={`${rows.length} line${rows.length === 1 ? "" : "s"}`} size="small" />
            <Chip label={`${totalQty.toLocaleString()} cases total`} size="small" color="primary" variant="outlined" />
          </Stack>

          {rows.length === 0 && !loading ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                No inventory yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add product lots with SKU, MFG date, batch, BBD, and quantity for shipping dispatch.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
                Add stock line
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    {[
                      "",
                      "Product name",
                      "SKU",
                      "Category",
                      "MFG date",
                      "Batch no.",
                      "BBD",
                      "Qty (cases)",
                    ].map((label) => (
                      <TableCell key={label || "actions"} sx={{ ...tableHeadCellSx(), ...DENSE_CELL, whiteSpace: "nowrap" }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={DENSE_CELL}>
                        <IconButton size="small" color="error" onClick={() => handleRemoveRow(row.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.productName}
                          onChange={(e) => updateRow(row.id, { productName: e.target.value })}
                          placeholder="Product name"
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.sku}
                          onChange={(e) => updateRow(row.id, { sku: e.target.value })}
                          placeholder="SKU (match Rate Master)"
                          sx={COMPACT_FIELD}
                        />
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <FormControl size="small" fullWidth sx={COMPACT_FIELD}>
                          <Select
                            value={row.category || "CSD"}
                            onChange={(e) => updateRow(row.id, { category: e.target.value })}
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <MenuItem key={c} value={c}>
                                {c}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell sx={DENSE_CELL}>
                        <TextField
                          size="small"
                          type="date"
                          fullWidth
                          value={row.mfgDate || ""}
                          onChange={(e) => updateRow(row.id, { mfgDate: e.target.value })}
                          InputLabelProps={{ shrink: true }}
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
                          value={row.bbdDate || ""}
                          onChange={(e) => updateRow(row.id, { bbdDate: e.target.value })}
                          InputLabelProps={{ shrink: true }}
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
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 1, border: 0 }}>
                      <Button size="small" startIcon={<AddIcon />} onClick={handleAddRow} variant="outlined">
                        Add stock line
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
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
