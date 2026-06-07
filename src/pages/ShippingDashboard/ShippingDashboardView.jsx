import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  TextField,
  InputAdornment,
  Stack,
  Card,
  CardActionArea,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LogoutIcon from "@mui/icons-material/Logout";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PersonIcon from "@mui/icons-material/Person";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditIcon from "@mui/icons-material/Edit";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import DayNightThemeToggle from "../../components/DayNightThemeToggle";
import WorkspaceChip from "../../components/WorkspaceChip";
import SaasAppBarTitle from "../../components/saas/SaasAppBarTitle";
import { tableHeaderBg, tableStripeAt } from "../../theme/contrastSurfaces";
import {
  saasAppBarSx,
  saasAppBarToolbarSx,
  saasPageBackdropSx,
  saasContentColumnSx,
} from "../../theme/saasChrome";
import {
  ORDER_STATUS,
  getOrderStatusLabel,
  isOrderAwaitingApprovalOnShipping,
} from "../../utils/orderStatus";
import { openShippingInvoice, downloadShippingInvoice } from "../../utils/shippingInvoiceActions";

function formatOrderDate(order) {
  const raw = order?.created_at || order?.timestamp;
  if (!raw) return "—";
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InvoiceActions({
  orderId,
  isApproved,
  isDelivered,
  hasInvoice,
  invoiceCount,
  busy,
  uploadingId,
  onViewInvoices,
  onUploadFile,
  onUploadCamera,
  onEditInvoices,
  canEditInvoice,
}) {
  return (
    <Stack direction="row" spacing={0.25} justifyContent="center" alignItems="center" flexWrap="wrap">
      {hasInvoice ? (
        <Tooltip title={invoiceCount > 1 ? `View ${invoiceCount} invoice files` : "View invoice"}>
          <IconButton size="small" color="primary" onClick={onViewInvoices}>
            <Badge badgeContent={invoiceCount > 1 ? invoiceCount : 0} color="primary" invisible={invoiceCount <= 1}>
              <VisibilityIcon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
      ) : null}
      {hasInvoice && canEditInvoice ? (
        <Tooltip title="Edit or remove invoice files">
          <span>
            <IconButton size="small" color="warning" disabled={busy} onClick={onEditInvoices}>
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      {isApproved ? (
        <>
          <Tooltip title="Upload invoice files (PNG, JPG, PDF — multiple allowed)">
            <span>
              <IconButton size="small" color="primary" disabled={busy} onClick={onUploadFile}>
                {uploadingId === orderId ? <CircularProgress size={18} /> : <UploadFileIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Take photo">
            <span>
              <IconButton size="small" color="secondary" disabled={busy} onClick={onUploadCamera}>
                <PhotoCameraIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ) : null}
      {isDelivered && hasInvoice ? (
        <Chip
          label={invoiceCount > 1 ? `${invoiceCount} files` : "Attached"}
          size="small"
          color="success"
          variant="outlined"
          sx={{ height: 22, fontSize: "0.65rem" }}
        />
      ) : null}
      {isApproved && !hasInvoice ? (
        <Chip label="Required" size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: "0.65rem" }} />
      ) : null}
      {!hasInvoice && !isApproved && !isDelivered ? (
        <Typography variant="caption" color="text.disabled">
          —
        </Typography>
      ) : null}
    </Stack>
  );
}

function OrderMobileCard({
  order,
  orderId,
  status,
  statusChipColor,
  isApproved,
  isDelivered,
  hasInvoice,
  invoiceCount,
  busy,
  canClickDeliver,
  uploadingId,
  deliveringId,
  onRowClick,
  onViewInvoices,
  onUploadFile,
  onUploadCamera,
  onEditInvoices,
  onRequestDeliver,
}) {
  const theme = useTheme();
  const isIncoming = isOrderAwaitingApprovalOnShipping(status);
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderLeft: 4,
        borderLeftColor: isDelivered
          ? theme.palette.success.main
          : isApproved
            ? theme.palette.info.main
            : isIncoming
              ? theme.palette.warning.main
              : theme.palette.divider,
        overflow: "hidden",
      }}
    >
      <CardActionArea onClick={onRowClick}>
        <CardContent sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {order.orderNumber || orderId}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {order.distributorName || order.distributorCode || "—"}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {formatOrderDate(order)}
              </Typography>
            </Box>
            <Chip label={getOrderStatusLabel(status)} size="small" color={statusChipColor(status)} sx={{ fontWeight: 700 }} />
          </Stack>
          <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
            Total UC: {Number(order.totalUC ?? order.totaluc ?? 0).toFixed(2)}
          </Typography>
        </CardContent>
      </CardActionArea>
      <Divider />
      <Box sx={{ px: 1.5, py: 1, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", justifyContent: "space-between" }} onClick={(e) => e.stopPropagation()}>
        <InvoiceActions
          orderId={orderId}
          isApproved={isApproved}
          isDelivered={isDelivered}
          hasInvoice={hasInvoice}
          invoiceCount={invoiceCount}
          busy={busy}
          uploadingId={uploadingId}
          onViewInvoices={onViewInvoices}
          onUploadFile={onUploadFile}
          onUploadCamera={onUploadCamera}
          onEditInvoices={onEditInvoices}
          canEditInvoice={isApproved || isDelivered}
        />
        {isApproved ? (
          <Button
            variant={hasInvoice ? "contained" : "outlined"}
            size="small"
            color="success"
            disabled={!canClickDeliver}
            startIcon={deliveringId === orderId ? <CircularProgress size={16} color="inherit" /> : <LocalShippingIcon />}
            onClick={onRequestDeliver}
            sx={{ fontWeight: 800, textTransform: "none" }}
          >
            Dispatch
          </Button>
        ) : isDelivered ? (
          <Chip icon={<CheckCircleOutlineIcon />} label="Dispatched" size="small" color="success" variant="outlined" />
        ) : isIncoming ? (
          <Chip label="Awaiting approval" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
        ) : null}
      </Box>
    </Card>
  );
}

export default function ShippingDashboardView({
  loading,
  isMobile,
  lastRefreshedAt,
  searchQuery,
  setSearchQuery,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  hasActiveFilters,
  clearFilters,
  statusTab,
  setStatusTab,
  incomingCount,
  approvedCount,
  deliveredCount,
  sortedOrders,
  shippingRelevantOrders,
  notifications,
  notificationsOpen,
  setNotificationsOpen,
  unreadNotifications = 0,
  onNotificationsOpen,
  onNotificationsClose,
  loadOrders,
  requestLogout,
  currentUser,
  onUploadFile,
  onUploadCamera,
  onEditInvoices,
  onRequestDeliver,
  onRowClick,
  getOrderId,
  getOrderStatus,
  statusChipColor,
  orderHasShippingInvoice,
  getOrderShippingInvoices,
  uploadingId,
  deliveringId,
  deliverConfirmOrder,
  setDeliverConfirmOrder,
  deliverPendingFiles,
  setDeliverPendingFiles,
  onPickDeliverFiles,
  onConfirmDeliver,
  logoutConfirmDialog,
}) {
  const theme = useTheme();
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const [invoiceMenuAnchor, setInvoiceMenuAnchor] = useState(null);
  const [invoiceMenuList, setInvoiceMenuList] = useState([]);

  const openInvoiceMenu = (event, order) => {
    const list = getOrderShippingInvoices(order);
    if (list.length === 1) {
      openShippingInvoice(list[0]);
      return;
    }
    setInvoiceMenuList(list);
    setInvoiceMenuAnchor(event.currentTarget);
  };

  const closeInvoiceMenu = () => {
    setInvoiceMenuAnchor(null);
    setInvoiceMenuList([]);
  };

  const renderOrderRow = (order, rowIdx) => {
    const orderId = getOrderId(order);
    const status = getOrderStatus(order);
    const hasInvoice = orderHasShippingInvoice(order);
    const invoices = getOrderShippingInvoices(order);
    const invoiceCount = invoices.length;
    const isApproved = status === ORDER_STATUS.APPROVED;
    const isDelivered = status === ORDER_STATUS.DELIVERED;
    const isIncoming = isOrderAwaitingApprovalOnShipping(status);
    const busy = uploadingId === orderId || deliveringId === orderId;
    const canClickDeliver = isApproved && !busy;
    const canEditInvoice = (isApproved || isDelivered) && hasInvoice;
    const stripe = tableStripeAt(theme, rowIdx);

    const stop = (fn) => (e) => {
      e.stopPropagation();
      fn(e);
    };

    return (
      <TableRow
        key={orderId}
        hover
        onClick={() => onRowClick(order)}
        sx={{
          cursor: "pointer",
          bgcolor: stripe,
          "&:hover": { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.06) },
          borderLeft: 4,
          borderLeftColor: isDelivered
            ? "success.main"
            : isApproved
              ? "info.main"
              : isIncoming
                ? "warning.main"
                : "transparent",
        }}
      >
        <TableCell sx={{ fontWeight: 800, fontSize: "0.8rem" }}>{order.orderNumber || orderId}</TableCell>
        <TableCell sx={{ fontSize: "0.8rem", maxWidth: 160 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {order.distributorName || order.distributorCode || "—"}
          </Typography>
          {order.distributorCode && order.distributorName ? (
            <Typography variant="caption" color="text.secondary">
              {order.distributorCode}
            </Typography>
          ) : null}
        </TableCell>
        <TableCell sx={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{formatOrderDate(order)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
          {Number(order.totalUC ?? order.totaluc ?? 0).toFixed(2)}
        </TableCell>
        <TableCell align="center">
          <Chip label={getOrderStatusLabel(status)} size="small" color={statusChipColor(status)} sx={{ fontWeight: 700 }} />
        </TableCell>
        <TableCell align="center" onClick={stop(() => {})}>
          <InvoiceActions
            orderId={orderId}
            isApproved={isApproved}
            isDelivered={isDelivered}
            hasInvoice={hasInvoice}
            invoiceCount={invoiceCount}
            busy={busy}
            uploadingId={uploadingId}
            onViewInvoices={stop((e) => openInvoiceMenu(e, order))}
            onUploadFile={stop(() => onUploadFile(order))}
            onUploadCamera={stop(() => onUploadCamera(order))}
            onEditInvoices={stop(() => onEditInvoices(order))}
            canEditInvoice={canEditInvoice}
          />
        </TableCell>
        <TableCell align="center" onClick={stop(() => {})}>
          {isApproved ? (
            <Tooltip title={hasInvoice ? "Mark dispatched" : "Attach invoices and dispatch"}>
              <span>
                <Button
                  variant={hasInvoice ? "contained" : "outlined"}
                  size="small"
                  color="success"
                  disabled={!canClickDeliver}
                  startIcon={
                    deliveringId === orderId ? <CircularProgress size={16} color="inherit" /> : <LocalShippingIcon />
                  }
                  onClick={stop(() => onRequestDeliver(order))}
                  sx={{ fontWeight: 800, textTransform: "none", minWidth: 88 }}
                >
                  Dispatch
                </Button>
              </span>
            </Tooltip>
          ) : isDelivered ? (
            <Chip icon={<CheckCircleOutlineIcon />} label="Dispatched" size="small" color="success" variant="outlined" />
          ) : isIncoming ? (
            <Chip label="Awaiting approval" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
          ) : (
            "—"
          )}
        </TableCell>
      </TableRow>
    );
  };

  const shippingSubtitle = [
    todayLabel,
    lastRefreshedAt
      ? `Updated ${lastRefreshedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
      : null,
    currentUser?.name || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box sx={saasPageBackdropSx(theme)}>
      <AppBar elevation={0} sx={saasAppBarSx(theme, { position: "sticky" })}>
        <Toolbar sx={{ ...saasAppBarToolbarSx(), flexWrap: "wrap" }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.contrastText, 0.12),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <LocalShippingIcon sx={{ color: "inherit" }} />
          </Box>
          <SaasAppBarTitle title="Shipping" subtitle={shippingSubtitle} />
          <WorkspaceChip sx={{ display: { xs: "none", sm: "flex" } }} />
          {currentUser ? (
            <Tooltip title={currentUser.email || "Signed in"}>
              <Chip
                icon={<PersonIcon sx={{ color: `${alpha(theme.palette.primary.contrastText, 0.95)} !important` }} />}
                label={currentUser.name || "Shipping"}
                size="small"
                sx={{
                  display: { xs: "none", sm: "flex" },
                  maxWidth: 220,
                  bgcolor: alpha(theme.palette.primary.contrastText, 0.14),
                  color: "primary.contrastText",
                  fontWeight: 700,
                  "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
                }}
              />
            </Tooltip>
          ) : null}
          <DayNightThemeToggle />
          <Tooltip title="Refresh orders">
            <IconButton color="inherit" onClick={loadOrders} disabled={loading} aria-label="refresh">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Activity log">
            <IconButton
              color="inherit"
              onClick={() => (onNotificationsOpen ? onNotificationsOpen() : setNotificationsOpen(true))}
              aria-label="notifications"
            >
              <Badge badgeContent={unreadNotifications} color="error" max={99}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Log out">
            <IconButton color="inherit" onClick={requestLogout} aria-label="logout">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
        {loading ? <LinearProgress color="secondary" sx={{ height: 2 }} /> : null}
      </AppBar>

      <Box sx={{ ...saasContentColumnSx(1280), p: { xs: 1.5, sm: 2.5, md: 3 } }}>
        <Alert severity="info" icon={<LocalShippingIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Workflow:</strong> New distributor orders appear here right away (pending GM approval). After approval,
          attach one or more invoice files (PNG, JPG, PDF) → tap <strong>Dispatch</strong> to upload and mark shipped in one
          step if you prefer. Admin and distributor are notified automatically.
        </Alert>

        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, border: 1, borderColor: "divider" }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} justifyContent="space-between">
              <ToggleButtonGroup
                size="small"
                value={statusTab}
                exclusive
                onChange={(_, v) => v && setStatusTab(v)}
                sx={{ flexWrap: "wrap" }}
              >
                <ToggleButton value="all" sx={{ textTransform: "none", fontWeight: 700, px: 2 }}>
                  All ({incomingCount + approvedCount + deliveredCount})
                </ToggleButton>
                <ToggleButton value="incoming" sx={{ textTransform: "none", fontWeight: 700, px: 2 }}>
                  Incoming ({incomingCount})
                </ToggleButton>
                <ToggleButton value="approved" sx={{ textTransform: "none", fontWeight: 700, px: 2 }}>
                  Approved ({approvedCount})
                </ToggleButton>
                <ToggleButton value="delivered" sx={{ textTransform: "none", fontWeight: 700, px: 2 }}>
                  Dispatched ({deliveredCount})
                </ToggleButton>
              </ToggleButtonGroup>
              {hasActiveFilters ? (
                <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <TextField
                size="small"
                placeholder="Search order, distributor, code…"
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
            </Stack>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : sortedOrders.length === 0 ? (
          <Paper sx={{ py: 6, px: 2, textAlign: "center", borderRadius: 2, border: 1, borderColor: "divider" }}>
            <InboxOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
              {shippingRelevantOrders.length === 0 ? "No orders yet" : "No matching orders"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360, mx: "auto" }}>
              {shippingRelevantOrders.length === 0
                ? "Orders appear here when a distributor submits them. Invoice upload and dispatch unlock after GM approval."
                : "Try adjusting search, dates, or status tabs."}
            </Typography>
            {hasActiveFilters ? (
              <Button variant="outlined" startIcon={<ClearIcon />} onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </Paper>
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {sortedOrders.map((order) => {
              const orderId = getOrderId(order);
              const status = getOrderStatus(order);
              const hasInvoice = orderHasShippingInvoice(order);
              const invoices = getOrderShippingInvoices(order);
              const invoiceCount = invoices.length;
              const isApproved = status === ORDER_STATUS.APPROVED;
              const isDelivered = status === ORDER_STATUS.DELIVERED;
              const busy = uploadingId === orderId || deliveringId === orderId;
              return (
                <OrderMobileCard
                  key={orderId}
                  order={order}
                  orderId={orderId}
                  status={status}
                  statusChipColor={statusChipColor}
                  isApproved={isApproved}
                  isDelivered={isDelivered}
                  hasInvoice={hasInvoice}
                  invoiceCount={invoiceCount}
                  busy={busy}
                  canClickDeliver={isApproved && !busy}
                  uploadingId={uploadingId}
                  deliveringId={deliveringId}
                  onRowClick={() => onRowClick(order)}
                  onViewInvoices={(e) => openInvoiceMenu(e, order)}
                  onUploadFile={() => onUploadFile(order)}
                  onUploadCamera={() => onUploadCamera(order)}
                  onEditInvoices={() => onEditInvoices(order)}
                  onRequestDeliver={() => onRequestDeliver(order)}
                />
              );
            })}
          </Stack>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
              maxHeight: "calc(100vh - 320px)",
              overflow: "auto",
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {["Order #", "Distributor", "Date", "Total UC", "Status", "Invoice", "Dispatch"].map((h, i) => (
                    <TableCell
                      key={h}
                      align={i === 3 ? "right" : i >= 4 ? "center" : "left"}
                      sx={{ fontWeight: 800, bgcolor: tableHeaderBg(theme), fontSize: "0.75rem", py: 1 }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>{sortedOrders.map((order, idx) => renderOrderRow(order, idx))}</TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Drawer
        anchor="right"
        open={notificationsOpen}
        onClose={() => {
          if (onNotificationsClose) onNotificationsClose();
          else setNotificationsOpen(false);
        }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 360 } } }}
      >
        <Box sx={{ p: 2, bgcolor: "grey.50", color: "text.primary", borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Activity
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Recent shipping actions
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          {notifications.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No activity yet
            </Typography>
          ) : (
            <List dense disablePadding>
              {notifications.map((n) => (
                <ListItem key={n.id} divider sx={{ px: 0 }}>
                  <ListItemText
                    primary={n.headline ? `${n.headline}: ${n.message}` : n.message}
                    secondary={n.at}
                    primaryTypographyProps={{ fontWeight: 600, fontSize: "0.875rem" }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={Boolean(deliverConfirmOrder)}
        onClose={() => setDeliverConfirmOrder(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Dispatch order</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Order{" "}
            <strong>
              {deliverConfirmOrder?.orderNumber ||
                (deliverConfirmOrder && getOrderId(deliverConfirmOrder))}
            </strong>
            . Attach invoice files (you can select multiple), then mark as dispatched.
          </DialogContentText>
          {deliverConfirmOrder && orderHasShippingInvoice(deliverConfirmOrder) ? (
            <Alert
              severity="success"
              sx={{ mb: 2, borderRadius: 2 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    onEditInvoices(deliverConfirmOrder);
                    setDeliverConfirmOrder(null);
                  }}
                >
                  Edit files
                </Button>
              }
            >
              {getOrderShippingInvoices(deliverConfirmOrder).length} file
              {getOrderShippingInvoices(deliverConfirmOrder).length !== 1 ? "s" : ""} already on this order.
              Add more below or use Edit files to remove mistakes.
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
              At least one invoice file is required before dispatch.
            </Alert>
          )}
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={onPickDeliverFiles}
            sx={{ fontWeight: 700, textTransform: "none", mb: 1.5 }}
          >
            Choose invoice files
          </Button>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            PNG, JPG, or PDF — up to 10 files, 5 MB each
          </Typography>
          {deliverPendingFiles.length > 0 ? (
            <Stack spacing={0.75}>
              {deliverPendingFiles.map((f, idx) => (
                <Stack
                  key={`${f.name}_${f.size}_${idx}`}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    py: 0.75,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600, maxWidth: "85%" }}>
                    {f.name}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label="remove file"
                    onClick={() =>
                      setDeliverPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button onClick={() => setDeliverConfirmOrder(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={onConfirmDeliver}
            disabled={
              deliveringId != null ||
              uploadingId != null ||
              (!orderHasShippingInvoice(deliverConfirmOrder) && deliverPendingFiles.length === 0)
            }
            startIcon={
              deliveringId || uploadingId ? <CircularProgress size={18} color="inherit" /> : <LocalShippingIcon />
            }
            sx={{ fontWeight: 800 }}
          >
            {deliverPendingFiles.length > 0
              ? `Save ${deliverPendingFiles.length} file${deliverPendingFiles.length !== 1 ? "s" : ""} & dispatch`
              : "Mark dispatched"}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={invoiceMenuAnchor} open={Boolean(invoiceMenuAnchor)} onClose={closeInvoiceMenu}>
        {invoiceMenuList.map((inv, idx) => (
          <React.Fragment key={`${inv.fileName}_${idx}`}>
            {idx > 0 ? <Divider /> : null}
            <MenuItem
              onClick={() => {
                openShippingInvoice(inv);
                closeInvoiceMenu();
              }}
            >
              <ListItemIcon>
                <VisibilityIcon fontSize="small" />
              </ListItemIcon>
              Open {inv.fileName || `file ${idx + 1}`}
            </MenuItem>
            <MenuItem
              onClick={() => {
                downloadShippingInvoice(inv);
                closeInvoiceMenu();
              }}
            >
              <ListItemIcon>
                <DescriptionOutlinedIcon fontSize="small" />
              </ListItemIcon>
              Download
            </MenuItem>
          </React.Fragment>
        ))}
      </Menu>

      {logoutConfirmDialog}
    </Box>
  );
}
