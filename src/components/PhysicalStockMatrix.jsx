import React, { useMemo, useCallback } from "react";
import {
  Typography,
  Paper,
  Box,
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

const DENSITY = {
  px: 1,
  py: 0.5,
  head: "0.7rem",
  body: "0.75rem",
  input: "0.75rem",
  fieldHeight: 32,
};

/** Column share of table width — keeps headers and body aligned at any width. */
const COL_PCT = {
  readOnly: {
    index: "4%",
    mfg: "15%",
    batch: "10%",
    bbd: "15%",
    opening: "14%",
    primary: "14%",
    physical: "14%",
    secondary: "14%",
  },
  editable: {
    index: "3.5%",
    mfg: "13.5%",
    batch: "9%",
    bbd: "13.5%",
    opening: "12.5%",
    primary: "12.5%",
    physical: "12.5%",
    secondary: "12.5%",
    actions: "5%",
  },
};

function buildPhysicalStockColumns(readOnly) {
  const pct = readOnly ? COL_PCT.readOnly : COL_PCT.editable;
  const cols = [
    { key: "index", label: "#", align: "center", width: pct.index },
    { key: "mfg", label: "MFG", align: "left", width: pct.mfg },
    { key: "batch", label: "Batch", align: "left", width: pct.batch },
    { key: "bbd", label: "BBD", align: "left", width: pct.bbd },
    { key: "opening", label: "Opening", align: "right", width: pct.opening },
    { key: "primary", label: "Primary", align: "right", width: pct.primary },
    { key: "physical", label: "Physical", align: "right", width: pct.physical },
    { key: "secondary", label: "Secondary", align: "right", width: pct.secondary },
  ];
  if (!readOnly) {
    cols.push({ key: "actions", label: "", align: "center", width: pct.actions });
  }
  return cols;
}

function PhysicalStockColGroup({ columns }) {
  return (
    <colgroup>
      {columns.map((col) => (
        <col key={col.key} style={{ width: col.width }} />
      ))}
    </colgroup>
  );
}

function physicalStockCellSx(col, { header = false, extra = {} } = {}) {
  const isRight = col.align === "right";
  return {
    textAlign: col.align,
    px: DENSITY.px,
    py: header ? 0.65 : DENSITY.py,
    verticalAlign: "middle",
    whiteSpace: header ? "nowrap" : "normal",
    overflow: header ? "hidden" : "visible",
    textOverflow: header ? "ellipsis" : undefined,
    fontSize: header ? DENSITY.head : DENSITY.body,
    lineHeight: 1.3,
    fontWeight: header ? 800 : isRight ? 600 : undefined,
    fontVariantNumeric: isRight && !header ? "tabular-nums" : undefined,
    boxSizing: "border-box",
    ...extra,
  };
}

function cellInnerSx(align = "left") {
  return {
    width: "100%",
    minWidth: 0,
    display: "block",
    textAlign: align,
    boxSizing: "border-box",
  };
}

function physicalStockInputSx({ align = "left", bold = false } = {}) {
  const h = DENSITY.fieldHeight;
  return {
    display: "block",
    width: "100%",
    minWidth: 0,
    m: 0,
    "& .MuiInputBase-root": {
      width: "100%",
      minHeight: h,
      height: h,
      alignItems: "center",
      borderRadius: 1,
      boxSizing: "border-box",
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "divider",
    },
    "& .MuiInputBase-input": {
      py: 0,
      px: "6px",
      height: h,
      minHeight: h,
      boxSizing: "border-box",
      fontSize: DENSITY.input,
      fontWeight: bold ? 700 : 600,
      lineHeight: 1.25,
      textAlign: align,
      "&::-webkit-calendar-picker-indicator": {
        margin: 0,
        padding: 0,
      },
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

function readOnlyValueSx({ computed = false, bold = false } = {}) {
  return {
    ...cellInnerSx("right"),
    fontWeight: bold ? 800 : 600,
    fontVariantNumeric: "tabular-nums",
    fontSize: DENSITY.body,
    lineHeight: `${DENSITY.fieldHeight}px`,
    color: computed ? "text.secondary" : "text.primary",
  };
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
  const columns = useMemo(() => buildPhysicalStockColumns(readOnly), [readOnly]);
  const colSpanAll = columns.length;

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
          acc.opening += Number(lot?.openingStockQty) || 0;
          acc.primary += Number(lot?.primarySale) || 0;
          acc.physical += Number(lot?.physicalStockQty) || 0;
          acc.secondary += Number(lot?.secondarySale) || 0;
        }
        return acc;
      },
      { opening: 0, primary: 0, physical: 0, secondary: 0 }
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
        const templateLot =
          [...lots].reverse().find((l) => l.mfgDate || l.batchNo || l.bbdDate) || lots[lots.length - 1];
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

  const qtyCell = (rowIndex, lotIndex, field, aria, lot, col, { computed = false } = {}) => {
    const v = lot?.[field];
    const display = v === "" || v == null ? "—" : Number(v) || 0;
    if (readOnly || computed) {
      return (
        <Typography sx={readOnlyValueSx({ computed, bold: boldDataValues })}>{display}</Typography>
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
        sx={physicalStockInputSx({ align: "right", bold: boldDataValues })}
      />
    );
  };

  const dateCell = (rowIndex, lotIndex, field, aria, lot) => {
    const v = lot?.[field] || "";
    if (readOnly) {
      return (
        <Typography
          sx={{
            ...cellInnerSx("left"),
            fontSize: DENSITY.body,
            fontWeight: 600,
            lineHeight: `${DENSITY.fieldHeight}px`,
          }}
        >
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
        sx={physicalStockInputSx({ align: "left" })}
      />
    );
  };

  const batchCell = (rowIndex, lotIndex, lot) => {
    const v = lot?.batchNo ?? "";
    if (readOnly) {
      return (
        <Typography
          sx={{
            ...cellInnerSx("left"),
            fontSize: DENSITY.body,
            fontWeight: 600,
            lineHeight: `${DENSITY.fieldHeight}px`,
            wordBreak: "break-word",
          }}
        >
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
        sx={physicalStockInputSx({ align: "left" })}
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

  const tableSx = {
    width: "100%",
    minWidth: readOnly ? 680 : 720,
    tableLayout: "fixed",
    borderCollapse: "collapse",
    "& .MuiTableCell-root": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      px: DENSITY.px,
      py: DENSITY.py,
    },
    "& .MuiTableCell-head": {
      py: 0.65,
      fontWeight: 800,
    },
  };

  const qtyTotalSx = {
    fontWeight: 900,
    fontSize: DENSITY.body,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    textAlign: "right",
  };

  const renderQtyTotalCells = (values, { fontSize = DENSITY.body, fontWeight = 900, color } = {}) => {
    const qtyCols = columns.filter((c) =>
      ["opening", "primary", "physical", "secondary"].includes(c.key)
    );
    return qtyCols.map((col) => (
      <TableCell
        key={col.key}
        align={col.align}
        sx={physicalStockCellSx(col, {
          extra: { ...qtyTotalSx, fontSize, fontWeight, color },
        })}
      >
        <Box component="span" sx={cellInnerSx("right")}>
          {values[col.key]}
        </Box>
      </TableCell>
    ));
  };

  const renderSubtotalRow = (label, values, rowSx, labelSx = {}) => (
    <TableRow sx={rowSx}>
      <TableCell
        colSpan={4}
        sx={physicalStockCellSx(columns[0], {
          extra: {
            fontWeight: labelSx.fontWeight ?? 800,
            fontSize: labelSx.fontSize ?? DENSITY.head,
            color: labelSx.color,
            textAlign: "left",
          },
        })}
      >
        {label}
      </TableCell>
      {renderQtyTotalCells(values, {
        fontSize: labelSx.fontSize ?? DENSITY.body,
        fontWeight: labelSx.fontWeight ?? 800,
        color: labelSx.color,
      })}
      {!readOnly ? (
        <TableCell sx={physicalStockCellSx(columns[columns.length - 1], { extra: { border: 0 } })} />
      ) : null}
    </TableRow>
  );

  const subtotalRowSx = {
    bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === "dark" ? 0.12 : 0.06),
    "& td": { borderTop: `1px solid ${theme.palette.divider}` },
  };

  const grandTotalRowSx = {
    bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.2 : 0.14),
    "& td": {
      borderTop: `1px solid ${alpha(theme.palette.warning.dark, 0.22)}`,
      py: 0.65,
    },
  };

  const colByKey = (key) => columns.find((c) => c.key === key);

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
          <Typography
            variant="caption"
            sx={{ fontWeight: 700, color: "text.primary", fontSize: "0.65rem", lineHeight: 1.35 }}
          >
            FIFO lots per batch — opening is yesterday's physical stock (auto). Enter primary sale and
            physical stock; secondary is auto-calculated.
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
        <Box sx={{ width: "100%", overflowX: "auto" }}>
          <Table size="small" sx={tableSx} stickyHeader>
            <PhysicalStockColGroup columns={columns} />
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    align={col.align}
                    sx={physicalStockCellSx(col, {
                      header: true,
                      extra: {
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        bgcolor: "background.paper",
                        borderBottom: `2px solid ${theme.palette.divider}`,
                      },
                    })}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(rows || []).map((row, rowIndex) => {
                const accent = getSkuAccent(row.productSku);
                const lots = getLotsFromProductRow(row);
                const sub = lots.reduce(
                  (a, l) => ({
                    opening: a.opening + (Number(l.openingStockQty) || 0),
                    primary: a.primary + (Number(l.primarySale) || 0),
                    physical: a.physical + (Number(l.physicalStockQty) || 0),
                    secondary: a.secondary + (Number(l.secondarySale) || 0),
                  }),
                  { opening: 0, primary: 0, physical: 0, secondary: 0 }
                );

                return (
                  <React.Fragment key={row.productSku || rowIndex}>
                    <TableRow>
                      <TableCell
                        colSpan={colSpanAll}
                        sx={{
                          px: DENSITY.px,
                          py: 0.55,
                          bgcolor: alpha(accent, theme.palette.mode === "dark" ? 0.14 : 0.08),
                          borderLeft: `3px solid ${accent}`,
                          borderBottom: `1px solid ${alpha(accent, 0.25)}`,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          <Typography
                            sx={{
                              fontWeight: 800,
                              fontSize: isFs ? "0.8rem" : "0.76rem",
                              letterSpacing: 0.04,
                              color: accent,
                            }}
                          >
                            {row.productSku}
                          </Typography>
                          {!readOnly ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                              onClick={() => addLot(rowIndex)}
                              sx={{
                                textTransform: "none",
                                fontWeight: 700,
                                py: 0.15,
                                fontSize: "0.68rem",
                                minHeight: 26,
                                borderColor: alpha(accent, 0.45),
                                color: accent,
                              }}
                            >
                              Add lot
                            </Button>
                          ) : null}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {lots.map((lot, lotIndex) => (
                      <TableRow key={lot.lotId || `${rowIndex}-${lotIndex}`} hover>
                        <TableCell
                          align="center"
                          sx={physicalStockCellSx(colByKey("index"), {
                            extra: { color: "text.secondary", fontWeight: 700 },
                          })}
                        >
                          <Box component="span" sx={cellInnerSx("center")}>
                            {lotIndex + 1}
                          </Box>
                        </TableCell>
                        <TableCell align="left" sx={physicalStockCellSx(colByKey("mfg"))}>
                          {dateCell(rowIndex, lotIndex, "mfgDate", "Manufacturing date", lot)}
                        </TableCell>
                        <TableCell align="left" sx={physicalStockCellSx(colByKey("batch"))}>
                          {batchCell(rowIndex, lotIndex, lot)}
                        </TableCell>
                        <TableCell align="left" sx={physicalStockCellSx(colByKey("bbd"))}>
                          {dateCell(rowIndex, lotIndex, "bbdDate", "Best before date", lot)}
                        </TableCell>
                        <TableCell align="right" sx={physicalStockCellSx(colByKey("opening"))}>
                          {qtyCell(rowIndex, lotIndex, "openingStockQty", "Opening stock", lot, colByKey("opening"), {
                            computed: true,
                          })}
                        </TableCell>
                        <TableCell align="right" sx={physicalStockCellSx(colByKey("primary"))}>
                          {qtyCell(rowIndex, lotIndex, "primarySale", "Primary sale", lot, colByKey("primary"))}
                        </TableCell>
                        <TableCell align="right" sx={physicalStockCellSx(colByKey("physical"))}>
                          {qtyCell(rowIndex, lotIndex, "physicalStockQty", "Physical stock", lot, colByKey("physical"))}
                        </TableCell>
                        <TableCell align="right" sx={physicalStockCellSx(colByKey("secondary"))}>
                          {qtyCell(rowIndex, lotIndex, "secondarySale", "Secondary sale", lot, colByKey("secondary"), {
                            computed: !readOnly,
                          })}
                        </TableCell>
                        {!readOnly ? (
                          <TableCell align="center" sx={physicalStockCellSx(colByKey("actions"))}>
                            <Box sx={{ ...cellInnerSx("center"), lineHeight: `${DENSITY.fieldHeight}px` }}>
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
                            </Box>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}

                    {renderSubtotalRow("Subtotal", sub, subtotalRowSx, {
                      fontWeight: 800,
                      fontSize: DENSITY.head,
                      color: "text.secondary",
                    })}
                  </React.Fragment>
                );
              })}

              <TableRow sx={grandTotalRowSx}>
                <TableCell
                  colSpan={4}
                  sx={physicalStockCellSx(columns[0], {
                    extra: { fontWeight: 900, fontSize: DENSITY.head, textAlign: "left" },
                  })}
                >
                  TOTAL (all SKUs)
                </TableCell>
                {renderQtyTotalCells(totals, { fontWeight: 900 })}
                {!readOnly ? (
                  <TableCell sx={physicalStockCellSx(columns[columns.length - 1], { extra: { border: 0 } })} />
                ) : null}
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Paper>
  );
}
