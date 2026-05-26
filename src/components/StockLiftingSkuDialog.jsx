import React, { useMemo } from "react";
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
  Stack,
  IconButton,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { buildSkuLiftingsFromSalesRecords } from "../utils/performanceSkuAggregation";
import { formatStockLiftDate } from "./StockLiftingRecordsTable";

function SkuTable({ title, rows, accent }) {
  if (!rows.length) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75, color: accent }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No SKU breakdown for this selection.
        </Typography>
      </Box>
    );
  }

  const totalPc = rows.reduce((s, r) => s + r.pc, 0);
  const totalUc = rows.reduce((s, r) => s + r.uc, 0);

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75, color: accent }}>
        {title}
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Product SKU</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                PC
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>
                UC
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sku} hover>
                <TableCell sx={{ fontWeight: 600, maxWidth: 280, whiteSpace: "normal" }}>{row.sku}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  {Math.round(row.pc).toLocaleString()}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  {(Math.round(row.uc * 100) / 100).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell sx={{ fontWeight: 900 }}>Subtotal</TableCell>
              <TableCell align="right" sx={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                {Math.round(totalPc).toLocaleString()}
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                {(Math.round(totalUc * 100) / 100).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/**
 * SKU-wise liftings for one stock lifting row or all rows in the table.
 * @param {object[]} salesRecords - sales_data-shaped rows with optional `products[]`
 */
export default function StockLiftingSkuDialog({
  open,
  onClose,
  title = "SKU liftings",
  subtitle = "",
  salesRecords = [],
  liftDateLabel = "",
}) {
  const liftings = useMemo(() => {
    if (!open) {
      return { csd: [], water: [], totals: { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 }, invoiceRows: 0 };
    }
    return buildSkuLiftingsFromSalesRecords(salesRecords);
  }, [open, salesRecords]);

  const hasAnySku = liftings.csd.length > 0 || liftings.water.length > 0;
  const hasProductLines = (salesRecords || []).some(
    (r) => Array.isArray(r?.products) && r.products.length > 0
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, pr: 6, pb: 1 }}>
        <Inventory2OutlinedIcon color="primary" sx={{ mt: 0.25 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {subtitle}
            </Typography>
          ) : null}
          {liftDateLabel ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {liftDateLabel}
            </Typography>
          ) : null}
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap sx={{ mb: 2 }}>
          <Chip
            size="small"
            label={`${liftings.invoiceRows} lift row(s)`}
            color={liftings.invoiceRows > 0 ? "primary" : "default"}
            variant="outlined"
          />
          <Chip size="small" label={`CSD PC ${liftings.totals.csdPC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`CSD UC ${liftings.totals.csdUC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`Water PC ${liftings.totals.waterPC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`Water UC ${liftings.totals.waterUC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
        </Stack>

        {liftings.invoiceRows === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            No lifting rows selected.
          </Typography>
        ) : !hasProductLines ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            This lift only has CSD/Water totals (no per-SKU lines in sales data). Re-upload sales Excel with product
            columns to see SKU detail.
          </Typography>
        ) : !hasAnySku ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Lift rows exist but no CSD/Water SKU quantities were parsed for this selection.
          </Typography>
        ) : (
          <>
            <SkuTable title="CSD products" rows={liftings.csd} accent="error.main" />
            <SkuTable title="Water products" rows={liftings.water} accent="info.main" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              PC = physical cases. UC = unit cases from the uploaded sales file.
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: "none", fontWeight: 700 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Build dialog context for a single lifting table row. */
export function stockLiftRowToSalesRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    invoiceDate: record.invoiceDate,
    products: Array.isArray(record.products) ? record.products : [],
    csdPC: record.csdPC,
    csdUC: record.csdUC,
    waterPC: record.waterPC,
    waterUC: record.waterUC,
  };
}

export function formatStockLiftSkuDialogDate(record) {
  return formatStockLiftDate(record);
}
