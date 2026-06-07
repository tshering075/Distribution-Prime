import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useMediaQuery,
  MenuItem,
  Select,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  Switch,
  FormControlLabel,
  CircularProgress,
  Stack,
  Divider,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  calcSummaryRows,
  calculatorPageShellSx,
  calculatorPaperSx,
  calculatorResultsShellSx,
  tableFooterBandBg,
  tableFooterBandBorder,
  tableRowHoverBg,
  tableStripeAt,
  tableHeadRowSx,
} from "./theme/contrastSurfaces";
import CheckIcon from "@mui/icons-material/Check";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckout";
import LocalDrinkIcon from "@mui/icons-material/LocalDrink";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import SportsBarIcon from "@mui/icons-material/SportsBar";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import {
  peekNextUniqueOrderNumber,
  loadUsedOrderNumbersFromLocalStorage,
  getCurrentOrderNumber,
} from "./utils/orderNumber";
import AppSnackbar from "./components/AppSnackbar";
import {
  DEFAULT_SKUS,
  UC_DIVISOR,
  DEFAULT_SKU_NAMES,
  customProductLineName,
  skuNameLooksLikeBuiltInCanLine,
} from "./constants/productSkus";

/** Built-in CAN lines (multi-select); Sprite can uses distinct name from PET SPRITE 300 ML. */
const BUILT_IN_CAN_PRODUCTS = [
  "COKE CAN 300 ML",
  "FANTA CAN 300 ML",
  "SPRITE CAN 300 ML",
  "DIET COKE CAN 300 ML",
  "COKE ZERO 300 ML",
  "LIMCA CAN 300 ML",
  "THUMS UP CAN 300 ML",
  "SCHWEPPES CAN TONIC WATER",
  "SCHWEPPES CAN SODA WATER",
];

const DEFAULT_CAN_RATE = 750;

const productFieldSx = {
  "& .MuiInputLabel-root": { fontWeight: 600 },
  "@media (hover: hover)": {
    "& .MuiOutlinedInput-root:hover": { boxShadow: 1 },
  },
  "& .MuiOutlinedInput-root.Mui-focused": {
    boxShadow: (t) => `0 0 0 2px ${alpha(t.palette.primary.main, 0.2)}`,
  },
};

function CalculatorSectionHeader({ title, subtitle, paletteColor = "primary", icon: Icon, filledCount }) {
  const theme = useTheme();
  const main = theme.palette[paletteColor]?.main ?? theme.palette.primary.main;
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        {Icon ? (
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(main, 0.12),
              color: `${paletteColor}.main`,
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: `${paletteColor}.main`, lineHeight: 1.3 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {filledCount > 0 ? (
          <Chip
            size="small"
            label={`${filledCount} with qty`}
            color={paletteColor}
            variant="outlined"
            sx={{ fontWeight: 600, flexShrink: 0 }}
          />
        ) : null}
      </Stack>
      <Divider sx={{ mt: 1.25, borderColor: alpha(main, 0.28) }} />
    </Box>
  );
}

function ProductCaseField({ label, value, onChange, isMobile, inputStyle, priceLine, hasValue }) {
  return (
    <Box>
      <TextField
        label={label}
        type="number"
        InputLabelProps={{ shrink: true }}
        inputProps={{
          min: 0,
          inputMode: "numeric",
          pattern: "[0-9]*",
          style: { ...inputStyle },
        }}
        value={value || ""}
        placeholder="0"
        onChange={onChange}
        size={isMobile ? "small" : "medium"}
        fullWidth
        sx={{
          ...productFieldSx,
          ...(hasValue
            ? {
                "& .MuiOutlinedInput-root fieldset": {
                  borderWidth: 2,
                  borderColor: "primary.main",
                },
              }
            : {}),
        }}
      />
      {priceLine ? (
        <Typography variant="caption" sx={{ mt: 0.5, display: "block", color: "text.secondary", fontWeight: 600 }}>
          {priceLine}
        </Typography>
      ) : null}
    </Box>
  );
}

function SummaryMetric({ label, value }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box
      sx={{
        textAlign: "center",
        p: { xs: 1.25, sm: 1.5 },
        borderRadius: 2,
        bgcolor: isDark ? alpha(theme.palette.common.white, 0.06) : alpha(theme.palette.common.white, 0.8),
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          mb: 0.75,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontSize: "0.68rem",
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{ fontWeight: 800, color: "primary.main", fontSize: { xs: "1rem", sm: "1.2rem" }, lineHeight: 1.2 }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function OrderMetaBar({ distributorName, orderNumber }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.75, sm: 1 }}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.12 : 0.06),
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
        {distributorName || "Demo Distributor"}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
        Order No: {orderNumber}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
        {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
      </Typography>
    </Stack>
  );
}

async function captureTableAsPng(tableElement, backgroundColor) {
  if (!tableElement) return null;
  const { default: html2canvas } = await import("html2canvas");
  const scale = Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  const canvas = await html2canvas(tableElement, {
    backgroundColor,
    scale,
    logging: false,
    useCORS: true,
  });
  return canvas.toDataURL("image/png");
}

function OrderCalculator({
  distributorName,
  schemes = [],
  onPlaceOrder,
  onAttachOrderTableImage,
  productRates,
  initialInputs = null,
  fixedOrderNumber = null,
  placeOrderButtonText = "Place Order",
  submitOrderButtonText = "Submit Order",
  editContext = null,
  gstEnabled = true,
  canManageGst = false,
  onToggleGst = null,
  getPreviewOrderNumber = null,
}) {
  const skus = useMemo(() => {
    const skuRates = productRates?.skuRates || {};
    const builtIn = DEFAULT_SKUS.map((sku) => {
      const saved = skuRates[sku.name];
      const kgPerCase = saved?.kgPerCase ?? sku.kgPerCase;
      const rate = saved?.rate ?? sku.rate;
      let ucMul = sku.ucMultiplier;
      if (saved && Object.prototype.hasOwnProperty.call(saved, "ucMultiplier")) {
        ucMul = saved.ucMultiplier;
      }
      const ucFormula =
        ucMul != null && typeof ucMul === "number" && !Number.isNaN(ucMul)
          ? (q) => (q * ucMul) / UC_DIVISOR
          : null;
      return { ...sku, kgPerCase, rate, ucMultiplier: ucMul, ucFormula };
    });

    const rawCustom = Array.isArray(productRates?.customProducts) ? productRates.customProducts : [];
    const customs = [];
    const seen = new Set();
    for (const p of rawCustom) {
      const lineName = customProductLineName(p?.name, p?.sku);
      if (!lineName || DEFAULT_SKU_NAMES.has(lineName) || seen.has(lineName)) continue;
      seen.add(lineName);
      const category =
        p.category === "Water" ? "Water" : p.category === "CAN" ? "CAN" : "CSD";
      const kgPerCase = Number(p.kgPerCase);
      const rate = Number(p.rate);
      const mulRaw = p.ucMultiplier;
      const ucMul =
        mulRaw === "" || mulRaw === null || mulRaw === undefined
          ? null
          : typeof mulRaw === "number"
            ? mulRaw
            : parseFloat(mulRaw);
      const ucFormula =
        ucMul != null && typeof ucMul === "number" && !Number.isNaN(ucMul)
          ? (q) => (q * ucMul) / UC_DIVISOR
          : null;
      customs.push({
        name: lineName,
        category,
        kgPerCase: Number.isFinite(kgPerCase) ? kgPerCase : 0,
        rate: Number.isFinite(rate) ? rate : 0,
        ucMultiplier: ucMul != null && !Number.isNaN(ucMul) ? ucMul : null,
        ucFormula,
        isCustom: true,
      });
    }

    return [...builtIn, ...customs];
  }, [productRates]);

  const selectableCanSkus = useMemo(() => {
    const customCanNames = skus.filter((s) => s.category === "CAN").map((s) => s.name);
    return [...BUILT_IN_CAN_PRODUCTS, ...customCanNames];
  }, [skus]);

  const canRate = useMemo(() => {
    return productRates?.canRate ?? DEFAULT_CAN_RATE;
  }, [productRates]);

  const [inputs, setInputs] = useState({});
  const [results, setResults] = useState([]);
  const [selectedCans, setSelectedCans] = useState([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const theme = useTheme();
  const summ = calcSummaryRows(theme);
  const resultsShellSx = calculatorResultsShellSx(theme);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const tableRef = React.useRef(null);
  const [caption, setCaption] = useState("");
  const [currentOrderNumber, setCurrentOrderNumber] = useState(null);
  const prefillPendingRef = useRef(false);

  useEffect(() => {
    if (initialInputs && typeof initialInputs === "object" && Object.keys(initialInputs).length > 0) {
      setInputs(initialInputs);
      setSelectedCans(
        Object.keys(initialInputs).filter(
          (sku) => selectableCanSkus.includes(sku) && Number(initialInputs[sku] || 0) > 0
        )
      );
      if (fixedOrderNumber) {
        setCurrentOrderNumber(fixedOrderNumber);
      }
      prefillPendingRef.current = true;
    }
  }, [initialInputs, fixedOrderNumber, selectableCanSkus]);

  useEffect(() => {
    if (prefillPendingRef.current) {
      prefillPendingRef.current = false;
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const effectiveGstEnabled = !!gstEnabled;

  const handleChange = (sku, value) => {
    // Allow empty string for clearing
    if (value === "" || value === null || value === undefined) {
      setInputs({ ...inputs, [sku]: "" });
      return;
    }
    
    // Parse as integer, validate range
    let val = parseInt(value, 10);
    if (isNaN(val) || val < 0) {
      val = 0;
    }
    // Cap at reasonable maximum (1 million cases)
    if (val > 1000000) {
      val = 1000000;
      alert("Maximum value is 1,000,000 cases");
    }
    setInputs({ ...inputs, [sku]: val });
  };

  const calculate = () => {
    try {
      // Generate order number when calculation starts
      if (!currentOrderNumber) {
        const orderNo =
          typeof getPreviewOrderNumber === "function"
            ? getPreviewOrderNumber()
            : peekNextUniqueOrderNumber(loadUsedOrderNumbersFromLocalStorage());
        setCurrentOrderNumber(orderNo);
      }
      
      let res = [];
      Object.keys(inputs).forEach((sku) => {
        try {
          let item = skus.find((s) => s.name === sku);
          let rate = item?.rate;
          let kgPerCase = item?.kgPerCase;
          let ucFormula = item?.ucFormula;
          if (!item && BUILT_IN_CAN_PRODUCTS.includes(sku)) {
            rate = canRate;
            kgPerCase = 8.28;
            ucFormula = null;
          }
          const cases = inputs[sku];
          if (cases <= 0) return; // Skip zero or negative cases
          
          if (!rate || !kgPerCase) {
            throw new Error(`Missing rate or weight data for ${sku}`);
          }
          
          // Apply schemes/discounts first to get finalCases (including free cases)
          let schemeApplied = null;
          let freeCases = 0;
          let discountAmount = 0;
          let finalAmount = cases * rate;
          let finalCases = cases;
          
          // Find applicable schemes for this SKU
          const category = item?.category === "Water" ? "Water" : "CSD";
          
          // Debug: Log available schemes and current SKU
          if (process.env.NODE_ENV === "development" && schemes.length > 0) {
            console.log(`🔍 Checking schemes for SKU: "${sku}" (Category: ${category})`, {
              totalSchemes: schemes.length,
              schemes: schemes.map(s => ({
                name: s.name,
                type: s.type,
                appliesTo: s.appliesTo,
                appliesToSKUs: s.appliesToSKUs,
                distributors: s.distributors
              }))
            });
          }
          
          const applicableSchemes = schemes.filter(scheme => {
            // Check if scheme is valid (within date range)
            const now = new Date();
            const startDate = new Date(scheme.startDate);
            const endDate = new Date(scheme.endDate);
            if (startDate > now || endDate < now) {
              if (process.env.NODE_ENV === "development") {
                console.log(`⏰ Scheme "${scheme.name}" is not active (dates: ${startDate.toISOString()} - ${endDate.toISOString()})`);
              }
              return false;
            }
            
            // If scheme has SKU-specific selection, check if this SKU is included
            if (scheme.appliesToSKUs && Array.isArray(scheme.appliesToSKUs) && scheme.appliesToSKUs.length > 0) {
              const matches = scheme.appliesToSKUs.includes(sku);
              if (process.env.NODE_ENV === "development") {
                console.log(`📦 SKU matching for scheme "${scheme.name}":`, {
                  sku,
                  appliesToSKUs: scheme.appliesToSKUs,
                  matches
                });
              }
              return matches;
            }
            
            // Fallback to category-based matching (for backward compatibility)
            const categoryMatch = scheme.appliesTo === "both" || scheme.appliesTo === category.toLowerCase();
            if (process.env.NODE_ENV === "development") {
              console.log(`📂 Category matching for scheme "${scheme.name}":`, {
                schemeAppliesTo: scheme.appliesTo,
                itemCategory: category.toLowerCase(),
                matches: categoryMatch
              });
            }
            return categoryMatch;
          });
          
          if (process.env.NODE_ENV === "development") {
            console.log(`✅ Found ${applicableSchemes.length} applicable schemes for "${sku}"`, applicableSchemes.map(s => s.name));
          }
          
          // Apply the first applicable scheme (priority to first scheme)
          if (applicableSchemes.length > 0) {
            const scheme = applicableSchemes[0];
            schemeApplied = scheme;
            
            if (scheme.type === "csd_scheme") {
              // Buy X Get Y Free scheme
              const buyQty = scheme.buyQuantity || 6;
              const freeQty = scheme.freeQuantity || 1;
              
              // Debug logging
              if (process.env.NODE_ENV === "development") {
                console.log(`🔍 CSD Scheme applied for ${sku}:`, {
                  cases,
                  buyQty,
                  freeQty,
                  qualifies: cases >= buyQty
                });
              }
              
              if (cases >= buyQty) {
                const sets = Math.floor(cases / buyQty);
                freeCases = sets * freeQty;
                finalCases = cases + freeCases; // Total cases including free
                finalAmount = cases * rate; // Only pay for purchased cases
                
                if (process.env.NODE_ENV === "development") {
                  console.log(`✅ Free cases calculated:`, {
                    sets,
                    freeCases,
                    totalCases: finalCases
                  });
                }
              } else {
                // Even if not enough quantity, mark that scheme is applicable
                // freeCases remains 0, but schemeApplied is set
                freeCases = 0;
                
                if (process.env.NODE_ENV === "development") {
                  console.log(`⚠️ Not enough quantity for free cases. Need ${buyQty}, have ${cases}`);
                }
              }
            } else if (scheme.type === "discount") {
              // Fixed discount amount per case
              const discountPerCase = scheme.discountAmount || 0;
              discountAmount = cases * discountPerCase;
              finalAmount = (cases * rate) - discountAmount;
            }
          }
          
          // Calculate total tons and total UC using finalCases (including free cases)
          const totalKg = finalCases * kgPerCase;
          const totalTon = totalKg / 1000;
          const totalUC = ucFormula ? ucFormula(finalCases) : null;
          
          if (!isFinite(totalKg) || !isFinite(totalTon) || !isFinite(finalAmount)) {
            throw new Error(`Invalid calculation result for ${sku}`);
          }
          
          res.push({ 
            sku, 
            cases, 
            rate, 
            totalAmount: finalAmount, 
            totalTon, 
            totalUC,
            schemeApplied,
            freeCases,
            discountAmount,
            finalCases: finalCases || cases
          });
        } catch (error) {
          // Log error for individual SKU but continue processing others
          if (process.env.NODE_ENV === "development") {
            console.error(`Error calculating for ${sku}:`, error);
          }
        }
      });
      setResults(res);
    } catch (error) {
      alert("An error occurred during calculation. Please check your inputs.");
    }
  };

  const reset = () => {
    setInputs({});
    setResults([]);
    setSelectedCans([]);
    setCurrentOrderNumber(null); // Reset order number
  };

  const handleSubmitOrder = async () => {
    const orderData = results.map(r => {
      const skuInfo = skus.find(s => s.name === r.sku);
      return {
        sku: r.sku,
        cases: r.finalCases || r.cases,
        rate: r.rate,
        totalAmount: r.totalAmount,
        totalTon: r.totalTon,
        totalUC: r.totalUC,
        category: skuInfo?.category || "CSD", // Add category for proper classification
        schemeApplied: r.schemeApplied ? {
          name: r.schemeApplied.name,
          type: r.schemeApplied.type,
          schemeDescription: r.schemeApplied.schemeDescription
        } : null,
        freeCases: r.freeCases || 0,
        discountAmount: r.discountAmount || 0,
        orderCaption: caption || "",
      };
    });

    const orderNumber =
      currentOrderNumber ||
      (typeof getPreviewOrderNumber === "function"
        ? getPreviewOrderNumber()
        : peekNextUniqueOrderNumber(loadUsedOrderNumbersFromLocalStorage()));

    setIsPlacingOrder(true);
    try {
      let placed = null;
      if (onPlaceOrder) {
        placed = await onPlaceOrder(orderData, orderNumber, null, editContext, caption);
      }
      setOrderDialogOpen(false);
      setCaption("");
      setCurrentOrderNumber(null);

      const attachNumber =
        placed?.orderNumber ||
        (editContext?.isEdit ? fixedOrderNumber || orderNumber : orderNumber);
      const attachOrderId = placed?.orderId || editContext?.orderId || null;

      if (typeof onAttachOrderTableImage === "function" && tableRef.current) {
        const bg = theme.palette.mode === "dark" ? "#1e1e1e" : theme.palette.background.paper;
        void (async () => {
          try {
            const tableImageData = await captureTableAsPng(tableRef.current, bg);
            if (tableImageData) {
              await onAttachOrderTableImage(attachNumber, tableImageData, attachOrderId);
            }
          } catch (error) {
            console.warn("Table screenshot attach failed:", error);
          }
        })();
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };
  const totalCasesSum = results.reduce((sum, r) => sum + (r.cases || 0), 0);
  const totalAmountSum = results.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const totalTonSum = results.reduce((sum, r) => sum + (r.totalTon || 0), 0);
  const totalDiscountSum = results.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
  const totalFreeCasesSum = results.reduce((sum, r) => sum + (r.freeCases || 0), 0);
  // Calculate GST (5% on total amount after discount)
  // GST is not applicable for "Gelephu Grocery" distributor
  const isGelephuGrocery = distributorName && distributorName.toLowerCase().includes("gelephu grocery");
  // Use toggle state if GST is enabled, otherwise 0 (unless it's Gelephu Grocery which is always 0)
      const gstRate = (isGelephuGrocery || !effectiveGstEnabled) ? 0 : 0.05; // 5% or 0% based on admin global setting or Gelephu Grocery
  const grossTotal = totalAmountSum; // Amount after discount
  const gstAmount = grossTotal * gstRate;
  const netTotal = grossTotal + gstAmount;

  const totalUC_CSD = results
    .filter(r => skus.find(s => s.name === r.sku)?.category === "CSD")
    .reduce((sum, r) => sum + (r.totalUC || 0), 0);

  const totalUC_Kinley = results
    .filter(r => skus.find(s => s.name === r.sku)?.category === "Water")
    .reduce((sum, r) => sum + (r.totalUC || 0), 0);

  const priceLineForSku = (skuName) => {
    const item = skus.find((s) => s.name === skuName);
    const rate = item?.rate ?? (BUILT_IN_CAN_PRODUCTS.includes(skuName) ? canRate : null);
    const amount = Number(rate);
    if (!Number.isFinite(amount)) return null;
    return `Price: Nu. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/cs`;
  };

  const getInputStyle = (item) => {
    const isDark = theme.palette.mode === "dark";
    const textColor = theme.palette.text.primary;
    const baseStyle = {
      fontWeight: "bold",
      color: textColor,
      textAlign: "left",
      fontSize: "0.9rem",
      borderRadius: "6px",
      padding: "0 8px",
      height: "36px",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      textOverflow: "ellipsis",
    };
    const tint = (light, darkBg) => (isDark ? darkBg : light);

    if (skuNameLooksLikeBuiltInCanLine(item.name) || item.category === "CAN")
      return {
        input: {
          ...baseStyle,
          background: isDark
            ? alpha(theme.palette.secondary.light, 0.15)
            : "linear-gradient(90deg,rgb(241, 224, 224) 0%, #fff7e6 50%, #eafaf1 100%)",
          WebkitBackgroundClip: "padding-box",
        },
      };
    if (item.name.startsWith("COKE"))
      return { input: { ...baseStyle, background: tint("#fdecea", alpha(theme.palette.error.main, 0.22)) } };
    if (item.name.startsWith("FANTA"))
      return { input: { ...baseStyle, background: tint("#fff7e6", alpha(theme.palette.warning.main, 0.2)) } };
    if (item.name.startsWith("SPRITE"))
      return { input: { ...baseStyle, background: tint("#eafaf1", alpha(theme.palette.success.main, 0.2)) } };
    if (item.name.startsWith("KINLEY"))
      return { input: { ...baseStyle, background: tint("#e6f2ff", alpha(theme.palette.info.main, 0.22)) } };
    if (item.name.startsWith("CHARGED"))
      return { input: { ...baseStyle, background: tint("#ffeaea", alpha(theme.palette.error.main, 0.16)) } };
    if (item.isCustom)
      return { input: { ...baseStyle, background: tint("#f3e5f5", alpha("#ce93d8", 0.22)) } };
    return { input: { ...baseStyle, background: tint("#fffde7", alpha(theme.palette.secondary.light, 0.12)) } };
  };

  // Group SKUs by category
  const csdProducts = skus.filter((item) => item.category === "CSD" && item.name !== "CAN 300 ML");
  const waterProducts = skus.filter(item => item.category === "Water");

  const countFilled = (names) =>
    names.filter((name) => {
      const v = inputs[name];
      return v !== "" && v != null && Number(v) > 0;
    }).length;

  const csdFilledCount = countFilled(csdProducts.map((p) => p.name));
  const waterFilledCount = countFilled(waterProducts.map((p) => p.name));
  const canFilledCount = countFilled(selectedCans);
  const totalFilledCount = csdFilledCount + waterFilledCount + canFilledCount;

  const quickSummaryCardSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 3,
    border: "2px solid",
    borderColor: (t) => (t.palette.mode === "dark" ? alpha(t.palette.warning.main, 0.45) : t.palette.warning.main),
    bgcolor: (t) =>
      t.palette.mode === "dark"
        ? alpha(t.palette.warning.main, 0.12)
        : alpha(t.palette.warning.light, 0.35),
    boxShadow: (t) =>
      t.palette.mode === "dark" ? "none" : `0 4px 16px ${alpha(t.palette.warning.main, 0.18)}`,
  };

  return (
    <>
      <Box sx={calculatorPageShellSx(theme, isMobile)}>
        <Paper elevation={6} sx={calculatorPaperSx(theme, isMobile)}>
          {/* Header Section */}
          <Stack alignItems="center" spacing={1.5} sx={{ mb: 3, textAlign: "center" }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                color: "primary.main",
              }}
            >
              <ReceiptLongOutlinedIcon />
            </Box>
            <Typography
              variant={isMobile ? "h5" : "h4"}
              sx={{ fontWeight: 800, color: "primary.main", letterSpacing: 0.5, lineHeight: 1.2 }}
            >
              Order Calculator
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 520, fontSize: { xs: "0.85rem", sm: "0.95rem" }, px: { xs: 0.5, sm: 0 } }}
            >
              Enter case quantities by product. Tap Calculate to see amounts, UC, and weight in tons.
            </Typography>
            {totalFilledCount > 0 ? (
              <Chip
                label={`${totalFilledCount} product${totalFilledCount === 1 ? "" : "s"} with quantity`}
                color="primary"
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ) : (
              <Chip label="No quantities entered yet" size="small" variant="outlined" sx={{ fontWeight: 500 }} />
            )}
          </Stack>

          {/* CSD Products Section */}
          <Box sx={{ mb: 3 }}>
            <CalculatorSectionHeader
              title="CSD Products"
              subtitle="Carbonated soft drinks — enter cases per SKU"
              paletteColor="primary"
              icon={LocalDrinkIcon}
              filledCount={csdFilledCount}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: { xs: 1.5, sm: 2 },
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {csdProducts.map((item) => (
                <ProductCaseField
                  key={item.name}
                  label={item.name}
                  value={inputs[item.name]}
                  hasValue={Number(inputs[item.name]) > 0}
                  inputStyle={getInputStyle(item).input}
                  priceLine={priceLineForSku(item.name)}
                  isMobile={isMobile}
                  onChange={(e) => handleChange(item.name, e.target.value)}
                />
              ))}
            </Box>
          </Box>

          {/* CAN Products Section */}
          <Box sx={{ mb: 3 }}>
            <CalculatorSectionHeader
              title="CAN Products"
              subtitle="Pick can lines first, then enter cases for each"
              paletteColor="secondary"
              icon={SportsBarIcon}
              filledCount={canFilledCount}
            />
            <Box
              sx={{
                width: "100%",
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? alpha(t.palette.secondary.main, 0.1)
                    : alpha(t.palette.secondary.light, 0.2),
                border: "1px solid",
                borderColor: "divider",
                boxSizing: "border-box",
              }}
            >
              <FormControl fullWidth size={isMobile ? "small" : "medium"} sx={{ mb: selectedCans.length > 0 ? 2 : 0 }}>
                <InputLabel id="can-products-label" shrink>
                  CAN products
                </InputLabel>
                <Select
                  labelId="can-products-label"
                  label="CAN products"
                  multiple
                  value={selectedCans}
                  onChange={(e) => setSelectedCans(e.target.value)}
                  displayEmpty
                  notched
                  renderValue={(selected) =>
                    selected.length === 0 ? (
                      <Typography color="text.secondary" variant="body2">
                        Tap to choose can SKUs…
                      </Typography>
                    ) : (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" color="secondary" sx={{ fontWeight: 600 }} />
                        ))}
                      </Box>
                    )
                  }
                >
                  {selectableCanSkus.map((p) => (
                    <MenuItem key={p} value={p}>
                      {p}
                      {selectedCans.includes(p) ? <CheckIcon color="success" sx={{ ml: "auto" }} /> : null}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {selectedCans.length === 0
                    ? "Select one or more can products to show quantity fields."
                    : `${selectedCans.length} can line${selectedCans.length === 1 ? "" : "s"} selected`}
                </FormHelperText>
              </FormControl>

              {selectedCans.length > 0 && (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    gap: 1.5,
                    width: "100%",
                  }}
                >
                  {selectedCans.map((can) => (
                    <ProductCaseField
                      key={can}
                      label={`${can} — cases`}
                      value={inputs[can]}
                      hasValue={Number(inputs[can]) > 0}
                      inputStyle={
                        getInputStyle(skus.find((s) => s.name === can) || { name: "CAN 300 ML", category: "CAN" })
                          .input
                      }
                      priceLine={priceLineForSku(can)}
                      isMobile={isMobile}
                      onChange={(e) => handleChange(can, e.target.value)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Water Products Section */}
          <Box sx={{ mb: 3 }}>
            <CalculatorSectionHeader
              title="Water Products"
              subtitle="Packaged and bulk water SKUs"
              paletteColor="info"
              icon={WaterDropIcon}
              filledCount={waterFilledCount}
            />
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: { xs: 1.5, sm: 2 },
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {waterProducts.map((item) => (
                <ProductCaseField
                  key={item.name}
                  label={item.name}
                  value={inputs[item.name]}
                  hasValue={Number(inputs[item.name]) > 0}
                  inputStyle={getInputStyle(item).input}
                  priceLine={priceLineForSku(item.name)}
                  isMobile={isMobile}
                  onChange={(e) => handleChange(item.name, e.target.value)}
                />
              ))}
            </Box>
          </Box>

          {/* GST Toggle Switch (admin control only) */}
          {canManageGst && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mb: 2,
                p: { xs: 1.5, sm: 2 },
                borderRadius: 2,
                bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === "dark" ? 0.14 : 0.1),
                border: "1px solid",
                borderColor: "warning.main",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={effectiveGstEnabled}
                    onChange={(e) => onToggleGst && onToggleGst(e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: { xs: "0.9rem", sm: "1rem" }, color: "text.primary" }}>
                      GST 5%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {effectiveGstEnabled ? "Applied on order totals" : "Excluded from totals"}
                    </Typography>
                  </Box>
                }
                sx={{ m: 0, gap: 1 }}
              />
            </Box>
          )}
            
          {/* Action Buttons Section */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, sm: 2 },
              mb: 3,
              borderRadius: 3,
              bgcolor: (t) => alpha(t.palette.background.default, 0.6),
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="center"
              alignItems="stretch"
            >
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={calculate}
                disabled={totalFilledCount === 0}
                fullWidth={isMobile}
                startIcon={<CalculateOutlinedIcon />}
                sx={{
                  borderRadius: 2.5,
                  py: 1.35,
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  flex: { sm: 1 },
                  maxWidth: { sm: 220 },
                }}
              >
                Calculate
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                size="large"
                onClick={reset}
                fullWidth={isMobile}
                startIcon={<RestartAltIcon />}
                sx={{
                  borderRadius: 2.5,
                  py: 1.35,
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  flex: { sm: 1 },
                  maxWidth: { sm: 180 },
                }}
              >
                Reset
              </Button>
              {results.length > 0 && (
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={() => {
                    setCurrentOrderNumber(peekNextUniqueOrderNumber(loadUsedOrderNumbersFromLocalStorage()));
                    setOrderDialogOpen(true);
                  }}
                  fullWidth={isMobile}
                  startIcon={<ShoppingCartCheckoutIcon />}
                  sx={{
                    borderRadius: 2.5,
                    py: 1.35,
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "1rem",
                    flex: { sm: 1 },
                    maxWidth: { sm: 240 },
                  }}
                >
                  {placeOrderButtonText}
                </Button>
              )}
            </Stack>
            {totalFilledCount === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 1.25 }}>
                Enter at least one case quantity to enable Calculate.
              </Typography>
            )}
          </Paper>

          {/* Live Preview Summary */}
          {results.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Card elevation={0} sx={quickSummaryCardSx}>
                <Typography
                  variant="subtitle1"
                  sx={{ mb: 2, fontWeight: 800, textAlign: "center", color: "text.primary" }}
                >
                  Quick Summary
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                    gap: { xs: 1.5, sm: 2 },
                  }}
                >
                  <SummaryMetric label="Total Cases" value={totalCasesSum.toLocaleString()} />
                  <SummaryMetric
                    label="Net Amount"
                    value={`Nu ${netTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
                  />
                  <SummaryMetric label="Total Tons" value={totalTonSum.toFixed(2)} />
                  <SummaryMetric label="Total UC" value={(totalUC_CSD + totalUC_Kinley).toFixed(2)} />
                </Box>
              </Card>
            </Box>
          )}

          {/* Detailed Results Table */}
          {results.length > 0 && (
            <TableContainer component={Paper} ref={tableRef} sx={resultsShellSx}>
              <OrderMetaBar
                distributorName={distributorName}
                orderNumber={currentOrderNumber || getCurrentOrderNumber()}
              />
              <Table size="small" sx={{ width: "100%" }}>
                <TableHead>
                  <TableRow sx={{ 
                    ...tableHeadRowSx(theme)
                    boxShadow: "0 2px 8px rgba(21, 101, 192, 0.3)"
                  }}>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "left", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      SKU
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "right", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      {isMobile ? "Qty" : "Qty/Cases"}
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "right", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      Rate
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "right", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      {isMobile ? "Amount" : "Total Amount"}
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "right", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      {isMobile ? "Tons" : "Total Tons"}
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      color: "text.primary", 
                      fontSize: isMobile ? 9 : 14, 
                      textAlign: "right", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      whiteSpace: "nowrap",
                      letterSpacing: "0.5px"
                    }}>
                      {isMobile ? "UC" : "Total UC"}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow 
                      key={i} 
                      sx={{ 
                        background: tableStripeAt(theme, i),
                        color: "text.primary",
                        "&:hover": { 
                          background: tableRowHoverBg(theme),
                          transform: "scale(1.01)",
                          transition: "all 0.2s ease-in-out",
                          boxShadow: (t) => `0 2px 4px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.35 : 0.1)}`,
                        },
                        transition: "all 0.2s ease-in-out"
                      }}
                    >
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "left", 
                        wordBreak: isMobile ? "break-word" : "normal",
                        color: "text.primary"
                      }}>
                        <Typography sx={{ 
                          fontSize: isMobile ? 9 : 13, 
                          lineHeight: 1.4, 
                          fontWeight: "600",
                          color: "text.primary"
                        }}>
                          {r.sku}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        {r.finalCases > r.cases && r.freeCases > 0 ? (
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.4 }}>
                            <Typography component="span" sx={{ 
                              fontWeight: "bold", 
                              fontSize: isMobile ? 9 : 13,
                              color: "text.primary"
                            }}>
                              {r.cases.toLocaleString()}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <Typography component="span" sx={{ 
                                color: "success.main", 
                                fontSize: isMobile ? 8 : 11, 
                                fontWeight: "bold" 
                              }}>
                                +{r.freeCases}
                              </Typography>
                              <Chip 
                                label="FREE" 
                                size="small" 
                                sx={{ 
                                  height: isMobile ? 18 : 20, 
                                  fontSize: isMobile ? 7 : 9, 
                                  backgroundColor: "#4caf50", 
                                  color: "white", 
                                  fontWeight: "bold",
                                  boxShadow: "0 2px 4px rgba(76, 175, 80, 0.3)"
                                }} 
                              />
                            </Box>
                          </Box>
                        ) : (
                          <Typography sx={{ 
                            fontSize: isMobile ? 9 : 13, 
                            fontWeight: "bold",
                            color: "text.primary"
                          }}>
                            {r.cases.toLocaleString()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        {r.schemeApplied && r.schemeApplied.type === "discount" && r.discountAmount > 0 ? (
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.3 }}>
                            <Typography sx={{ 
                              fontSize: isMobile ? 9 : 13, 
                              fontWeight: "bold", 
                              color: "info.light",
                              textAlign: "right"
                            }}>
                              {(() => {
                                const discountPerCase = r.schemeApplied.discountAmount || 0;
                                const discountedRate = r.rate - discountPerCase;
                                return isMobile ? discountedRate : discountedRate.toLocaleString("en-IN", { maximumFractionDigits: 2 });
                              })()}
                            </Typography>
                            <Chip 
                              label="DISCOUNTED" 
                              size="small" 
                              sx={{ 
                                height: isMobile ? 18 : 20, 
                                fontSize: isMobile ? 7 : 9, 
                                backgroundColor: "info.main", 
                                color: "white", 
                                fontWeight: "bold",
                                boxShadow: "0 2px 4px rgba(25, 118, 210, 0.3)"
                              }} 
                            />
                          </Box>
                        ) : (
                          <Typography sx={{ 
                            fontSize: isMobile ? 9 : 13, 
                            fontWeight: "bold",
                            color: "text.primary"
                          }}>
                            {isMobile ? r.rate : r.rate.toLocaleString()}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        <Typography sx={{ 
                          fontSize: isMobile ? 9 : 13, 
                          fontWeight: "bold",
                          color: "text.primary"
                        }}>
                          {isMobile ? Math.round(r.totalAmount).toLocaleString() : r.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        <Typography sx={{ 
                          fontSize: isMobile ? 9 : 13, 
                          fontWeight: "bold",
                          color: "text.primary"
                        }}>
                          {r.totalTon.toFixed(3)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 9 : 13, 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.2, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        <Typography sx={{ 
                          fontSize: isMobile ? 9 : 13, 
                          fontWeight: "bold",
                          color: "text.primary"
                        }}>
                          {r.totalUC !== null ? r.totalUC.toFixed(2) : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Discount Row */}
                  {totalDiscountSum > 0 && (
                    <TableRow sx={{ 
                      fontWeight: "bold", 
                      background: summ.discountBg,
                      borderTop: "2px solid",
                      borderColor: summ.discountBorder,
                      color: "text.primary",
                      boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 4px rgba(244, 67, 54, 0.2)"),
                    }}>
                      <TableCell colSpan={3} sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.25, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right" 
                      }}>
                        <Typography sx={{ 
                          fontWeight: "bold", 
                          color: "error.light",
                          fontSize: isMobile ? 9 : 13
                        }}>
                          Total Discount:
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.25, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right" 
                      }}>
                        <Typography sx={{ 
                          fontWeight: "bold", 
                          color: "error.light",
                          fontSize: isMobile ? 9 : 13
                        }}>
                          {isMobile ? Math.round(totalDiscountSum).toLocaleString() : totalDiscountSum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>
                      <TableCell colSpan={2} sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1.25, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right" 
                      }}>
                        -
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Gross Total Row */}
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: summ.grossBg,
                    borderTop: "3px solid",
                    borderColor: summ.grossBorder,
                    color: "text.primary",
                    boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 6px rgba(255, 152, 0, 0.2)"),
                  }}>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "left",
                      color: "warning.light"
                    }}>
                      Gross Total
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "right",
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontSize: isMobile ? 10 : 14, 
                        fontWeight: "bold",
                        color: "text.primary"
                      }}>
                        {(totalCasesSum + totalFreeCasesSum).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "right",
                      color: "text.secondary"
                    }}>
                      -
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "right", 
                      color: "error.light" 
                    }}>
                      <Typography sx={{ 
                        fontSize: isMobile ? 10 : 14, 
                        fontWeight: "bold",
                        color: "error.light"
                      }}>
                        {isMobile ? Math.round(totalAmountSum).toLocaleString() : totalAmountSum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "right",
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontSize: isMobile ? 10 : 14, 
                        fontWeight: "bold",
                        color: "text.primary"
                      }}>
                        {totalTonSum.toFixed(3)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.5, 
                      fontSize: isMobile ? 10 : 14, 
                      textAlign: "right",
                      color: "text.secondary"
                    }}>
                      -
                    </TableCell>
                  </TableRow>
                  
                  {/* GST Row - Only show if GST is enabled and applicable */}
                  {effectiveGstEnabled && !isGelephuGrocery && gstAmount > 0 && (
                    <TableRow sx={{ 
                      fontWeight: "bold", 
                      background: summ.gstBg,
                      borderTop: "2px solid",
                      borderColor: summ.gstBorder,
                      color: "text.primary",
                      boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 4px rgba(255, 193, 7, 0.2)"),
                    }}>
                      <TableCell colSpan={3} sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right",
                        color: "warning.light"
                      }}>
                        <Typography sx={{ 
                          fontWeight: "bold",
                          fontSize: isMobile ? 9 : 13,
                          color: "warning.light"
                        }}>
                          GST (5%):
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right",
                        color: "text.primary"
                      }}>
                        <Typography sx={{ 
                          fontWeight: "bold",
                          fontSize: isMobile ? 9 : 13,
                          color: "text.primary"
                        }}>
                          {isMobile ? Math.round(gstAmount).toLocaleString() : gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </Typography>
                      </TableCell>
                      <TableCell colSpan={2} sx={{ 
                        fontWeight: "bold", 
                        px: isMobile ? 0.5 : 1.5, 
                        py: isMobile ? 0.75 : 1, 
                        fontSize: isMobile ? 9 : 13, 
                        textAlign: "right",
                        color: "text.secondary"
                      }}>
                        -
                      </TableCell>
                    </TableRow>
                  )}
                  
                  {/* Net Total Row */}
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: summ.netBg,
                    borderTop: "3px solid",
                    borderColor: summ.netBorder,
                    color: "text.primary",
                    boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 4px 8px rgba(76, 175, 80, 0.3)"),
                  }}>
                    <TableCell colSpan={3} sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.25, 
                      fontSize: isMobile ? 10 : 15, 
                      textAlign: "right",
                      color: "success.light"
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 10 : 15,
                        color: "success.light"
                      }}>
                        Net Total:
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.25, 
                      fontSize: isMobile ? 10 : 15, 
                      textAlign: "right", 
                      color: "success.main" 
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold", 
                        fontSize: isMobile ? 10 : 15,
                        color: "success.main"
                      }}>
                        {isMobile ? Math.round(netTotal).toLocaleString() : netTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2} sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.75 : 1.25, 
                      fontSize: isMobile ? 10 : 15, 
                      textAlign: "right",
                      color: "text.secondary"
                    }}>
                      -
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: tableFooterBandBg(theme),
                    borderTop: "1px solid",
                    borderColor: tableFooterBandBorder(theme),
                    color: "text.primary",
                  }}>
                    <TableCell colSpan={5} sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.5 : 1, 
                      textAlign: "right", 
                      fontSize: isMobile ? 9 : 13,
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold",
                        fontSize: isMobile ? 9 : 13,
                        color: "text.primary"
                      }}>
                        CSD UC:
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.5 : 1, 
                      textAlign: "right", 
                      fontSize: isMobile ? 9 : 13,
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold",
                        fontSize: isMobile ? 9 : 13,
                        color: "text.primary"
                      }}>
                        {totalUC_CSD.toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: tableFooterBandBg(theme),
                    color: "text.primary",
                  }}>
                    <TableCell colSpan={5} sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.5 : 1, 
                      textAlign: "right", 
                      fontSize: isMobile ? 9 : 13,
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold",
                        fontSize: isMobile ? 9 : 13,
                        color: "text.primary"
                      }}>
                        Water UC:
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ 
                      fontWeight: "bold", 
                      px: isMobile ? 0.5 : 1.5, 
                      py: isMobile ? 0.5 : 1, 
                      textAlign: "right", 
                      fontSize: isMobile ? 9 : 13,
                      color: "text.primary"
                    }}>
                      <Typography sx={{ 
                        fontWeight: "bold",
                        fontSize: isMobile ? 9 : 13,
                        color: "text.primary"
                      }}>
                        {totalUC_Kinley.toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Order Summary Dialog */}
      <Dialog open={orderDialogOpen} onClose={() => setOrderDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: "primary.main", pb: 1 }}>
          Order Summary
        </DialogTitle>
        <DialogContent sx={{ color: "text.primary", pt: 0 }}>
          <OrderMetaBar
            distributorName={distributorName}
            orderNumber={currentOrderNumber || getCurrentOrderNumber()}
          />
          <TableContainer component={Paper} sx={{ bgcolor: "background.paper", borderRadius: 2, boxShadow: 2, border: "1px solid", borderColor: "divider" }}>
            <Table size="small" sx={{ width: "100%" }}>
              <TableHead>
                <TableRow sx={tableHeadRowSx(theme)}>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "left", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    SKU
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "right", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    {isMobile ? "Qty" : "Qty/Cases"}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "right", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    Rate
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "right", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    {isMobile ? "Amount" : "Total Amount"}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "right", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    {isMobile ? "Tons" : "Total Tons"}
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: "bold", 
                    color: "text.primary", 
                    fontSize: isMobile ? 9 : 14, 
                    textAlign: "right", 
                    px: isMobile ? 0.5 : 1.5, 
                    py: isMobile ? 0.75 : 1.5, 
                    whiteSpace: "nowrap",
                    letterSpacing: "0.5px"
                  }}>
                    {isMobile ? "UC" : "Total UC"}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, i) => (
                  <TableRow 
                    key={i} 
                    sx={{ 
                      background: tableStripeAt(theme, i),
                      color: "text.primary",
                      "&:hover": { 
                        background: tableRowHoverBg(theme),
                        transform: "scale(1.01)",
                        transition: "all 0.2s ease-in-out",
                        boxShadow: (t) => `0 2px 4px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.35 : 0.1)}`,
                      },
                      transition: "all 0.2s ease-in-out"
                    }}
                  >
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "left", whiteSpace: "nowrap", color: "text.primary" }}>
                      <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "600", color: "text.primary" }}>{r.sku}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      {r.finalCases > r.cases && r.freeCases > 0 ? (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.4 }}>
                          <Typography component="span" sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>{r.cases.toLocaleString()}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                            <Typography component="span" sx={{ color: "success.main", fontSize: isMobile ? 8 : 11, fontWeight: "bold" }}>+{r.freeCases}</Typography>
                            <Chip label="FREE" size="small" sx={{ height: isMobile ? 18 : 20, fontSize: isMobile ? 7 : 9, backgroundColor: "#4caf50", color: "white", fontWeight: "bold", boxShadow: "0 2px 4px rgba(76, 175, 80, 0.3)" }} />
                          </Box>
                        </Box>
                      ) : (
                        <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>{r.cases.toLocaleString()}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      {r.schemeApplied && r.schemeApplied.type === "discount" && r.discountAmount > 0 ? (
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.3 }}>
                          <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "bold", color: "info.light", textAlign: "right" }}>
                            {(() => {
                              const discountPerCase = r.schemeApplied.discountAmount || 0;
                              const discountedRate = r.rate - discountPerCase;
                              return isMobile ? discountedRate : discountedRate.toLocaleString("en-IN", { maximumFractionDigits: 2 });
                            })()}
                          </Typography>
                          <Chip label="DISCOUNTED" size="small" sx={{ height: isMobile ? 18 : 20, fontSize: isMobile ? 7 : 9, backgroundColor: "info.main", color: "white", fontWeight: "bold", boxShadow: "0 2px 4px rgba(25, 118, 210, 0.3)" }} />
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "bold", color: "text.primary" }}>
                          {isMobile ? r.rate : r.rate.toLocaleString()}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "bold", color: "text.primary" }}>
                        {isMobile ? Math.round(r.totalAmount).toLocaleString() : r.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "bold", color: "text.primary" }}>{r.totalTon.toFixed(3)}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.2, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      <Typography sx={{ fontSize: isMobile ? 9 : 13, fontWeight: "bold", color: "text.primary" }}>{r.totalUC !== null ? r.totalUC.toFixed(2) : "-"}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Discount Row */}
                {totalDiscountSum > 0 && (
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: summ.discountBg,
                    borderTop: "2px solid",
                    borderColor: summ.discountBorder,
                    color: "text.primary",
                    boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 4px rgba(244, 67, 54, 0.2)"),
                  }}>
                    <TableCell colSpan={3} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap" }}>
                      <Typography sx={{ fontWeight: "bold", color: "error.light", fontSize: isMobile ? 9 : 13 }}>Total Discount:</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap" }}>
                      <Typography sx={{ fontWeight: "bold", color: "error.light", fontSize: isMobile ? 9 : 13 }}>
                        {isMobile ? Math.round(totalDiscountSum).toLocaleString() : totalDiscountSum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap" }}>-</TableCell>
                  </TableRow>
                )}
                
                {/* Gross Total Row */}
                <TableRow sx={{ 
                  fontWeight: "bold", 
                  background: summ.grossBg,
                  borderTop: "3px solid",
                  borderColor: summ.grossBorder,
                  color: "text.primary",
                  boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 6px rgba(255, 152, 0, 0.2)"),
                }}>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "left", whiteSpace: "nowrap", color: "warning.light" }}>Gross Total</TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontSize: isMobile ? 10 : 14, fontWeight: "bold", color: "text.primary" }}>{(totalCasesSum + totalFreeCasesSum).toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "right", whiteSpace: "nowrap", color: "text.secondary" }}>-</TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "right", color: "error.light", whiteSpace: "nowrap" }}>
                    <Typography sx={{ fontSize: isMobile ? 10 : 14, fontWeight: "bold", color: "error.light" }}>
                      {isMobile ? Math.round(totalAmountSum).toLocaleString() : totalAmountSum.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontSize: isMobile ? 10 : 14, fontWeight: "bold", color: "text.primary" }}>{totalTonSum.toFixed(3)}</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.5, fontSize: isMobile ? 10 : 14, textAlign: "right", whiteSpace: "nowrap", color: "text.secondary" }}>-</TableCell>
                </TableRow>
                
                {/* GST Row - Only show if GST is enabled and applicable */}
                {effectiveGstEnabled && !isGelephuGrocery && gstAmount > 0 && (
                  <TableRow sx={{ 
                    fontWeight: "bold", 
                    background: summ.gstBg,
                    borderTop: "2px solid",
                    borderColor: summ.gstBorder,
                    color: "text.primary",
                    boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 2px 4px rgba(255, 193, 7, 0.2)"),
                  }}>
                    <TableCell colSpan={3} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap", color: "warning.light" }}>
                      <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "warning.light" }}>GST (5%):</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap", color: "text.primary" }}>
                      <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>
                        {isMobile ? Math.round(gstAmount).toLocaleString() : gstAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </Typography>
                    </TableCell>
                    <TableCell colSpan={2} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1, fontSize: isMobile ? 9 : 13, textAlign: "right", whiteSpace: "nowrap", color: "text.secondary" }}>-</TableCell>
                  </TableRow>
                )}
                
                {/* Net Total Row */}
                <TableRow sx={{ 
                  fontWeight: "bold", 
                  background: summ.netBg,
                  borderTop: "3px solid",
                  borderColor: summ.netBorder,
                  color: "text.primary",
                  boxShadow: (t) => (t.palette.mode === "dark" ? "none" : "0 4px 8px rgba(76, 175, 80, 0.3)"),
                }}>
                  <TableCell colSpan={3} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 10 : 15, textAlign: "right", whiteSpace: "nowrap", color: "success.light" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 15, color: "success.light" }}>Net Total:</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 10 : 15, textAlign: "right", color: "success.main", whiteSpace: "nowrap" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 10 : 15, color: "success.main" }}>
                      {isMobile ? Math.round(netTotal).toLocaleString() : netTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell colSpan={2} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.75 : 1.25, fontSize: isMobile ? 10 : 15, textAlign: "right", whiteSpace: "nowrap", color: "text.secondary" }}>-</TableCell>
                </TableRow>
                
                  <TableRow sx={{ fontWeight: "bold", background: tableFooterBandBg(theme), borderTop: "1px solid", borderColor: tableFooterBandBorder(theme), color: "text.primary" }}>
                  <TableCell colSpan={5} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.5 : 1, textAlign: "right", fontSize: isMobile ? 9 : 13, whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>CSD UC:</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.5 : 1, textAlign: "right", fontSize: isMobile ? 9 : 13, whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>{totalUC_CSD.toFixed(2)}</Typography>
                  </TableCell>
                </TableRow>
                  <TableRow sx={{ fontWeight: "bold", background: tableFooterBandBg(theme), color: "text.primary" }}>
                  <TableCell colSpan={5} sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.5 : 1, textAlign: "right", fontSize: isMobile ? 9 : 13, whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>Water UC:</Typography>
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", px: isMobile ? 0.5 : 1.5, py: isMobile ? 0.5 : 1, textAlign: "right", fontSize: isMobile ? 9 : 13, whiteSpace: "nowrap", color: "text.primary" }}>
                    <Typography sx={{ fontWeight: "bold", fontSize: isMobile ? 9 : 13, color: "text.primary" }}>{totalUC_Kinley.toFixed(2)}</Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
    
              {/* Caption Input Box */}
              <TextField
              label="Additional Info / Caption"
              multiline
              rows={3}
              fullWidth
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              sx={{
                mt: 2,
            "& .MuiInputBase-root": {
              backgroundColor: (t) =>
                t.palette.mode === "dark" ? alpha(t.palette.secondary.main, 0.12) : "#fffde7",
              borderRadius: 2,
            },
            "& .MuiInputLabel-root": { fontWeight: "bold", color: "primary.main" },
          }}
          placeholder="Write any additional info here..."
        />
        </TableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button onClick={() => setOrderDialogOpen(false)} color="inherit" disabled={isPlacingOrder} sx={{ fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitOrder}
            color="primary"
            variant="contained"
            disabled={isPlacingOrder}
            startIcon={isPlacingOrder ? <CircularProgress size={18} color="inherit" /> : <ShoppingCartCheckoutIcon />}
            sx={{ fontWeight: 700, px: 3 }}
          >
            {isPlacingOrder ? "Submitting…" : submitOrderButtonText}
          </Button>
        </DialogActions>
      </Dialog>

      <AppSnackbar
        open={snackbarOpen}
        severity="success"
        message="Screenshot copied to clipboard!"
        autoHideDuration={2200}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </>
  );
}

export default OrderCalculator;
