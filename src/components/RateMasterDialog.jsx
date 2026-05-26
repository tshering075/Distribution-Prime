import React, { useState, useEffect, useRef } from "react";
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
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Card,
  CardContent,
  Stack,
  Container,
  InputAdornment,
  Tooltip,
  Fade,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import RestoreIcon from "@mui/icons-material/Restore";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import NuProductRateIcon from "./NuProductRateIcon";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import PasswordDialog from "./PasswordDialog";
import { saveProductRates } from "../services/supabaseService";
import AppSnackbar from "./AppSnackbar";
import {
  DEFAULT_SKUS,
  DEFAULT_SKU_NAMES,
  UC_DIVISOR,
  customProductLineName,
  skuNameLooksLikeBuiltInCanLine,
} from "../constants/productSkus";
import { BUILT_IN_CAN_PRODUCTS } from "../utils/calculatorSkuNames";
import { writeProductRatesToLocalStorage } from "../utils/productRatesStorage";
import { tableSubHeaderBandBg } from "../theme/contrastSurfaces";

const DEFAULT_CAN_RATE = 750;

const CATEGORY_COLORS = {
  CSD: "#E40521",
  CAN: "#FF6F00",
  Water: "#0288D1",
  Custom: "#6A1B9A",
};

function builtInPetCsdNames(matchName) {
  return DEFAULT_SKUS.filter(
    (s) => s.category === "CSD" && !skuNameLooksLikeBuiltInCanLine(s.name) && matchName(s.name)
  ).map((s) => s.name);
}

/** Keeps Product & Rate Master labels in sync with `DEFAULT_SKUS` + calculator CAN catalogue. */
const RATE_GROUPS = [
  {
    key: "csd_300ml",
    label: "CSD 300ml",
    category: "CSD",
    members: builtInPetCsdNames((name) => /\b300\s+ML\b/i.test(name)),
    defaultRate: 480,
  },
  {
    key: "csd_500ml",
    label: "CSD 500ml",
    category: "CSD",
    members: builtInPetCsdNames((name) => /\b500\s+ML\b/i.test(name)),
    defaultRate: 625,
  },
  {
    key: "csd_1_25l",
    label: "CSD 1.25L",
    category: "CSD",
    members: builtInPetCsdNames((name) => /\b1\.25\s+L\b/i.test(name)),
    defaultRate: 640,
  },
  {
    key: "water_200ml",
    label: "Water 200ml",
    category: "Water",
    members: DEFAULT_SKUS.filter((s) => s.category === "Water" && /\b200\b/.test(s.name)).map((s) => s.name),
    defaultRate: 95,
  },
  {
    key: "water_500ml",
    label: "Water 500ml",
    category: "Water",
    members: DEFAULT_SKUS.filter((s) => s.category === "Water" && /\b500\b/.test(s.name)).map((s) => s.name),
    defaultRate: 135,
  },
  {
    key: "water_1l",
    label: "Water 1 Ltr",
    category: "Water",
    members: DEFAULT_SKUS.filter(
      (s) => s.category === "Water" && /\b1(\.0)?\s+L\b/i.test(s.name) && !/\b1\.25\b/.test(s.name)
    ).map((s) => s.name),
    defaultRate: 115,
  },
  {
    key: "can_300ml",
    label: "CAN / sleek (built-in lines)",
    category: "CAN",
    members: [...BUILT_IN_CAN_PRODUCTS],
    defaultRate: 750,
  },
];

const emptyCustomRow = () => ({
  name: "",
  sku: "",
  category: "CSD",
  kgPerCase: "",
  ucMultiplier: "",
  rate: "",
});

function SectionHeader({ icon: Icon, title, subtitle, accent }) {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: alpha(accent || theme.palette.error.main, 0.12),
          color: accent || theme.palette.error.main,
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

export default function RateMasterDialog({ open, onClose, productRates, onRatesUpdated }) {
  const theme = useTheme();
  const dialogJustOpenedRef = useRef(false);

  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [savePasswordDialogOpen, setSavePasswordDialogOpen] = useState(false);

  const [tab, setTab] = useState(0);
  const [rates, setRates] = useState([]);
  const [customProducts, setCustomProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open && !dialogJustOpenedRef.current) {
      setIsAuthenticated(false);
      setPasswordDialogOpen(true);
      dialogJustOpenedRef.current = true;
    } else if (!open) {
      dialogJustOpenedRef.current = false;
      setIsAuthenticated(false);
      setHasChanges(false);
      setTab(0);
    }
  }, [open]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, productRates]);

  const loadRates = () => {
    const skuRates = productRates?.skuRates || {};
    const loaded = RATE_GROUPS.map((group) => {
      const savedRateFromMembers = group.members
        .map((name) => skuRates?.[name]?.rate)
        .find((rate) => typeof rate === "number" && !isNaN(rate));

      const groupRate =
        group.key === "can_300ml"
          ? (productRates?.canRate ?? savedRateFromMembers ?? group.defaultRate)
          : (savedRateFromMembers ?? group.defaultRate);

      return { ...group, rate: groupRate };
    });

    setRates(loaded);

    const raw = productRates?.customProducts;
    if (Array.isArray(raw) && raw.length > 0) {
      setCustomProducts(
        raw.map((p) => ({
          name: p.name ?? "",
          sku: p.sku != null ? String(p.sku) : "",
          category: p.category === "Water" ? "Water" : p.category === "CAN" ? "CAN" : "CSD",
          kgPerCase: p.kgPerCase != null ? String(p.kgPerCase) : "",
          ucMultiplier:
            p.ucMultiplier != null && p.ucMultiplier !== "" ? String(p.ucMultiplier) : "",
          rate: p.rate != null ? String(p.rate) : "",
        }))
      );
    } else {
      setCustomProducts([]);
    }

    setHasChanges(false);
  };

  const handleRateChange = (index, value) => {
    const val = value === "" ? "" : parseFloat(value);
    setRates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], rate: val };
      return updated;
    });
    setHasChanges(true);
  };

  const handleResetDefaults = () => {
    setRates(RATE_GROUPS.map((group) => ({ ...group, rate: group.defaultRate })));
    setHasChanges(true);
  };

  const handleAddProduct = () => {
    setCustomProducts((prev) => [...prev, emptyCustomRow()]);
    setHasChanges(true);
  };

  const handleRemoveProduct = (index) => {
    setCustomProducts((prev) => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleCustomChange = (index, field, value) => {
    setCustomProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setHasChanges(true);
  };

  const validateAndNormalizeCustom = () => {
    const rows = [];
    const lineNameCounts = new Map();
    for (let i = 0; i < customProducts.length; i++) {
      const p = customProducts[i];
      const name = String(p.name || "").trim();
      const sku = String(p.sku || "").trim();
      const lineName = customProductLineName(name, sku);
      const hasAny =
        name || sku || p.kgPerCase !== "" || p.ucMultiplier !== "" || p.rate !== "";
      if (!hasAny) continue;
      if (!lineName) {
        return { error: `Row ${i + 1}: enter a product name and/or SKU variant (e.g. 300ml).` };
      }
      if (DEFAULT_SKU_NAMES.has(lineName)) {
        return {
          error: `"${lineName}" matches a built-in product. Change the name or variant.`,
        };
      }
      lineNameCounts.set(lineName, (lineNameCounts.get(lineName) || 0) + 1);
      if (lineNameCounts.get(lineName) > 1) {
        return { error: `Duplicate line: "${lineName}" (same name + variant).` };
      }
      const kg = parseFloat(p.kgPerCase);
      const rate = parseFloat(p.rate);
      if (!Number.isFinite(kg) || kg <= 0) {
        return { error: `"${lineName}": weight per case must be a positive number.` };
      }
      if (!Number.isFinite(rate) || rate <= 0) {
        return { error: `"${lineName}": rate must be a positive number.` };
      }
      let ucMultiplier = null;
      if (p.ucMultiplier !== "" && p.ucMultiplier != null) {
        const m = parseFloat(p.ucMultiplier);
        if (!Number.isFinite(m) || m <= 0) {
          return { error: `"${lineName}": UC multiplier must be empty or a positive number.` };
        }
        ucMultiplier = m;
      }
      rows.push({
        name,
        sku,
        category: p.category === "Water" ? "Water" : p.category === "CAN" ? "CAN" : "CSD",
        kgPerCase: kg,
        ucMultiplier,
        rate,
      });
    }
    return { customProducts: rows };
  };

  const handleSaveClick = () => {
    const invalid = rates.some((r) => r.rate === "" || isNaN(r.rate) || r.rate <= 0);
    if (invalid) {
      setSnackbar({ open: true, message: "All group rates must be positive numbers.", severity: "error" });
      return;
    }
    const customCheck = validateAndNormalizeCustom();
    if (customCheck.error) {
      setSnackbar({ open: true, message: customCheck.error, severity: "error" });
      return;
    }
    setSavePasswordDialogOpen(true);
  };

  const confirmSave = async () => {
    setSavePasswordDialogOpen(false);
    const customCheck = validateAndNormalizeCustom();
    if (customCheck.error) {
      setSnackbar({ open: true, message: customCheck.error, severity: "error" });
      return;
    }
    const normalizedCustom = customCheck.customProducts;

    setSaving(true);
    try {
      const skuRates = {};
      rates.forEach((group) => {
        group.members.forEach((skuName) => {
          const defaultSku = DEFAULT_SKUS.find((s) => s.name === skuName);
          if (group.category === "CAN" && BUILT_IN_CAN_PRODUCTS.includes(skuName)) {
            skuRates[skuName] = {
              rate: group.rate,
              kgPerCase: defaultSku?.kgPerCase ?? 8.28,
              ...(defaultSku?.ucMultiplier != null && typeof defaultSku.ucMultiplier === "number"
                ? { ucMultiplier: defaultSku.ucMultiplier }
                : {}),
            };
            return;
          }
          if (!defaultSku) return;
          const entry = { rate: group.rate, kgPerCase: defaultSku.kgPerCase };
          if (defaultSku.ucMultiplier != null && typeof defaultSku.ucMultiplier === "number") {
            entry.ucMultiplier = defaultSku.ucMultiplier;
          }
          skuRates[skuName] = entry;
        });
      });

      normalizedCustom.forEach((p) => {
        const lineName = customProductLineName(p.name, p.sku);
        skuRates[lineName] = {
          rate: p.rate,
          kgPerCase: p.kgPerCase,
          ...(p.ucMultiplier != null ? { ucMultiplier: p.ucMultiplier } : {}),
        };
      });

      const canRate = rates.find((group) => group.key === "can_300ml")?.rate ?? DEFAULT_CAN_RATE;

      const payload = { skuRates, canRate, customProducts: normalizedCustom };
      writeProductRatesToLocalStorage(payload);

      let cloudOk = true;
      try {
        await saveProductRates(payload);
      } catch (error) {
        cloudOk = false;
        console.error("Error saving rates to Supabase:", error);
      }

      if (onRatesUpdated) {
        onRatesUpdated(payload);
      }
      setHasChanges(false);
      setSnackbar({
        open: true,
        message: cloudOk
          ? "Saved to Supabase and this device."
          : "Saved on this device only (cloud save failed).",
        severity: cloudOk ? "success" : "warning",
      });
    } catch (error) {
      console.error("Error saving rates:", error);
      setSnackbar({ open: true, message: "Could not save. Please try again.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSuccess = () => {
    setIsAuthenticated(true);
    setPasswordDialogOpen(false);
  };

  const handlePasswordClose = () => {
    setPasswordDialogOpen(false);
    if (!isAuthenticated) {
      onClose && onClose();
    }
  };

  const customPreviewLine = (row) => {
    const ln = customProductLineName(row.name, row.sku);
    return ln || "—";
  };

  if (!isAuthenticated) {
    return (
      <PasswordDialog
        open={passwordDialogOpen}
        onClose={handlePasswordClose}
        onSuccess={handlePasswordSuccess}
        title="Access Restricted"
        message="Enter your admin password to manage product & rate master (rates and custom products)."
      />
    );
  }

  const tableMaxHeight = "min(52vh, calc(100vh - 380px))";
  const customCount = customProducts.filter((r) => String(r.name || "").trim() || String(r.sku || "").trim()).length;

  const categoryLabel = (c) => (c === "Water" ? "Water" : c === "CAN" ? "CAN" : "CSD");

  const ratesPanelRows = [];
  let lastCategory = null;
  let categoryIndex = 0;
  rates.forEach((item, index) => {
    if (item.category !== lastCategory) {
      lastCategory = item.category;
      const showTopRule = categoryIndex > 0;
      categoryIndex += 1;
      ratesPanelRows.push(
        <TableRow key={`sec-${item.category}-${index}`}>
          <TableCell
            colSpan={3}
            sx={{
              py: 1.5,
              px: 2,
              borderBottom: "none",
              bgcolor: alpha(CATEGORY_COLORS[item.category] || "#999", 0.09),
              borderTop: showTopRule ? `1px solid ${alpha(theme.palette.divider, 0.15)}` : "none",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 4,
                  height: 20,
                  borderRadius: 1,
                  bgcolor: CATEGORY_COLORS[item.category] || "#999",
                }}
              />
              <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 0.8, color: "text.primary" }}>
                {item.category} · standard groups
              </Typography>
            </Stack>
          </TableCell>
        </TableRow>
      );
    }
    ratesPanelRows.push(
      <TableRow
        hover
        key={item.key}
        sx={{
          transition: "background-color 0.15s ease",
          "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.06) },
        }}
      >
        <TableCell sx={{ fontSize: "0.875rem", py: 1.5, maxWidth: { xs: 160, sm: 240 } }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {item.label}
          </Typography>
          {item.members.length > 1 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              Applies to {item.members.length} SKUs
            </Typography>
          ) : null}
        </TableCell>
        <TableCell align="center" sx={{ verticalAlign: "middle" }}>
          <Chip
            label={item.category}
            size="small"
            sx={{
              bgcolor: CATEGORY_COLORS[item.category] || "#999",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.7rem",
              height: 24,
              minWidth: 52,
            }}
          />
        </TableCell>
        <TableCell align="right" sx={{ py: 1, verticalAlign: "middle" }}>
          <TextField
            size="small"
            type="number"
            value={item.rate}
            onChange={(e) => handleRateChange(index, e.target.value)}
            inputProps={{ min: 0, step: 1, style: { textAlign: "right", fontWeight: 600 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    ₹
                  </Typography>
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: 118, sm: 128 } }}
          />
        </TableCell>
      </TableRow>
    );
  });

  const ratesPanel = (
    <Container maxWidth="md" disableGutters sx={{ py: { xs: 2, sm: 2.5 }, px: { xs: 2, sm: 3 } }}>
      <SectionHeader
        icon={NuProductRateIcon}
        title="Standard rate groups"
        subtitle="One price per group applies to every built-in SKU in that group. Use the Products tab to add extra lines."
        accent={theme.palette.error.main}
      />
      <TableContainer
        component={Paper}
        elevation={0}
        variant="outlined"
        sx={{
          maxHeight: tableMaxHeight,
          borderRadius: 2.5,
          borderColor: alpha(theme.palette.divider, 0.14),
          boxShadow: `0 1px 3px ${alpha("#000", 0.06)}`,
          overflow: "auto",
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  bgcolor: tableSubHeaderBandBg(theme),
                  color: "text.primary",
                  borderBottom: `2px solid ${alpha(theme.palette.divider, 0.12)}`,
                }}
              >
                Group
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  bgcolor: tableSubHeaderBandBg(theme),
                  color: "text.primary",
                  borderBottom: `2px solid ${alpha(theme.palette.divider, 0.12)}`,
                }}
              >
                Type
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 800,
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  bgcolor: tableSubHeaderBandBg(theme),
                  color: "text.primary",
                  borderBottom: `2px solid ${alpha(theme.palette.divider, 0.12)}`,
                }}
              >
                Rate
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{ratesPanelRows}</TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 3 }}>
        <Chip
          icon={<Inventory2Icon sx={{ "&&": { fontSize: 18 } }} />}
          label="Your custom products"
          size="small"
          sx={{
            fontWeight: 700,
            px: 0.5,
            bgcolor: alpha(CATEGORY_COLORS.Custom, 0.1),
            color: CATEGORY_COLORS.Custom,
            border: `1px solid ${alpha(CATEGORY_COLORS.Custom, 0.25)}`,
          }}
        />
      </Divider>

      <SectionHeader
        icon={Inventory2Icon}
        title="Quick rate edits"
        subtitle="Adjust per-line rates here or switch to Products for full fields (weight, UC, category)."
        accent={CATEGORY_COLORS.Custom}
      />

      {customProducts.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 4,
            textAlign: "center",
            borderRadius: 2.5,
            borderStyle: "dashed",
            borderColor: alpha(CATEGORY_COLORS.Custom, 0.35),
            bgcolor: alpha(CATEGORY_COLORS.Custom, 0.04),
          }}
        >
          <Inventory2Icon sx={{ fontSize: 40, color: alpha(CATEGORY_COLORS.Custom, 0.45), mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            No custom products yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360, mx: "auto" }}>
            Add SKUs that appear on distributor calculators alongside the standard catalogue.
          </Typography>
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddIcon />}
            onClick={() => {
              setTab(1);
              handleAddProduct();
            }}
            sx={{
              bgcolor: CATEGORY_COLORS.Custom,
              "&:hover": { bgcolor: alpha(CATEGORY_COLORS.Custom, 0.88) },
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 2.5,
            }}
          >
            Add product in Products tab
          </Button>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          variant="outlined"
          sx={{
            maxHeight: "min(38vh, calc(100vh - 480px))",
            borderRadius: 2.5,
            borderColor: alpha(CATEGORY_COLORS.Custom, 0.3),
            boxShadow: `0 1px 3px ${alpha(CATEGORY_COLORS.Custom, 0.08)}`,
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    bgcolor: alpha(CATEGORY_COLORS.Custom, 0.08),
                  }}
                >
                  Calculator line
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    bgcolor: alpha(CATEGORY_COLORS.Custom, 0.08),
                  }}
                >
                  Category
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    bgcolor: alpha(CATEGORY_COLORS.Custom, 0.08),
                  }}
                >
                  Rate
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customProducts.map((row, index) => (
                <TableRow key={index} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: customPreviewLine(row) === "—" ? "text.disabled" : "text.primary",
                      }}
                    >
                      {customPreviewLine(row)}
                    </Typography>
                    {(row.name || row.sku) && customPreviewLine(row) !== "—" ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                        {row.name ? (
                          <Chip label={row.name} size="small" variant="outlined" sx={{ height: 24, fontSize: "0.7rem" }} />
                        ) : null}
                        {row.sku ? (
                          <Chip
                            label={row.sku}
                            size="small"
                            sx={{ height: 24, fontSize: "0.7rem", bgcolor: alpha(CATEGORY_COLORS.Custom, 0.14) }}
                          />
                        ) : null}
                      </Stack>
                    ) : null}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={categoryLabel(row.category)}
                      size="small"
                      sx={{
                        bgcolor: CATEGORY_COLORS[categoryLabel(row.category)] || "#999",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        height: 24,
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={row.rate}
                      onChange={(e) => handleCustomChange(index, "rate", e.target.value)}
                      inputProps={{ min: 0, step: 1, style: { textAlign: "right", fontWeight: 600 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              ₹
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                      sx={{ width: { xs: 118, sm: 128 } }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );

  const accentForCategory = (cat) =>
    cat === "Water" ? CATEGORY_COLORS.Water : cat === "CAN" ? CATEGORY_COLORS.CAN : CATEGORY_COLORS.CSD;

  const productsPanel = (
    <Container maxWidth="md" disableGutters sx={{ py: { xs: 2, sm: 2.5 }, px: { xs: 2, sm: 3 } }}>
      <Card
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
          bgcolor: alpha(theme.palette.info.main, 0.04),
          mb: 2.5,
          overflow: "hidden",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ p: 2 }}>
          <InfoOutlinedIcon sx={{ color: "info.main", mt: 0.25, flexShrink: 0 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "info.dark", mb: 0.75 }}>
              How custom products work
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2.25, color: "text.secondary", typography: "body2", lineHeight: 1.65 }}>
              <li>
                <strong>Name</strong> + <strong>variant</strong> (e.g. 300ml) form the calculator line name.
              </li>
              <li>
                <strong>CSD / Water</strong> → grid on the calculator. <strong>CAN</strong> → appears in the CAN multi-select with its own rate.
              </li>
              <li>
                UC = <strong>(cases × multiplier) ÷ {UC_DIVISOR}</strong>. Leave multiplier empty for no UC (CAN-style).
              </li>
            </Stack>
          </Box>
        </Stack>
      </Card>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 2 }}>
        <Button
          startIcon={<AddIcon />}
          onClick={handleAddProduct}
          variant="contained"
          disableElevation
          fullWidth={false}
          sx={{
            alignSelf: { xs: "stretch", sm: "center" },
            bgcolor: CATEGORY_COLORS.Custom,
            "&:hover": { bgcolor: alpha(CATEGORY_COLORS.Custom, 0.88) },
            borderRadius: 2,
            textTransform: "none",
            fontWeight: 700,
            px: 2.5,
            py: 1,
          }}
        >
          Add product
        </Button>
        {customProducts.length > 0 ? (
          <Chip
            label={`${customProducts.length} row${customProducts.length !== 1 ? "s" : ""}`}
            variant="outlined"
            sx={{ fontWeight: 600, borderColor: alpha(CATEGORY_COLORS.Custom, 0.4), alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        ) : null}
      </Stack>

      <Stack spacing={2.25}>
        {customProducts.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 4,
              textAlign: "center",
              borderRadius: 2.5,
              borderStyle: "dashed",
              bgcolor: alpha(theme.palette.action.hover, 0.04),
            }}
          >
            <Typography color="text.secondary" variant="body1">
              No products yet. Tap <strong>Add product</strong> to create your first line.
            </Typography>
          </Paper>
        ) : null}
        {customProducts.map((row, index) => (
          <Fade in key={index} timeout={280}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                borderLeft: `4px solid ${accentForCategory(row.category)}`,
                overflow: "visible",
                boxShadow: `0 2px 12px ${alpha("#000", 0.04)}`,
              }}
            >
              <CardContent sx={{ py: 2.25, px: { xs: 2, sm: 2.5 }, "&:last-child": { pb: 2.25 } }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 800, letterSpacing: 1 }}>
                      Product {index + 1}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.35, mt: 0.25 }}>
                      {customPreviewLine(row) === "—" ? "New product" : customPreviewLine(row)}
                    </Typography>
                  </Box>
                  <Tooltip title="Remove this product">
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveProduct(index)}
                      aria-label="Remove product"
                      sx={{
                        color: "text.secondary",
                        bgcolor: alpha(theme.palette.error.main, 0.06),
                        "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.14), color: "error.main" },
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      size="small"
                      fullWidth
                      label="Product name"
                      placeholder="e.g. Limca"
                      value={row.name}
                      onChange={(e) => handleCustomChange(index, "name", e.target.value)}
                    />
                    <TextField
                      size="small"
                      fullWidth
                      label="Variant / SKU"
                      placeholder="e.g. 300ml, 500ml"
                      value={row.sku}
                      onChange={(e) => handleCustomChange(index, "sku", e.target.value)}
                    />
                  </Stack>

                  <FormControl size="small" sx={{ maxWidth: 280 }}>
                    <InputLabel id={`cat-${index}`}>Category</InputLabel>
                    <Select labelId={`cat-${index}`} label="Category" value={row.category} onChange={(e) => handleCustomChange(index, "category", e.target.value)}>
                      <MenuItem value="CSD">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CATEGORY_COLORS.CSD }} />
                          CSD
                        </Stack>
                      </MenuItem>
                      <MenuItem value="Water">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CATEGORY_COLORS.Water }} />
                          Water
                        </Stack>
                      </MenuItem>
                      <MenuItem value="CAN">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: CATEGORY_COLORS.CAN }} />
                          CAN
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField
                      size="small"
                      label="Weight (kg / case)"
                      type="number"
                      value={row.kgPerCase}
                      onChange={(e) => handleCustomChange(index, "kgPerCase", e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="UC multiplier"
                      type="number"
                      value={row.ucMultiplier}
                      onChange={(e) => handleCustomChange(index, "ucMultiplier", e.target.value)}
                      placeholder="Optional"
                      helperText={`Fixed divisor: ${UC_DIVISOR}`}
                      inputProps={{ min: 0, step: 0.01 }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Rate per case"
                      type="number"
                      value={row.rate}
                      onChange={(e) => handleCustomChange(index, "rate", e.target.value)}
                      inputProps={{ min: 0, step: 1 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Typography variant="body2" fontWeight={700} color="text.secondary">
                              ₹
                            </Typography>
                          </InputAdornment>
                        ),
                      }}
                      fullWidth
                    />
                  </Stack>

                  <Paper
                    variant="outlined"
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.04),
                      borderColor: alpha(theme.palette.success.main, 0.2),
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
                      Preview on calculator
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "success.dark" }}>
                      {customPreviewLine(row)}
                    </Typography>
                  </Paper>
                </Stack>
              </CardContent>
            </Card>
          </Fade>
        ))}
      </Stack>
    </Container>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        maxWidth={false}
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: 0,
            m: 0,
            height: "100%",
            maxHeight: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            bgcolor: "background.default",
            color: "text.primary",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            background: `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${alpha("#b71c1c", 0.95)} 55%, ${alpha(theme.palette.error.dark, 0.9)} 100%)`,
            color: "#fff",
            py: 2,
            px: { xs: 2, sm: 3 },
            flexShrink: 0,
            boxShadow: `0 4px 20px ${alpha("#000", 0.12)}`,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha("#fff", 0.15),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: `1px solid ${alpha("#fff", 0.25)}`,
              }}
            >
              <NuProductRateIcon sx={{ fontSize: "1.35rem" }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.35rem" }, lineHeight: 1.25 }}>
                Product &amp; Rate Master
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
                <CloudDoneOutlinedIcon sx={{ fontSize: 16, opacity: 0.9 }} />
                <Typography variant="caption" sx={{ opacity: 0.92, lineHeight: 1.4 }}>
                  Supabase + device backup · distributors see changes after save
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            {hasChanges ? (
              <Chip
                label="Unsaved"
                size="small"
                sx={{
                  bgcolor: alpha("#fff", 0.2),
                  color: "#fff",
                  fontWeight: 800,
                  border: `1px solid ${alpha("#fff", 0.35)}`,
                  display: { xs: "none", sm: "inline-flex" },
                }}
              />
            ) : null}
            <IconButton onClick={onClose} sx={{ color: "#fff", bgcolor: alpha("#fff", 0.1), "&:hover": { bgcolor: alpha("#fff", 0.2) } }} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <Box
          sx={{
            px: { xs: 1.5, sm: 2 },
            pt: 1.5,
            pb: 0.5,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: (t) =>
              t.palette.mode === "dark" ? alpha(t.palette.common.white, 0.04) : alpha(t.palette.grey[50], 0.95),
            flexShrink: 0,
          }}
        >
          <Container maxWidth="md" disableGutters>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: 2.5,
                p: 0.5,
                mb: 1,
                borderColor: alpha(theme.palette.divider, 0.12),
                bgcolor: "background.paper",
              }}
            >
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                variant="fullWidth"
                TabIndicatorProps={{ sx: { display: "none" } }}
                sx={{
                  minHeight: 44,
                  "& .MuiTab-root": {
                    minHeight: 44,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    borderRadius: 2,
                    mx: 0.25,
                    transition: "background-color 0.2s ease, color 0.2s ease",
                  },
                  "& .Mui-selected": {
                    color: `${theme.palette.error.main} !important`,
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                  },
                }}
              >
            <Tab
              disableRipple
              label={
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75}>
                  <NuProductRateIcon
                    sx={{
                      fontSize: "0.78rem",
                      minWidth: 26,
                      height: 26,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.error.main, 0.12),
                      color: theme.palette.error.main,
                    }}
                  />
                  <span>Rates</span>
                </Stack>
              }
            />
            <Tab
              disableRipple
              label={
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75}>
                  <Inventory2Icon sx={{ fontSize: 20, opacity: 0.85 }} />
                  <span>Products</span>
                  {customCount > 0 ? (
                    <Chip label={customCount} size="small" sx={{ height: 20, minWidth: 20, fontSize: "0.7rem" }} />
                  ) : null}
                </Stack>
              }
            />
              </Tabs>
            </Paper>
          </Container>
        </Box>

        <DialogContent
          sx={{
            flex: 1,
            overflow: "auto",
            p: 0,
            bgcolor: (t) =>
              t.palette.mode === "dark" ? alpha(t.palette.common.white, 0.03) : alpha(t.palette.grey[50], 0.5),
            color: "text.primary",
          }}
        >
          {tab === 0 ? ratesPanel : productsPanel}
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            gap: 1.5,
            flexShrink: 0,
            flexWrap: "wrap",
            bgcolor: "background.paper",
            boxShadow: (t) => `0 -4px 24px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.2 : 0.04)}`,
          }}
        >
          <Button
            startIcon={<RestoreIcon />}
            onClick={handleResetDefaults}
            color="inherit"
            size="medium"
            disabled={tab !== 0}
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
          >
            Reset group defaults
          </Button>
          {hasChanges ? (
            <Chip
              label="Unsaved changes"
              color="warning"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700, display: { xs: "none", md: "inline-flex" } }}
            />
          ) : null}
          <Box sx={{ flex: 1, minWidth: 8 }} />
          <Button onClick={onClose} color="inherit" size="medium" sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveClick}
            disabled={saving || !hasChanges}
            disableElevation
            size="large"
            sx={{
              bgcolor: theme.palette.error.main,
              "&:hover": { bgcolor: theme.palette.error.dark },
              "&.Mui-disabled": { bgcolor: alpha(theme.palette.action.disabledBackground, 0.5) },
              textTransform: "none",
              fontWeight: 800,
              borderRadius: 2,
              px: 3,
              py: 1,
              boxShadow: hasChanges ? `0 4px 14px ${alpha(theme.palette.error.main, 0.35)}` : "none",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <PasswordDialog
        open={savePasswordDialogOpen}
        onClose={() => setSavePasswordDialogOpen(false)}
        onSuccess={confirmSave}
        title="Confirm changes"
        message="Saving updates product rates and your custom product list (including SKU variants) for all calculators. Enter your admin password to confirm."
      />

      <AppSnackbar
        open={snackbar.open}
        severity={snackbar.severity}
        message={snackbar.message}
        autoHideDuration={3200}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </>
  );
}
