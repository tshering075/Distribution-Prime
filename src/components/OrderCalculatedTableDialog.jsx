import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import {
  calculatorResultsShellSx,
  calcSummaryRows,
  tableFooterBandBg,
  tableFooterBandBorder,
  tableRowHoverBg,
  tableStripeAt,
  tableHeadRowSx,
  tableHeadCellSx,
} from "../theme/contrastSurfaces";
import ShippingInvoiceAttachment from "./ShippingInvoiceAttachment";
import { orderHasShippingInvoice, getOrderStatusLabel } from "../utils/orderStatus";
import {
  num,
  calculateOrderLine,
  buildOrderDataFromEditRows,
  aggregateOrderLineTotals,
  enrichLineWithMfgBatch,
  orderRowsToEditState,
  createEmptyEditRow,
  getPurchasedCasesFromRow,
  formatOrderLineSkuLabel,
  resolveCatalogLineName,
} from "../utils/orderLineCalculation";
import { getAllCalculatorSkuNames } from "../utils/calculatorSkuNames";
import { formatProductLabelDisplay } from "../utils/productCatalog";
import { mfgDateToInputValue, formatLotDateDisplay, parseLotDateDisplay } from "../utils/shippingFifoLots";
import {
  getWorkspaceInventory,
  subscribeWorkspaceInventory,
} from "../services/supabaseService";
import {
  getInventorySkuOptions,
  getInventoryLotQuantity,
  getInventorySkuTotalQuantity,
  getMfgDateOptionsForSkuFromInventory,
  getBatchOptionsForSkuMfgFromInventory,
  getBbdOptionsForSkuMfgBatchFromInventory,
  pickFifoLotFromInventory,
  resolveBatchForMfgFromInventory,
  resolveBbdForMfgBatchFromInventory,
  validateOrderLinesAgainstInventory,
} from "../utils/workspaceInventory";
import ShippingTransportFields from "./ShippingTransportFields";
import {
  getOrderTransport,
  isOrderTransportComplete,
  transportValidationMessage,
  buildTransportPatch,
} from "../constants/shippingTransport";

/** Readable condensed layout for shipping fullscreen (tight spacing, min 11–12px type). */
function getDialogTableDensity(condensed, isMobile) {
  if (condensed) {
    return {
      body: isMobile ? 11 : 12,
      head: isMobile ? 11 : 12,
      footer: isMobile ? 11 : 13,
      netTotal: isMobile ? 12 : 14,
      caption: isMobile ? 10 : 11,
      title: isMobile ? "0.95rem" : "1.05rem",
      chip: isMobile ? 9 : 10,
      chipH: isMobile ? 16 : 18,
      input: isMobile ? 11 : 12,
      px: isMobile ? 0.5 : 0.75,
      py: isMobile ? 0.5 : 0.625,
      shortHeaders: true,
      roundAmounts: false,
      productColMinW: 152,
      productColWidth: "20%",
      mfgColMinW: 118,
      mfgColWidth: "11%",
      batchColMinW: 104,
      batchColWidth: "10%",
      bbdColMinW: 118,
      bbdColWidth: "11%",
      stockColMinW: 76,
      stockColWidth: "8%",
      qtyW: 80,
      numColMinW: 68,
      numColWidth: "8%",
      shellPx: 1,
      shellPy: 0.75,
    };
  }
  return {
    body: isMobile ? 10 : 13,
    head: isMobile ? 9 : 14,
    footer: isMobile ? 10 : 14,
    netTotal: isMobile ? 10 : 15,
    caption: isMobile ? 10 : 12,
    title: isMobile ? "1rem" : "1.25rem",
    chip: isMobile ? 7 : 9,
    chipH: isMobile ? 18 : 20,
    input: isMobile ? 10 : 13,
    px: isMobile ? 0.5 : 1.5,
    py: isMobile ? 0.75 : 1.5,
    shortHeaders: isMobile,
    roundAmounts: isMobile,
    productColMinW: 168,
    productColWidth: "18%",
    mfgColMinW: 132,
    mfgColWidth: "11%",
    batchColMinW: 116,
    batchColWidth: "10%",
    bbdColMinW: 132,
    bbdColWidth: "11%",
    stockColMinW: 84,
    stockColWidth: "8%",
    qtyW: isMobile ? 72 : 96,
    numColMinW: 76,
    numColWidth: "8%",
    shellPx: 2,
    shellPy: 1,
  };
}

function buildOrderTableColumns(editable, density) {
  const columns = [];
  if (editable) {
    columns.push({ key: "actions", label: "", align: "center", width: 40, minWidth: 40, wrap: false });
  }
  columns.push(
    {
      key: "product",
      label: "Product",
      align: "left",
      width: density.productColWidth,
      minWidth: density.productColMinW,
      wrap: true,
    },
    {
      key: "mfg",
      label: density.shortHeaders ? "MFG" : "MFG Date",
      align: "left",
      width: density.mfgColWidth,
      minWidth: density.mfgColMinW,
      wrap: true,
    },
    {
      key: "batch",
      label: density.shortHeaders ? "Batch" : "Batch No",
      align: "left",
      width: density.batchColWidth,
      minWidth: density.batchColMinW,
      wrap: true,
    },
    {
      key: "bbd",
      label: "BBD",
      align: "left",
      width: density.bbdColWidth,
      minWidth: density.bbdColMinW,
      wrap: true,
    },
    {
      key: "stock",
      label: "Stock",
      align: "left",
      width: density.stockColWidth,
      minWidth: density.stockColMinW,
      wrap: false,
    },
    {
      key: "qty",
      label: density.shortHeaders ? "Qty" : "Qty/Cases",
      align: "right",
      width: density.qtyW,
      minWidth: density.qtyW,
      wrap: false,
    },
    {
      key: "rate",
      label: "Rate",
      align: "right",
      width: density.numColWidth,
      minWidth: density.numColMinW,
      wrap: false,
    },
    {
      key: "amount",
      label: density.shortHeaders ? "Amt" : "Total Amount",
      align: "right",
      width: density.numColWidth,
      minWidth: density.numColMinW,
      wrap: false,
    },
    {
      key: "tons",
      label: density.shortHeaders ? "Tons" : "Total Tons",
      align: "right",
      width: density.numColWidth,
      minWidth: density.numColMinW,
      wrap: false,
    },
    {
      key: "uc",
      label: density.shortHeaders ? "UC" : "Total UC",
      align: "right",
      width: density.numColWidth,
      minWidth: density.numColMinW,
      wrap: false,
    }
  );
  return columns;
}

function shippingTableCellSx(col, density, { header = false, extra = {}, hasField = false } = {}) {
  if (!col) return extra;
  const isRight = col.align === "right";
  return {
    ...(header ? tableHeadCellSx() : {}),
    textAlign: col.align,
    px: density.px,
    py: density.py,
    width: col.width,
    minWidth: col.minWidth,
    whiteSpace: header ? (col.wrap ? "normal" : "nowrap") : "normal",
    overflow: header ? undefined : "visible",
    verticalAlign: header ? "bottom" : "top",
    fontSize: header ? density.head : density.body,
    lineHeight: 1.3,
    fontWeight: header ? 800 : isRight ? 600 : undefined,
    fontVariantNumeric: isRight && !header ? "tabular-nums" : undefined,
    color: header ? undefined : "text.primary",
    boxSizing: "border-box",
    ...(hasField && !header ? { height: "auto" } : {}),
    ...extra,
  };
}

function ProductCellLabel({ label, density }) {
  const text = formatProductLabelDisplay(label);
  if (!text || text === "—") {
    return (
      <Typography component="span" sx={{ fontSize: density.body, color: "text.secondary" }}>
        —
      </Typography>
    );
  }
  return (
    <Tooltip title={text} placement="top-start" enterDelay={400}>
      <Typography
        component="span"
        sx={{
          fontWeight: 700,
          fontSize: density.body,
          textTransform: "uppercase",
          whiteSpace: "normal",
          lineHeight: 1.35,
          display: "block",
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

function LotFieldLabel({ label, density }) {
  const text = String(label ?? "").trim();
  if (!text || text === "—") {
    return (
      <Typography component="span" sx={{ fontSize: density.body, color: "text.secondary" }}>
        —
      </Typography>
    );
  }
  return (
    <Tooltip title={text} placement="top-start" enterDelay={400}>
      <Typography
        component="span"
        sx={{
          fontWeight: 600,
          fontSize: density.body,
          whiteSpace: "normal",
          lineHeight: 1.35,
          display: "block",
          wordBreak: "break-word",
        }}
      >
        {text}
      </Typography>
    </Tooltip>
  );
}

function shippingInputSx(density, { align = "left" } = {}) {
  return {
    fontSize: density.input,
    width: "100%",
    "& .MuiInputBase-root": {
      width: "100%",
      height: "auto !important",
      minHeight: 34,
      alignItems: "center",
      overflow: "visible",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "divider",
    },
    "& .MuiSelect-select": {
      height: "auto !important",
      minHeight: "1.35em",
      py: "6px !important",
      pl: "8px !important",
      pr: "28px !important",
      whiteSpace: "normal",
      lineHeight: 1.35,
      wordBreak: "break-word",
      overflow: "visible",
      textOverflow: "clip",
      display: "block",
      textAlign: align,
    },
    "& .MuiInputBase-input": {
      py: "6px",
      px: "8px",
      height: "auto",
      minHeight: "1.35em",
      fontSize: density.input,
      whiteSpace: "normal",
      overflow: "visible",
      textOverflow: "clip",
      textAlign: align,
    },
  };
}

const lotFieldSelectSx = (density) => shippingInputSx(density, { align: "left" });

const lotFieldInputSx = (density) => shippingInputSx(density, { align: "left" });

function InventoryLotEditCells({
  sku,
  mfgDate,
  batchNo,
  bbdDate,
  inventoryRows,
  density,
  cellSx,
  onMfgChange,
  onBatchChange,
  onBbdChange,
}) {
  if (!sku) {
    return (
      <>
        <TableCell sx={cellSx("mfg")}>—</TableCell>
        <TableCell sx={cellSx("batch")}>—</TableCell>
        <TableCell sx={cellSx("bbd")}>—</TableCell>
        <TableCell sx={cellSx("stock")}>—</TableCell>
      </>
    );
  }

  const mfgOptions = getMfgDateOptionsForSkuFromInventory(inventoryRows, sku);
  const batchOptions = getBatchOptionsForSkuMfgFromInventory(inventoryRows, sku, mfgDate);
  const bbdOptions = getBbdOptionsForSkuMfgBatchFromInventory(inventoryRows, sku, mfgDate, batchNo);
  const lotQty = getInventoryLotQuantity(inventoryRows, sku, mfgDate, batchNo, bbdDate);
  const skuTotal = getInventorySkuTotalQuantity(inventoryRows, sku);
  const inputMfgDate = mfgDateToInputValue(mfgDate);
  const inputBbdDate = mfgDateToInputValue(bbdDate);

  const renderMfgField = () => {
    if (mfgOptions.length > 0) {
      return (
        <Select
          size="small"
          fullWidth
          displayEmpty
          value={inputMfgDate || ""}
          onChange={(e) => onMfgChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          sx={lotFieldSelectSx(density)}
          renderValue={(v) => (v ? formatLotDateDisplay(v) : <em>Select MFG</em>)}
        >
          <MenuItem value="">
            <em>Select MFG</em>
          </MenuItem>
          {mfgOptions.map((d) => {
            const iso = mfgDateToInputValue(d) || d;
            return (
              <MenuItem key={iso} value={iso} sx={{ whiteSpace: "normal" }}>
                {formatLotDateDisplay(d)}
              </MenuItem>
            );
          })}
        </Select>
      );
    }
    return (
      <TextField
        size="small"
        type="text"
        fullWidth
        placeholder="DD-MM-YYYY"
        value={inputMfgDate ? formatLotDateDisplay(inputMfgDate) : ""}
        onChange={(e) => onMfgChange(parseLotDateDisplay(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        sx={lotFieldInputSx(density)}
      />
    );
  };

  const renderBatchField = () => {
    if (batchOptions.length > 0) {
      return (
        <Select
          size="small"
          fullWidth
          displayEmpty
          value={batchNo || ""}
          onChange={(e) => onBatchChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          sx={lotFieldSelectSx(density)}
          renderValue={(v) => (v ? v : <em>Select batch</em>)}
        >
          <MenuItem value="">
            <em>Select batch</em>
          </MenuItem>
          {batchOptions.map((b) => (
            <MenuItem key={b} value={b} sx={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {b}
            </MenuItem>
          ))}
        </Select>
      );
    }
    return (
      <TextField
        size="small"
        fullWidth
        value={batchNo || ""}
        onChange={(e) => onBatchChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder="Batch no."
        sx={lotFieldInputSx(density)}
      />
    );
  };

  const renderBbdField = () => {
    if (bbdOptions.length > 0) {
      return (
        <Select
          size="small"
          fullWidth
          displayEmpty
          value={inputBbdDate || ""}
          onChange={(e) => onBbdChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          sx={lotFieldSelectSx(density)}
          renderValue={(v) => (v ? formatLotDateDisplay(v) : <em>Select BBD</em>)}
        >
          <MenuItem value="">
            <em>Select BBD</em>
          </MenuItem>
          {bbdOptions.map((d) => {
            const iso = mfgDateToInputValue(d) || d;
            return (
              <MenuItem key={iso} value={iso} sx={{ whiteSpace: "normal" }}>
                {formatLotDateDisplay(d)}
              </MenuItem>
            );
          })}
        </Select>
      );
    }
    return (
      <TextField
        size="small"
        type="text"
        fullWidth
        placeholder="DD-MM-YYYY"
        value={inputBbdDate ? formatLotDateDisplay(inputBbdDate) : ""}
        onChange={(e) => onBbdChange(parseLotDateDisplay(e.target.value))}
        onClick={(e) => e.stopPropagation()}
        sx={lotFieldInputSx(density)}
      />
    );
  };

  return (
    <>
      <TableCell sx={cellSx("mfg", { hasField: true })}>
        <FormControl size="small" fullWidth sx={{ m: 0 }}>
          {renderMfgField()}
        </FormControl>
      </TableCell>
      <TableCell sx={cellSx("batch", { hasField: true })}>
        <FormControl size="small" fullWidth sx={{ m: 0 }}>
          {renderBatchField()}
        </FormControl>
      </TableCell>
      <TableCell sx={cellSx("bbd", { hasField: true })}>
        <FormControl size="small" fullWidth sx={{ m: 0 }}>
          {renderBbdField()}
        </FormControl>
      </TableCell>
      <TableCell sx={cellSx("stock")}>
        <Chip
          size="small"
          label={lotQty > 0 ? `${lotQty} avail` : skuTotal > 0 ? `${skuTotal} SKU` : "No stock"}
          color={lotQty > 0 ? "success" : skuTotal > 0 ? "warning" : "default"}
          variant={lotQty > 0 ? "filled" : "outlined"}
          sx={{ fontWeight: 700, fontSize: density.chip }}
        />
      </TableCell>
    </>
  );
}

function formatRate(rate, density) {
  if (density.roundAmounts) return rate;
  return rate.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatAmount(totalAmount, density) {
  if (density.roundAmounts) return Math.round(totalAmount).toLocaleString();
  return totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function QtyCell({ row, density, editable, purchasedCases, onPurchasedCasesChange }) {
  const cases = num(row.cases);
  const freeCases = num(row.freeCases);
  const orderedCases = freeCases > 0 ? Math.max(0, cases - freeCases) : cases;

  if (editable) {
    return (
      <TextField
        size="small"
        type="number"
        fullWidth
        inputProps={{ min: 0, step: 1, style: { textAlign: "right" } }}
        value={purchasedCases === "" || purchasedCases == null ? "" : purchasedCases}
        onChange={(e) => onPurchasedCasesChange(e.target.value)}
        sx={{
          ...shippingInputSx(density, { align: "right" }),
          "& input[type=number]": { MozAppearance: "textfield" },
          "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
            WebkitAppearance: "none",
            margin: 0,
          },
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (freeCases > 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25, whiteSpace: "nowrap" }}>
        <Typography
          component="span"
          sx={{
            fontWeight: "bold",
            fontSize: density.body,
            color: "text.primary",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {orderedCases.toLocaleString()}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Typography component="span" sx={{ color: "success.light", fontSize: density.chip, fontWeight: "bold" }}>
            +{freeCases}
          </Typography>
          <Chip
            label="FREE"
            size="small"
            sx={{
              height: density.chipH,
              fontSize: density.chip,
              backgroundColor: "#4caf50",
              color: "white",
              fontWeight: "bold",
            }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Typography
      sx={{
        fontWeight: "bold",
        fontSize: density.body,
        color: "text.primary",
        whiteSpace: "nowrap",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {cases.toLocaleString()}
    </Typography>
  );
}

function RateCell({ row, density }) {
  const rate = num(row.rate);
  const scheme = row.schemeApplied;

  if (scheme?.type === "discount" && num(row.discountAmount) > 0) {
    const discountPerCase = num(scheme.discountAmount);
    const discountedRate = rate - discountPerCase;
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.3 }}>
        <Typography sx={{ fontSize: density.body, fontWeight: "bold", color: "info.light" }}>
          {formatRate(discountedRate, density)}
        </Typography>
        <Chip
          label="DISCOUNTED"
          size="small"
          sx={{
            height: density.chipH,
            fontSize: density.chip,
            backgroundColor: "#1976d2",
            color: "white",
            fontWeight: "bold",
          }}
        />
      </Box>
    );
  }

  return (
    <Typography sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary" }}>
      {formatRate(rate, density)}
    </Typography>
  );
}

/**
 * Calculated results table for a saved order.
 * Read-only by default; shipping can pass `editable` for qty edits and new lines.
 */
export default function OrderCalculatedTableDialog({
  open,
  onClose,
  order,
  distributorName,
  getOrderStatus,
  fullScreen = false,
  condensed = false,
  editable = false,
  productRates = null,
  schemes = [],
  skuOptions: skuOptionsProp = null,
  onSave,
  saving = false,
  saveAndDispatch = false,
  onSaveAndDispatch,
  dispatchPhase = false,
  onMarkDispatched,
  markingDispatched = false,
  distributorDetails = null,
  showTransportFields = false,
  transport = null,
  onTransportChange,
  transportError = "",
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const useFullScreen = fullScreen || isMobile;
  const density = useMemo(() => getDialogTableDensity(condensed, isMobile), [condensed, isMobile]);
  const orderColumns = useMemo(() => buildOrderTableColumns(editable, density), [editable, density]);
  const cellSx = useCallback(
    (key, options = {}) => {
      const col = orderColumns.find((c) => c.key === key);
      return shippingTableCellSx(col, density, options);
    },
    [orderColumns, density]
  );
  const summ = calcSummaryRows(theme);
  const resultsShellSx = calculatorResultsShellSx(theme);

  const [editRows, setEditRows] = useState([]);
  const [saveError, setSaveError] = useState("");
  const [inventoryRows, setInventoryRows] = useState([]);

  const tableColCount = orderColumns.length;

  const skuOptions = useMemo(() => {
    const resolve = (name) => resolveCatalogLineName(name, productRates) || name;
    if (skuOptionsProp?.length) return skuOptionsProp.map(resolve);
    const fromInventory = getInventorySkuOptions(inventoryRows).map((o) => o.sku);
    if (fromInventory.length > 0) return fromInventory;
    return getAllCalculatorSkuNames(productRates);
  }, [skuOptionsProp, inventoryRows, productRates]);

  useEffect(() => {
    if (!open) {
      setInventoryRows([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getWorkspaceInventory();
        if (!cancelled) setInventoryRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch (e) {
        console.warn("Could not load workspace inventory:", e);
        if (!cancelled) setInventoryRows([]);
      }
    })();
    const unsub = subscribeWorkspaceInventory((data) => {
      if (!cancelled) setInventoryRows(Array.isArray(data?.rows) ? data.rows : []);
    });
    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !editable) {
      setEditRows([]);
      setSaveError("");
      return;
    }
    setSaveError("");
    const initial = orderRowsToEditState(order?.data);
    const rows =
      initial.length > 0
        ? initial.map((r) => {
            const sku = resolveCatalogLineName(r.sku, productRates) || r.sku;
            const base = { ...r, sku };
            if (!sku || (base.mfgDate && base.batchNo)) return base;
            const fifo = pickFifoLotFromInventory(inventoryRows, sku);
            const normalizedMfg = mfgDateToInputValue(fifo.mfgDate) || fifo.mfgDate;
            return {
              ...base,
              mfgDate: base.mfgDate ? mfgDateToInputValue(base.mfgDate) || base.mfgDate : normalizedMfg,
              batchNo: base.batchNo || fifo.batchNo,
              bbdDate: base.bbdDate ? mfgDateToInputValue(base.bbdDate) || base.bbdDate : fifo.bbdDate,
            };
          })
        : [createEmptyEditRow()];
    setEditRows(rows);
  }, [open, editable, order, inventoryRows, productRates]);

  const staticRows = useMemo(
    () =>
      (Array.isArray(order?.data) ? order.data : []).map((row) =>
        enrichLineWithMfgBatch(row, row)
      ),
    [order]
  );

  const computedFromEdit = useMemo(() => {
    if (!editable) return [];
    return editRows.map((er) => {
      const purchased =
        er.purchasedCases === "" || er.purchasedCases == null
          ? 0
          : Math.max(0, Math.floor(num(er.purchasedCases)));
      if (!er.sku || purchased <= 0) {
        return {
          _key: er._key,
          sku: er.sku || "",
          cases: 0,
          freeCases: 0,
          rate: 0,
          totalAmount: 0,
          totalTon: 0,
          totalUC: null,
          discountAmount: 0,
          schemeApplied: null,
          isDraft: true,
        };
      }
      const calc =
        calculateOrderLine({
          sku: er.sku,
          purchasedCases: purchased,
          productRates,
          schemes,
          preferSchemeName: er.preferSchemeName,
        }) || {};
      return {
        ...calc,
        _key: er._key,
        isDraft: false,
        mfgDate: er.mfgDate ?? "",
        batchNo: er.batchNo ?? "",
        bbdDate: er.bbdDate ?? "",
      };
    });
  }, [editable, editRows, productRates, schemes]);

  const aggregates = useMemo(() => {
    const source = editable
      ? computedFromEdit.filter((r) => r.sku && num(r.cases) > 0 && !r.isDraft)
      : staticRows;
    let totalAmountSum = 0;
    let totalTonSum = 0;
    let totalDiscountSum = 0;
    let sumCasesDisplay = 0;
    let totalUC_CSD = 0;
    let totalUC_Water = 0;

    source.forEach((row) => {
      const cases = num(row.cases);
      const discountAmount = num(row.discountAmount);
      const totalAmount = num(row.totalAmount);
      const totalTon = num(row.totalTon);
      const totalUC = num(row.totalUC);
      const category = row.category || "CSD";

      totalAmountSum += totalAmount;
      totalTonSum += totalTon;
      totalDiscountSum += discountAmount;
      sumCasesDisplay += cases;
      if (category === "Water") totalUC_Water += totalUC;
      else totalUC_CSD += totalUC;
    });

    if (!editable) {
      const csdUC = order?.csdUC != null && order?.csdUC !== "" ? num(order.csdUC) : totalUC_CSD;
      const waterUC = order?.waterUC != null && order?.waterUC !== "" ? num(order.waterUC) : totalUC_Water;
      return {
        totalAmountSum,
        totalTonSum,
        totalDiscountSum,
        sumCasesDisplay,
        totalUC_CSD: csdUC,
        totalUC_Water: waterUC,
      };
    }

    return {
      totalAmountSum,
      totalTonSum,
      totalDiscountSum,
      sumCasesDisplay,
      totalUC_CSD,
      totalUC_Water,
    };
  }, [order, staticRows, editable, computedFromEdit]);

  const isGelephuGrocery =
    distributorName && String(distributorName).toLowerCase().includes("gelephu grocery");
  const gstRate = isGelephuGrocery ? 0 : 0.05;
  const gstAmount = aggregates.totalAmountSum * gstRate;
  const netTotal = aggregates.totalAmountSum + gstAmount;
  const showGst = gstAmount > 0;

  const orderNo = order?.orderNumber || "—";

  const statusRaw = getOrderStatus && order ? getOrderStatus(order) : order?.status || "pending";
  const status = String(statusRaw || "pending").toLowerCase();
  const statusLabel = getOrderStatusLabel(status);

  const headerDate =
    order?.timestamp ||
    order?.created_at ||
    (order?.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : null) ||
    new Date().toLocaleDateString();

  const updateEditRow = useCallback((key, patch) => {
    setEditRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }, []);

  const handleSkuChange = useCallback(
    (key, sku) => {
      const lineSku = resolveCatalogLineName(sku, productRates) || sku;
      const fifo = lineSku
        ? pickFifoLotFromInventory(inventoryRows, lineSku)
        : { mfgDate: "", batchNo: "", bbdDate: "" };
      const normalizedMfg = mfgDateToInputValue(fifo.mfgDate) || fifo.mfgDate;
      updateEditRow(key, {
        sku: lineSku,
        preferSchemeName: null,
        mfgDate: normalizedMfg,
        batchNo: fifo.batchNo,
        bbdDate: mfgDateToInputValue(fifo.bbdDate) || fifo.bbdDate,
      });
    },
    [inventoryRows, productRates, updateEditRow]
  );

  const handleMfgChange = useCallback(
    (key, mfgDate, sku) => {
      const nextMfg = mfgDate ? String(mfgDate).slice(0, 10) : "";
      const row = editRows.find((r) => r._key === key);
      const nextBatch = resolveBatchForMfgFromInventory(inventoryRows, sku || row?.sku, nextMfg, row?.batchNo);
      const nextBbd = resolveBbdForMfgBatchFromInventory(
        inventoryRows,
        sku || row?.sku,
        nextMfg,
        nextBatch,
        row?.bbdDate
      );
      updateEditRow(key, {
        mfgDate: nextMfg,
        batchNo: nextBatch,
        bbdDate: mfgDateToInputValue(nextBbd) || nextBbd,
      });
    },
    [inventoryRows, editRows, updateEditRow]
  );

  const handleBatchChange = useCallback(
    (key, batchNo, sku) => {
      const row = editRows.find((r) => r._key === key);
      const nextBbd = resolveBbdForMfgBatchFromInventory(
        inventoryRows,
        sku || row?.sku,
        row?.mfgDate,
        batchNo,
        row?.bbdDate
      );
      updateEditRow(key, {
        batchNo,
        bbdDate: mfgDateToInputValue(nextBbd) || nextBbd,
      });
    },
    [inventoryRows, editRows, updateEditRow]
  );

  const handleAddRow = () => {
    setEditRows((prev) => [...prev, createEmptyEditRow()]);
  };

  const handleRemoveRow = (key) => {
    setEditRows((prev) => prev.filter((r) => r._key !== key));
  };

  const hasLineItems = editable ? editRows.length > 0 : staticRows.length > 0;
  const transportValue = transport ?? getOrderTransport(order);

  const buildSavePayload = useCallback(() => {
    const data = buildOrderDataFromEditRows(editRows, productRates, schemes);
    if (data.length === 0) {
      setSaveError("Add at least one line with a SKU and quantity greater than zero.");
      return null;
    }
    setSaveError("");
    const totals = aggregateOrderLineTotals(data);
    return { data, ...totals };
  }, [editRows, productRates, schemes]);

  const validateInventoryBeforeDispatch = useCallback(
    (lines) => {
      const check = validateOrderLinesAgainstInventory(inventoryRows, lines);
      if (!check.ok) {
        setSaveError(check.message);
        return false;
      }
      setSaveError("");
      return true;
    },
    [inventoryRows]
  );

  const handleSaveAndDispatch = async () => {
    if (!onSave || !onSaveAndDispatch) return;
    const payload = buildSavePayload();
    if (!payload) return;
    if (!validateInventoryBeforeDispatch(payload.data)) return;
    if (showTransportFields) {
      const transportOrder = { ...order, ...buildTransportPatch(transportValue) };
      if (!isOrderTransportComplete(transportOrder)) {
        setSaveError(transportValidationMessage(transportOrder));
        return;
      }
    }
    setSaveError("");
    try {
      await onSave(payload);
      await onSaveAndDispatch({
        payload,
        transport: transportValue,
        headerDate,
        orderNo,
        gstRate,
      });
    } catch (e) {
      if (e?.message) setSaveError(e.message);
    }
  };

  const handleMarkDispatchedClick = () => {
    if (!onMarkDispatched) return;
    const lines = staticRows.filter((row) => row?.sku && num(row.cases) > 0);
    if (!validateInventoryBeforeDispatch(lines)) return;
    onMarkDispatched({ transport: transportValue });
  };

  const showTransportEditable =
    showTransportFields && hasLineItems && editable && onTransportChange && !dispatchPhase;
  const showTransportReadOnly =
    showTransportFields &&
    hasLineItems &&
    (status === "delivered" || dispatchPhase);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={useFullScreen}>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          py: condensed ? 1 : 1.5,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: density.title }}>
            {dispatchPhase ? `Dispatch order #${orderNo}` : `Order #${orderNo}`}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9, fontSize: density.caption }}>
            {dispatchPhase
              ? "Review summary and invoice, then mark dispatched"
              : statusLabel}
            {editable && !dispatchPhase
              ? " · Adjust qty; MFG/batch/BBD from inventory (FIFO)"
              : ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "inherit" }} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: density.shellPx, py: density.shellPy, mt: condensed ? 0.5 : 1 }}>
        {!hasLineItems && !editable ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            No line items were saved for this order.
          </Typography>
        ) : (
          <>
            <TableContainer
              component={Paper}
              sx={{
                ...resultsShellSx,
                borderRadius: condensed ? 2 : 3,
                boxShadow: condensed ? 2 : 3,
                ...(condensed && {
                  maxHeight: "calc(100dvh - 168px)",
                  overflow: "auto",
                }),
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  px: density.shellPx + 0.5,
                  pt: density.shellPy,
                  pb: density.shellPy,
                  flexWrap: "wrap",
                  gap: 0.75,
                }}
              >
                <Box sx={{ fontWeight: "bold", color: "text.primary", fontSize: density.footer }}>
                  {distributorName || "Distributor"}
                </Box>
                <Box
                  sx={{
                    fontWeight: "bold",
                    fontSize: density.footer,
                    textAlign: "center",
                    flexGrow: 1,
                    color: "text.primary",
                  }}
                >
                  Order No: {orderNo}
                </Box>
                <Box sx={{ fontWeight: "bold", fontSize: density.caption, color: "text.primary" }}>
                  📅 {headerDate}
                </Box>
              </Box>
              <Table
                size="small"
                sx={{
                  width: "100%",
                  minWidth: condensed ? 1080 : 1180,
                  tableLayout: "fixed",
                  "& .MuiTableCell-root": {
                    overflow: "visible",
                  },
                  "& .MuiTableRow-root": {
                    height: "auto",
                  },
                }}
              >
                <colgroup>
                  {orderColumns.map((col) => (
                    <col
                      key={col.key}
                      style={{
                        width: typeof col.width === "number" ? `${col.width}px` : col.width,
                        minWidth: col.minWidth,
                      }}
                    />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    {orderColumns.map((col) => (
                      <TableCell key={col.key} sx={cellSx(col.key, { header: true })}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(editable ? editRows : staticRows).map((sourceRow, i) => {
                    const row = editable ? computedFromEdit[i] || sourceRow : sourceRow;
                    const editSource = editable ? sourceRow : null;
                    const totalAmount = num(row.totalAmount);
                    const totalTon = num(row.totalTon);
                    const totalUC = row.totalUC != null && row.totalUC !== "" ? num(row.totalUC) : null;

                    return (
                      <TableRow
                        key={editable ? editSource._key : i}
                        sx={{
                          background: tableStripeAt(theme, i),
                          color: "text.primary",
                          "&:hover": { bgcolor: tableRowHoverBg(theme) },
                        }}
                      >
                        {editable ? (
                          <TableCell sx={cellSx("actions", { extra: { p: 0.5 } })}>
                            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                              <IconButton
                                size="small"
                                color="error"
                                aria-label="remove line"
                                onClick={() => handleRemoveRow(editSource._key)}
                                disabled={editRows.length <= 1}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        ) : null}
                        <TableCell sx={cellSx("product", { extra: { fontWeight: 700 }, hasField: editable })}>
                          {editable ? (
                            <FormControl size="small" fullWidth sx={{ m: 0 }}>
                              <Select
                                value={resolveCatalogLineName(editSource.sku, productRates) || editSource.sku || ""}
                                displayEmpty
                                onChange={(e) => handleSkuChange(editSource._key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  ...shippingInputSx(density, { align: "left" }),
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                }}
                                MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                                renderValue={(selected) =>
                                  selected ? formatProductLabelDisplay(selected) : (
                                    <em style={{ textTransform: "none" }}>Select product</em>
                                  )
                                }
                              >
                                <MenuItem value="">
                                  <em>Select product</em>
                                </MenuItem>
                                {skuOptions.map((name) => {
                                  const avail = getInventorySkuTotalQuantity(inventoryRows, name);
                                  const displayName = formatProductLabelDisplay(name);
                                  return (
                                    <MenuItem
                                      key={name}
                                      value={name}
                                      sx={{ fontSize: density.input, textTransform: "uppercase", whiteSpace: "normal" }}
                                    >
                                      {avail > 0 ? `${displayName} (${avail} avail)` : displayName}
                                    </MenuItem>
                                  );
                                })}
                              </Select>
                            </FormControl>
                          ) : (
                            <ProductCellLabel
                              label={formatOrderLineSkuLabel(row, productRates)}
                              density={density}
                            />
                          )}
                        </TableCell>
                        {editable ? (
                          <InventoryLotEditCells
                            sku={editSource.sku}
                            mfgDate={editSource.mfgDate}
                            batchNo={editSource.batchNo}
                            bbdDate={editSource.bbdDate}
                            inventoryRows={inventoryRows}
                            density={density}
                            cellSx={cellSx}
                            onMfgChange={(val) => handleMfgChange(editSource._key, val, editSource.sku)}
                            onBatchChange={(val) => handleBatchChange(editSource._key, val, editSource.sku)}
                            onBbdChange={(val) =>
                              updateEditRow(editSource._key, {
                                bbdDate: val ? String(val).slice(0, 10) : "",
                              })
                            }
                          />
                        ) : (
                          <>
                            <TableCell sx={cellSx("mfg")}>
                              <LotFieldLabel label={formatLotDateDisplay(row.mfgDate)} density={density} />
                            </TableCell>
                            <TableCell sx={cellSx("batch")}>
                              <LotFieldLabel label={row.batchNo} density={density} />
                            </TableCell>
                            <TableCell sx={cellSx("bbd")}>
                              <LotFieldLabel label={formatLotDateDisplay(row.bbdDate)} density={density} />
                            </TableCell>
                            <TableCell sx={cellSx("stock")}>
                              {(() => {
                                const lotQty = getInventoryLotQuantity(
                                  inventoryRows,
                                  row.sku,
                                  row.mfgDate,
                                  row.batchNo,
                                  row.bbdDate
                                );
                                return (
                                  <Chip
                                    size="small"
                                    label={lotQty > 0 ? `${lotQty} avail` : "No stock"}
                                    color={lotQty > 0 ? "success" : "default"}
                                    variant={lotQty > 0 ? "filled" : "outlined"}
                                    sx={{ fontWeight: 700, fontSize: density.chip }}
                                  />
                                );
                              })()}
                            </TableCell>
                          </>
                        )}
                        <TableCell sx={cellSx("qty", { extra: { fontWeight: "bold" }, hasField: editable })}>
                          <QtyCell
                            row={row}
                            density={density}
                            editable={editable}
                            purchasedCases={editable ? editSource.purchasedCases : getPurchasedCasesFromRow(row)}
                            onPurchasedCasesChange={(val) =>
                              updateEditRow(editSource._key, {
                                purchasedCases: val === "" ? "" : Math.max(0, parseInt(val, 10) || 0),
                              })
                            }
                          />
                        </TableCell>
                        <TableCell sx={cellSx("rate", { extra: { fontWeight: "bold" } })}>
                          <RateCell row={row} density={density} />
                        </TableCell>
                        <TableCell sx={cellSx("amount", { extra: { fontWeight: "bold" } })}>
                          {row.sku && num(row.cases) > 0 ? formatAmount(totalAmount, density) : "—"}
                        </TableCell>
                        <TableCell sx={cellSx("tons", { extra: { fontWeight: "bold" } })}>
                          {row.sku && num(row.cases) > 0 ? totalTon.toFixed(3) : "—"}
                        </TableCell>
                        <TableCell sx={cellSx("uc", { extra: { fontWeight: "bold" } })}>
                          {row.sku && num(row.cases) > 0 && totalUC != null ? totalUC.toFixed(2) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {editable ? (
                    <TableRow>
                      <TableCell colSpan={tableColCount} sx={{ py: 1, border: 0 }}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={handleAddRow}
                          variant="outlined"
                          color="primary"
                        >
                          Add line
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {aggregates.totalDiscountSum > 0 && (
                    <TableRow
                      sx={{
                        fontWeight: "bold",
                        background: summ.discountBg,
                        borderTop: "2px solid",
                        borderColor: summ.discountBorder,
                        color: "text.primary",
                      }}
                    >
                      <TableCell
                        colSpan={editable ? 6 : 5}
                        align="right"
                        sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                      >
                        Total Discount:
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                      >
                        {formatAmount(aggregates.totalDiscountSum, density)}
                      </TableCell>
                      <TableCell colSpan={2} align="right" sx={{ color: "text.secondary" }}>
                        —
                      </TableCell>
                    </TableRow>
                  )}

                  <TableRow
                    sx={{
                      fontWeight: "bold",
                      background: summ.grossBg,
                      borderTop: "3px solid",
                      borderColor: summ.grossBorder,
                      color: "text.primary",
                    }}
                  >
                    <TableCell
                      colSpan={editable ? 4 : 3}
                      sx={{
                        fontWeight: "bold",
                        fontSize: density.footer,
                        color: "warning.light",
                        px: density.px,
                        py: density.py,
                      }}
                    >
                      Gross Total
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.footer, px: density.px, py: density.py }}
                    >
                      {aggregates.sumCasesDisplay.toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary", px: density.px, py: density.py }}>
                      —
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: "bold",
                        fontSize: density.footer,
                        color: "error.light",
                        px: density.px,
                        py: density.py,
                      }}
                    >
                      {formatAmount(aggregates.totalAmountSum, density)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.footer, px: density.px, py: density.py }}
                    >
                      {aggregates.totalTonSum.toFixed(3)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: "text.secondary" }}>
                      —
                    </TableCell>
                  </TableRow>

                  {showGst && (
                    <TableRow
                      sx={{
                        fontWeight: "bold",
                        background: summ.gstBg,
                        borderTop: "2px solid",
                        borderColor: summ.gstBorder,
                        color: "text.primary",
                      }}
                    >
                      <TableCell
                        colSpan={editable ? 6 : 5}
                        align="right"
                        sx={{
                          fontWeight: "bold",
                          color: "warning.light",
                          fontSize: density.body,
                          px: density.px,
                          py: density.py,
                        }}
                      >
                        GST (5%):
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                      >
                        {formatAmount(gstAmount, density)}
                      </TableCell>
                      <TableCell colSpan={2} align="right" sx={{ color: "text.secondary" }}>
                        —
                      </TableCell>
                    </TableRow>
                  )}

                  <TableRow
                    sx={{
                      fontWeight: "bold",
                      background: summ.netBg,
                      borderTop: "3px solid",
                      borderColor: summ.netBorder,
                      color: "text.primary",
                    }}
                  >
                    <TableCell
                      colSpan={editable ? 6 : 5}
                      align="right"
                      sx={{
                        fontWeight: "bold",
                        color: "success.light",
                        fontSize: density.netTotal,
                        px: density.px,
                        py: density.py,
                      }}
                    >
                      Net Total:
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: "bold",
                        color: "success.main",
                        fontSize: density.netTotal,
                        px: density.px,
                        py: density.py,
                      }}
                    >
                      {formatAmount(netTotal, density)}
                    </TableCell>
                    <TableCell colSpan={2} align="right" sx={{ color: "text.secondary" }}>
                      —
                    </TableCell>
                  </TableRow>

                  <TableRow
                    sx={{
                      fontWeight: "bold",
                      background: tableFooterBandBg(theme),
                      borderTop: "1px solid",
                      borderColor: tableFooterBandBorder(theme),
                      color: "text.primary",
                    }}
                  >
                    <TableCell
                      colSpan={editable ? 8 : 7}
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                    >
                      CSD UC:
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                    >
                      {aggregates.totalUC_CSD.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ fontWeight: "bold", background: tableFooterBandBg(theme), color: "text.primary" }}>
                    <TableCell
                      colSpan={editable ? 8 : 7}
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                    >
                      Water UC:
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: "bold", fontSize: density.body, px: density.px, py: density.py }}
                    >
                      {aggregates.totalUC_Water.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {showTransportEditable ? (
              <ShippingTransportFields
                value={transportValue}
                onChange={onTransportChange}
                error={transportError}
                required
                compact={condensed}
              />
            ) : null}

            {showTransportReadOnly ? (
              <ShippingTransportFields
                value={transportValue}
                disabled
                required={false}
                compact={condensed}
              />
            ) : null}

            {saveError ? (
              <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                {saveError}
              </Typography>
            ) : null}

            {order?.caption ? (
              <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
                <strong>Note:</strong> {order.caption}
              </Typography>
            ) : null}

            {orderHasShippingInvoice(order) ? (
              <ShippingInvoiceAttachment
                order={order}
                title={
                  dispatchPhase || status === "delivered"
                    ? "Shipping invoice (attached for dispatch)"
                    : "Shipping invoice"
                }
              />
            ) : dispatchPhase ? (
              <Typography variant="body2" color="warning.main" sx={{ mt: 2, fontWeight: 600 }}>
                Invoice is still uploading. Wait a moment or close and try Save and dispatch again.
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: "wrap", gap: 1 }}>
        {dispatchPhase && onMarkDispatched ? (
          <Button
            onClick={handleMarkDispatchedClick}
            variant="contained"
            color="success"
            disabled={markingDispatched || saving || !orderHasShippingInvoice(order)}
            startIcon={
              markingDispatched ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <LocalShippingIcon />
              )
            }
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            {markingDispatched ? "Dispatching…" : "Mark dispatched"}
          </Button>
        ) : null}
        {editable && onSave && saveAndDispatch && onSaveAndDispatch && !dispatchPhase ? (
          <Button
            onClick={handleSaveAndDispatch}
            variant="contained"
            color="success"
            disabled={saving}
            startIcon={
              saving ? <CircularProgress size={18} color="inherit" /> : <LocalShippingIcon />
            }
            sx={{ fontWeight: 700, textTransform: "none" }}
          >
            {saving ? "Saving…" : "Save and dispatch"}
          </Button>
        ) : null}
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          disabled={saving || markingDispatched}
        >
          {dispatchPhase ? "Cancel" : "Close"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
