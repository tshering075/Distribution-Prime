import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Paper,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel,
  InputAdornment,
  CircularProgress,
  Alert,
  Slide,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
import SearchIcon from "@mui/icons-material/Search";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { buildCalculatorSkus, num } from "../utils/orderLineCalculation";
import {
  buildPosSettingsPayload,
  resolvePosSettings,
  writePosSettingsToLocalStorage,
} from "../utils/posSettingsStorage";
import { getDistributors, saveDistributors } from "../utils/distributorAuth";
import { savePosSettings } from "../utils/posSettingsStorage";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const CATEGORY_COLORS = {
  CSD: "#e53935",
  CAN: "#fb8c00",
  Water: "#1e88e5",
};

function formatNu(amount) {
  return `Nu. ${num(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function DistributorPosSettingsDialog({
  open,
  onClose,
  distributorCode,
  distributorName,
  distributor,
  setDistributor,
  productRates,
  globalGstEnabled = true,
  isSupabaseConfigured,
  showToast,
  onSaved,
}) {
  const theme = useTheme();
  const skus = useMemo(() => buildCalculatorSkus(productRates), [productRates]);
  const categories = useMemo(() => {
    const set = new Set(skus.map((s) => s.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [skus]);

  const [rates, setRates] = useState({});
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [gstEnabled, setGstEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadFromSource = useCallback(() => {
    const settings = resolvePosSettings(distributor, distributorCode, productRates);
    setRates(settings.rates || {});
    setDiscountType(settings.discountType || "none");
    setDiscountValue(settings.discountValue > 0 ? String(settings.discountValue) : "");
    setGstEnabled(settings.gstEnabled !== false);
    setDirty(false);
  }, [distributor, distributorCode, productRates]);

  useEffect(() => {
    if (open) {
      setSearch("");
      setCategoryFilter("All");
      loadFromSource();
    }
  }, [open, loadFromSource]);

  const filteredSkus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skus.filter((sku) => {
      if (categoryFilter !== "All" && sku.category !== categoryFilter) return false;
      if (!q) return true;
      return String(sku.name).toLowerCase().includes(q);
    });
  }, [skus, search, categoryFilter]);

  const persistLocalDistributor = (payload) => {
    const list = getDistributors();
    const idx = list.findIndex((d) => d.code === distributorCode);
    if (idx >= 0) {
      list[idx] = { ...list[idx], pos_settings: payload };
      saveDistributors(list);
    }
    writePosSettingsToLocalStorage(distributorCode, payload);
    setDistributor?.((prev) => (prev ? { ...prev, pos_settings: payload } : prev));
  };

  const handleRateChange = (skuName, value) => {
    setRates((prev) => ({ ...prev, [skuName]: value }));
    setDirty(true);
  };

  const handleResetRate = (sku) => {
    setRates((prev) => ({ ...prev, [sku.name]: num(sku.rate) }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!distributorCode) return;
    const payload = buildPosSettingsPayload({
      rates,
      discountType,
      discountValue: num(discountValue),
      gstEnabled: globalGstEnabled ? gstEnabled : false,
    });

    setSaving(true);
    try {
      let saved = payload;
      try {
        saved = await savePosSettings(distributorCode, payload, { isSupabaseConfigured });
        persistLocalDistributor(saved);
      } catch (err) {
        if (err?.localOnly) {
          persistLocalDistributor(payload);
          showToast?.(err.message, "warning", "POS settings");
        } else {
          throw err;
        }
      }

      setDirty(false);
      onSaved?.(saved);
      showToast?.("POS rates and settings saved.", "success", "POS settings");
      onClose?.();
    } catch (err) {
      console.error("Failed to save POS settings:", err);
      showToast?.(err?.message || "Could not save POS settings.", "error", "POS settings");
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
      PaperProps={{ sx: { bgcolor: "background.default", display: "flex", flexDirection: "column" } }}
    >
      <Box
        sx={{
          flexShrink: 0,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: "#fff",
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
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
          <SettingsIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            POS settings
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }} noWrap>
            {distributorName || distributorCode} · selling rates, discount &amp; GST
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "inherit" }} aria-label="Close settings">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: { xs: 1.5, sm: 2.5 } }}>
        <Stack spacing={2} sx={{ maxWidth: 1100, mx: "auto" }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
              Default discount &amp; GST
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={discountType}
                  onChange={(_, v) => {
                    if (v) {
                      setDiscountType(v);
                      setDirty(true);
                    }
                  }}
                >
                  <ToggleButton value="none" sx={{ fontWeight: 700, textTransform: "none" }}>
                    No discount
                  </ToggleButton>
                  <ToggleButton value="percent" sx={{ fontWeight: 700, textTransform: "none" }}>
                    %
                  </ToggleButton>
                  <ToggleButton value="fixed" sx={{ fontWeight: 700, textTransform: "none" }}>
                    Nu.
                  </ToggleButton>
                </ToggleButtonGroup>
                {discountType !== "none" ? (
                  <TextField
                    size="small"
                    type="number"
                    label={discountType === "percent" ? "Discount %" : "Discount Nu."}
                    value={discountValue}
                    onChange={(e) => {
                      setDiscountValue(e.target.value);
                      setDirty(true);
                    }}
                    sx={{ width: 160 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocalOfferIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                ) : null}
              </Stack>
              <FormControlLabel
                control={
                  <Switch
                    checked={globalGstEnabled && gstEnabled}
                    disabled={!globalGstEnabled}
                    onChange={(e) => {
                      setGstEnabled(e.target.checked);
                      setDirty(true);
                    }}
                  />
                }
                label={
                  globalGstEnabled
                    ? "Apply 5% GST on POS sales"
                    : "GST disabled by admin for your region"
                }
                sx={{ ml: { md: "auto" } }}
              />
            </Stack>
            {!globalGstEnabled ? (
              <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
                GST is turned off globally for your distributor region. Contact admin to enable it.
              </Alert>
            ) : null}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              Selling rates
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Set your retail price per case. Catalogue rate is shown for reference.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onClick={() => setCategoryFilter(cat)}
                    color={categoryFilter === cat ? "primary" : "default"}
                    variant={categoryFilter === cat ? "filled" : "outlined"}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
            </Stack>

            <TableContainer sx={{ maxHeight: "min(52vh, 520px)", border: 1, borderColor: "divider", borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 800, width: 88 }}>Category</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, width: 110 }}>
                      Catalogue
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, width: 140 }}>
                      Your rate
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, width: 88 }}>
                      Reset
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSkus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                        No products match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSkus.map((sku) => {
                      const accent = CATEGORY_COLORS[sku.category] || theme.palette.primary.main;
                      const selling = rates[sku.name] ?? num(sku.rate);
                      const isCustom = num(selling) !== num(sku.rate);
                      return (
                        <TableRow key={sku.name} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{sku.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={sku.category}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                bgcolor: alpha(accent, 0.12),
                                color: accent,
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: "text.secondary" }}>
                            {formatNu(sku.rate)}
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={selling}
                              onChange={(e) => handleRateChange(sku.name, e.target.value)}
                              inputProps={{ min: 0, step: "0.01", style: { textAlign: "right" } }}
                              sx={{
                                width: 120,
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: 1.5,
                                  bgcolor: isCustom ? alpha(accent, 0.06) : "transparent",
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              disabled={!isCustom}
                              onClick={() => handleResetRate(sku)}
                              sx={{ textTransform: "none", fontWeight: 700, minWidth: 0 }}
                            >
                              Reset
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Box>

      <Paper
        elevation={6}
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
          justifyContent: "flex-end",
        }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", fontWeight: 700 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          disabled={saving || !dirty}
          onClick={handleSave}
          sx={{ textTransform: "none", fontWeight: 800, minWidth: 140 }}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Paper>
    </Dialog>
  );
}
