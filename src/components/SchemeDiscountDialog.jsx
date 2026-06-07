import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  TextField,
  Chip,
  Checkbox,
  Paper,
  Grid,
  Alert,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Tooltip,
  Avatar,
  Stack,
  LinearProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import AppSnackbar from "./AppSnackbar";
import StatCard from "./StatCard";
import {
  getAllCatalogLineNames,
  getCatalogProductsGrouped,
  inferSchemeAppliesTo,
} from "../utils/productCatalog";

function formatDateRange(start, end) {
  if (!start || !end) return "—";
  try {
    return `${new Date(start).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function daysUntilEnd(endDate) {
  const end = new Date(endDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
      {Icon ? (
        <Avatar
          variant="rounded"
          sx={{
            width: 40,
            height: 40,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            color: "primary.main",
          }}
        >
          <Icon fontSize="small" />
        </Avatar>
      ) : null}
      <Box>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

function SchemeTypeCards({ value, onChange }) {
  const theme = useTheme();
  const options = [
    {
      id: "csd_scheme",
      title: "Buy X Get Y",
      subtitle: "Free cases on purchase",
      icon: CardGiftcardOutlinedIcon,
    },
    {
      id: "discount",
      title: "Per-case discount",
      subtitle: "Fixed ₹ off each case",
      icon: CurrencyRupeeIcon,
    },
  ];
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
      {options.map((opt) => {
        const selected = value === opt.id;
        const Icon = opt.icon;
        return (
          <Paper
            key={opt.id}
            variant="outlined"
            onClick={() => onChange(opt.id)}
            sx={{
              flex: 1,
              p: 2,
              cursor: "pointer",
              borderRadius: 2,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : "background.paper",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": { borderColor: "primary.light", bgcolor: alpha(theme.palette.primary.main, 0.04) },
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Icon color={selected ? "primary" : "action"} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {opt.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {opt.subtitle}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

function SchemesListView({ schemes, distributors, onDelete, variant = "active" }) {
  const theme = useTheme();
  const isActive = variant === "active";

  if (schemes.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 4,
          textAlign: "center",
          borderRadius: 2,
          borderStyle: "dashed",
          bgcolor: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <LocalOfferIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {isActive ? "No active schemes" : "No expired schemes"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {isActive
            ? "Create a scheme on the first tab to offer promotions to distributors."
            : "Expired schemes appear here after their end date passes."}
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
        {schemes.map((scheme) => {
          const daysLeft = isActive ? daysUntilEnd(scheme.endDate) : null;
          return (
            <Card key={scheme.id} variant="outlined" sx={{ borderRadius: 2, opacity: isActive ? 1 : 0.85 }}>
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {scheme.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {scheme.schemeDescription}
                    </Typography>
                  </Box>
                  <IconButton size="small" color="error" onClick={() => onDelete(scheme.id)} aria-label="Delete scheme">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
                  <Chip
                    size="small"
                    label={scheme.type === "csd_scheme" ? "Buy X Get Y" : "Discount"}
                    color="primary"
                    variant={isActive ? "filled" : "outlined"}
                  />
                  {isActive && daysLeft != null ? (
                    <Chip
                      size="small"
                      label={daysLeft <= 0 ? "Ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                      color={daysLeft <= 3 ? "warning" : "default"}
                      variant="outlined"
                    />
                  ) : null}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      scheme.appliesToSKUs?.length
                        ? `${scheme.appliesToSKUs.length} SKU(s)`
                        : scheme.appliesTo === "water"
                          ? "Water"
                          : scheme.appliesTo === "both"
                            ? "CSD + Water"
                            : "CSD"
                    }
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  {isActive
                    ? formatDateRange(scheme.startDate, scheme.endDate)
                    : `Ended ${new Date(scheme.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                </Typography>
                {scheme.distributors?.length > 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {scheme.distributors.length} distributor{scheme.distributors.length === 1 ? "" : "s"}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </Box>
      <TableContainer sx={{ display: { xs: "none", md: "block" }, borderRadius: 2, border: 1, borderColor: "divider" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
              <TableCell sx={{ fontWeight: 700 }}>Scheme</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Offer</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Products</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Validity</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Distributors</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 72 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schemes.map((scheme) => {
              const daysLeft = isActive ? daysUntilEnd(scheme.endDate) : null;
              const skuTooltip = scheme.appliesToSKUs?.length ? scheme.appliesToSKUs.join(", ") : "";
              return (
                <TableRow key={scheme.id} hover sx={{ opacity: isActive ? 1 : 0.75 }}>
                  <TableCell>
                    <Typography fontWeight={600}>{scheme.name}</Typography>
                    {isActive && daysLeft != null && daysLeft <= 7 ? (
                      <Typography variant="caption" color={daysLeft <= 3 ? "warning.main" : "text.secondary"}>
                        {daysLeft <= 0 ? "Ends today" : `${daysLeft}d left`}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={scheme.type === "csd_scheme" ? "Buy X Get Y" : "Discount"}
                      color={isActive ? "primary" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{scheme.schemeDescription}</Typography>
                  </TableCell>
                  <TableCell>
                    {scheme.appliesToSKUs?.length ? (
                      <Tooltip title={skuTooltip}>
                        <Chip label={`${scheme.appliesToSKUs.length} SKU(s)`} size="small" variant="outlined" />
                      </Tooltip>
                    ) : (
                      <Chip
                        label={
                          scheme.appliesTo === "csd" ? "CSD" : scheme.appliesTo === "water" ? "Water" : "Both"
                        }
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {isActive
                        ? formatDateRange(scheme.startDate, scheme.endDate)
                        : new Date(scheme.endDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${scheme.distributors?.length || 0}`}
                      title={
                        scheme.distributors
                          ?.map((code) => distributors.find((d) => d.code === code)?.name || code)
                          .join(", ") || ""
                      }
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Delete scheme">
                      <IconButton size="small" color="error" onClick={() => onDelete(scheme.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

export default function SchemeDiscountDialog({
  open,
  onClose,
  distributors = [],
  schemes = [],
  onSaveScheme,
  onDeleteScheme,
  productRates = null,
  onOpenRateMaster,
}) {
  const theme = useTheme();
  const [schemeType, setSchemeType] = useState("csd_scheme");
  const [schemeName, setSchemeName] = useState("");
  const [buyQuantity, setBuyQuantity] = useState(6);
  const [freeQuantity, setFreeQuantity] = useState(1);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDistributors, setSelectedDistributors] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSKUs, setSelectedSKUs] = useState([]);
  const [skuSearchTerm, setSkuSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, severity: "info", title: "", message: "" });

  const showToast = useCallback((severity, title, message) => {
    setSnackbar({ open: true, severity, title, message });
  }, []);

  useEffect(() => {
    if (open) {
      setSchemeType("csd_scheme");
      setSchemeName("");
      setBuyQuantity(6);
      setFreeQuantity(1);
      setDiscountAmount(0);
      setStartDate("");
      setEndDate("");
      setSelectedDistributors([]);
      setSearchTerm("");
      setSelectedSKUs([]);
      setSkuSearchTerm("");
      setTabValue(0);
    }
  }, [open]);

  const prevDistributorsRef = useRef(selectedDistributors);
  useEffect(() => {
    const hasUndefined = selectedDistributors.some((code) => code === undefined || code === null || code === "");
    if (hasUndefined && JSON.stringify(prevDistributorsRef.current) !== JSON.stringify(selectedDistributors)) {
      const cleaned = selectedDistributors.filter((code) => code !== undefined && code !== null && code !== "");
      setSelectedDistributors(cleaned);
      prevDistributorsRef.current = cleaned;
    } else {
      prevDistributorsRef.current = selectedDistributors;
    }
  }, [selectedDistributors]);

  const catalogProductsGrouped = useMemo(
    () => getCatalogProductsGrouped(productRates),
    [productRates]
  );

  const allCatalogSkus = useMemo(
    () => getAllCatalogLineNames(productRates),
    [productRates]
  );

  const hasCatalogProducts = allCatalogSkus.length > 0;

  const validDistributors = useMemo(
    () =>
      distributors.filter(
        (d) => d && d.code && d.code !== undefined && d.code !== null && String(d.code).trim() !== ""
      ),
    [distributors]
  );

  const filteredDistributors = useMemo(() => {
    if (!searchTerm) return validDistributors;
    const searchLower = searchTerm.toLowerCase();
    return validDistributors.filter(
      (d) =>
        d.name?.toLowerCase().includes(searchLower) ||
        String(d.code).toLowerCase().includes(searchLower)
    );
  }, [validDistributors, searchTerm]);

  const activeSchemes = useMemo(() => {
    const now = new Date();
    return schemes.filter((scheme) => new Date(scheme.endDate) >= now);
  }, [schemes]);

  const expiredSchemes = useMemo(() => {
    const now = new Date();
    return schemes.filter((scheme) => new Date(scheme.endDate) < now);
  }, [schemes]);

  const formProgress = useMemo(() => {
    let steps = 0;
    let done = 0;
    steps += 1;
    if (schemeName.trim()) done += 1;
    steps += 1;
    if (selectedSKUs.length > 0) done += 1;
    steps += 1;
    if (startDate && endDate) done += 1;
    steps += 1;
    if (selectedDistributors.length > 0) done += 1;
    return Math.round((done / steps) * 100);
  }, [schemeName, selectedSKUs, startDate, endDate, selectedDistributors]);

  const handleToggleDistributor = (distributorCode) => {
    if (!distributorCode) return;
    setSelectedDistributors((prev) => {
      const cleanPrev = prev.filter((code) => code !== undefined && code !== null && code !== "");
      if (cleanPrev.includes(distributorCode)) {
        return cleanPrev.filter((code) => code !== distributorCode);
      }
      return [...cleanPrev, distributorCode];
    });
  };

  const handleSelectAll = () => {
    if (selectedDistributors.length === filteredDistributors.length) {
      setSelectedDistributors([]);
    } else {
      setSelectedDistributors(
        filteredDistributors.map((d) => d.code).filter((code) => code !== undefined && code !== null && code !== "")
      );
    }
  };

  const handleSave = () => {
    const cleanedDistributors = selectedDistributors.filter((code) => code !== undefined && code !== null && code !== "");
    const cleanedSKUs = selectedSKUs.filter((sku) => sku !== undefined && sku !== null && sku !== "");

    if (cleanedDistributors.length !== selectedDistributors.length) setSelectedDistributors(cleanedDistributors);
    if (cleanedSKUs.length !== selectedSKUs.length) setSelectedSKUs(cleanedSKUs);

    const validSelectedDistributors = cleanedDistributors;
    const validSKUs = cleanedSKUs;

    if (!schemeName.trim()) {
      showToast("warning", "Scheme name required", "Enter a name distributors will recognize.");
      return;
    }
    if (!startDate || !endDate) {
      showToast("warning", "Dates required", "Choose both start and end dates.");
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      showToast("warning", "Invalid dates", "End date must be after the start date.");
      return;
    }
    if (!Array.isArray(validSelectedDistributors) || validSelectedDistributors.length === 0) {
      showToast("warning", "Select distributors", "Choose at least one distributor for this offer.");
      return;
    }
    if (validSKUs.length === 0) {
      showToast("warning", "Select products", "Choose at least one SKU this scheme applies to.");
      return;
    }
    if (schemeType === "csd_scheme" && (Number(buyQuantity) <= 0 || Number(freeQuantity) < 0)) {
      showToast("warning", "Invalid quantities", "Buy quantity must be greater than 0; free quantity cannot be negative.");
      return;
    }
    if (schemeType === "discount" && Number(discountAmount) <= 0) {
      showToast("warning", "Invalid discount", "Discount amount must be greater than ₹0.");
      return;
    }

    const distributorsArray = validSelectedDistributors.map((d) => String(d).trim()).filter((d) => d.length > 0);
    const skusArray = validSKUs.map((s) => String(s).trim()).filter((s) => s.length > 0);
    const appliesTo = inferSchemeAppliesTo(skusArray, productRates);

    if (distributorsArray.length === 0) {
      showToast("error", "Invalid selection", "Selected distributors have no valid codes. Check distributor setup.");
      return;
    }

    const schemeData = {
      id: `scheme_${Date.now()}`,
      type: schemeType,
      name: schemeName.trim(),
      appliesTo,
      appliesToSKUs: skusArray,
      startDate,
      endDate,
      distributors: distributorsArray,
      createdAt: new Date().toISOString(),
    };

    if (schemeType === "csd_scheme") {
      const buyQty = Number(buyQuantity);
      const freeQty = Number(freeQuantity);
      if (!isNaN(buyQty) && buyQty >= 0) schemeData.buyQuantity = buyQty;
      if (!isNaN(freeQty) && freeQty >= 0) schemeData.freeQuantity = freeQty;
      schemeData.schemeDescription = `Buy ${buyQuantity}, Get ${freeQuantity} Free (${buyQuantity}+${freeQuantity})`;
    } else if (schemeType === "discount") {
      const discountAmt = Number(discountAmount);
      if (!isNaN(discountAmt) && discountAmt >= 0) schemeData.discountAmount = discountAmt;
      schemeData.schemeDescription = `₹${discountAmount} Discount per Case`;
    }

    Object.keys(schemeData).forEach((key) => {
      if (schemeData[key] === undefined) delete schemeData[key];
    });
    if (!Array.isArray(schemeData.distributors)) schemeData.distributors = [];
    if (!Array.isArray(schemeData.appliesToSKUs)) schemeData.appliesToSKUs = [];

    onSaveScheme(schemeData);
    showToast("success", "Scheme saved", `"${schemeData.name}" is now active for selected distributors.`);

    setSchemeName("");
    setBuyQuantity(6);
    setFreeQuantity(1);
    setDiscountAmount(0);
    setStartDate("");
    setEndDate("");
    setSelectedDistributors([]);
    setSelectedSKUs([]);
    setTabValue(1);
  };

  const handleDelete = (schemeId) => {
    if (window.confirm("Delete this scheme? Distributors will no longer see this offer.")) {
      onDeleteScheme(schemeId);
      showToast("info", "Scheme removed", "The scheme has been deleted.");
    }
  };

  const headerGradient = `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <AppBar
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: theme.zIndex.appBar + 1,
          background: headerGradient,
        }}
      >
        <Toolbar sx={{ gap: 1, py: { xs: 0.5, sm: 1 } }}>
          <LocalOfferIcon />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="div" fontWeight={700} noWrap>
              Schemes & Discounts
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9, display: { xs: "none", sm: "block" } }}>
              Promotions for distributor ordering
            </Typography>
          </Box>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ bgcolor: "background.default", minHeight: "100vh", pb: 4 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            pt: 2,
            pb: 0,
            position: "sticky",
            top: { xs: 56, sm: 64 },
            zIndex: theme.zIndex.appBar,
            bgcolor: "background.default",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={{ xs: 4 }}>
              <StatCard
                title="Active"
                value={activeSchemes.length}
                hint="Running now"
                color="success"
                icon={CheckCircleIcon}
                active={tabValue === 1}
                onClick={() => setTabValue(1)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <StatCard
                title="Expired"
                value={expiredSchemes.length}
                hint="Past end date"
                color="secondary"
                icon={CancelIcon}
                active={tabValue === 2}
                onClick={() => setTabValue(2)}
              />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <StatCard
                title="Create"
                value="+"
                hint="New offer"
                color="primary"
                icon={AddIcon}
                active={tabValue === 0}
                onClick={() => setTabValue(0)}
              />
            </Grid>
          </Grid>

          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="fullWidth"
            sx={{
              mb: 0,
              minHeight: 48,
              "& .MuiTab-root": {
                minHeight: 48,
                fontWeight: 600,
                textTransform: "none",
                fontSize: { xs: "0.8rem", sm: "0.9rem" },
              },
            }}
          >
            <Tab label="Create" icon={<AddIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label={`Active (${activeSchemes.length})`} icon={<CheckCircleIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
            <Tab label={`Expired (${expiredSchemes.length})`} icon={<CancelIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
          </Tabs>
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}>
          {tabValue === 0 && (
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, lg: 7 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <SectionHeader
                      icon={LocalOfferIcon}
                      title="New scheme or discount"
                      subtitle="Define products, offer type, dates, and who receives it"
                    />

                    <Box sx={{ mb: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Form progress
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          {formProgress}%
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={formProgress} sx={{ borderRadius: 1, height: 6 }} />
                    </Box>

                    <SchemeTypeCards value={schemeType} onChange={setSchemeType} />

                    <TextField
                      fullWidth
                      label="Scheme name"
                      value={schemeName}
                      onChange={(e) => setSchemeName(e.target.value)}
                      placeholder="e.g. Summer 2026 – CSD promo"
                      sx={{ mb: 2.5 }}
                      size="small"
                    />

                    <SectionHeader
                      icon={Inventory2OutlinedIcon}
                      title="Products"
                      subtitle="From Product & Rate Master — active SKUs only"
                    />
                    {!hasCatalogProducts ? (
                      <Alert severity="warning" variant="outlined" sx={{ mb: 1.5 }}>
                        No products in this workspace catalogue. Add products in{" "}
                        <strong>Product &amp; Rate Master</strong> first.
                        {onOpenRateMaster ? (
                          <>
                            {" "}
                            <Button size="small" onClick={onOpenRateMaster} sx={{ textTransform: "none", fontWeight: 700 }}>
                              Open catalogue
                            </Button>
                          </>
                        ) : null}
                      </Alert>
                    ) : null}
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search SKUs…"
                      value={skuSearchTerm}
                      onChange={(e) => setSkuSearchTerm(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ mb: 1 }}
                    />
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!hasCatalogProducts}
                        onClick={() =>
                          setSelectedSKUs(
                            selectedSKUs.length === allCatalogSkus.length ? [] : [...allCatalogSkus]
                          )
                        }
                      >
                        {selectedSKUs.length === allCatalogSkus.length ? "Clear all" : "Select all"}
                      </Button>
                      <Chip label={`${selectedSKUs.length} selected`} size="small" color="primary" variant="outlined" />
                    </Stack>
                    <Paper
                      variant="outlined"
                      sx={{ maxHeight: 220, overflow: "auto", borderRadius: 2, mb: 2.5 }}
                    >
                      {Object.entries(catalogProductsGrouped).map(([category, skuList]) => {
                        const filteredSKUs = skuList.filter((sku) =>
                          sku.toLowerCase().includes(skuSearchTerm.toLowerCase())
                        );
                        if (filteredSKUs.length === 0) return null;
                        return (
                          <Box key={category} sx={{ px: 1, py: 0.5 }}>
                            <Typography
                              variant="overline"
                              sx={{ px: 1, color: "primary.main", fontWeight: 700, letterSpacing: 0.8 }}
                            >
                              {category}
                            </Typography>
                            {filteredSKUs.map((sku) => (
                              <Box
                                key={sku}
                                onClick={() =>
                                  setSelectedSKUs((prev) =>
                                    prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
                                  )
                                }
                                sx={{
                                  px: 1,
                                  py: 0.75,
                                  borderRadius: 1,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                }}
                              >
                                <Checkbox checked={selectedSKUs.includes(sku)} size="small" tabIndex={-1} />
                                <Typography variant="body2">{sku}</Typography>
                              </Box>
                            ))}
                          </Box>
                        );
                      })}
                    </Paper>

                    {schemeType === "csd_scheme" ? (
                      <>
                        <Grid container spacing={2} sx={{ mb: 1.5 }}>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Buy (cases)"
                              type="number"
                              value={buyQuantity}
                              onChange={(e) => setBuyQuantity(e.target.value)}
                              inputProps={{ min: 1 }}
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Free (cases)"
                              type="number"
                              value={freeQuantity}
                              onChange={(e) => setFreeQuantity(e.target.value)}
                              inputProps={{ min: 0 }}
                            />
                          </Grid>
                        </Grid>
                        <Alert severity="info" variant="outlined" sx={{ mb: 2.5, borderRadius: 2 }}>
                          Preview: Buy <strong>{buyQuantity}</strong>, get <strong>{freeQuantity}</strong> free (
                          {buyQuantity}+{freeQuantity} bundle)
                        </Alert>
                      </>
                    ) : (
                      <TextField
                        fullWidth
                        size="small"
                        label="Discount per case"
                        type="number"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                        helperText="e.g. ₹5, ₹10, ₹15 per case"
                        inputProps={{ min: 0, step: 0.01 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Typography fontWeight={600}>₹</Typography>
                            </InputAdornment>
                          ),
                        }}
                        sx={{ mb: 2.5 }}
                      />
                    )}

                    <Divider sx={{ my: 2 }} />
                    <SectionHeader icon={EventIcon} title="Validity" subtitle="When distributors can use this offer" />
                    <Grid container spacing={2} sx={{ mb: 2.5 }}>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Start"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="End"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>

                    <Divider sx={{ my: 2 }} />
                    <SectionHeader
                      icon={PeopleIcon}
                      title="Distributors"
                      subtitle={`${validDistributors.length} with valid codes`}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by name or code…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ mb: 1 }}
                    />
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
                      <Button size="small" variant="outlined" onClick={handleSelectAll}>
                        {selectedDistributors.length === filteredDistributors.length && filteredDistributors.length > 0
                          ? "Clear all"
                          : "Select visible"}
                      </Button>
                      <Chip
                        label={`${selectedDistributors.length} selected`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Stack>
                    <Paper variant="outlined" sx={{ maxHeight: 280, overflow: "auto", borderRadius: 2 }}>
                      {distributors.length === 0 ? (
                        <Alert severity="warning" sx={{ m: 2, borderRadius: 2 }}>
                          No distributors loaded. Add distributors from the sidebar first.
                        </Alert>
                      ) : validDistributors.length === 0 ? (
                        <Alert severity="warning" sx={{ m: 2, borderRadius: 2 }}>
                          {distributors.length} distributor(s) found, but none have valid codes.
                        </Alert>
                      ) : filteredDistributors.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: "center" }}>
                          <Typography color="text.secondary">No match for &ldquo;{searchTerm}&rdquo;</Typography>
                        </Box>
                      ) : (
                        filteredDistributors.map((distributor) => {
                          const selected = selectedDistributors.includes(distributor.code);
                          return (
                            <Box
                              key={distributor.code}
                              onClick={() => handleToggleDistributor(distributor.code)}
                              sx={{
                                px: 1.5,
                                py: 1,
                                borderBottom: 1,
                                borderColor: "divider",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : "transparent",
                                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                              }}
                            >
                              <Checkbox checked={selected} size="small" tabIndex={-1} />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap>
                                  {distributor.name || "Unnamed"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {distributor.code}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        })
                      )}
                    </Paper>
                  </CardContent>
                  <CardActions
                    sx={{
                      px: { xs: 2, sm: 3 },
                      py: 2,
                      borderTop: 1,
                      borderColor: "divider",
                      justifyContent: "flex-end",
                      gap: 1,
                      flexWrap: "wrap",
                    }}
                  >
                    <Button onClick={onClose} variant="outlined" color="inherit">
                      Close
                    </Button>
                    <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
                      Save scheme
                    </Button>
                  </CardActions>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    position: { lg: "sticky" },
                    top: { lg: 140 },
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      Live preview
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      What distributors will see in the calculator
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="overline" color="text.secondary">
                          Type
                        </Typography>
                        <Typography variant="body1" fontWeight={600}>
                          {schemeType === "csd_scheme"
                            ? `Buy ${buyQuantity} get ${freeQuantity} free`
                            : `₹${discountAmount || "—"} off per case`}
                        </Typography>
                      </Box>
                      {schemeName ? (
                        <Box>
                          <Typography variant="overline" color="text.secondary">
                            Name
                          </Typography>
                          <Typography variant="body1" fontWeight={600}>
                            {schemeName}
                          </Typography>
                        </Box>
                      ) : null}
                      {startDate && endDate ? (
                        <Box>
                          <Typography variant="overline" color="text.secondary">
                            Validity
                          </Typography>
                          <Typography variant="body2">{formatDateRange(startDate, endDate)}</Typography>
                        </Box>
                      ) : null}
                      {selectedSKUs.length > 0 ? (
                        <Box>
                          <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
                            Products ({selectedSKUs.length})
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.5}>
                            {selectedSKUs.slice(0, 6).map((sku) => (
                              <Chip key={sku} label={sku} size="small" variant="outlined" />
                            ))}
                            {selectedSKUs.length > 6 ? (
                              <Chip label={`+${selectedSKUs.length - 6}`} size="small" />
                            ) : null}
                          </Stack>
                        </Box>
                      ) : null}
                      {selectedDistributors.length > 0 ? (
                        <Box>
                          <Typography variant="overline" color="text.secondary" display="block" gutterBottom>
                            Distributors ({selectedDistributors.length})
                          </Typography>
                          <Stack direction="row" flexWrap="wrap" gap={0.5}>
                            {selectedDistributors.slice(0, 5).map((code) => {
                              const dist = distributors.find((d) => d.code === code);
                              return <Chip key={code} label={dist?.name || code} size="small" color="primary" />;
                            })}
                            {selectedDistributors.length > 5 ? (
                              <Chip label={`+${selectedDistributors.length - 5}`} size="small" />
                            ) : null}
                          </Stack>
                        </Box>
                      ) : null}
                      {!schemeName && selectedSKUs.length === 0 && selectedDistributors.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" fontStyle="italic">
                          Fill in the form to see a preview here.
                        </Typography>
                      ) : null}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <SectionHeader
                  icon={CheckCircleIcon}
                  title="Active schemes"
                  subtitle="Currently within start and end dates"
                />
                <SchemesListView
                  schemes={activeSchemes}
                  distributors={distributors}
                  onDelete={handleDelete}
                  variant="active"
                />
              </CardContent>
            </Card>
          )}

          {tabValue === 2 && (
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <SectionHeader
                  icon={CancelIcon}
                  title="Expired schemes"
                  subtitle="Past end date — delete to clean up history"
                />
                <SchemesListView
                  schemes={expiredSchemes}
                  distributors={distributors}
                  onDelete={handleDelete}
                  variant="expired"
                />
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <AppSnackbar
        open={snackbar.open}
        severity={snackbar.severity}
        title={snackbar.title}
        message={snackbar.message}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />
    </Dialog>
  );
}
