import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
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
import {
  buildDistributorSkuLiftingsForDateRange,
  getSalesInvoiceDateBoundsForDistributor,
} from "../utils/performanceSkuAggregation";

function SkuTable({ title, rows, accent }) {
  if (!rows.length) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75, color: accent }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No liftings in this date range.
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

export default function DistributorPerformanceSkuDialog({
  open,
  onClose,
  distributorCode,
  distributorName,
  distributorRegion,
  allSalesData,
  distributors,
}) {
  const bounds = useMemo(() => {
    if (!open || !distributorCode) return { minDate: "", maxDate: "", rowCount: 0 };
    return getSalesInvoiceDateBoundsForDistributor(allSalesData, distributors, distributorCode);
  }, [open, distributorCode, allSalesData, distributors]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!open) return;
    setDateFrom(bounds.minDate || "");
    setDateTo(bounds.maxDate || "");
  }, [open, bounds.minDate, bounds.maxDate]);

  const liftings = useMemo(() => {
    if (!open || !distributorCode) {
      return { csd: [], water: [], totals: { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 }, invoiceRows: 0 };
    }
    return buildDistributorSkuLiftingsForDateRange(
      allSalesData,
      distributors,
      distributorCode,
      dateFrom,
      dateTo
    );
  }, [open, distributorCode, allSalesData, distributors, dateFrom, dateTo]);

  const hasAnySku = liftings.csd.length > 0 || liftings.water.length > 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          pr: 6,
          pb: 1,
        }}
      >
        <Inventory2OutlinedIcon color="primary" sx={{ mt: 0.25 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            SKU liftings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {distributorName || "—"}
            {distributorCode ? ` · ${distributorCode}` : ""}
            {distributorRegion ? ` · ${distributorRegion}` : ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Invoice date from"
            type="date"
            size="small"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Invoice date to"
            type="date"
            size="small"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setDateFrom(bounds.minDate || "");
              setDateTo(bounds.maxDate || "");
            }}
            disabled={!bounds.minDate && !bounds.maxDate}
            sx={{ alignSelf: { xs: "flex-start", sm: "center" }, textTransform: "none", fontWeight: 700 }}
          >
            Full upload range
          </Button>
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap sx={{ mb: 2 }}>
          <Chip
            size="small"
            label={`${liftings.invoiceRows} invoice row(s)`}
            color={liftings.invoiceRows > 0 ? "primary" : "default"}
            variant="outlined"
          />
          <Chip size="small" label={`CSD PC ${liftings.totals.csdPC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`CSD UC ${liftings.totals.csdUC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`Water PC ${liftings.totals.waterPC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
          <Chip size="small" label={`Water UC ${liftings.totals.waterUC.toLocaleString()}`} sx={{ fontWeight: 700 }} />
        </Stack>

        {bounds.rowCount === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            No dispatched-order records matched this distributor yet. Achievement rows are created when shipping marks
            orders dispatched.
          </Typography>
        ) : !hasAnySku ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            {liftings.invoiceRows > 0
              ? "Invoice rows exist in this range but no CSD/Water SKU quantities were parsed (check product column names in the upload)."
              : "No invoice rows in the selected date range."}
          </Typography>
        ) : (
          <>
            <SkuTable title="CSD products" rows={liftings.csd} accent="error.main" />
            <SkuTable title="Water products" rows={liftings.water} accent="info.main" />
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              PC = physical cases from the upload. UC = unit cases (from upload or size-based conversion). Excludes cans
              and unrecognized columns. Matches Performance achieved totals when the date range covers all uploaded rows.
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
