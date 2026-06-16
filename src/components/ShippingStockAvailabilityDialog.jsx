import React, { useMemo, useState } from "react";
import {
  Dialog,
  Button,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  Stack,
  CircularProgress,
  Collapse,
  Tooltip,
  AppBar,
  Toolbar,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import RemoveShoppingCartOutlinedIcon from "@mui/icons-material/RemoveShoppingCartOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import { buildProductStockAvailabilityList } from "../utils/workspaceInventory";
import { formatProductLabelDisplay, normalizeCategory } from "../utils/productCatalog";
import { formatLotDateDisplay } from "../utils/shippingFifoLots";
import { tableHeadRowSx, tableHeadCellSx, tableStripeAt } from "../theme/contrastSurfaces";

const STOCK_COLUMNS = [
  { key: "expand", label: "", width: 48, align: "center" },
  { key: "product", label: "Product", width: "34%", align: "left", wrap: true },
  { key: "category", label: "Category", width: "12%", align: "left" },
  { key: "qty", label: "Available (cases)", width: "16%", align: "right" },
  { key: "lots", label: "Lots", width: "10%", align: "right" },
  { key: "status", label: "Status", width: "18%", align: "left" },
];

const LOT_COLUMNS = [
  { key: "mfg", label: "MFG date", width: "24%", align: "left" },
  { key: "batch", label: "Batch no.", width: "28%", align: "left", wrap: true },
  { key: "bbd", label: "BBD", width: "24%", align: "left" },
  { key: "qty", label: "Qty (cases)", width: "24%", align: "right" },
];

function stockCellSx(col, { header = false, extra = {} } = {}) {
  return {
    ...(header ? tableHeadCellSx() : {}),
    textAlign: col.align,
    width: col.width,
    minWidth: col.minWidth,
    whiteSpace: col.wrap ? "normal" : "nowrap",
    verticalAlign: header ? "bottom" : "middle",
    fontWeight: header ? 800 : undefined,
    fontVariantNumeric: col.align === "right" && !header ? "tabular-nums" : undefined,
    lineHeight: 1.35,
    px: header ? 1.25 : 1.25,
    py: header ? 1 : 1,
    boxSizing: "border-box",
    ...extra,
  };
}

function stockStatus(totalQty) {
  if (totalQty <= 0) return { label: "Out of stock", color: "default", icon: RemoveShoppingCartOutlinedIcon };
  if (totalQty < 50) return { label: "Low stock", color: "warning", icon: WarningAmberOutlinedIcon };
  return { label: "In stock", color: "success", icon: CheckCircleOutlineIcon };
}

function SummaryCard({ title, value, subtitle, color = "primary", icon: Icon }) {
  const theme = useTheme();
  const main = theme.palette[color]?.main || theme.palette.primary.main;
  return (
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: { xs: "100%", sm: 160 },
        borderRadius: 2,
        borderColor: alpha(main, 0.35),
        bgcolor: alpha(main, theme.palette.mode === "dark" ? 0.12 : 0.06),
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(main, 0.16),
              color: main,
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>
              {value}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function LotDetails({ lots }) {
  const theme = useTheme();
  if (!lots?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No lots with quantity in inventory.
      </Typography>
    );
  }
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ mt: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.background.default, 0.6) }}
    >
      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          {LOT_COLUMNS.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <TableHead>
          <TableRow sx={tableHeadRowSx(theme)}>
            {LOT_COLUMNS.map((col) => (
              <TableCell key={col.key} sx={stockCellSx(col, { header: true, extra: { fontSize: "0.75rem", py: 0.75 } })}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {lots.map((lot, i) => (
            <TableRow key={`${lot.mfgDate}-${lot.batchNo}-${lot.bbdDate}-${i}`} sx={{ bgcolor: tableStripeAt(theme, i) }}>
              <TableCell sx={stockCellSx(LOT_COLUMNS[0], { extra: { fontSize: "0.8125rem" } })}>
                {lot.mfgDate ? formatLotDateDisplay(lot.mfgDate) : "—"}
              </TableCell>
              <TableCell sx={stockCellSx(LOT_COLUMNS[1], { extra: { fontSize: "0.8125rem", whiteSpace: "normal" } })}>
                {lot.batchNo || "—"}
              </TableCell>
              <TableCell sx={stockCellSx(LOT_COLUMNS[2], { extra: { fontSize: "0.8125rem" } })}>
                {lot.bbdDate ? formatLotDateDisplay(lot.bbdDate) : "—"}
              </TableCell>
              <TableCell sx={stockCellSx(LOT_COLUMNS[3], { extra: { fontSize: "0.8125rem", fontWeight: 700 } })}>
                {lot.quantity.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ShippingStockAvailabilityDialog({
  open,
  onClose,
  productRates,
  inventoryRows,
  loading = false,
  onRefresh,
}) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const products = useMemo(
    () => buildProductStockAvailabilityList(productRates, inventoryRows),
    [productRates, inventoryRows]
  );

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => normalizeCategory(p.category)));
    return ["all", ...[...set].sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && normalizeCategory(p.category) !== categoryFilter) return false;
      if (!q) return true;
      const hay = [p.product, p.productName, p.variant, p.category].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, categoryFilter]);

  const summary = useMemo(() => {
    const inStock = products.filter((p) => p.totalQty > 0).length;
    const lowStock = products.filter((p) => p.totalQty > 0 && p.totalQty < 50).length;
    const totalCases = products.reduce((s, p) => s + p.totalQty, 0);
    const totalLots = products.reduce((s, p) => s + (p.lots?.length || 0), 0);
    return { inStock, outOfStock: products.length - inStock, lowStock, totalCases, totalLots };
  }, [products]);

  const toggleExpanded = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "primary.main" }}>
        <Toolbar variant="dense" sx={{ gap: 1, minHeight: { xs: 56, sm: 60 } }}>
          <Inventory2OutlinedIcon sx={{ color: "primary.contrastText" }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.1rem" }, lineHeight: 1.2 }}>
              Product stock availability
            </Typography>
            <Typography variant="caption" sx={{ color: alpha("#fff", 0.85), display: { xs: "none", sm: "block" } }}>
              Refer workspace inventory before dispatching orders
            </Typography>
          </Box>
          <Tooltip title="Refresh stock">
            <span>
              <IconButton color="inherit" onClick={onRefresh} disabled={loading} aria-label="refresh stock">
                <RefreshOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Toolbar>
        {loading ? <LinearProgress color="secondary" /> : null}
      </AppBar>

      <Box
        sx={{
          height: "calc(100dvh - 56px)",
          overflow: "auto",
          bgcolor: "background.default",
          p: { xs: 1.5, sm: 2.5 },
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
            <SummaryCard
              title="TOTAL CASES"
              value={summary.totalCases.toLocaleString()}
              subtitle="Across all products"
              color="primary"
              icon={Inventory2OutlinedIcon}
            />
            <SummaryCard
              title="IN STOCK"
              value={summary.inStock}
              subtitle={`${summary.lowStock} low stock`}
              color="success"
              icon={CheckCircleOutlineIcon}
            />
            <SummaryCard
              title="OUT OF STOCK"
              value={summary.outOfStock}
              subtitle={`${products.length} catalogue lines`}
              color="warning"
              icon={RemoveShoppingCartOutlinedIcon}
            />
            <SummaryCard
              title="STOCK LOTS"
              value={summary.totalLots}
              subtitle="FIFO layers in inventory"
              color="info"
              icon={LayersOutlinedIcon}
            />
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2 },
              mb: 2,
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
            }}
          >
            <Stack spacing={1.5}>
              <TextField
                size="small"
                placeholder="Search by product name, SKU, or category…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setQuery("")} aria-label="clear search">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={categoryFilter}
                  onChange={(_, v) => v && setCategoryFilter(v)}
                  sx={{ flexWrap: "wrap" }}
                >
                  {categories.map((cat) => (
                    <ToggleButton key={cat} value={cat} sx={{ textTransform: "none", fontWeight: 700, px: 1.5 }}>
                      {cat === "all" ? "All categories" : cat}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Chip
                  label={`${filtered.length} shown`}
                  size="small"
                  sx={{ fontWeight: 700, ml: { sm: "auto" } }}
                />
              </Stack>
            </Stack>
          </Paper>

          {loading && products.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
              <CircularProgress />
            </Box>
          ) : filtered.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderRadius: 2 }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1.5 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                {products.length === 0 ? "No products in catalogue" : "No matching products"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: "auto" }}>
                {products.length === 0
                  ? "Add products in Product & Rate Master and enter stock lots in Inventory."
                  : "Try a different search or category filter."}
              </Typography>
            </Paper>
          ) : (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, overflow: "auto", maxHeight: { xs: "calc(100dvh - 340px)", sm: "calc(100dvh - 380px)" } }}
            >
              <Table stickyHeader size="small" sx={{ tableLayout: "fixed", minWidth: 720, width: "100%" }}>
                <colgroup>
                  {STOCK_COLUMNS.map((col) => (
                    <col key={col.key} style={{ width: col.width }} />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    {STOCK_COLUMNS.map((col) => (
                      <TableCell key={col.key} sx={stockCellSx(col, { header: true })}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((row, i) => {
                    const key = row.product.toUpperCase();
                    const status = stockStatus(row.totalQty);
                    const StatusIcon = status.icon;
                    const isOpen = expandedKey === key;
                    const lotCount = row.lots?.length || 0;
                    return (
                      <React.Fragment key={key}>
                        <TableRow
                          hover
                          sx={{
                            bgcolor: tableStripeAt(theme, i),
                            "& > td": { borderBottom: isOpen ? 0 : undefined },
                          }}
                        >
                          <TableCell sx={stockCellSx(STOCK_COLUMNS[0])}>
                            <Box sx={{ display: "flex", justifyContent: "center" }}>
                              <IconButton
                                size="small"
                                onClick={() => toggleExpanded(key)}
                                disabled={row.totalQty <= 0}
                                aria-label={isOpen ? "Hide lots" : "Show lots"}
                              >
                                {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={stockCellSx(STOCK_COLUMNS[1], {
                              extra: { fontWeight: 700, textTransform: "uppercase", whiteSpace: "normal" },
                            })}
                          >
                            {formatProductLabelDisplay(row.product)}
                          </TableCell>
                          <TableCell sx={stockCellSx(STOCK_COLUMNS[2])}>
                            <Chip
                              label={normalizeCategory(row.category)}
                              size="small"
                              variant="outlined"
                              sx={{ fontWeight: 700, maxWidth: "100%" }}
                            />
                          </TableCell>
                          <TableCell sx={stockCellSx(STOCK_COLUMNS[3], { extra: { fontWeight: 800, fontSize: "0.95rem" } })}>
                            {row.totalQty.toLocaleString()}
                          </TableCell>
                          <TableCell sx={stockCellSx(STOCK_COLUMNS[4], { extra: { fontWeight: 600, color: "text.secondary" } })}>
                            {lotCount > 0 ? lotCount : "—"}
                          </TableCell>
                          <TableCell sx={stockCellSx(STOCK_COLUMNS[5])}>
                            <Chip
                              icon={<StatusIcon sx={{ fontSize: "16px !important" }} />}
                              label={status.label}
                              size="small"
                              color={status.color}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={STOCK_COLUMNS.length} sx={{ py: 0, px: 0, borderTop: 0 }}>
                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                              <Box
                                sx={{
                                  px: { xs: 1.5, sm: 2 },
                                  py: 1.5,
                                  pl: { xs: 2, sm: 7 },
                                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04),
                                  borderTop: 1,
                                  borderColor: "divider",
                                }}
                              >
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                                  Stock lots (FIFO)
                                </Typography>
                                <LotDetails lots={row.lots} />
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

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" size="large" onClick={onClose} sx={{ fontWeight: 700, px: 3 }}>
              Close
            </Button>
          </Stack>
        </Box>
      </Box>
    </Dialog>
  );
}
