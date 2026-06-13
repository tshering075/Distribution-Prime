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
  Tabs,
  Tab,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Slide,
  CircularProgress,
  Alert,
  Badge,
  Drawer,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Tooltip,
  Fab,
  useMediaQuery,
  Checkbox,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PrintIcon from "@mui/icons-material/Print";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PhoneIcon from "@mui/icons-material/Phone";
import BadgeIcon from "@mui/icons-material/Badge";
import { buildCalculatorSkus, num } from "../utils/orderLineCalculation";
import {
  localIsoDate,
  normalizePhysicalStockPayload,
  resolvePhysicalStockProductLines,
} from "../utils/physicalStockTemplate";
import {
  appendPosSaleAsync,
  clearHeldPosSale,
  deletePosSaleAsync,
  readPosSales,
  syncPosSalesFromSupabase,
  computePosGstAmount,
  readHeldPosSale,
  aggregatePosSalesByProduct,
  filterPosSalesByDateRange,
  resolvePosGstRate,
  saleGrandTotal,
  saveHeldPosSale,
  sumPosItemCount,
  sumPosSalesByPayment,
  sumPosSalesTotal,
} from "../utils/posSaleStorage";
import {
  buildDispatchedInboundMap,
  buildStockAvailabilityMap,
  deductStockForPosSale,
  getPhysicalStockRowsFromDistributor,
  lineItemsForStockRestore,
  mergeDispatchedInboundIntoAvailability,
  restoreStockFromPosSale,
} from "../utils/posStock";
import {
  buildDispatchedInboundBySku,
  buildDispatchedOrderCards,
  getDeliveredOrdersForDistributor,
} from "../utils/posDispatchedStock";
import {
  upsertDistributorPhysicalStockSnapshot,
} from "../services/supabaseService";
import { getDistributors, saveDistributors } from "../utils/distributorAuth";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import {
  applyPosRatesToSkus,
  resolvePosSettings,
} from "../utils/posSettingsStorage";
import DistributorPosSettingsDialog from "./DistributorPosSettingsDialog";
import { POS_PRINT_TYPES, printPosSaleDocument } from "../utils/posSalePrint";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", short: "Cash" },
  { value: "mobile", label: "Mobile / QR", short: "QR" },
  { value: "credit", label: "Credit", short: "Credit" },
];

const CATEGORY_COLORS = {
  CSD: "#e53935",
  CAN: "#fb8c00",
  Water: "#1e88e5",
};

const LOW_STOCK_THRESHOLD = 5;

function formatNu(amount) {
  return `Nu. ${num(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function paymentLabel(value) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || value;
}

function InvoiceDetailRow({ label, value, sx }) {
  if (value == null || value === "") return null;
  return (
    <Stack direction="row" spacing={1} sx={{ py: 0.35, ...sx }}>
      <Typography
        variant="body2"
        sx={{ minWidth: 108, fontWeight: 700, color: "text.secondary", flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ flex: 1, textAlign: "right", wordBreak: "break-word" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function InvoiceTotalRow({ label, value, emphasize, deduct, sx }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ width: "100%", ...sx }}>
      <Typography
        variant={emphasize ? "subtitle1" : "body2"}
        sx={{
          fontWeight: emphasize ? 800 : 600,
          color: deduct ? "success.main" : "text.secondary",
          textAlign: "left",
          flex: 1,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant={emphasize ? "subtitle1" : "body2"}
        sx={{
          fontWeight: emphasize ? 900 : 700,
          color: emphasize ? "primary.main" : deduct ? "success.main" : "text.primary",
          minWidth: 96,
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function InvoiceLineItemsTable({ lines }) {
  return (
    <Table
      size="small"
      sx={{
        "& .MuiTableCell-root": {
          borderBottom: "1px solid",
          borderColor: "divider",
          py: 0.75,
          px: 0.5,
          verticalAlign: "top",
        },
        "& .MuiTableCell-root:first-of-type": { pl: 0 },
        "& .MuiTableCell-root:last-of-type": { pr: 0 },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 800, fontSize: "0.7rem", color: "text.secondary" }}>Product</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800, fontSize: "0.7rem", color: "text.secondary", width: 44 }}>
            Qty
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.7rem", color: "text.secondary", width: 76 }}>
            Rate
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 800, fontSize: "0.7rem", color: "text.secondary", width: 84 }}>
            Amount
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {(lines || []).map((line) => (
          <TableRow key={line.sku}>
            <TableCell sx={{ fontWeight: 600, fontSize: "0.8125rem", lineHeight: 1.35 }}>{line.name}</TableCell>
            <TableCell align="center" sx={{ fontSize: "0.8125rem" }}>
              {line.qty}
            </TableCell>
            <TableCell align="right" sx={{ fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
              {formatNu(line.rate)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
              {formatNu(line.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InvoiceTotalsBlock({ sale }) {
  const gstRatePct = Math.round((Number(sale.gstRate) || 0.05) * 100);
  return (
    <Box sx={{ mt: 1.5, pt: 1.25, borderTop: 1, borderColor: "divider", width: "100%" }}>
      <Box sx={{ width: "100%" }}>
        <InvoiceTotalRow label="Subtotal" value={formatNu(sale.subtotal)} />
        {sale.discountAmount > 0 ? (
          <InvoiceTotalRow label="Discount" value={`− ${formatNu(sale.discountAmount)}`} deduct sx={{ mt: 0.5 }} />
        ) : null}
        {Number(sale.gstAmount) > 0 ? (
          <InvoiceTotalRow label={`GST (${gstRatePct}%)`} value={formatNu(sale.gstAmount)} sx={{ mt: 0.5 }} />
        ) : null}
        <InvoiceTotalRow label="Total" value={formatNu(saleGrandTotal(sale))} emphasize sx={{ mt: 0.75 }} />
        {sale.changeGiven > 0 ? (
          <InvoiceTotalRow label="Change given" value={formatNu(sale.changeGiven)} sx={{ mt: 0.5 }} />
        ) : null}
      </Box>
    </Box>
  );
}

function resolveDistributorProfile(distributor, distributorName) {
  return {
    businessName: String(distributor?.name || distributorName || "").trim(),
    address: String(distributor?.address || "").trim(),
    gstin: String(distributor?.gstin ?? distributor?.gstinNo ?? distributor?.gstin_no ?? "").trim(),
    tpn: String(distributor?.tpn ?? distributor?.tpnNo ?? distributor?.tpn_no ?? "").trim(),
    phone: String(distributor?.phone || "").trim(),
  };
}

function InvoiceHeaderBlock({ profile, invoiceNumber, saleNumber, createdAt, documentType = "receipt", sx }) {
  const name = profile?.businessName || profile?.distributorName || "Distributor";
  const address = profile?.address || profile?.distributorAddress || "";
  const gstin = profile?.gstin || profile?.distributorGstin || "";
  const isInvoice = documentType === "invoice";

  return (
    <Box sx={{ textAlign: "center", mb: 2, ...sx }}>
      <Typography
        variant="overline"
        sx={{ fontWeight: 900, letterSpacing: 1.6, color: "text.secondary", display: "block", mb: 0.75 }}
      >
        {isInvoice ? "Tax Invoice" : "Receipt"}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.3 }}>
        {name}
      </Typography>
      {address ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.5 }}>
          {address}
        </Typography>
      ) : null}
      {gstin ? (
        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mt: 0.5 }}>
          GSTIN: {gstin}
        </Typography>
      ) : null}
      {isInvoice && invoiceNumber ? (
        <Typography variant="body2" sx={{ fontWeight: 900, display: "block", mt: 1.25, letterSpacing: 0.3 }}>
          Invoice No.: {invoiceNumber}
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        {[saleNumber ? `Sale ${saleNumber}` : null, createdAt ? formatTime(createdAt) : null]
          .filter(Boolean)
          .join(" · ")}
      </Typography>
    </Box>
  );
}

function computeDiscount(subtotal, discountType, discountValue) {
  const base = num(subtotal);
  const value = Math.max(0, num(discountValue));
  if (discountType === "percent") {
    const pct = Math.min(100, value);
    return Math.min(base, (base * pct) / 100);
  }
  if (discountType === "fixed") {
    return Math.min(base, value);
  }
  return 0;
}

function StatCard({ label, value, sub, accent }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2.5,
        flex: 1,
        minWidth: 120,
        bgcolor: alpha(accent || theme.palette.primary.main, 0.06),
        borderColor: alpha(accent || theme.palette.primary.main, 0.2),
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2, mt: 0.25 }}>
        {value}
      </Typography>
      {sub ? (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      ) : null}
    </Paper>
  );
}

function PosSectionHeader({ title, subtitle, action }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{ fontWeight: 800, letterSpacing: 1.1, color: "text.secondary", lineHeight: 1.2, display: "block" }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action || null}
    </Stack>
  );
}

function PosKpiStrip({ todayTotal, todayCount, todayItems }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      square
      sx={{
        flexShrink: 0,
        px: { xs: 1.5, sm: 2.5 },
        py: 1.25,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(3, 1fr)", md: "repeat(3, minmax(0, 200px))" },
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Today&apos;s sales
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
            {formatNu(todayTotal)}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Transactions
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
            {todayCount}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Cases sold
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
            {todayItems}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function PosPanel({ children, sx }) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function PosHeader({ distributorProfile, distributorCode, onClose, onOpenSettings }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        background: (t) =>
          `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
        color: "#fff",
        px: { xs: 1.5, sm: 2.5 },
        py: { xs: 1.25, sm: 1.5 },
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        boxShadow: "0 4px 12px rgba(198, 40, 40, 0.35)",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2.5,
          bgcolor: "rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <PointOfSaleIcon sx={{ fontSize: 28 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, fontSize: { xs: "1.1rem", sm: "1.3rem" } }}>
          Point of Sale
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.95, fontWeight: 600, mt: 0.15 }} noWrap>
          {distributorProfile?.businessName || distributorCode}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.85, display: "block" }} noWrap>
          {[distributorProfile?.gstin ? `GSTIN ${distributorProfile.gstin}` : null, distributorCode]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
      </Box>
      <Tooltip title="POS rates, discount & GST">
        <IconButton onClick={onOpenSettings} sx={{ color: "inherit" }} aria-label="POS settings" size="large">
          <SettingsIcon />
        </IconButton>
      </Tooltip>
      <IconButton onClick={onClose} sx={{ color: "inherit" }} aria-label="Close POS" size="large">
        <CloseIcon />
      </IconButton>
    </Box>
  );
}

function ProductCatalogueRow({ sku, stock, inCartQty, accent, onAdd, onSetQty, disabled, isMobile }) {
  const outOfStock = stock !== null && stock <= 0;
  const lowStock = stock !== null && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  const atMax = stock !== null && inCartQty >= stock;

  return (
    <TableRow
      hover
      sx={{
        opacity: disabled || outOfStock ? 0.55 : 1,
        bgcolor: inCartQty > 0 ? alpha(accent, 0.06) : undefined,
        "& td": { py: 0.5, borderColor: "divider" },
      }}
    >
      <TableCell sx={{ pl: 1.5, maxWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 3,
              alignSelf: "stretch",
              borderRadius: 1,
              bgcolor: accent,
              flexShrink: 0,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.3 }} noWrap>
              {sku.name}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="caption" sx={{ fontWeight: 700, color: accent, fontSize: "0.65rem" }}>
                {sku.category}
              </Typography>
              {outOfStock ? (
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 700, fontSize: "0.65rem" }}>
                  Out
                </Typography>
              ) : lowStock ? (
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700, fontSize: "0.65rem" }}>
                  Low
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap", width: 88 }}>
        <Typography variant="body2" sx={{ fontWeight: 800, color: "primary.main", fontSize: "0.8125rem" }}>
          {formatNu(sku.rate)}
        </Typography>
        {sku.hasCustomRate && sku.catalogRate != null ? (
          <Typography variant="caption" color="text.secondary" sx={{ textDecoration: "line-through", fontSize: "0.65rem" }}>
            {formatNu(sku.catalogRate)}
          </Typography>
        ) : null}
      </TableCell>
      <TableCell align="center" sx={{ width: 52, fontWeight: 700, fontSize: "0.8125rem" }}>
        {stock == null ? "—" : stock}
      </TableCell>
      {!isMobile ? (
        <TableCell align="center" sx={{ width: 44, fontSize: "0.75rem", color: "text.secondary" }}>
          {inCartQty > 0 ? (
            <Chip label={inCartQty} size="small" color="primary" sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800 }} />
          ) : (
            "—"
          )}
        </TableCell>
      ) : null}
      <TableCell align="right" sx={{ width: isMobile ? 132 : 148, pr: 1.5 }}>
        <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
          <IconButton
            size="small"
            disabled={disabled || outOfStock || inCartQty <= 0}
            onClick={() => onSetQty(sku, inCartQty - 1)}
            sx={{ width: 28, height: 28 }}
          >
            <RemoveIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <TextField
            size="small"
            value={inCartQty || ""}
            placeholder="0"
            disabled={disabled || outOfStock}
            onChange={(e) => onSetQty(sku, e.target.value)}
            inputProps={{
              inputMode: "numeric",
              style: { textAlign: "center", padding: "4px 2px", fontWeight: 800, fontSize: 12 },
            }}
            sx={{ width: 40, "& .MuiOutlinedInput-root": { height: 28 } }}
          />
          <IconButton
            size="small"
            disabled={disabled || outOfStock || atMax}
            onClick={() => onAdd(sku)}
            sx={{ width: 28, height: 28 }}
          >
            <AddIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <Button
            size="small"
            variant="contained"
            disabled={disabled || outOfStock}
            onClick={() => onAdd(sku)}
            sx={{
              minWidth: 0,
              px: 1,
              height: 28,
              fontWeight: 800,
              fontSize: "0.75rem",
              textTransform: "none",
              boxShadow: "none",
            }}
          >
            Add
          </Button>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function ProductCatalogueTable({ skus, getStockForSku, cartQtyMap, onAdd, onSetQty, theme, isMobile }) {
  return (
    <TableContainer
      sx={{
        flex: 1,
        minHeight: 0,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        overflow: "auto",
      }}
    >
      <Table size="small" stickyHeader sx={{ tableLayout: "fixed", minWidth: isMobile ? 420 : 520 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 800, fontSize: "0.7rem", py: 0.75, bgcolor: "background.paper" }}>
              Product
            </TableCell>
            <TableCell
              align="right"
              sx={{ fontWeight: 800, fontSize: "0.7rem", py: 0.75, width: 88, bgcolor: "background.paper" }}
            >
              Rate
            </TableCell>
            <TableCell
              align="center"
              sx={{ fontWeight: 800, fontSize: "0.7rem", py: 0.75, width: 52, bgcolor: "background.paper" }}
            >
              Avail
            </TableCell>
            {!isMobile ? (
              <TableCell
                align="center"
                sx={{ fontWeight: 800, fontSize: "0.7rem", py: 0.75, width: 44, bgcolor: "background.paper" }}
              >
                Cart
              </TableCell>
            ) : null}
            <TableCell
              align="right"
              sx={{ fontWeight: 800, fontSize: "0.7rem", py: 0.75, width: 148, bgcolor: "background.paper", pr: 1.5 }}
            >
              Qty
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {skus.map((sku) => {
            const stock = getStockForSku(sku.name);
            const accent = CATEGORY_COLORS[sku.category] || theme.palette.primary.main;
            return (
              <ProductCatalogueRow
                key={sku.name}
                sku={sku}
                stock={stock}
                inCartQty={cartQtyMap.get(sku.name) || 0}
                accent={accent}
                onAdd={onAdd}
                onSetQty={onSetQty}
                disabled={num(sku.rate) <= 0}
                isMobile={isMobile}
              />
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CartPanel({
  cart,
  cartSubtotal,
  discountAmount,
  gstAmount,
  gstRate,
  cartTotal,
  paymentMethod,
  setPaymentMethod,
  customerName,
  setCustomerName,
  customerMobile,
  setCustomerMobile,
  customerGstin,
  setCustomerGstin,
  customerTpn,
  setCustomerTpn,
  note,
  setNote,
  amountTendered,
  setAmountTendered,
  completing,
  heldSale,
  onOpenSettings,
  onClear,
  onHold,
  onResume,
  onSetCartQty,
  onComplete,
}) {
  const theme = useTheme();
  const changeDue =
    paymentMethod === "cash" && amountTendered !== ""
      ? Math.max(0, num(amountTendered) - cartTotal)
      : null;
  const tenderShort =
    paymentMethod === "cash" && amountTendered !== "" && num(amountTendered) < cartTotal;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        maxHeight: "100%",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <PosSectionHeader
          title="Current sale"
          subtitle={`${cart.length} lines · ${cart.reduce((s, l) => s + l.qty, 0)} cases · records secondary sale`}
          action={
            <Stack direction="row" spacing={0.25}>
              {heldSale ? (
                <Tooltip title="Resume held sale">
                  <IconButton size="small" color="primary" onClick={onResume}>
                    <PlayCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              <Tooltip title="Hold sale">
                <span>
                  <IconButton size="small" onClick={onHold} disabled={cart.length === 0}>
                    <PauseCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Clear cart">
                <span>
                  <IconButton size="small" color="error" onClick={onClear} disabled={cart.length === 0}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          }
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          px: 2,
          py: 1.5,
        }}
      >
        {cart.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 3, opacity: 0.7 }}>
            <ShoppingCartIcon sx={{ fontSize: 48, mb: 1, color: "text.disabled" }} />
            <Typography variant="body2" color="text.secondary" align="center">
              Add products from the catalogue or resume a held sale.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {cart.map((line) => (
              <Paper key={line.sku} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ minWidth: 0, pr: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {line.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatNu(line.rate)} / case
                    </Typography>
                  </Box>
                  <IconButton size="small" color="error" onClick={() => onSetCartQty(line.sku, 0)} aria-label="Remove">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <IconButton size="small" onClick={() => onSetCartQty(line.sku, line.qty - 1)}>
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ fontWeight: 800, minWidth: 28, textAlign: "center" }}>{line.qty}</Typography>
                    <IconButton size="small" onClick={() => onSetCartQty(line.sku, line.qty + 1)}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography sx={{ fontWeight: 800 }}>{formatNu(line.rate * line.qty)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 1.5, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
        <PosSectionHeader
          title="Payment"
          subtitle="Discount & GST are set in POS settings"
          action={
            <Button size="small" onClick={onOpenSettings} sx={{ textTransform: "none", fontWeight: 700, minWidth: 0 }}>
              Settings
            </Button>
          }
        />
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={paymentMethod}
          onChange={(_, v) => v && setPaymentMethod(v)}
        >
          {PAYMENT_METHODS.map((m) => (
            <ToggleButton key={m.value} value={m.value} sx={{ fontWeight: 700, textTransform: "none", flex: 1 }}>
              {m.short}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 1.5, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
        <PosSectionHeader title="Customer" subtitle="Optional billing details" />
        <TextField
          fullWidth
          size="small"
          label="Customer name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          sx={{ mb: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Mobile no."
          value={customerMobile}
          onChange={(e) => setCustomerMobile(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Customer GSTIN"
          value={customerGstin}
          onChange={(e) => setCustomerGstin(e.target.value)}
          sx={{ mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BadgeIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Customer TPN No."
          value={customerTpn}
          onChange={(e) => setCustomerTpn(e.target.value)}
          sx={{ mb: 1 }}
          placeholder="Tax payer number"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <BadgeIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          sx={{ mb: 1 }}
        />

        {paymentMethod === "cash" && cart.length > 0 ? (
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Amount received"
            value={amountTendered}
            onChange={(e) => setAmountTendered(e.target.value)}
            error={tenderShort}
            helperText={
              tenderShort
                ? `Short by ${formatNu(cartTotal - num(amountTendered))}`
                : changeDue != null && num(amountTendered) >= cartTotal
                  ? `Change: ${formatNu(changeDue)}`
                  : " "
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PaymentsOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        ) : null}
        </Paper>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          p: 2,
          pt: 1.5,
          pb: { xs: "max(16px, env(safe-area-inset-bottom))", sm: 2 },
          borderTop: 2,
          borderColor: "divider",
          bgcolor: "background.paper",
          boxShadow: (t) => `0 -10px 28px ${alpha(t.palette.common.black, 0.12)}`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Subtotal
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {formatNu(cartSubtotal)}
          </Typography>
        </Stack>
        {discountAmount > 0 ? (
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" color="success.main">
              Discount
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "success.main" }}>
              − {formatNu(discountAmount)}
            </Typography>
          </Stack>
        ) : null}
        {gstAmount > 0 ? (
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              GST ({Math.round((gstRate || 0) * 100)}%)
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {formatNu(gstAmount)}
            </Typography>
          </Stack>
        ) : null}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Total
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 900, color: "primary.main" }}>
            {formatNu(cartTotal)}
          </Typography>
        </Stack>
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={
            cart.length === 0 ||
            completing ||
            (paymentMethod === "cash" && amountTendered !== "" && num(amountTendered) < cartTotal)
          }
          onClick={onComplete}
          startIcon={completing ? <CircularProgress size={18} color="inherit" /> : <PointOfSaleIcon />}
          sx={{
            fontWeight: 800,
            py: 1.5,
            borderRadius: 2,
            textTransform: "none",
            fontSize: "1rem",
            boxShadow: (t) => `0 4px 14px ${alpha(t.palette.primary.main, 0.35)}`,
          }}
        >
          {completing ? "Processing…" : "Complete sale"}
        </Button>
        {paymentMethod === "cash" && cart.length > 0 && amountTendered !== "" && num(amountTendered) < cartTotal ? (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75, textAlign: "center" }}>
            Amount received is less than total — adjust cash or change payment method
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function ReceiptDialog({ open, sale, distributorProfile, onClose, onNewSale }) {
  const [printType, setPrintType] = useState(POS_PRINT_TYPES.receipt);

  useEffect(() => {
    if (open) setPrintType(POS_PRINT_TYPES.receipt);
  }, [open, sale?.id]);

  if (!sale) return null;

  const profile = {
    businessName: sale.distributorName || distributorProfile?.businessName,
    address: sale.distributorAddress || distributorProfile?.address,
    gstin: sale.distributorGstin || distributorProfile?.gstin,
    tpn: distributorProfile?.tpn,
  };

  const handlePrint = () => {
    printPosSaleDocument(sale, profile, printType);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <Box sx={{ p: 2.5 }}>
        <InvoiceHeaderBlock
          profile={profile}
          invoiceNumber={sale.invoiceNumber}
          saleNumber={sale.saleNumber}
          createdAt={sale.createdAt}
          documentType={printType}
        />

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, mb: 2 }}>
          <InvoiceLineItemsTable lines={sale.lines} />
          <InvoiceTotalsBlock sale={sale} />
          <Box sx={{ mt: 1.5, pt: 1.25, borderTop: 1, borderColor: "divider" }}>
            <InvoiceDetailRow label="Payment" value={paymentLabel(sale.paymentMethod)} />
            <InvoiceDetailRow label="Customer" value={sale.customerName} />
            <InvoiceDetailRow label="Mobile" value={sale.customerMobile} />
            <InvoiceDetailRow label="Customer GSTIN" value={sale.customerGstin} />
            <InvoiceDetailRow label="Customer TPN" value={sale.customerTpn} />
          </Box>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
          Print as
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={printType}
          onChange={(_, next) => {
            if (next) setPrintType(next);
          }}
          sx={{ mb: 1.5 }}
        >
          <ToggleButton value={POS_PRINT_TYPES.receipt} sx={{ textTransform: "none", fontWeight: 700 }}>
            Receipt
          </ToggleButton>
          <ToggleButton value={POS_PRINT_TYPES.invoice} sx={{ textTransform: "none", fontWeight: 700 }}>
            Invoice
          </ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} sx={{ flex: 1, textTransform: "none", fontWeight: 700 }}>
            Print {printType === POS_PRINT_TYPES.invoice ? "invoice" : "receipt"}
          </Button>
          <Button variant="contained" onClick={onNewSale} sx={{ flex: 1, textTransform: "none", fontWeight: 700 }}>
            New sale
          </Button>
        </Stack>
        <Button fullWidth onClick={onClose} sx={{ mt: 1, textTransform: "none" }}>
          Close
        </Button>
      </Box>
    </Dialog>
  );
}

function DispatchedTab({ dispatchedCards, inboundBySku, onSellSku }) {
  const theme = useTheme();
  const totalInbound = Array.from(inboundBySku?.values() || []).reduce((s, row) => s + (row.qty || 0), 0);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        p: { xs: 1.5, md: 2 },
        bgcolor: (t) => alpha(t.palette.grey[500], 0.04),
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 1.5 }}>
        <PosSectionHeader title="Dispatch inbound" subtitle="Stock received from shipped orders" />
      </Box>
      <Alert severity="info" icon={<LocalShippingIcon />} sx={{ borderRadius: 2, mb: 2 }}>
        Dispatched orders add to <strong>primary sale</strong> in physical stock. POS retail sales reduce{" "}
        <strong>physical stock</strong> and increase <strong>secondary sale</strong> automatically.
      </Alert>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
          gap: 1.25,
          mb: 2,
        }}
      >
        <StatCard
          label="Dispatched orders"
          value={dispatchedCards.length}
          sub="ready for retail"
          accent={theme.palette.info.main}
        />
        <StatCard
          label="Inbound cases"
          value={totalInbound}
          sub="from all dispatches"
          accent={theme.palette.success.main}
        />
        <StatCard
          label="SKU lines"
          value={inboundBySku?.size || 0}
          sub="with dispatch qty"
          accent={theme.palette.warning.main}
        />
      </Box>

      {inboundBySku?.size > 0 ? (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            Available from dispatches (by product)
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {Array.from(inboundBySku.values()).map((row) => (
              <Chip
                key={row.sku}
                label={`${row.sku}: ${row.qty} cs`}
                onClick={() => onSellSku?.(row.sku)}
                clickable={Boolean(onSellSku)}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Stack>
        </Paper>
      ) : null}

      {dispatchedCards.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          No dispatched orders yet. Stock from shipping will appear here once orders are marked dispatched.
        </Alert>
      ) : (
        <Stack spacing={1.25}>
          {dispatchedCards.map((card) => (
            <Paper key={card.orderId} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Order {card.orderId}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {card.deliveredLabel}
                    {card.invoiceNumber ? ` · Invoice ${card.invoiceNumber}` : ""}
                  </Typography>
                </Box>
                <Chip label={`${card.totalCases} cases`} size="small" color="primary" sx={{ fontWeight: 800 }} />
              </Stack>
              <Stack spacing={0.5}>
                {card.lines.map((line) => (
                  <Stack key={`${card.orderId}-${line.sku}`} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{line.sku}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {line.qty} cs
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
      </Box>
    </Box>
  );
}

function formatReportDate(iso) {
  const day = String(iso || "").slice(0, 10);
  if (!day) return "—";
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString();
}

function ReportsTab({
  allSales,
  reportFromDate,
  reportToDate,
  onFromDateChange,
  onToDateChange,
  reportSearch,
  onReportSearchChange,
  onViewReceipt,
}) {
  const theme = useTheme();
  const [expandedSku, setExpandedSku] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const salesInRange = useMemo(
    () => filterPosSalesByDateRange(allSales, reportFromDate, reportToDate),
    [allSales, reportFromDate, reportToDate]
  );

  const productRows = useMemo(() => aggregatePosSalesByProduct(salesInRange), [salesInRange]);

  const categories = useMemo(() => {
    const set = new Set(productRows.map((r) => r.category).filter((c) => c && c !== "—"));
    return ["All", ...Array.from(set).sort()];
  }, [productRows]);

  const filteredRows = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return productRows.filter((row) => {
      if (categoryFilter !== "All" && row.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        String(row.name).toLowerCase().includes(q) ||
        String(row.sku).toLowerCase().includes(q) ||
        String(row.category).toLowerCase().includes(q)
      );
    });
  }, [productRows, reportSearch, categoryFilter]);

  const summary = useMemo(() => {
    const totalRevenue = sumPosSalesTotal(salesInRange);
    const transactions = salesInRange.length;
    const casesSold = sumPosItemCount(salesInRange);
    const productsSold = productRows.length;
    return { totalRevenue, transactions, casesSold, productsSold };
  }, [salesInRange, productRows.length]);

  const applyPreset = (preset) => {
    const today = localIsoDate();
    if (preset === "today") {
      onFromDateChange(today);
      onToDateChange(today);
      return;
    }
    if (preset === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      onFromDateChange(localIsoDate(d));
      onToDateChange(today);
      return;
    }
    if (preset === "month") {
      const d = new Date();
      onFromDateChange(localIsoDate(new Date(d.getFullYear(), d.getMonth(), 1)));
      onToDateChange(today);
    }
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    const header = ["Product", "Category", "Qty sold", "Avg rate", "Revenue", "Sales count"];
    const lines = filteredRows.map((r) =>
      [r.name, r.category, r.qtySold, r.avgRate, r.revenue, r.saleCount]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pos-report-${reportFromDate}-to-${reportToDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const findSaleForReceipt = (saleId) => (allSales || []).find((s) => s.id === saleId);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        p: { xs: 1.5, md: 2 },
        bgcolor: (t) => alpha(t.palette.grey[500], 0.04),
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Box sx={{ mb: 1.5 }}>
          <PosSectionHeader
            title="Sales report"
            subtitle={`Product-wise · ${formatReportDate(reportFromDate)} – ${formatReportDate(reportToDate)}`}
            action={
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                disabled={filteredRows.length === 0}
                onClick={handleExportCsv}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                Export CSV
              </Button>
            }
          />
        </Box>

        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexShrink: 0 }}>
              <TextField
                size="small"
                type="date"
                label="From"
                value={reportFromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                value={reportToDate}
                onChange={(e) => onToDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
            </Stack>
            <TextField
              fullWidth
              size="small"
              placeholder="Search product, SKU, or category…"
              value={reportSearch}
              onChange={(e) => onReportSearchChange(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
            <Chip label="Today" size="small" onClick={() => applyPreset("today")} sx={{ fontWeight: 700 }} />
            <Chip label="Last 7 days" size="small" onClick={() => applyPreset("week")} sx={{ fontWeight: 700 }} />
            <Chip label="This month" size="small" onClick={() => applyPreset("month")} sx={{ fontWeight: 700 }} />
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
        </Paper>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
            gap: 1.25,
            mb: 2,
          }}
        >
          <StatCard
            label="Revenue"
            value={formatNu(summary.totalRevenue)}
            sub={`${summary.transactions} sale(s)`}
            accent={theme.palette.primary.main}
          />
          <StatCard
            label="Cases sold"
            value={summary.casesSold}
            sub="total quantity"
            accent={theme.palette.success.main}
          />
          <StatCard
            label="Products sold"
            value={summary.productsSold}
            sub="unique SKUs"
            accent={theme.palette.info.main}
          />
          <StatCard
            label="Avg. per sale"
            value={summary.transactions ? formatNu(summary.totalRevenue / summary.transactions) : "—"}
            sub="ticket size"
            accent={theme.palette.warning.main}
          />
        </Box>

        {salesInRange.length === 0 ? (
          <Alert severity="info" icon={<AssessmentIcon />} sx={{ borderRadius: 2 }}>
            No POS sales in this date range. Try widening the dates or complete sales from the <strong>Sell</strong> tab.
          </Alert>
        ) : filteredRows.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            No products match your search. Clear the search or change the category filter.
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, width: 40 }} />
                  <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Category</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    Qty sold
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    Avg rate
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    Revenue
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    In sales
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  const expanded = expandedSku === row.sku.toUpperCase();
                  const accent = CATEGORY_COLORS[row.category] || theme.palette.primary.main;
                  return (
                    <React.Fragment key={row.sku}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedSku(expanded ? null : row.sku.toUpperCase())}
                          >
                            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.category}
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
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {row.qtySold.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">{formatNu(row.avgRate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {formatNu(row.revenue)}
                        </TableCell>
                        <TableCell align="right">{row.saleCount}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} sx={{ py: 0, borderBottom: expanded ? undefined : "none" }}>
                          <Collapse in={expanded} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 1.5, pl: 5, pr: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Sale lines for {row.name}
                              </Typography>
                              <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                                {row.lines.map((line, idx) => {
                                  const sale = findSaleForReceipt(line.saleId);
                                  return (
                                    <Stack
                                      key={`${line.saleId}-${idx}`}
                                      direction="row"
                                      justifyContent="space-between"
                                      alignItems="center"
                                      flexWrap="wrap"
                                      gap={1}
                                    >
                                      <Typography variant="body2">
                                        {line.invoiceNumber} · {formatReportDate(line.createdAt)} · {line.qty} cs @{" "}
                                        {formatNu(line.rate)}
                                      </Typography>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                          {formatNu(line.amount)}
                                        </Typography>
                                        {sale ? (
                                          <Button
                                            size="small"
                                            onClick={() => onViewReceipt?.(sale)}
                                            sx={{ textTransform: "none", fontWeight: 700, minWidth: 0 }}
                                          >
                                            Receipt
                                          </Button>
                                        ) : null}
                                      </Stack>
                                    </Stack>
                                  );
                                })}
                              </Stack>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <TableCell colSpan={3} sx={{ fontWeight: 900 }}>
                    Total ({filteredRows.length} products)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>
                    {filteredRows.reduce((s, r) => s + r.qtySold, 0).toLocaleString()}
                  </TableCell>
                  <TableCell />
                  <TableCell align="right" sx={{ fontWeight: 900, color: "primary.main" }}>
                    {formatNu(filteredRows.reduce((s, r) => s + r.revenue, 0))}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}

function HistoryTab({
  todaySales,
  todayTotal,
  paymentBreakdown,
  onViewReceipt,
  onDeleteSales,
  isDeleting,
}) {
  const theme = useTheme();
  const [expandedId, setExpandedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [pendingDelete, setPendingDelete] = useState(null);
  const todayItems = sumPosItemCount(todaySales);

  const saleIds = useMemo(() => todaySales.map((s) => s.id).filter(Boolean), [todaySales]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(saleIds);
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [saleIds]);

  const selectedSales = useMemo(
    () => todaySales.filter((s) => selectedIds.has(s.id)),
    [todaySales, selectedIds]
  );

  const allSelected = saleIds.length > 0 && selectedIds.size === saleIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(saleIds));
    }
  };

  const toggleSelect = (saleId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete?.length) return;
    onDeleteSales?.(pendingDelete);
    setPendingDelete(null);
    setSelectedIds(new Set());
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        p: { xs: 1.5, md: 2 },
        bgcolor: (t) => alpha(t.palette.grey[500], 0.04),
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 1.5 }}>
        <PosSectionHeader
          title="Sales history"
          subtitle={`Today · ${localIsoDate()}`}
          action={
            selectedIds.size > 0 ? (
              <Button
                size="small"
                color="error"
                variant="contained"
                disabled={isDeleting}
                startIcon={isDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
                onClick={() => setPendingDelete(selectedSales)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                Delete {selectedIds.size} selected
              </Button>
            ) : null
          }
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
          gap: 1.25,
          mb: 2,
        }}
      >
        <StatCard label="Today's revenue" value={formatNu(todayTotal)} sub={localIsoDate()} accent={theme.palette.primary.main} />
        <StatCard label="Transactions" value={todaySales.length} sub="sales today" accent={theme.palette.info.main} />
        <StatCard label="Cases sold" value={todayItems} sub="total quantity" accent={theme.palette.success.main} />
        <StatCard
          label="Avg. ticket"
          value={todaySales.length ? formatNu(todayTotal / todaySales.length) : "—"}
          sub="per sale"
          accent={theme.palette.warning.main}
        />
      </Box>

      {Object.keys(paymentBreakdown).length > 0 ? (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {PAYMENT_METHODS.filter((m) => paymentBreakdown[m.value]).map((m) => (
            <Chip
              key={m.value}
              icon={<PaymentsOutlinedIcon />}
              label={`${m.short}: ${formatNu(paymentBreakdown[m.value])}`}
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>
      ) : null}

      {todaySales.length === 0 ? (
        <Alert severity="info" icon={<Inventory2OutlinedIcon />} sx={{ borderRadius: 2 }}>
          No POS sales recorded today yet. Complete a sale from the <strong>Sell</strong> tab.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 42 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={isDeleting || saleIds.length === 0}
                    onChange={toggleSelectAll}
                    inputProps={{ "aria-label": "Select all sales" }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 800, width: 40 }} />
                <TableCell sx={{ fontWeight: 800 }}>Invoice #</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Payment</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Amount
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todaySales.map((sale) => {
                const itemCount = (sale.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
                const expanded = expandedId === sale.id;
                const isSelected = selectedIds.has(sale.id);
                return (
                  <React.Fragment key={sale.id}>
                    <TableRow hover selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          disabled={isDeleting}
                          onChange={() => toggleSelect(sale.id)}
                          inputProps={{ "aria-label": `Select sale ${sale.invoiceNumber || sale.saleNumber}` }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedId(expanded ? null : sale.id)}>
                          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {sale.invoiceNumber || sale.saleNumber}
                        {sale.invoiceNumber ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {sale.saleNumber}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatTime(sale.createdAt)}</TableCell>
                      <TableCell>{sale.customerName || "—"}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{paymentLabel(sale.paymentMethod)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>
                        {formatNu(saleGrandTotal(sale))}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            onClick={() => onViewReceipt(sale)}
                            sx={{ textTransform: "none", fontWeight: 700, minWidth: 0 }}
                          >
                            Receipt
                          </Button>
                          <Tooltip title="Delete sale">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={isDeleting}
                                onClick={() => setPendingDelete([sale])}
                                aria-label="Delete sale"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 0, borderBottom: expanded ? undefined : "none" }}>
                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1.5, pl: 5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {itemCount} cases
                              {sale.discountAmount > 0 ? ` · Discount ${formatNu(sale.discountAmount)}` : ""}
                            </Typography>
                            <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                              {(sale.lines || []).map((l) => (
                                <Stack key={l.sku} direction="row" justifyContent="space-between">
                                  <Typography variant="body2">
                                    {l.name} × {l.qty}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {formatNu(l.amount)}
                                  </Typography>
                                </Stack>
                              ))}
                            </Stack>
                            {sale.note ? (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                Note: {sale.note}
                              </Typography>
                            ) : null}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={Boolean(pendingDelete?.length)} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            {pendingDelete?.length === 1 ? "Delete this sale?" : `Delete ${pendingDelete?.length || 0} sales?`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {pendingDelete?.length === 1
              ? `${pendingDelete[0].invoiceNumber || pendingDelete[0].saleNumber} will be removed. Stock will be restored and the record deleted from Supabase.`
              : `${pendingDelete?.length || 0} sales will be removed. Stock will be restored and all records deleted from Supabase.`}
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={() => setPendingDelete(null)} disabled={isDeleting} sx={{ textTransform: "none", fontWeight: 700 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {pendingDelete?.length === 1 ? "Delete sale" : `Delete ${pendingDelete?.length || 0} sales`}
            </Button>
          </Stack>
        </Box>
      </Dialog>
      </Box>
    </Box>
  );
}

export default function DistributorPosSaleDialog({
  open,
  onClose,
  distributorCode,
  distributorName,
  distributor,
  setDistributor,
  productRates,
  orders = [],
  gstEnabled = true,
  isSupabaseConfigured,
  showToast,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("all");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerGstin, setCustomerGstin] = useState("");
  const [customerTpn, setCustomerTpn] = useState("");
  const [note, setNote] = useState("");
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("");
  const [amountTendered, setAmountTendered] = useState("");
  const [completing, setCompleting] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [todaySales, setTodaySales] = useState([]);
  const [allPosSales, setAllPosSales] = useState([]);
  const [reportFromDate, setReportFromDate] = useState(() => localIsoDate());
  const [reportToDate, setReportToDate] = useState(() => localIsoDate());
  const [reportSearch, setReportSearch] = useState("");
  const [receiptSale, setReceiptSale] = useState(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [heldSale, setHeldSale] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [posSettingsRevision, setPosSettingsRevision] = useState(0);

  const distributorProfile = useMemo(
    () => resolveDistributorProfile(distributor, distributorName),
    [distributor, distributorName]
  );

  const posSettings = useMemo(() => {
    void posSettingsRevision;
    return resolvePosSettings(distributor, distributorCode, productRates);
  }, [distributor, distributorCode, productRates, posSettingsRevision]);

  const skus = useMemo(
    () => applyPosRatesToSkus(buildCalculatorSkus(productRates), posSettings),
    [productRates, posSettings]
  );
  const catalogSkuNames = useMemo(() => skus.map((s) => s.name), [skus]);
  const physicalRows = useMemo(
    () => getPhysicalStockRowsFromDistributor(distributor, productRates),
    [distributor, productRates]
  );

  const deliveredOrders = useMemo(
    () => getDeliveredOrdersForDistributor(orders, distributorCode),
    [orders, distributorCode]
  );

  const dispatchedCards = useMemo(
    () => buildDispatchedOrderCards(deliveredOrders, catalogSkuNames),
    [deliveredOrders, catalogSkuNames]
  );

  const inboundBySku = useMemo(
    () => buildDispatchedInboundBySku(deliveredOrders, catalogSkuNames),
    [deliveredOrders, catalogSkuNames]
  );

  const stockMap = useMemo(() => {
    const base = buildStockAvailabilityMap(physicalRows, catalogSkuNames);
    const inbound = buildDispatchedInboundMap(deliveredOrders, catalogSkuNames);
    return mergeDispatchedInboundIntoAvailability(base, inbound);
  }, [physicalRows, catalogSkuNames, deliveredOrders]);

  const categories = useMemo(() => {
    const set = new Set(skus.map((s) => s.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [skus]);

  const cartQtyMap = useMemo(() => {
    const map = new Map();
    for (const line of cart) map.set(line.sku, line.qty);
    return map;
  }, [cart]);

  const filteredSkus = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = skus.filter((s) => {
      if (categoryFilter !== "All" && s.category !== categoryFilter) return false;
      if (!q) return true;
      return String(s.name).toLowerCase().includes(q);
    });

    if (stockFilter === "in_stock") {
      list = list.filter((s) => {
        const stock = stockMap.get(String(s.name).toUpperCase());
        return stock == null || stock > 0;
      });
    } else if (stockFilter === "low") {
      list = list.filter((s) => {
        const stock = stockMap.get(String(s.name).toUpperCase());
        return stock != null && stock > 0 && stock <= LOW_STOCK_THRESHOLD;
      });
    }

    return list.sort((a, b) => {
      const sa = stockMap.get(String(a.name).toUpperCase()) ?? 9999;
      const sb = stockMap.get(String(b.name).toUpperCase()) ?? 9999;
      if (sa === 0 && sb > 0) return 1;
      if (sb === 0 && sa > 0) return -1;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [skus, search, categoryFilter, stockFilter, stockMap]);

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, line) => sum + num(line.rate) * num(line.qty), 0),
    [cart]
  );
  const discountAmount = useMemo(
    () => computeDiscount(cartSubtotal, discountType, discountValue),
    [cartSubtotal, discountType, discountValue]
  );
  const gstRate = useMemo(
    () =>
      resolvePosGstRate(
        gstEnabled && posSettings.gstEnabled !== false,
        distributorProfile.businessName || distributorName
      ),
    [gstEnabled, posSettings.gstEnabled, distributorProfile.businessName, distributorName]
  );
  const taxableTotal = useMemo(
    () => Math.max(0, cartSubtotal - discountAmount),
    [cartSubtotal, discountAmount]
  );
  const gstAmount = useMemo(
    () => computePosGstAmount(taxableTotal, gstRate),
    [taxableTotal, gstRate]
  );
  const cartTotal = useMemo(() => taxableTotal + gstAmount, [taxableTotal, gstAmount]);

  const refreshTodaySales = useCallback(async () => {
    if (!distributorCode) return;
    const today = localIsoDate();
    const cached = readPosSales(distributorCode);
    setAllPosSales(cached);
    setTodaySales(filterPosSalesByDateRange(cached, today, today));
    setHeldSale(readHeldPosSale(distributorCode));

    const merged = await syncPosSalesFromSupabase(distributorCode, isSupabaseConfigured);
    setAllPosSales(merged);
    setTodaySales(filterPosSalesByDateRange(merged, today, today));
    setHeldSale(readHeldPosSale(distributorCode));
  }, [distributorCode, isSupabaseConfigured]);

  useEffect(() => {
    if (open) {
      setTab(0);
      setSearch("");
      setCategoryFilter("All");
      setStockFilter("all");
      setCart([]);
      setPaymentMethod("cash");
      setCustomerName("");
      setCustomerMobile("");
      setCustomerGstin("");
      setCustomerTpn("");
      setNote("");
      setDiscountType(posSettings.discountType || "none");
      setDiscountValue(posSettings.discountValue > 0 ? String(posSettings.discountValue) : "");
      setAmountTendered("");
      setReceiptSale(null);
      setCartDrawerOpen(false);
      setReportFromDate(localIsoDate());
      setReportToDate(localIsoDate());
      setReportSearch("");
      refreshTodaySales();
    }
  }, [open, refreshTodaySales, posSettings.discountType, posSettings.discountValue]);

  const handlePosSettingsSaved = useCallback(
    (payload) => {
      setPosSettingsRevision((n) => n + 1);
      setDiscountType(payload.discountType || "none");
      setDiscountValue(payload.discountValue > 0 ? String(payload.discountValue) : "");
      const catalog = buildCalculatorSkus(productRates);
      setCart((prev) =>
        prev.map((line) => {
          const custom = payload.rates?.[line.sku];
          const catalogSku = catalog.find((s) => s.name === line.sku);
          const rate = custom != null ? num(custom) : num(catalogSku?.rate);
          return { ...line, rate };
        })
      );
    },
    [productRates]
  );

  const getStockForSku = (skuName) => stockMap.get(String(skuName).toUpperCase()) ?? null;

  const addToCart = (sku, qtyDelta = 1) => {
    const rate = num(sku.rate);
    if (rate <= 0) {
      showToast?.("Set a selling rate in POS settings before selling this product.", "warning", "No price");
      return;
    }
    const stock = getStockForSku(sku.name);
    const currentQty = cartQtyMap.get(sku.name) || 0;
    const nextQty = currentQty + qtyDelta;

    if (stock !== null && stock <= 0) {
      showToast?.(`${sku.name} is out of stock.`, "warning", "No stock");
      return;
    }
    if (stock !== null && nextQty > stock) {
      showToast?.(`Only ${stock} cases available for ${sku.name}.`, "warning", "Stock limit");
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.sku === sku.name);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = next[idx].qty + qtyDelta;
        if (newQty <= 0) return prev.filter((l) => l.sku !== sku.name);
        next[idx] = { ...next[idx], qty: newQty };
        return next;
      }
      if (qtyDelta <= 0) return prev;
      return [
        ...prev,
        { sku: sku.name, name: sku.name, category: sku.category, rate, qty: qtyDelta },
      ];
    });
  };

  const setCartQtyForSku = (sku, qty) => {
    const n = Math.max(0, Math.floor(Number(qty) || 0));
    const stock = getStockForSku(sku.name);
    if (stock !== null && n > stock) {
      showToast?.(`Only ${stock} cases available.`, "warning", "Stock limit");
      return;
    }
    if (n <= 0) {
      setCart((prev) => prev.filter((l) => l.sku !== sku.name));
      return;
    }
    const rate = num(sku.rate);
    if (rate <= 0) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.sku === sku.name);
      if (idx >= 0) {
        return prev.map((l) => (l.sku === sku.name ? { ...l, qty: n } : l));
      }
      return [...prev, { sku: sku.name, name: sku.name, category: sku.category, rate, qty: n }];
    });
  };

  const setCartQty = (skuName, qty) => {
    const sku = skus.find((s) => s.name === skuName);
    if (!sku) return;
    setCartQtyForSku(sku, qty);
  };

  const clearCart = () => {
    setCart([]);
    setDiscountType(posSettings.discountType || "none");
    setDiscountValue(posSettings.discountValue > 0 ? String(posSettings.discountValue) : "");
    setAmountTendered("");
  };

  const holdSale = () => {
    if (!distributorCode || cart.length === 0) return;
    const payload = {
      cart,
      paymentMethod,
      customerName,
      customerMobile,
      customerGstin,
      customerTpn,
      note,
      discountType,
      discountValue,
      heldAt: new Date().toISOString(),
    };
    if (saveHeldPosSale(distributorCode, payload)) {
      clearCart();
      setCustomerName("");
      setCustomerMobile("");
      setCustomerGstin("");
      setCustomerTpn("");
      setNote("");
      refreshTodaySales();
      showToast?.("Sale held. Resume it from the cart panel.", "info", "Sale on hold", 4000);
    }
  };

  const resumeHeldSale = () => {
    if (!heldSale?.cart?.length) return;
    setCart(heldSale.cart);
    setPaymentMethod(heldSale.paymentMethod || "cash");
    setCustomerName(heldSale.customerName || "");
    setCustomerMobile(heldSale.customerMobile || "");
    setCustomerGstin(heldSale.customerGstin || "");
    setCustomerTpn(heldSale.customerTpn || "");
    setNote(heldSale.note || "");
    setDiscountType(heldSale.discountType || "none");
    setDiscountValue(heldSale.discountValue || "");
    clearHeldPosSale(distributorCode);
    setHeldSale(null);
    showToast?.("Held sale restored to cart.", "success", "Resumed", 3000);
    if (isMobile) setCartDrawerOpen(true);
  };

  const handleDeleteSales = async (sales) => {
    const list = (sales || []).filter((s) => s?.id);
    if (!distributorCode || list.length === 0) return;

    setIsDeletingHistory(true);
    try {
      for (const sale of list) {
        await deletePosSaleAsync(distributorCode, sale.id, { isSupabaseConfigured });
      }

      let nextRows = getPhysicalStockRowsFromDistributor(distributor, productRates);
      for (const sale of list) {
        ({ rows: nextRows } = restoreStockFromPosSale(nextRows, lineItemsForStockRestore(sale)));
      }

      const productLines = resolvePhysicalStockProductLines(productRates);
      const raw = distributor?.physical_stock ?? distributor?.physicalStock ?? null;
      const reportDate = (raw && typeof raw === "object" && raw.reportDate) || localIsoDate();
      const stockPayload = normalizePhysicalStockPayload(
        { reportDate, rows: nextRows, updatedAt: new Date().toISOString() },
        productLines
      );

      await persistStock(stockPayload);

      const deletedIds = new Set(list.map((s) => s.id));
      if (receiptSale?.id && deletedIds.has(receiptSale.id)) setReceiptSale(null);
      await refreshTodaySales();

      const label =
        list.length === 1
          ? list[0].invoiceNumber || list[0].saleNumber
          : `${list.length} sales`;
      showToast?.(`${label} deleted — stock restored.`, "success", "Sale deleted", 4500);
    } catch (error) {
      console.error(error);
      showToast?.(error?.message || "Could not delete sale(s).", "error", "Delete failed");
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const sellSkuFromDispatch = (skuName) => {
    const sku = skus.find((s) => String(s.name).toUpperCase() === String(skuName).toUpperCase());
    if (!sku) {
      showToast?.("Product not found in rate catalogue.", "warning", "POS");
      return;
    }
    setTab(0);
    addToCart(sku, 1);
    if (isMobile) setCartDrawerOpen(true);
  };

  const persistStock = async (stockPayload) => {
    const list = getDistributors();
    const idx = list.findIndex((d) => d.code === distributorCode);
    if (idx >= 0) {
      list[idx] = { ...list[idx], physical_stock: stockPayload };
      saveDistributors(list);
    }
    setDistributor?.((prev) => (prev ? { ...prev, physical_stock: stockPayload } : prev));

    if (!isSupabaseConfigured || !distributorCode) return;

    try {
      const { savePhysicalStockToSupabase } = await import("../services/posSupabaseService");
      const updated = await savePhysicalStockToSupabase(distributorCode, stockPayload);
      const physical_stock = updated?.physical_stock ?? stockPayload;
      setDistributor?.((prev) => (prev ? { ...prev, ...updated, physical_stock } : prev));
      try {
        await upsertDistributorPhysicalStockSnapshot(distributorCode, stockPayload);
      } catch (snapErr) {
        console.warn("POS physical stock snapshot save failed:", snapErr);
      }
      logActivity(
        ACTIVITY_TYPES.PHYSICAL_STOCK_UPDATED,
        `POS sale updated physical stock for ${distributorName || distributorCode}`,
        { distributorCode, reportDate: stockPayload.reportDate, source: "pos" }
      );
    } catch (err) {
      console.warn("POS physical stock Supabase sync failed:", err);
      showToast?.(
        "Sale saved but physical stock may not be visible to admin until Supabase RPC is configured.",
        "warning",
        "Stock sync",
        6000
      );
    }
  };

  const handleCompleteSale = async () => {
    if (!distributorCode || cart.length === 0) return;
    setCompleting(true);
    try {
      const lines = cart.map((l) => ({
        sku: l.sku,
        name: l.name,
        category: l.category,
        qty: l.qty,
        rate: l.rate,
        amount: num(l.rate) * num(l.qty),
      }));

      const { rows: nextRows, shortages, deductions } = deductStockForPosSale(
        physicalRows,
        lines.map((l) => ({ sku: l.sku, qty: l.qty }))
      );

      const productLines = resolvePhysicalStockProductLines(productRates);
      const raw = distributor?.physical_stock ?? distributor?.physicalStock ?? null;
      const reportDate = (raw && typeof raw === "object" && raw.reportDate) || localIsoDate();
      const stockPayload = normalizePhysicalStockPayload(
        { reportDate, rows: nextRows, updatedAt: new Date().toISOString() },
        productLines
      );

      const tendered = paymentMethod === "cash" && amountTendered !== "" ? num(amountTendered) : null;
      const changeGiven = tendered != null ? Math.max(0, tendered - cartTotal) : null;

      const sale = await appendPosSaleAsync(
        distributorCode,
        {
        lines,
        stockDeductions: deductions,
        subtotal: cartSubtotal,
        discountType,
        discountValue: num(discountValue),
        discountAmount,
        taxableAmount: taxableTotal,
        gstRate,
        gstAmount,
        total: cartTotal,
        paymentMethod,
        amountTendered: tendered,
        changeGiven,
        customerName,
        customerMobile,
        customerGstin,
        customerTpn,
        note,
        distributorName: distributorProfile.businessName,
        distributorAddress: distributorProfile.address,
        distributorGstin: distributorProfile.gstin,
        },
        { isSupabaseConfigured }
      );

      await persistStock(stockPayload);
      clearHeldPosSale(distributorCode);
      setHeldSale(null);

      logActivity(
        ACTIVITY_TYPES.ORDER_CREATED,
        `POS sale ${sale.invoiceNumber || sale.saleNumber} — ${formatNu(saleGrandTotal(sale))} (${distributorName || distributorCode})`,
        { distributorCode, saleNumber: sale.saleNumber, invoiceNumber: sale.invoiceNumber }
      );

      clearCart();
      setCustomerName("");
      setCustomerMobile("");
      setCustomerGstin("");
      setCustomerTpn("");
      setNote("");
      setCartDrawerOpen(false);
      refreshTodaySales();
      setReceiptSale(sale);

      if (shortages.length > 0) {
        const names = shortages.map((s) => s.sku).join(", ");
        showToast?.(
          `Sale recorded. Stock was short for: ${names}. Update physical stock if needed.`,
          "warning",
          "Sale completed",
          6000
        );
      } else {
        showToast?.(
          `${sale.invoiceNumber || sale.saleNumber} completed — physical stock updated, secondary sale recalculated.`,
          "success",
          "Sale recorded",
          4500
        );
      }
    } catch (e) {
      console.error(e);
      showToast?.(e?.message || "Could not complete sale", "error", "POS");
    } finally {
      setCompleting(false);
    }
  };

  const todayTotal = sumPosSalesTotal(todaySales);
  const todayItems = sumPosItemCount(todaySales);
  const paymentBreakdown = sumPosSalesByPayment(todaySales);
  const cartItemCount = cart.reduce((s, l) => s + l.qty, 0);

  const cartPanelProps = {
    cart,
    cartSubtotal,
    discountAmount,
    gstAmount,
    gstRate,
    cartTotal,
    paymentMethod,
    setPaymentMethod,
    customerName,
    setCustomerName,
    customerMobile,
    setCustomerMobile,
    customerGstin,
    setCustomerGstin,
    customerTpn,
    setCustomerTpn,
    note,
    setNote,
    amountTendered,
    setAmountTendered,
    completing,
    heldSale,
    onOpenSettings: () => setSettingsOpen(true),
    onClear: clearCart,
    onHold: holdSale,
    onResume: resumeHeldSale,
    onSetCartQty: setCartQty,
    onComplete: handleCompleteSale,
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        TransitionComponent={Transition}
        TransitionProps={{ timeout: 200 }}
        PaperProps={{
          elevation: 0,
          sx: {
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            height: "100%",
            maxHeight: "100dvh",
          },
        }}
      >
        <PosHeader
          distributorProfile={distributorProfile}
          distributorCode={distributorCode}
          onClose={onClose}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {tab !== 0 ? (
          <PosKpiStrip todayTotal={todayTotal} todayCount={todaySales.length} todayItems={todayItems} />
        ) : null}

        <Paper
          elevation={0}
          square
          sx={{
            flexShrink: 0,
            px: { xs: 1.5, sm: 2.5 },
            py: tab === 0 ? 0.5 : 1,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 42,
              "& .MuiTab-root": {
                minHeight: 42,
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                mx: 0.25,
                px: { xs: 1.5, sm: 2 },
              },
              "& .Mui-selected": {
                bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              },
              "& .MuiTabs-indicator": { height: 3, borderRadius: 1.5 },
            }}
          >
            <Tab icon={<StorefrontIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Sell" />
            <Tab icon={<LocalShippingIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Dispatch (${deliveredOrders.length})`} />
            <Tab icon={<ReceiptLongIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`History (${todaySales.length})`} />
            <Tab icon={<AssessmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Reports" />
          </Tabs>
        </Paper>

        {tab === 0 ? (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              bgcolor: (t) => alpha(t.palette.grey[500], 0.04),
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: { xs: 0, md: "calc(100dvh - 132px)" },
                height: { md: "calc(100dvh - 132px)" },
                pt: 0,
                pb: { xs: 1, md: 1.5 },
                px: { xs: 1, md: 2 },
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr minmax(400px, 480px)" },
                gridTemplateRows: "1fr",
                alignItems: "start",
                gap: { xs: 0, md: 2 },
              }}
            >
              <PosPanel
                sx={{
                  height: { md: "calc(100dvh - 132px)" },
                  minHeight: { md: "calc(100dvh - 132px)" },
                  maxHeight: { md: "calc(100dvh - 132px)" },
                  alignSelf: "start",
                }}
              >
                <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
                  <PosSectionHeader
                    title="Product catalogue"
                    subtitle={`${filteredSkus.length} products available`}
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.25 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search by product name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    />
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={stockFilter}
                      onChange={(_, v) => v && setStockFilter(v)}
                      sx={{ flexShrink: 0 }}
                    >
                      <ToggleButton value="all" sx={{ fontWeight: 700, textTransform: "none", px: 1.25 }}>
                        All
                      </ToggleButton>
                      <ToggleButton value="in_stock" sx={{ fontWeight: 700, textTransform: "none", px: 1.25 }}>
                        In stock
                      </ToggleButton>
                      <ToggleButton value="low" sx={{ fontWeight: 700, textTransform: "none", px: 1.25 }}>
                        Low
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Box>

                <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
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
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    px: 1.5,
                    py: 1,
                    pb: isMobile ? 10 : 1,
                  }}
                >
                  {heldSale?.cart?.length ? (
                    <Alert
                      severity="info"
                      action={
                        <Button color="inherit" size="small" onClick={resumeHeldSale} sx={{ fontWeight: 700 }}>
                          Resume
                        </Button>
                      }
                      sx={{ mb: 1.5, borderRadius: 2 }}
                    >
                      Held sale ({heldSale.cart.length} items) from {formatTime(heldSale.heldAt || new Date().toISOString())}
                    </Alert>
                  ) : null}

                  {filteredSkus.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      No products match your filters. Check rates and physical stock with your admin.
                    </Alert>
                  ) : (
                    <ProductCatalogueTable
                      skus={filteredSkus}
                      getStockForSku={getStockForSku}
                      cartQtyMap={cartQtyMap}
                      onAdd={(s) => addToCart(s, 1)}
                      onSetQty={setCartQtyForSku}
                      theme={theme}
                      isMobile={isMobile}
                    />
                  )}
                </Box>
              </PosPanel>

              {!isMobile ? (
                <PosPanel
                  sx={{
                    boxShadow: (t) => `0 8px 32px ${alpha(t.palette.common.black, 0.06)}`,
                    width: "100%",
                    height: { md: "calc(100dvh - 132px)" },
                    minHeight: { md: "calc(100dvh - 132px)" },
                    maxHeight: { md: "calc(100dvh - 132px)" },
                    alignSelf: "start",
                  }}
                >
                  <CartPanel {...cartPanelProps} />
                </PosPanel>
              ) : null}
            </Box>

            {isMobile ? (
              <>
                <Fab
                  color="primary"
                  onClick={() => setCartDrawerOpen(true)}
                  sx={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: (t) => t.zIndex.modal + 1,
                    fontWeight: 800,
                  }}
                >
                  <Badge badgeContent={cartItemCount || null} color="error" max={99}>
                    <ShoppingCartIcon />
                  </Badge>
                </Fab>
                <Drawer
                  anchor="bottom"
                  open={cartDrawerOpen}
                  onClose={() => setCartDrawerOpen(false)}
                  PaperProps={{
                    sx: {
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                      height: { xs: "96dvh", sm: "min(96dvh, 820px)" },
                      maxHeight: "96dvh",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 4,
                      borderRadius: 2,
                      bgcolor: "divider",
                      mx: "auto",
                      mt: 1,
                      mb: 0.5,
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flex: 1, minHeight: 0, width: "100%" }}>
                    <CartPanel {...cartPanelProps} />
                  </Box>
                </Drawer>
              </>
            ) : null}
          </Box>
        ) : tab === 1 ? (
          <DispatchedTab
            dispatchedCards={dispatchedCards}
            inboundBySku={inboundBySku}
            onSellSku={sellSkuFromDispatch}
          />
        ) : tab === 2 ? (
          <HistoryTab
            todaySales={todaySales}
            todayTotal={todayTotal}
            paymentBreakdown={paymentBreakdown}
            onViewReceipt={setReceiptSale}
            onDeleteSales={handleDeleteSales}
            isDeleting={isDeletingHistory}
          />
        ) : (
          <ReportsTab
            allSales={allPosSales}
            reportFromDate={reportFromDate}
            reportToDate={reportToDate}
            onFromDateChange={setReportFromDate}
            onToDateChange={setReportToDate}
            reportSearch={reportSearch}
            onReportSearchChange={setReportSearch}
            onViewReceipt={setReceiptSale}
          />
        )}
      </Dialog>

      <ReceiptDialog
        open={Boolean(receiptSale)}
        sale={receiptSale}
        distributorProfile={distributorProfile}
        onClose={() => setReceiptSale(null)}
        onNewSale={() => {
          setReceiptSale(null);
          setTab(0);
        }}
      />

      <DistributorPosSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        distributorCode={distributorCode}
        distributorName={distributorName}
        distributor={distributor}
        setDistributor={setDistributor}
        productRates={productRates}
        globalGstEnabled={gstEnabled}
        isSupabaseConfigured={isSupabaseConfigured}
        showToast={showToast}
        onSaved={handlePosSettingsSaved}
      />
    </>
  );
}
