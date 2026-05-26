import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Tooltip,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  IconButton,
  CircularProgress,
  TextField,
  InputAdornment,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EmailIcon from "@mui/icons-material/Email";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import HistoryIcon from "@mui/icons-material/History";
import {
  ORDER_STATUS,
  getOrderStatusLabel,
  getOrderApprovalDueMs,
} from "../../../utils/orderStatus";
import {
  getOrderArchiveRetentionDays,
  setOrderArchiveRetentionDays,
  hydrateOrderArchiveRetentionDays,
  persistOrderArchiveRetentionDays,
  ORDER_ARCHIVE_RETENTION_OPTIONS,
  partitionOrdersByArchive,
} from "../../../utils/orderArchive";
import { tableHeaderBg, tableStripeAt } from "../../../theme/contrastSurfaces";

function getOrderDateKey(order) {
  const raw = order?.created_at || order?.timestamp;
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function orderMatchesSearch(order, query, getOrderId) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    order?.orderNumber,
    order?.distributorName,
    order?.distributorCode,
    order?.id,
    getOrderId ? getOrderId(order) : null,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase());
  return parts.some((p) => p.includes(q));
}

function isPendingReview(status) {
  return (
    status === ORDER_STATUS.PENDING ||
    status === ORDER_STATUS.SENT ||
    status === ORDER_STATUS.PENDING_EMAIL_FAILED
  );
}

/**
 * OrdersSection Component
 * Displays all orders in a table with actions (send email, approve, reject)
 */
function OrdersSection({
  allOrders,
  isMobile,
  sendingEmail,
  onRefresh,
  onSendEmail,
  onApprove,
  onReject,
  onDelete,
  onPreviewOrder,
  getOrderStatus,
  getOrderId,
}) {
  const theme = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [orderToDelete, setOrderToDelete] = React.useState(null);

  const handleDeleteClick = (e, order) => {
    e.stopPropagation();
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (orderToDelete && onDelete) {
      onDelete(orderToDelete);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const isOrderUpdated = (order) => {
    if (order?.isEdited || Number(order?.editedCount || 0) > 0) return true;
    if (!order?.created_at || !order?.updated_at) return false;
    const createdAtMs = Date.parse(order.created_at);
    const updatedAtMs = Date.parse(order.updated_at);
    if (Number.isNaN(createdAtMs) || Number.isNaN(updatedAtMs)) return false;
    // Ignore tiny timestamp jitter from create/update in same transaction.
    return updatedAtMs - createdAtMs > 1000;
  };

  const getUpdatedLabel = (order) => {
    const count = Number(order?.editedCount || 0);
    if (count > 1) return `Updated x${count}`;
    return "Updated";
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [queueView, setQueueView] = useState("active");
  const [retentionDays, setRetentionDays] = useState(() => getOrderArchiveRetentionDays());

  useEffect(() => {
    let cancelled = false;
    hydrateOrderArchiveRetentionDays().then((days) => {
      if (!cancelled) setRetentionDays(days);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { active: activeOrders, history: historyOrders } = useMemo(
    () => partitionOrdersByArchive(allOrders, getOrderStatus, retentionDays),
    [allOrders, getOrderStatus, retentionDays]
  );

  const queueOrders = queueView === "history" ? historyOrders : activeOrders;
  const isHistoryView = queueView === "history";

  const handleRetentionChange = async (e) => {
    const requested = Number(e.target.value);
    setRetentionDays(requested);
    try {
      const next = await persistOrderArchiveRetentionDays(requested);
      setRetentionDays(next);
    } catch (err) {
      console.warn("Could not save archive setting to server:", err);
      setRetentionDays(setOrderArchiveRetentionDays(requested));
    }
  };

  const tabCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let delivered = 0;
    queueOrders.forEach((o) => {
      const s = getOrderStatus(o);
      if (isPendingReview(s)) pending += 1;
      else if (s === ORDER_STATUS.APPROVED) approved += 1;
      else if (s === ORDER_STATUS.DELIVERED) delivered += 1;
    });
    return { pending, approved, delivered, total: queueOrders.length };
  }, [queueOrders, getOrderStatus]);

  const filteredOrders = useMemo(() => {
    let list = Array.isArray(queueOrders) ? [...queueOrders] : [];
    if (statusTab === "pending") {
      list = list.filter((o) => isPendingReview(getOrderStatus(o)));
    } else if (statusTab === "approved") {
      list = list.filter((o) => getOrderStatus(o) === ORDER_STATUS.APPROVED);
    } else if (statusTab === "delivered") {
      list = list.filter((o) => getOrderStatus(o) === ORDER_STATUS.DELIVERED);
    }
    if (dateFrom) {
      list = list.filter((o) => {
        const key = getOrderDateKey(o);
        return key && key >= dateFrom;
      });
    }
    if (dateTo) {
      list = list.filter((o) => {
        const key = getOrderDateKey(o);
        return key && key <= dateTo;
      });
    }
    if (searchQuery.trim()) {
      list = list.filter((o) => orderMatchesSearch(o, searchQuery, getOrderId));
    }
    return list.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));
  }, [queueOrders, statusTab, dateFrom, dateTo, searchQuery, getOrderStatus, getOrderId]);

  const hasActiveFilters = Boolean(searchQuery.trim() || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        mb: { xs: 1, sm: 2 },
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
          {isHistoryView ? "Order history" : "Order queue"}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 168 }}>
            <InputLabel id="archive-retention-label">Archive after</InputLabel>
            <Select
              labelId="archive-retention-label"
              label="Archive after"
              value={retentionDays}
              onChange={handleRetentionChange}
            >
              {ORDER_ARCHIVE_RETENTION_OPTIONS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d} days delivered
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={onRefresh} sx={{ fontWeight: 700, textTransform: "none" }}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={queueView}
          onChange={(_, v) => v && setQueueView(v)}
          sx={{ flexWrap: "wrap", mb: 0.5 }}
        >
          <ToggleButton value="active" sx={{ textTransform: "none", fontWeight: 700 }}>
            Active queue ({activeOrders.length})
          </ToggleButton>
          <ToggleButton value="history" sx={{ textTransform: "none", fontWeight: 700 }}>
            <HistoryIcon sx={{ fontSize: 18, mr: 0.5 }} />
            History ({historyOrders.length})
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600 }}>
          {isHistoryView
            ? `Delivered orders older than ${retentionDays} days. Records stay in the database until you delete them.`
            : `Recent and in-progress orders. Delivered orders move to History after ${retentionDays} days.`}
        </Typography>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={statusTab}
          onChange={(_, v) => v && setStatusTab(v)}
          sx={{ flexWrap: "wrap" }}
        >
          <ToggleButton value="all" sx={{ textTransform: "none", fontWeight: 700 }}>
            All ({tabCounts.total})
          </ToggleButton>
          <ToggleButton value="pending" sx={{ textTransform: "none", fontWeight: 700 }}>
            Review ({tabCounts.pending})
          </ToggleButton>
          <ToggleButton value="approved" sx={{ textTransform: "none", fontWeight: 700 }}>
            Approved ({tabCounts.approved})
          </ToggleButton>
          <ToggleButton value="delivered" sx={{ textTransform: "none", fontWeight: 700 }}>
            Delivered ({tabCounts.delivered})
          </ToggleButton>
        </ToggleButtonGroup>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Search order, distributor…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery("")} aria-label="clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
          <TextField label="From" type="date" size="small" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: { md: 150 } }} />
          <TextField label="To" type="date" size="small" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ min: dateFrom || undefined }} sx={{ minWidth: { md: 150 } }} />
          {hasActiveFilters ? (
            <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters} sx={{ alignSelf: { md: "center" }, whiteSpace: "nowrap" }}>
              Clear
            </Button>
          ) : null}
        </Stack>

        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={`Showing: ${filteredOrders.length}`} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
          {tabCounts.pending > 0 && statusTab !== "pending" ? (
            <Chip label={`${tabCounts.pending} need review`} size="small" color="warning" onClick={() => setStatusTab("pending")} sx={{ fontWeight: 700, cursor: "pointer" }} />
          ) : null}
        </Stack>
      </Stack>

      {(allOrders || []).length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <InboxOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            No orders yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Orders from distributors will appear here.
          </Typography>
        </Box>
      ) : queueOrders.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 5 }}>
          <HistoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">
            {isHistoryView
              ? `No archived orders yet. Delivered orders appear here ${retentionDays}+ days after delivery.`
              : "No orders in the active queue. Check History for older delivered orders."}
          </Typography>
        </Box>
      ) : filteredOrders.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 5 }}>
          <InboxOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            No orders match your filters
          </Typography>
          <Button size="small" variant="outlined" startIcon={<ClearIcon />} onClick={() => { clearFilters(); setStatusTab("all"); }}>
            Reset filters
          </Button>
        </Box>
      ) : (
        <TableContainer
          sx={{
            maxWidth: "100%",
            maxHeight: "calc(100vh - 380px)",
            overflow: "auto",
            borderRadius: 1.5,
            border: 1,
            borderColor: "divider",
            "&::-webkit-scrollbar": { height: 6, width: 6 },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: alpha(theme.palette.text.disabled, theme.palette.mode === "dark" ? 0.5 : 0.35),
              borderRadius: 3,
            },
          }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: { xs: 520, sm: 760, md: 820 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1, whiteSpace: "nowrap" }}>
                  Date/Time
                </TableCell>
                <TableCell sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1, whiteSpace: "nowrap" }}>
                  Distributor
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}>
                  CSD PC
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}>
                  Water PC
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}>
                  Total UC
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}>
                  Status
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order, idx) => {
                  const status = getOrderStatus(order);
                  const orderId = getOrderId(order);
                  const isSending = sendingEmail === orderId;
                  const updated = isOrderUpdated(order);
                  const approvalDueMs =
                    status === ORDER_STATUS.SENT ? getOrderApprovalDueMs(order) : null;
                  const isApprovalOverdue =
                    approvalDueMs != null && Date.now() > approvalDueMs;

                  const stripe = tableStripeAt(theme, idx);
                  const rowBorder =
                    status === ORDER_STATUS.APPROVED
                      ? theme.palette.info.main
                      : isPendingReview(status)
                      ? theme.palette.warning.main
                      : status === ORDER_STATUS.DELIVERED
                      ? theme.palette.success.main
                      : "transparent";

                  return (
                    <TableRow
                      key={orderId || idx}
                      hover
                      onClick={() => onPreviewOrder(order)}
                      sx={{
                        cursor: "pointer",
                        bgcolor: stripe,
                        borderLeft: 4,
                        borderLeftColor: rowBorder,
                        "&:hover": {
                          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.06),
                        },
                      }}
                    >
                      <TableCell sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, py: { xs: 1, sm: 1.5 } }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>
                            {order.timestamp}
                          </Typography>
                          {order.orderNumber && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "primary.main",
                                fontWeight: 600,
                                mt: 0.5,
                                fontSize: { xs: "0.65rem", sm: "0.75rem" },
                              }}
                            >
                              Order #: {order.orderNumber}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 500,
                          fontSize: { xs: "0.75rem", sm: "0.875rem" },
                          py: { xs: 1, sm: 1.5 },
                          whiteSpace: "nowrap",
                        }}
                      >
                        {order.distributorName || order.distributorCode || "Unknown"}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, py: { xs: 1, sm: 1.5 } }}
                      >
                        {(order.csdPC || 0).toLocaleString()}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" }, py: { xs: 1, sm: 1.5 } }}
                      >
                        {(order.waterPC || 0).toLocaleString()}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: 600,
                          fontSize: { xs: "0.75rem", sm: "0.875rem" },
                          py: { xs: 1, sm: 1.5 },
                        }}
                      >
                        {(order.totalUC || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="center" sx={{ py: { xs: 1, sm: 1.5 } }}>
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                          <Chip
                            label={getOrderStatusLabel(status)}
                            size={isMobile ? "small" : "medium"}
                            color={
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
                                : "default"
                            }
                            sx={{
                              fontWeight: 600,
                              fontSize: { xs: "0.65rem", sm: "0.75rem" },
                              height: { xs: 20, sm: 24 },
                            }}
                          />
                          {isApprovalOverdue && (
                            <Chip
                              label="Overdue"
                              size={isMobile ? "small" : "medium"}
                              color="error"
                              variant="outlined"
                              sx={{
                                fontWeight: 700,
                                fontSize: { xs: "0.6rem", sm: "0.72rem" },
                                height: { xs: 20, sm: 24 },
                              }}
                            />
                          )}
                          {updated && (
                            <Chip
                              label={getUpdatedLabel(order)}
                              size={isMobile ? "small" : "medium"}
                              color="secondary"
                              variant="outlined"
                              sx={{
                                fontWeight: 700,
                                fontSize: { xs: "0.6rem", sm: "0.72rem" },
                                height: { xs: 20, sm: 24 },
                              }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()} sx={{ py: { xs: 0.5, sm: 1 } }}>
                        <Box
                          sx={{
                            display: "flex",
                            gap: { xs: 0.25, sm: 0.5 },
                            justifyContent: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <Tooltip title={isHistoryView ? "Archived — open History for read-only view" : "Send Email for Approval"}>
                            <span>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSendEmail(order);
                                }}
                                disabled={
                                  isHistoryView ||
                                  isSending ||
                                  status === "canceled" ||
                                  status === "approved" ||
                                  status === "dispatched" ||
                                  status === "delivered" ||
                                  status === "rejected"
                                }
                              >
                                {isSending ? <CircularProgress size={16} /> : <EmailIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isHistoryView ? "Archived order" : "Approve Order"}>
                            <span>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onApprove(order);
                                }}
                                disabled={
                                  isHistoryView ||
                                  status === "approved" ||
                                  status === "dispatched" ||
                                  status === "delivered" ||
                                  status === "canceled"
                                }
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={isHistoryView ? "Archived order" : "Reject Order"}>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onReject(order);
                                }}
                                disabled={isHistoryView || status === "rejected" || status === "canceled"}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Permanently delete (database + local)">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => handleDeleteClick(e, order)}
                              sx={{ ml: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Order?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Permanently delete this order from Supabase and local storage? This is the only way orders are removed from the database.
            {orderToDelete && (
              <>
                <br />
                <br />
                <strong>Order Details:</strong>
                <br />
                Distributor: {orderToDelete.distributorName || orderToDelete.distributorCode || "Unknown"}
                <br />
                Date: {orderToDelete.timestamp}
                {orderToDelete.orderNumber && (
                  <>
                    <br />
                    Order #: {orderToDelete.orderNumber}
                  </>
                )}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default OrdersSection;
