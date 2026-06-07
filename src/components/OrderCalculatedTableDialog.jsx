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
  orderRowsToEditState,
  createEmptyEditRow,
  getPurchasedCasesFromRow,
} from "../utils/orderLineCalculation";
import { getAllCalculatorSkuNames } from "../utils/calculatorSkuNames";
import {
  getMfgDateOptionsForSku,
  getBatchOptionsForSkuMfg,
  pickFifoMfgAndBatch,
  resolveBatchForMfg,
} from "../utils/shippingFifoLots";
import { getFgOpeningStock, subscribeFgOpeningStock } from "../services/supabaseService";
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
      skuMinW: 108,
      mfgMinW: 86,
      batchMinW: 72,
      qtyW: 58,
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
    skuMinW: 140,
    mfgMinW: 120,
    batchMinW: 108,
    qtyW: isMobile ? 72 : 96,
    shellPx: 2,
    shellPy: 1,
  };
}

function MfgBatchEditCells({ sku, mfgDate, batchNo, fgRows, density, onMfgChange, onBatchChange }) {
  const mfgOptions = useMemo(
    () => (sku ? getMfgDateOptionsForSku(fgRows, sku) : []),
    [fgRows, sku]
  );
  const batchOptions = useMemo(
    () => (sku && mfgDate ? getBatchOptionsForSkuMfg(fgRows, sku, mfgDate) : []),
    [fgRows, sku, mfgDate]
  );

  if (!sku) {
    return (
      <>
        <TableCell sx={{ fontSize: density.body, color: "text.secondary", px: density.px, py: density.py }}>
          —
        </TableCell>
        <TableCell sx={{ fontSize: density.body, color: "text.secondary", px: density.px, py: density.py }}>
          —
        </TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell sx={{ minWidth: density.mfgMinW, px: density.px, py: density.py }}>
        <FormControl size="small" fullWidth>
          <Select
            value={mfgDate || ""}
            displayEmpty
            onChange={(e) => onMfgChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            sx={{ fontSize: density.input, "& .MuiSelect-select": { py: 0.5 } }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 280 } } }}
          >
            <MenuItem value="">
              <em>MFG date</em>
            </MenuItem>
            {mfgOptions.map((d) => (
              <MenuItem key={d} value={d} sx={{ fontSize: density.input }}>
                {d}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </TableCell>
      <TableCell sx={{ minWidth: density.batchMinW, px: density.px, py: density.py }}>
        <FormControl size="small" fullWidth>
          <Select
            value={batchNo || ""}
            displayEmpty
            disabled={!mfgDate}
            onChange={(e) => onBatchChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            sx={{ fontSize: density.input, "& .MuiSelect-select": { py: 0.5 } }}
            MenuProps={{ PaperProps: { sx: { maxHeight: 280 } } }}
          >
            <MenuItem value="">
              <em>Batch</em>
            </MenuItem>
            {batchOptions.map((b) => (
              <MenuItem key={b} value={b} sx={{ fontSize: density.input }}>
                {b}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
  const scheme = row.schemeApplied;
  const orderedCases = freeCases > 0 ? Math.max(0, cases - freeCases) : cases;

  if (editable) {
    return (
      <TextField
        size="small"
        type="number"
        inputProps={{ min: 0, step: 1 }}
        value={purchasedCases === "" || purchasedCases == null ? "" : purchasedCases}
        onChange={(e) => onPurchasedCasesChange(e.target.value)}
        sx={{ width: density.qtyW, "& input": { fontSize: density.input, py: 0.5 } }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (freeCases > 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25 }}>
        <Typography component="span" sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary" }}>
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
    <Typography sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary" }}>
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
  const summ = calcSummaryRows(theme);
  const resultsShellSx = calculatorResultsShellSx(theme);

  const [editRows, setEditRows] = useState([]);
  const [saveError, setSaveError] = useState("");
  const [fgOpeningRows, setFgOpeningRows] = useState([]);

  const tableColCount = editable ? 9 : 8;

  const skuOptions = useMemo(
    () => skuOptionsProp || getAllCalculatorSkuNames(productRates),
    [skuOptionsProp, productRates]
  );

  useEffect(() => {
    if (!open) {
      setFgOpeningRows([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getFgOpeningStock();
        if (!cancelled) setFgOpeningRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch (e) {
        console.warn("Could not load FG opening stock:", e);
        if (!cancelled) setFgOpeningRows([]);
      }
    })();
    const unsub = subscribeFgOpeningStock((data) => {
      if (!cancelled) setFgOpeningRows(Array.isArray(data?.rows) ? data.rows : []);
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
            if (!r.sku || (r.mfgDate && r.batchNo)) return r;
            const fifo = pickFifoMfgAndBatch(fgOpeningRows, r.sku);
            return {
              ...r,
              mfgDate: r.mfgDate || fifo.mfgDate,
              batchNo: r.batchNo || fifo.batchNo,
            };
          })
        : [createEmptyEditRow()];
    setEditRows(rows);
  }, [open, editable, order, fgOpeningRows]);

  const staticRows = useMemo(
    () => (Array.isArray(order?.data) ? order.data : []),
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
      return { ...calc, _key: er._key, isDraft: false };
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
      const fifo = sku ? pickFifoMfgAndBatch(fgOpeningRows, sku) : { mfgDate: "", batchNo: "" };
      updateEditRow(key, {
        sku,
        preferSchemeName: null,
        mfgDate: fifo.mfgDate,
        batchNo: fifo.batchNo,
      });
    },
    [fgOpeningRows, updateEditRow]
  );

  const handleMfgChange = useCallback(
    (key, sku, mfgDate, currentBatch) => {
      const batchNo = resolveBatchForMfg(fgOpeningRows, sku, mfgDate, currentBatch);
      updateEditRow(key, { mfgDate, batchNo });
    },
    [fgOpeningRows, updateEditRow]
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

  const handleSaveAndDispatch = async () => {
    if (!onSave || !onSaveAndDispatch) return;
    const payload = buildSavePayload();
    if (!payload) return;
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
              ? " · Adjust qty; MFG/batch from company stock (FIFO)"
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
              <Table size="small" sx={{ width: "100%", tableLayout: condensed ? "fixed" : "auto" }}>
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    {(editable
                      ? [
                          "",
                          "SKU",
                          density.shortHeaders ? "MFG" : "MFG Date",
                          density.shortHeaders ? "Batch" : "Batch No",
                          density.shortHeaders ? "Qty" : "Qty/Cases",
                          "Rate",
                          density.shortHeaders ? "Amt" : "Total Amount",
                          density.shortHeaders ? "Tons" : "Total Tons",
                          density.shortHeaders ? "UC" : "Total UC",
                        ]
                      : [
                          "SKU",
                          density.shortHeaders ? "MFG" : "MFG Date",
                          density.shortHeaders ? "Batch" : "Batch No",
                          density.shortHeaders ? "Qty" : "Qty/Cases",
                          "Rate",
                          density.shortHeaders ? "Amt" : "Total Amount",
                          density.shortHeaders ? "Tons" : "Total Tons",
                          density.shortHeaders ? "UC" : "Total UC",
                        ]
                    ).map((label, i) => (
                        <TableCell
                          key={`${label}-${i}`}
                          sx={{
                            ...tableHeadCellSx(),
                            fontSize: density.head,
                            textAlign: i <= (editable ? 3 : 2) ? "left" : "right",
                            px: density.px,
                            py: density.py,
                            whiteSpace: "nowrap",
                            width: editable && i === 0 ? 36 : undefined,
                            lineHeight: 1.25,
                          }}
                        >
                          {label}
                        </TableCell>
                      )
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(editable ? editRows : staticRows).map((sourceRow, i) => {
                    const row = editable ? computedFromEdit[i] || sourceRow : sourceRow;
                    const editSource = editable ? sourceRow : null;
                    const rate = num(row.rate);
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
                          <TableCell sx={{ px: 0.5, width: 40 }}>
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="remove line"
                              onClick={() => handleRemoveRow(editSource._key)}
                              disabled={editRows.length <= 1}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        ) : null}
                        <TableCell
                          sx={{
                            fontWeight: 700,
                            fontSize: density.body,
                            wordBreak: condensed ? "break-word" : "normal",
                            color: "text.primary",
                            minWidth: editable ? density.skuMinW : undefined,
                            px: density.px,
                            py: density.py,
                          }}
                        >
                          {editable ? (
                            <FormControl size="small" fullWidth>
                              <Select
                                value={editSource.sku || ""}
                                displayEmpty
                                onChange={(e) => handleSkuChange(editSource._key, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  fontSize: density.input,
                                  fontWeight: 700,
                                  "& .MuiSelect-select": { py: 0.5 },
                                }}
                                MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
                              >
                                <MenuItem value="">
                                  <em>Select SKU</em>
                                </MenuItem>
                                {skuOptions.map((name) => (
                                  <MenuItem key={name} value={name} sx={{ fontSize: density.input }}>
                                    {name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            row.sku
                          )}
                        </TableCell>
                        {editable ? (
                          <MfgBatchEditCells
                            sku={editSource.sku}
                            mfgDate={editSource.mfgDate}
                            batchNo={editSource.batchNo}
                            fgRows={fgOpeningRows}
                            density={density}
                            onMfgChange={(val) =>
                              handleMfgChange(editSource._key, editSource.sku, val, editSource.batchNo)
                            }
                            onBatchChange={(val) => updateEditRow(editSource._key, { batchNo: val })}
                          />
                        ) : (
                          <>
                            <TableCell
                              sx={{ fontWeight: 600, fontSize: density.body, px: density.px, py: density.py }}
                            >
                              {row.mfgDate || "—"}
                            </TableCell>
                            <TableCell
                              sx={{ fontWeight: 600, fontSize: density.body, px: density.px, py: density.py }}
                            >
                              {row.batchNo || "—"}
                            </TableCell>
                          </>
                        )}
                        <TableCell
                          align="right"
                          sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary", px: density.px, py: density.py }}
                        >
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
                        <TableCell
                          align="right"
                          sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary", px: density.px, py: density.py }}
                        >
                          <RateCell row={row} density={density} />
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary", px: density.px, py: density.py }}
                        >
                          {row.sku && num(row.cases) > 0 ? formatAmount(totalAmount, density) : "—"}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary", px: density.px, py: density.py }}
                        >
                          {row.sku && num(row.cases) > 0 ? totalTon.toFixed(3) : "—"}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ fontWeight: "bold", fontSize: density.body, color: "text.primary", px: density.px, py: density.py }}
                        >
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
            onClick={() => onMarkDispatched({ transport: transportValue })}
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
