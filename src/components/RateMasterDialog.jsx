import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  FormControlLabel,
  Stack,
  Tooltip,
  AppBar,
  Toolbar,
  LinearProgress,
  Checkbox,
  Divider,
  Switch,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import NuProductRateIcon from "./NuProductRateIcon";
import CatalogSelectWithAdd from "./CatalogSelectWithAdd";
import { getProductRates, saveProductRates } from "../services/supabaseService";
import AppSnackbar from "./AppSnackbar";
import {
  writeProductRatesToLocalStorage,
  readProductRatesMetaFromLocalStorage,
} from "../utils/productRatesStorage";
import {
  DEFAULT_UC_DIVISOR,
  catalogToEditorRows,
  createEmptyProduct,
  validateAndNormalizeEditorRows,
  ensureProductCatalog,
  getProductLineName,
  getWorkspaceStarterCatalog,
  buildCategoryOptions,
  buildSkuOptions,
  normalizeCatalogSettings,
  normalizeCategory,
} from "../utils/productCatalog";
import { tableHeadRowSx, tableHeadCellSx } from "../theme/contrastSurfaces";
import { useOrganization } from "../context/OrganizationProvider";
import { useBrand } from "../hooks/useBrand";

const DENSE_CELL = { py: 0.5, px: 0.75, fontSize: "0.75rem", lineHeight: 1.25 };
const COMPACT_FIELD = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", height: 32 },
  "& .MuiInputBase-input": { py: 0.35, px: 0.75 },
  "& .MuiSelect-select": { py: 0.35, minHeight: "unset !important" },
};

function formatSavedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export default function RateMasterDialog({
  open,
  onClose,
  productRates,
  onRatesUpdated,
}) {
  const theme = useTheme();
  const brand = useBrand();
  const { organization } = useOrganization();
  const dialogJustOpenedRef = useRef(false);

  const [ucDivisor, setUcDivisor] = useState(String(DEFAULT_UC_DIVISOR));
  const [ucEnabled, setUcEnabled] = useState(false);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(true);
  const [lastSavedLabel, setLastSavedLabel] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [hasChanges, setHasChanges] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [customVariants, setCustomVariants] = useState([]);
  const [addOptionDialog, setAddOptionDialog] = useState({ open: false, kind: null, rowIndex: null });
  const [addOptionDraft, setAddOptionDraft] = useState("");

  const catalogForOptions = useMemo(
    () => ({ settings: { customCategories, customVariants } }),
    [customCategories, customVariants]
  );

  const categoryOptions = useMemo(
    () => buildCategoryOptions(catalogForOptions, products.map((p) => p.category)),
    [catalogForOptions, products]
  );

  const skuOptions = useMemo(
    () => buildSkuOptions(catalogForOptions, products.map((p) => p.variant)),
    [catalogForOptions, products]
  );

  const activeCount = useMemo(() => products.filter((p) => p.active !== false).length, [products]);
  const totalRows = products.length;

  const applyCatalog = useCallback((catalog, { markSynced = true } = {}) => {
    const normalized = ensureProductCatalog(catalog);
    const settings = normalizeCatalogSettings(normalized.settings);
    setUcDivisor(String(settings.ucDivisor ?? DEFAULT_UC_DIVISOR));
    setUcEnabled(
      settings.ucEnabled === true ||
        (normalized.products || []).some((p) => p.ucMultiplier != null && Number(p.ucMultiplier) > 0)
    );
    setCustomCategories(settings.customCategories);
    setCustomVariants(settings.customVariants);
    setProducts(catalogToEditorRows(normalized));
    setHasChanges(false);
    if (markSynced) setCloudSynced(true);
    const meta = readProductRatesMetaFromLocalStorage(organization?.id);
    setLastSavedLabel(formatSavedAt(meta?.savedAt));
  }, [organization?.id]);

  const loadFromProps = useCallback(() => {
    applyCatalog(productRates, { markSynced: true });
  }, [applyCatalog, productRates]);

  const refreshFromWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const doc = await getProductRates();
      if (doc) {
        const catalog = ensureProductCatalog(doc);
        writeProductRatesToLocalStorage(catalog, organization?.id);
        applyCatalog(catalog);
        onRatesUpdated?.(catalog);
        setCloudSynced(true);
        setSnackbar({
          open: true,
          message: "Loaded catalogue from this workspace.",
          severity: "success",
        });
      } else {
        applyCatalog(productRates || { products: [], settings: { ucDivisor: DEFAULT_UC_DIVISOR } });
        setCloudSynced(true);
        setSnackbar({
          open: true,
          message: "No saved catalogue yet. Use the starter template or add rows, then save.",
          severity: "info",
        });
      }
    } catch (e) {
      setCloudSynced(false);
      loadFromProps();
      setSnackbar({
        open: true,
        message: e?.message || "Could not load from cloud. Showing cached copy.",
        severity: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [applyCatalog, loadFromProps, onRatesUpdated, organization?.id, productRates]);

  useEffect(() => {
    if (open && !dialogJustOpenedRef.current) {
      dialogJustOpenedRef.current = true;
      refreshFromWorkspace();
    } else if (!open) {
      dialogJustOpenedRef.current = false;
      setHasChanges(false);
      setLoading(false);
    }
  }, [open, refreshFromWorkspace]);

  const handleProductChange = (index, field, value) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setHasChanges(true);
  };

  const handleUcUseChange = (index, checked) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        ucUse: checked,
        ucMultiplier: checked ? next[index].ucMultiplier : "",
      };
      return next;
    });
    setHasChanges(true);
  };

  const handleAddProduct = () => {
    setProducts((prev) => [...prev, createEmptyProduct()]);
    setHasChanges(true);
  };

  const handleLoadStarter = () => {
    const starter = getWorkspaceStarterCatalog();
    setUcDivisor(String(starter.settings?.ucDivisor ?? DEFAULT_UC_DIVISOR));
    setUcEnabled(false);
    setProducts(catalogToEditorRows(starter));
    setHasChanges(true);
    setSnackbar({
      open: true,
      message: "Starter template loaded. Review rates and save to publish to this workspace.",
      severity: "info",
    });
  };

  const handleRemoveProduct = (index) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const openAddOption = (kind, rowIndex) => {
    setAddOptionDialog({ open: true, kind, rowIndex });
    setAddOptionDraft("");
  };

  const closeAddOption = () => {
    setAddOptionDialog({ open: false, kind: null, rowIndex: null });
    setAddOptionDraft("");
  };

  const confirmAddOption = () => {
    const label = addOptionDraft.trim();
    if (!label) {
      setSnackbar({ open: true, message: "Enter a name.", severity: "warning" });
      return;
    }
    const { kind, rowIndex } = addOptionDialog;
    if (kind === "category") {
      const normalized = normalizeCategory(label);
      setCustomCategories((prev) =>
        prev.some((c) => c.toLowerCase() === normalized.toLowerCase()) ? prev : [...prev, normalized]
      );
      handleProductChange(rowIndex, "category", normalized);
    } else if (kind === "sku") {
      setCustomVariants((prev) =>
        prev.some((v) => v.toLowerCase() === label.toLowerCase()) ? prev : [...prev, label]
      );
      handleProductChange(rowIndex, "variant", label);
    }
    closeAddOption();
    setSnackbar({
      open: true,
      message: kind === "category" ? `Category “${label}” added.` : `SKU “${label}” added.`,
      severity: "success",
    });
  };

  const catalogSettingsPayload = useMemo(
    () => ({ customCategories, customVariants, ucEnabled }),
    [customCategories, customVariants, ucEnabled]
  );

  const handleSave = async () => {
    const result = validateAndNormalizeEditorRows(products, ucDivisor, catalogSettingsPayload);
    if (result.error) {
      setSnackbar({ open: true, message: result.error, severity: "error" });
      return;
    }
    if (result.catalog.products.length === 0) {
      setSnackbar({
        open: true,
        message: "Add at least one product before saving.",
        severity: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = result.catalog;
      writeProductRatesToLocalStorage(payload, organization?.id);
      setLastSavedLabel(formatSavedAt(new Date().toISOString()));
      let cloudOk = true;
      let cloudErrorMessage = "";
      try {
        await saveProductRates(payload);
      } catch (error) {
        cloudOk = false;
        cloudErrorMessage =
          typeof error?.message === "string" && error.message.trim()
            ? error.message.trim()
            : "Cloud sync failed — check connection and try again.";
        console.error("Error saving catalogue to Supabase:", error);
      }
      setCloudSynced(cloudOk);
      onRatesUpdated?.(payload);
      setHasChanges(false);
      setSnackbar({
        open: true,
        message: cloudOk
          ? `Catalogue saved for “${organization?.slug || "workspace"}”.`
          : `Saved on this device. ${cloudErrorMessage}`,
        severity: cloudOk ? "success" : "warning",
      });
    } catch (e) {
      setSnackbar({ open: true, message: e?.message || "Save failed.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const previewLine = (row) => getProductLineName({ name: row.name, variant: row.variant });

  const workspaceSlug = organization?.slug || "default";
  const isEmpty = products.length === 0;
  const headerColor = brand?.primary || theme.palette.primary.main;

  const baseColumns = [
    { key: "on", h: "On", tip: "Include in orders and calculators", w: 36 },
    { key: "product", h: "Product", tip: "Base name (e.g. Product A)", w: "14%" },
    { key: "sku", h: "SKU / size", tip: "Variant or pack size", w: "14%" },
    { key: "cat", h: "Category", tip: "CSD, Water, CAN…", w: 72 },
    { key: "rate", h: "Rate", tip: "Price per case", w: 68 },
    { key: "kg", h: "kg/case", tip: "Weight per case", w: 56 },
  ];
  const ucColumn = { key: "uc", h: "UC×", tip: "UC multiplier for this line", w: 88 };
  const deleteColumn = { key: "del", h: "", w: 36 };
  const columns = ucEnabled ? [...baseColumns, ucColumn, deleteColumn] : [...baseColumns, deleteColumn];

  return (
    <>
      <Dialog fullScreen open={open} onClose={onClose}>
        {loading || saving ? <LinearProgress /> : null}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: headerColor }}>
          <Toolbar variant="dense" sx={{ gap: 1, minHeight: 52 }}>
            <NuProductRateIcon sx={{ width: 32, height: 32, bgcolor: alpha("#fff", 0.15), color: "#fff" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Product &amp; Rate Master
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                {workspaceSlug} · {activeCount} active of {totalRows}
              </Typography>
            </Box>
            {hasChanges ? (
              <Chip
                size="small"
                label="Unsaved"
                sx={{ height: 24, bgcolor: alpha("#fff", 0.2), color: "#fff", fontWeight: 700 }}
              />
            ) : null}
            <Tooltip title="Reload from cloud">
              <span>
                <IconButton color="inherit" onClick={refreshFromWorkspace} disabled={loading || saving}>
                  <RefreshOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
            {!isEmpty && (
              <Button
                color="inherit"
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddProduct}
                disabled={saving}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderColor: alpha("#fff", 0.4),
                  display: { xs: "none", sm: "inline-flex" },
                }}
              >
                Add product
              </Button>
            )}
            <IconButton color="inherit" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <DialogContent sx={{ bgcolor: "background.default", p: { xs: 1, sm: 1.5 }, flex: 1, overflow: "auto" }}>
          <Box sx={{ maxWidth: 1480, mx: "auto" }}>
            <Paper
              variant="outlined"
              sx={{
                px: { xs: 1.25, sm: 1.5 },
                py: 1,
                mb: 1.5,
                borderRadius: 2,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: { xs: 1, sm: 1.5 },
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1, minWidth: 0 }}>
                {cloudSynced ? (
                  <Chip size="small" icon={<CloudDoneOutlinedIcon />} label="Synced" color="success" variant="outlined" sx={{ height: 26 }} />
                ) : (
                  <Chip size="small" icon={<CloudOffOutlinedIcon />} label="Offline" color="warning" variant="outlined" sx={{ height: 26 }} />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {activeCount} active · {totalRows} lines
                  {lastSavedLabel ? ` · saved ${lastSavedLabel}` : ""}
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{
                  py: 0.25,
                  px: 1,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, ucEnabled ? 0.06 : 0.03),
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <TuneOutlinedIcon color="action" sx={{ fontSize: 18 }} />
                <FormControlLabel
                  sx={{ m: 0, mr: ucEnabled ? 0.5 : 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={ucEnabled}
                      onChange={(e) => {
                        setUcEnabled(e.target.checked);
                        setHasChanges(true);
                      }}
                    />
                  }
                  label={<Typography variant="caption" fontWeight={700}>UC</Typography>}
                />
                {ucEnabled ? (
                  <TextField
                    label="Divisor"
                    type="number"
                    size="small"
                    value={ucDivisor}
                    onChange={(e) => {
                      setUcDivisor(e.target.value);
                      setHasChanges(true);
                    }}
                    inputProps={{ min: 0.001, step: 0.001 }}
                    sx={{ width: 108, "& .MuiInputBase-root": { height: 32 } }}
                  />
                ) : null}
              </Stack>

              {isEmpty ? (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AutoAwesomeOutlinedIcon />}
                    onClick={handleLoadStarter}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Starter template
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddProduct}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Add product
                  </Button>
                </Stack>
              ) : null}
            </Paper>

            {isEmpty ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 2,
                  textAlign: "center",
                  borderStyle: "dashed",
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                }}
              >
                <Inventory2OutlinedIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                  No products yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: "auto" }}>
                  Load Product A, B, C samples from the toolbar above, or add your own lines.
                </Typography>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: { lg: "calc(100vh - 200px)" } }}>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    borderBottom: 1,
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    Product lines
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      details · rates · weight{ucEnabled ? " · UC" : ""}
                    </Typography>
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddProduct}
                    disabled={saving}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Add product
                  </Button>
                </Box>
                <TableContainer sx={{ flex: 1, maxHeight: { xs: "none", lg: "calc(100vh - 220px)" } }}>
                      <Table size="small" stickyHeader sx={{ tableLayout: "fixed", width: "100%" }}>
                        <TableHead>
                          <TableRow sx={tableHeadRowSx(theme)}>
                            <TableCell
                              colSpan={4}
                              sx={{ ...tableHeadCellSx(), ...DENSE_CELL, fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.08) }}
                            >
                              Product details
                            </TableCell>
                            <TableCell
                              colSpan={2}
                              sx={{ ...tableHeadCellSx(), ...DENSE_CELL, fontWeight: 800, bgcolor: alpha(theme.palette.success.main, 0.08) }}
                            >
                              Pricing &amp; weight
                            </TableCell>
                            {ucEnabled ? (
                              <TableCell
                                sx={{ ...tableHeadCellSx(), ...DENSE_CELL, fontWeight: 800, bgcolor: alpha(theme.palette.warning.main, 0.1) }}
                              >
                                UC
                              </TableCell>
                            ) : null}
                            <TableCell sx={{ ...tableHeadCellSx(), ...DENSE_CELL, width: 36 }} />
                          </TableRow>
                          <TableRow sx={tableHeadRowSx(theme)}>
                            {columns.map(({ key, h, tip, w }) => (
                              <TableCell
                                key={key}
                                sx={{ ...tableHeadCellSx({ whiteSpace: "nowrap" }), ...DENSE_CELL, width: w, px: 0.75 }}
                              >
                                {tip && h ? (
                                  <Tooltip title={tip}>
                                    <span>{h}</span>
                                  </Tooltip>
                                ) : (
                                  h
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {products.map((row, index) => {
                            const line = previewLine(row);
                            return (
                              <TableRow
                                key={row.id}
                                hover
                                sx={{
                                  opacity: row.active === false ? 0.55 : 1,
                                  "& td": DENSE_CELL,
                                }}
                              >
                                <TableCell padding="checkbox" align="center">
                                  <Checkbox
                                    size="small"
                                    checked={row.active !== false}
                                    onChange={(e) => handleProductChange(index, "active", e.target.checked)}
                                  />
                                </TableCell>
                                <TableCell padding="none">
                                  <Tooltip title={line ? `Line: ${line}` : "Product name"}>
                                    <TextField
                                      size="small"
                                      placeholder="Product A"
                                      value={row.name}
                                      onChange={(e) => handleProductChange(index, "name", e.target.value)}
                                      sx={{ ...COMPACT_FIELD, width: "100%" }}
                                    />
                                  </Tooltip>
                                </TableCell>
                                <TableCell padding="none">
                                  <FormControl size="small" fullWidth sx={COMPACT_FIELD}>
                                    <CatalogSelectWithAdd
                                      value={row.variant}
                                      options={skuOptions}
                                      placeholder="300 ML"
                                      onChange={(v) => handleProductChange(index, "variant", v)}
                                      onAddNew={() => openAddOption("sku", index)}
                                      sx={COMPACT_FIELD}
                                    />
                                  </FormControl>
                                </TableCell>
                                <TableCell padding="none">
                                  <FormControl size="small" fullWidth sx={COMPACT_FIELD}>
                                    <CatalogSelectWithAdd
                                      value={row.category || "CSD"}
                                      options={categoryOptions}
                                      placeholder="Category"
                                      onChange={(v) => handleProductChange(index, "category", v || "CSD")}
                                      onAddNew={() => openAddOption("category", index)}
                                      sx={COMPACT_FIELD}
                                    />
                                  </FormControl>
                                </TableCell>
                                <TableCell padding="none">
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={row.rate}
                                    onChange={(e) => handleProductChange(index, "rate", e.target.value)}
                                    inputProps={{ min: 0, step: 0.01 }}
                                    sx={{ ...COMPACT_FIELD, width: "100%" }}
                                  />
                                </TableCell>
                                <TableCell padding="none">
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={row.kgPerCase}
                                    onChange={(e) => handleProductChange(index, "kgPerCase", e.target.value)}
                                    inputProps={{ min: 0, step: 0.01 }}
                                    sx={{ ...COMPACT_FIELD, width: "100%" }}
                                  />
                                </TableCell>
                                {ucEnabled ? (
                                  <TableCell padding="none">
                                    <Stack direction="row" alignItems="center" spacing={0.5}>
                                      <Switch
                                        size="small"
                                        checked={!!row.ucUse}
                                        onChange={(e) => handleUcUseChange(index, e.target.checked)}
                                      />
                                      {row.ucUse ? (
                                        <TextField
                                          size="small"
                                          type="number"
                                          placeholder="×"
                                          value={row.ucMultiplier}
                                          onChange={(e) => handleProductChange(index, "ucMultiplier", e.target.value)}
                                          inputProps={{ min: 0, step: 0.01 }}
                                          sx={{ ...COMPACT_FIELD, width: "100%", minWidth: 52 }}
                                        />
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          Off
                                        </Typography>
                                      )}
                                    </Stack>
                                  </TableCell>
                                ) : null}
                                <TableCell padding="none" align="center">
                                  <Tooltip title="Remove row">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleRemoveProduct(index)}
                                      aria-label="Remove product"
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
            )}
          </Box>
        </DialogContent>

        <Divider />

        <DialogActions
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: "background.paper",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Button
            onClick={loadFromProps}
            disabled={!hasChanges || saving}
            color="inherit"
            sx={{ textTransform: "none" }}
          >
            Discard changes
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ textTransform: "none" }}>
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!hasChanges || saving || loading}
            onClick={handleSave}
            sx={{ textTransform: "none", fontWeight: 800, minWidth: 140 }}
          >
            {saving ? "Saving…" : "Save catalogue"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOptionDialog.open} onClose={closeAddOption} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {addOptionDialog.kind === "category" ? "New category" : "New SKU / size"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={addOptionDialog.kind === "category" ? "Category name" : "SKU or pack size"}
            placeholder={addOptionDialog.kind === "category" ? "Juice" : "300 ML"}
            value={addOptionDraft}
            onChange={(e) => setAddOptionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmAddOption();
            }}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={closeAddOption} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirmAddOption} sx={{ textTransform: "none", fontWeight: 700 }}>
            Add
          </Button>
        </DialogActions>
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
