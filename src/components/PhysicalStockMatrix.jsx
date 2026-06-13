import React, { useMemo, useCallback } from "react";
import {
  Typography,
  Paper,
  Box,
  Stack,
  Divider,
  Button,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
  createFifoLotWithTraceabilityFrom,
  getLotsFromProductRow,
} from "../utils/physicalStockTemplate";

/** Column share of table width — equal qty columns keep totals aligned at full width. */
const MATRIX_COL_PCT = {
  readOnly: {
    index: "4%",
    mfg: "16%",
    batch: "12%",
    bbd: "16%",
    primary: "17.33%",
    physical: "17.33%",
    secondary: "17.34%",
  },
  editable: {
    index: "3%",
    mfg: "14%",
    batch: "10%",
    bbd: "14%",
    primary: "14.67%",
    physical: "14.67%",
    secondary: "14.66%",
    actions: "4%",
  },
};

function MatrixColGroup({ readOnly }) {
  const pct = readOnly ? MATRIX_COL_PCT.readOnly : MATRIX_COL_PCT.editable;
  return (
    <colgroup>
      <col style={{ width: pct.index }} />
      <col style={{ width: pct.mfg }} />
      <col style={{ width: pct.batch }} />
      <col style={{ width: pct.bbd }} />
      <col style={{ width: pct.primary }} />
      <col style={{ width: pct.physical }} />
      <col style={{ width: pct.secondary }} />
      {!readOnly ? <col style={{ width: pct.actions }} /> : null}
    </colgroup>
  );
}

function compactFieldSx(alignRight = false) {
  return {
    width: "100%",
    minWidth: 0,
    m: 0,
    "& .MuiOutlinedInput-root": { width: "100%" },
    "& input": {
      py: 0.5,
      fontSize: "0.75rem",
      ...(alignRight ? { textAlign: "right" } : {}),
    },
  };
}

function applyPrimaryPhysicalSecondary(field, draft) {
  const toNumOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const toSafe = (n) => (n == null ? "" : Math.max(0, Math.round(n)));

  if (field === "primarySale" || field === "physicalStockQty") {
    const opening = toNumOrNull(draft.openingStockQty) ?? 0;
    const primary = toNumOrNull(draft.primarySale);
    const physical = toNumOrNull(draft.physicalStockQty);
    if (primary != null && physical != null) {
      draft.secondarySale = toSafe(opening + primary - physical);
    }
  }
  return draft;
}

export default function PhysicalStockMatrix({
  rows,
  readOnly,
  onRowsChange,
  variant = "default",
  maxHeight,
  boldDataValues = false,
  showLotHelp = true,
}) {
  const theme = useTheme();
  const isFs = variant === "fullscreen";
  const bodyMaxHeight = maxHeight ?? "78vh";

  const getSkuAccent = useCallback(
    (skuName) => {
      const s = String(skuName || "").trim().toUpperCase();
      if (s.startsWith("KO")) return "#1565c0";
      if (s.startsWith("FX")) return "#FF7A00";
      if (s.startsWith("SP")) return "#00A651";
      if (s.startsWith("CH")) return "#8B1A1A";
      if (s.startsWith("KWAT")) return "#0B63CE";
      return theme.palette.primary.main;
    },
    [theme.palette.primary.main]
  );

  const totals = useMemo(() => {
    return (rows || []).reduce(
      (acc, row) => {
        for (const lot of getLotsFromProductRow(row)) {
          acc.primary += Number(lot?.primarySale) || 0;
          acc.physical += Number(lot?.physicalStockQty) || 0;
          acc.secondary += Number(lot?.secondarySale) || 0;
        }
        return acc;
      },
      { primary: 0, physical: 0, secondary: 0 }
    );
  }, [rows]);

  const updateLotField = useCallback(
    (rowIndex, lotIndex, field, value) => {
      if (!onRowsChange) return;
      const next = (rows || []).map((row, ri) => {
        if (ri !== rowIndex) return row;
        const lots = getLotsFromProductRow(row).map((l) => ({ ...l }));
        const draft = { ...lots[lotIndex] };

        if (field === "mfgDate" || field === "bbdDate") {
          draft[field] = typeof value === "string" ? value.slice(0, 10) : "";
        } else if (field === "batchNo") {
          draft.batchNo = value;
        } else if (field === "primarySale" || field === "physicalStockQty") {
          const typedValue = value === "" ? "" : Math.max(0, Number(value) || 0);
          draft[field] = typedValue;
          applyPrimaryPhysicalSecondary(field, draft);
        }

        lots[lotIndex] = draft;
        return { ...row, productSku: row.productSku, lots };
      });
      onRowsChange(next);
    },
    [rows, onRowsChange]
  );

  const addLot = useCallback(
    (rowIndex) => {
      if (!onRowsChange) return;
      const next = (rows || []).map((row, ri) => {
        if (ri !== rowIndex) return row;
        const lots = getLotsFromProductRow(row);
        const templateLot = [...lots].reverse().find((l) => l.mfgDate || l.batchNo || l.bbdDate) || lots[lots.length - 1];
        const lotsNext = [...lots, createFifoLotWithTraceabilityFrom(templateLot)];
        return { ...row, lots: lotsNext };
      });
      onRowsChange(next);
    },
    [rows, onRowsChange]
  );

  const removeLot = useCallback(
    (rowIndex, lotIndex) => {
      if (!onRowsChange) return;
      const next = (rows || []).map((row, ri) => {
        if (ri !== rowIndex) return row;
        const lots = getLotsFromProductRow(row);
        if (lots.length <= 1) return row;
        const filtered = lots.filter((_, i) => i !== lotIndex);
        return { ...row, lots: filtered };
      });
      onRowsChange(next);
    },
    [rows, onRowsChange]
  );

  const qtyCell = (rowIndex, lotIndex, field, aria, lot, { computed = false } = {}) => {
    const v = lot?.[field];
    const display = v === "" || v == null ? "—" : Number(v) || 0;
    if (readOnly || computed) {
      return (
        <Typography
          sx={{
            fontWeight: boldDataValues ? 800 : 600,
            fontVariantNumeric: "tabular-nums",
            py: 0.25,
            fontSize: "0.75rem",
            textAlign: "right",
            display: "block",
            color: computed ? "text.secondary" : undefined,
          }}
        >
          {display}
        </Typography>
      );
    }
    return (
      <TextField
        size="small"
        type="number"
        fullWidth
        inputProps={{ min: 0, step: 1, "aria-label": aria }}
        value={v === "" || v == null ? "" : Number(v) || 0}
        onChange={(e) => updateLotField(rowIndex, lotIndex, field, e.target.value)}
        sx={{
          ...compactFieldSx(true),
          "& input": {
            ...compactFieldSx(true)["& input"],
            fontWeight: boldDataValues ? 700 : 600,
          },
        }}
      />
    );
  };

  const dateCell = (rowIndex, lotIndex, field, aria, lot) => {
    const v = lot?.[field] || "";
    if (readOnly) {
      return (
        <Typography variant="caption" sx={{ py: 0.25, fontWeight: 600, fontSize: "0.75rem" }}>
          {v || "—"}
        </Typography>
      );
    }
    return (
      <TextField
        size="small"
        type="date"
        fullWidth
        InputLabelProps={{ shrink: true }}
        inputProps={{ "aria-label": aria }}
        value={v}
        onChange={(e) => updateLotField(rowIndex, lotIndex, field, e.target.value)}
        sx={compactFieldSx()}
      />
    );
  };

  const batchCell = (rowIndex, lotIndex, lot) => {
    const v = lot?.batchNo ?? "";
    if (readOnly) {
      return (
        <Typography variant="caption" sx={{ py: 0.25, fontWeight: 600, fontSize: "0.75rem" }}>
          {v || "—"}
        </Typography>
      );
    }
    return (
      <TextField
        size="small"
        fullWidth
        inputProps={{ "aria-label": "Batch number" }}
        value={v}
        onChange={(e) => updateLotField(rowIndex, lotIndex, "batchNo", e.target.value)}
        sx={compactFieldSx()}
      />
    );
  };

  const paperSx = isFs
    ? {
        height: "100%",
        minHeight: { xs: "calc(100dvh - 220px)", sm: "calc(100dvh - 200px)" },
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        p: { xs: 0.75, sm: 1 },
      }
    : {
        maxHeight: bodyMaxHeight,
        overflow: "auto",
        p: { xs: 0.75, sm: 1 },
      };

  const headCellSx = {
    fontWeight: 800,
    fontSize: "0.68rem",
    py: 0.5,
    px: 0.5,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  const bodyCellSx = { py: 0.35, px: 0.5, overflow: "hidden" };
  const tableSx = {
    width: "100%",
    tableLayout: "fixed",
  };
  const tableWrapSx = { width: "100%" };
  const qtyTotalSx = {
    fontWeight: 900,
    fontSize: "0.72rem",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  };
  const subtotalRowSx = {
    bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === "dark" ? 0.12 : 0.06),
    "& td": { borderTop: `1px solid ${theme.palette.divider}` },
  };
  const grandTotalRowSx = {
    bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.2 : 0.14),
    "& td": {
      borderTop: `1px solid ${alpha(theme.palette.warning.dark, 0.22)}`,
      py: 0.5,
    },
  };

  const renderQtyTotalCells = (values, { fontSize = "0.72rem", fontWeight = 900 } = {}) => (
    <>
      <TableCell align="right" sx={{ ...bodyCellSx, ...qtyTotalSx, fontSize, fontWeight }}>
        {values.primary}
      </TableCell>
      <TableCell align="right" sx={{ ...bodyCellSx, ...qtyTotalSx, fontSize, fontWeight }}>
        {values.physical}
      </TableCell>
      <TableCell align="right" sx={{ ...bodyCellSx, ...qtyTotalSx, fontSize, fontWeight }}>
        {values.secondary}
      </TableCell>
    </>
  );

  const renderTotalsRow = (label, values, rowSx, labelSx = {}) => (
    <TableRow sx={rowSx}>
      <TableCell
        colSpan={4}
        sx={{
          ...bodyCellSx,
          fontWeight: labelSx.fontWeight ?? 900,
          fontSize: labelSx.fontSize ?? "0.68rem",
          color: labelSx.color,
        }}
      >
        {label}
      </TableCell>
      {renderQtyTotalCells(values, { fontSize: labelSx.fontSize ?? "0.72rem", fontWeight: labelSx.fontWeight ?? 900 })}
      {!readOnly ? <TableCell sx={bodyCellSx} /> : null}
    </TableRow>
  );

  return (
    <Paper variant="outlined" sx={paperSx}>
      {showLotHelp ? (
        <Box
          sx={{
            flexShrink: 0,
            mb: 0.75,
            px: 0.75,
            py: 0.45,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.08),
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.24),
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.primary", fontSize: "0.65rem", lineHeight: 1.35 }}>
            FIFO lots per batch — enter primary sale & physical stock; secondary is auto-calculated.
          </Typography>
        </Box>
      ) : null}
      <Box
        sx={{
          flex: isFs ? 1 : undefined,
          minHeight: isFs ? 0 : undefined,
          overflow: isFs ? "auto" : undefined,
          WebkitOverflowScrolling: "touch",
        }}
      >
      <Stack spacing={0.75}>
        {(rows || []).map((row, rowIndex) => {
          const accent = getSkuAccent(row.productSku);
          const lots = getLotsFromProductRow(row);
          const sub = lots.reduce(
            (a, l) => ({
              primary: a.primary + (Number(l.primarySale) || 0),
              physical: a.physical + (Number(l.physicalStockQty) || 0),
              secondary: a.secondary + (Number(l.secondarySale) || 0),
            }),
            { primary: 0, physical: 0, secondary: 0 }
          );
          return (
            <Paper
              key={row.productSku || rowIndex}
              variant="outlined"
              sx={{
                p: { xs: 0.5, sm: 0.75 },
                borderRadius: 1.25,
                borderColor: "divider",
                bgcolor: "background.paper",
                borderLeft: "3px solid",
                borderLeftColor: accent,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: isFs ? "0.78rem" : "0.74rem",
                  mb: 0.5,
                  letterSpacing: 0.05,
                  color: accent,
                }}
              >
                {row.productSku}
              </Typography>

              <Box sx={tableWrapSx}>
                <Table size="small" sx={tableSx}>
                  <MatrixColGroup readOnly={readOnly} />
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>#</TableCell>
                      <TableCell sx={headCellSx}>MFG</TableCell>
                      <TableCell sx={headCellSx}>Batch</TableCell>
                      <TableCell sx={headCellSx}>BBD</TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Primary
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Physical
                      </TableCell>
                      <TableCell sx={headCellSx} align="right">
                        Secondary
                      </TableCell>
                      {!readOnly ? <TableCell align="right" sx={headCellSx} /> : null}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lots.map((lot, lotIndex) => (
                      <TableRow key={lot.lotId || `${rowIndex}-${lotIndex}`}>
                        <TableCell sx={{ ...bodyCellSx, fontWeight: 700, color: "text.secondary", fontSize: "0.72rem" }}>
                          {lotIndex + 1}
                        </TableCell>
                        <TableCell sx={bodyCellSx}>{dateCell(rowIndex, lotIndex, "mfgDate", "Manufacturing date", lot)}</TableCell>
                        <TableCell sx={bodyCellSx}>{batchCell(rowIndex, lotIndex, lot)}</TableCell>
                        <TableCell sx={bodyCellSx}>{dateCell(rowIndex, lotIndex, "bbdDate", "Best before date", lot)}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{qtyCell(rowIndex, lotIndex, "primarySale", "Primary sale", lot)}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>{qtyCell(rowIndex, lotIndex, "physicalStockQty", "Physical stock", lot)}</TableCell>
                        <TableCell align="right" sx={bodyCellSx}>
                          {qtyCell(rowIndex, lotIndex, "secondarySale", "Secondary sale", lot, { computed: !readOnly })}
                        </TableCell>
                        {!readOnly ? (
                          <TableCell align="right" sx={bodyCellSx}>
                            <IconButton
                              size="small"
                              aria-label="Remove lot"
                              disabled={lots.length <= 1}
                              onClick={() => removeLot(rowIndex, lotIndex)}
                              color="error"
                              sx={{ p: 0.35 }}
                            >
                              <RemoveCircleOutlineIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                    {renderTotalsRow("Subtotal", sub, subtotalRowSx, {
                      fontWeight: 800,
                      fontSize: "0.62rem",
                      color: "text.secondary",
                    })}
                  </TableBody>
                </Table>
              </Box>

              {!readOnly ? (
                <Box sx={{ mt: 0.5, display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                    onClick={() => addLot(rowIndex)}
                    sx={{ textTransform: "none", fontWeight: 700, py: 0.25, fontSize: "0.7rem", minHeight: 28 }}
                  >
                    Add lot
                  </Button>
                </Box>
              ) : null}
            </Paper>
          );
        })}
      </Stack>
      </Box>
      <Divider sx={{ my: 0.75, flexShrink: 0 }} />
      <Box sx={tableWrapSx}>
        <Table size="small" sx={tableSx}>
          <MatrixColGroup readOnly={readOnly} />
          <TableBody>
            {renderTotalsRow("TOTAL (all SKUs)", totals, grandTotalRowSx)}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
