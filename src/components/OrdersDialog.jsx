import React, { useEffect, useMemo, useState } from "react";
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
  Typography,
  Box,
  IconButton,
  useMediaQuery,
  useTheme,
  Chip,
  Tooltip,
  Alert,
  Stack,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { tableHeaderBg, tableStripeAt } from "../theme/contrastSurfaces";
import CancelIcon from "@mui/icons-material/Cancel";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import HistoryIcon from "@mui/icons-material/History";
import { partitionDistributorOrdersByDelivered } from "../utils/orderArchive";
import {
  ORDER_STATUS,
  getOrderStatusLabel,
  getOrderApprovalDueMs,
  orderHasShippingInvoice,
  getOrderShippingInvoices,
} from "../utils/orderStatus";

export default function OrdersDialog({
  open,
  onClose,
  orders,
  distributorName,
  onCancelOrder,
  cancelingOrderId,
  getOrderStatus,
  getOrderKey,
  onEditOrder,
  onOrderRowClick,
  onViewShippingInvoice,
  onDownloadShippingInvoice,
  loadingInvoiceOrderId,
  onRefreshOrders,
  ordersRefreshing = false,
  /** Distributor dashboard only — admin order UI uses OrdersSection, not this dialog. */
  hideHelpText = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [listView, setListView] = useState("active");

  useEffect(() => {
    if (!open) setListView("active");
  }, [open]);

  const { active: activeOrders, history: historyOrders } = useMemo(
    () => partitionDistributorOrdersByDelivered(orders, getOrderStatus),
    [orders, getOrderStatus]
  );

  const displayOrders = listView === "history" ? historyOrders : activeOrders;
  const isHistoryView = listView === "history";

  const invoiceOrderCount = useMemo(
    () =>
      hideHelpText
        ? 0
        : displayOrders.filter((o) => {
            const st = (getOrderStatus ? getOrderStatus(o) : o?.status || "").toLowerCase();
            const delivered = st === ORDER_STATUS.DELIVERED || st === "dispatched";
            return delivered && orderHasShippingInvoice(o);
          }).length,
    [displayOrders, getOrderStatus, hideHelpText]
  );

  const deliveredAwaitingInvoice = useMemo(
    () =>
      hideHelpText
        ? 0
        : displayOrders.filter((o) => {
            const st = (getOrderStatus ? getOrderStatus(o) : o?.status || "").toLowerCase();
            const delivered = st === ORDER_STATUS.DELIVERED || st === "dispatched";
            return delivered && !orderHasShippingInvoice(o);
          }).length,
    [displayOrders, getOrderStatus, hideHelpText]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={isMobile}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          py: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Order List — {distributorName}
          </Typography>
          {!hideHelpText ? (
            <Typography variant="caption" sx={{ opacity: 0.92, display: "block", mt: 0.5 }}>
              Tap a row for your calculated table. When dispatched, use <strong>View</strong> / <strong>Download</strong> for
              shipping documents (multiple files per order are supported).
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
          {onRefreshOrders ? (
            <Tooltip title="Refresh orders">
              <span>
                <IconButton
                  onClick={onRefreshOrders}
                  disabled={ordersRefreshing}
                  sx={{ color: "inherit" }}
                  aria-label="refresh orders"
                >
                  {ordersRefreshing ? <CircularProgress size={22} color="inherit" /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          <IconButton onClick={onClose} sx={{ color: "inherit" }} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1, sm: 2 }, mt: 1 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={listView}
          onChange={(_, v) => v && setListView(v)}
          sx={{ mb: 1.5, flexWrap: "wrap" }}
        >
          <ToggleButton value="active" sx={{ textTransform: "none", fontWeight: 800 }}>
            Active ({activeOrders.length})
          </ToggleButton>
          <ToggleButton value="history" sx={{ textTransform: "none", fontWeight: 800 }}>
            <HistoryIcon sx={{ fontSize: 18, mr: 0.5 }} />
            History ({historyOrders.length})
          </ToggleButton>
        </ToggleButtonGroup>
        {!hideHelpText ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2, fontWeight: 600 }}>
            {isHistoryView
              ? "Dispatched orders. Use View / Download for shipping invoices."
              : "In-progress orders. Cancel removes pending/sent orders from the app, browser storage, and server."}
          </Typography>
        ) : null}
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 2, mt: hideHelpText ? 0.5 : 0 }}>
          <Chip size="small" label="Pending" color="default" variant="outlined" sx={{ fontWeight: 700 }} />
          <Chip size="small" label="Approved" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
          <Chip size="small" label="Dispatched" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
        </Stack>
        {!hideHelpText && invoiceOrderCount > 0 ? (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            {invoiceOrderCount} dispatched order{invoiceOrderCount !== 1 ? "s have" : " has"} shipping invoice
            {invoiceOrderCount !== 1 ? "s" : ""}. Use the invoice column — badge shows when there are multiple files.
          </Alert>
        ) : null}
        {!hideHelpText && deliveredAwaitingInvoice > 0 ? (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            {deliveredAwaitingInvoice} dispatched order{deliveredAwaitingInvoice !== 1 ? "s" : ""} without an invoice
            loaded yet. Tap <strong>Get invoice</strong> or use Refresh above.
          </Alert>
        ) : null}
        {displayOrders.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {hideHelpText
                ? "No orders found"
                : isHistoryView
                  ? "No dispatched orders in history yet."
                  : "No active orders. Dispatched orders appear under History."}
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: { xs: "70vh", sm: "60vh" }, overflow: "auto" }}>
            <Table size={isMobile ? "small" : "medium"} stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: tableHeaderBg(theme) }}>
                  <TableCell sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Order #
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Date
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    CSD PC
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    CSD UC
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Water PC
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Water UC
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Status
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Shipping invoice
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", fontSize: { xs: "0.7rem", sm: "0.875rem" }, color: "text.primary" }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayOrders.map((order, idx) => {
                  const status = (getOrderStatus ? getOrderStatus(order) : order?.status || "pending").toLowerCase();
                  const delivered =
                    status === ORDER_STATUS.DELIVERED || status === "dispatched";
                  const hasInvoice = orderHasShippingInvoice(order);
                  const invoiceFiles = getOrderShippingInvoices(order);
                  const invoiceFileCount = invoiceFiles.length;
                  const orderKey = getOrderKey ? getOrderKey(order) : idx;
                  const invoiceBusy = loadingInvoiceOrderId === orderKey;

                  return (
                    <TableRow
                      key={orderKey}
                      hover
                      onClick={() => onOrderRowClick && onOrderRowClick(order)}
                      sx={{
                        bgcolor: tableStripeAt(theme, idx),
                        color: "text.primary",
                        "&:hover": {
                          bgcolor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.primary.main, 0.12)
                              : alpha(theme.palette.primary.main, 0.06),
                        },
                        ...(onOrderRowClick ? { cursor: "pointer" } : {}),
                      }}
                    >
                      <TableCell sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.orderNumber || `#${displayOrders.length - idx}`}
                      </TableCell>
                      <TableCell sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.timestamp || order.created_at || "N/A"}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.csdPC || 0}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.csdUC ? parseFloat(order.csdUC).toFixed(2) : "0.00"}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.waterPC || 0}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, fontWeight: 700, color: "text.primary" }}>
                        {order.waterUC ? parseFloat(order.waterUC).toFixed(2) : "0.00"}
                      </TableCell>
                      <TableCell align="center" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, color: "text.primary" }}>
                        {(() => {
                          const color =
                            status === ORDER_STATUS.APPROVED
                              ? "success"
                              : status === ORDER_STATUS.DELIVERED
                              ? "primary"
                              : status === ORDER_STATUS.REJECTED
                              ? "error"
                              : status === ORDER_STATUS.CANCELED
                              ? "warning"
                              : status === ORDER_STATUS.PENDING_EMAIL_FAILED
                              ? "warning"
                              : status === ORDER_STATUS.SENT
                              ? "info"
                              : "default";
                          const approvalDueMs =
                            status === ORDER_STATUS.SENT ? getOrderApprovalDueMs(order) : null;
                          const overdue =
                            approvalDueMs != null && Date.now() > approvalDueMs;
                          return (
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5, flexWrap: "wrap" }}>
                              <Chip
                                label={getOrderStatusLabel(status)}
                                size="small"
                                color={color}
                                sx={{ fontWeight: 600 }}
                              />
                              {overdue && (
                                <Chip label="Overdue" size="small" color="error" variant="outlined" sx={{ fontWeight: 700 }} />
                              )}
                            </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        {hasInvoice ? (
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: 0.25,
                              flexWrap: "wrap",
                            }}
                          >
                            {invoiceFileCount > 1 ? (
                              <Chip
                                label={`${invoiceFileCount} files`}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.65rem", fontWeight: 800 }}
                              />
                            ) : null}
                            <Tooltip
                              title={
                                invoiceFileCount > 1
                                  ? `View ${invoiceFileCount} invoice files`
                                  : "View shipping invoice"
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  disabled={invoiceBusy}
                                  onClick={() => onViewShippingInvoice && onViewShippingInvoice(order)}
                                >
                                  <VisibilityIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip
                              title={
                                invoiceFileCount > 1
                                  ? `Download all ${invoiceFileCount} files`
                                  : "Download shipping invoice"
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  disabled={invoiceBusy}
                                  onClick={() => onDownloadShippingInvoice && onDownloadShippingInvoice(order)}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        ) : delivered ? (
                          <Tooltip title="Shipping has not attached an invoice yet, or tap View to load from server">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={invoiceBusy || !onViewShippingInvoice}
                                onClick={() => onViewShippingInvoice && onViewShippingInvoice(order)}
                                sx={{ textTransform: "none", fontSize: "0.7rem" }}
                              >
                                Get invoice
                              </Button>
                            </span>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const cancellable =
                            !isHistoryView &&
                            (status === ORDER_STATUS.PENDING ||
                              status === ORDER_STATUS.SENT ||
                              status === ORDER_STATUS.PENDING_EMAIL_FAILED);
                          const orderId = order?.id || order?.orderNumber || orderKey;
                          const editable =
                            !isHistoryView &&
                            status !== ORDER_STATUS.APPROVED &&
                            status !== ORDER_STATUS.DELIVERED &&
                            status !== "dispatched";
                          if (isHistoryView) {
                            return (
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Dispatched
                              </Typography>
                            );
                          }
                          return (
                            <>
                              <Tooltip title={cancellable ? "Cancel and delete this order" : "Only pending/sent orders can be canceled"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="warning"
                                    disabled={!cancellable || !onCancelOrder || cancelingOrderId === orderId}
                                    onClick={() => onCancelOrder && onCancelOrder(order)}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={editable ? "Edit and resubmit" : "Cannot edit this order"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={!editable || !onEditOrder}
                                    onClick={() => onEditOrder && onEditOrder(order)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
