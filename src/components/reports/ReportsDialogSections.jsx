import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import SaveAltOutlinedIcon from "@mui/icons-material/SaveAltOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import BarChartIcon from "@mui/icons-material/BarChart";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";

export const REPORT_TABS = [
  {
    value: "performance",
    label: "Performance",
    icon: BarChartIcon,
    description: "Distributor-wise CSD & Water lifts vs targets",
  },
  {
    value: "sku",
    label: "SKU sales",
    icon: Inventory2OutlinedIcon,
    description: "Aggregated SKU ranking across all dispatches",
  },
  {
    value: "dispatch",
    label: "Dispatch sales",
    icon: ReceiptLongOutlinedIcon,
    description: "Invoice-level dispatch log with print & save",
  },
];

function formatMetric(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

export function ReportTabsBar({ reportType, onChange }) {
  const theme = useTheme();

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
      <Tabs
        value={reportType}
        onChange={(_, v) => onChange(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          bgcolor: alpha(theme.palette.grey[500], 0.06),
          "& .MuiTab-root": {
            minHeight: 36,
            py: 0.5,
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.75rem",
            gap: 0.5,
            minWidth: 0,
          },
          "& .MuiTab-iconWrapper": { fontSize: 16 },
        }}
      >
        {REPORT_TABS.map(({ value, label, icon: Icon }) => (
          <Tab
            key={value}
            value={value}
            label={label}
            icon={<Icon sx={{ fontSize: 16 }} />}
            iconPosition="start"
          />
        ))}
      </Tabs>
    </Paper>
  );
}

export function ReportFiltersPanel({
  reportType,
  startDate,
  endDate,
  dateError,
  selectedRegion,
  performanceSearch,
  dispatchSearch,
  filteredCount,
  hasFilters,
  onStartChange,
  onEndChange,
  onRegionChange,
  onPerformanceSearchChange,
  onDispatchSearchChange,
  onReset,
}) {
  return (
    <Paper variant="outlined" sx={{ px: 1.25, py: 1, borderRadius: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
        }}
      >
        <TextField
          label="From"
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: "100%", sm: 148 } }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={endDate}
          error={Boolean(dateError)}
          onChange={(e) => onEndChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: { xs: "100%", sm: 148 } }}
        />

        {reportType === "performance" ? (
          <>
            <FormControl size="small" sx={{ width: { xs: "100%", sm: 140 } }}>
              <InputLabel>Region</InputLabel>
              <Select value={selectedRegion} label="Region" onChange={(e) => onRegionChange(e.target.value)}>
                <MenuItem value="All">All regions</MenuItem>
                <MenuItem value="Southern">Southern</MenuItem>
                <MenuItem value="Western">Western</MenuItem>
                <MenuItem value="Eastern">Eastern</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search distributor…"
              value={performanceSearch}
              onChange={(e) => onPerformanceSearchChange(e.target.value)}
              sx={{ flex: "1 1 160px", minWidth: { sm: 160 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </>
        ) : null}

        {reportType === "dispatch" ? (
          <TextField
            size="small"
            placeholder="Search invoice, vehicle, distributor…"
            value={dispatchSearch}
            onChange={(e) => onDispatchSearchChange(e.target.value)}
            sx={{ flex: "1 1 180px", minWidth: { sm: 180 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        ) : null}

        {hasFilters ? (
          <Button size="small" onClick={onReset} sx={{ fontWeight: 700, minWidth: "auto", px: 1, height: 40 }}>
            Reset
          </Button>
        ) : null}
      </Box>

      {dateError ? (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.75, ml: 0.25 }}>
          {dateError}
        </Typography>
      ) : null}
    </Paper>
  );
}

export function ReportEmptyState({ icon: Icon = InboxOutlinedIcon, title, message }) {
  return (
    <Box sx={{ py: 3, px: 2, textAlign: "center" }}>
      <Icon sx={{ fontSize: 32, color: "action.disabled", mb: 0.75 }} />
      <Typography variant="body2" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360, mx: "auto", display: "block" }}>
        {message}
      </Typography>
    </Box>
  );
}

export function ReportTableShell({ title, chips, children, tableRef }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexWrap: "wrap",
        }}
      >
        <TableChartIcon sx={{ fontSize: 16 }} color="action" />
        <Typography variant="caption" fontWeight={800} sx={{ fontSize: "0.8rem" }}>
          {title}
        </Typography>
        {chips ? (
          <Stack direction="row" spacing={0.75} sx={{ ml: "auto" }} flexWrap="wrap" useFlexGap>
            {chips}
          </Stack>
        ) : null}
      </Box>
      <Box ref={tableRef}>{children}</Box>
    </Paper>
  );
}

export function useReportTableStyles() {
  const theme = useTheme();
  const tableMaxH = { xs: "min(54vh, 440px)", sm: "min(62vh, 560px)" };
  const headSx = {
    fontWeight: 700,
    backgroundColor: theme.palette.primary.dark,
    color: "#fff",
    py: 0.5,
    px: 1,
    fontSize: "0.7rem",
    whiteSpace: "nowrap",
    lineHeight: 1.2,
  };
  const cellSx = { py: 0.4, px: 1, fontSize: "0.75rem", lineHeight: 1.3 };
  const subHeadCsd = {
    ...cellSx,
    fontWeight: 700,
    backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
  };
  const subHeadWater = {
    ...cellSx,
    fontWeight: 700,
    backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
  };
  const metric = (v) => (
    <Box
      component="span"
      sx={{
        fontVariantNumeric: "tabular-nums",
        color: Number(v) ? "text.primary" : "text.disabled",
      }}
    >
      {formatMetric(v)}
    </Box>
  );

  return { theme, tableMaxH, headSx, cellSx, subHeadCsd, subHeadWater, metric };
}

export function PerformanceReportTable({ groups, styles }) {
  const { theme, tableMaxH, headSx, cellSx, subHeadCsd, subHeadWater, metric } = styles;

  return (
    <TableContainer sx={{ maxHeight: tableMaxH }}>
      <Table stickyHeader size="small" sx={{ minWidth: 780 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>CSD SKU</TableCell>
            <TableCell align="right" sx={headSx}>PC</TableCell>
            <TableCell align="right" sx={headSx}>UC</TableCell>
            <TableCell sx={headSx}>Water SKU</TableCell>
            <TableCell align="right" sx={headSx}>PC</TableCell>
            <TableCell align="right" sx={headSx}>UC</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((group) => {
            const rowCount = Math.max(group.csd.length, group.water.length, 1);
            return (
              <React.Fragment key={group.key}>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{
                      ...cellSx,
                      fontWeight: 800,
                      bgcolor: alpha(theme.palette.grey[500], 0.08),
                    }}
                  >
                    Distributor: {group.name}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={subHeadCsd}>CSD</TableCell>
                  <TableCell align="right" sx={subHeadCsd}>PC</TableCell>
                  <TableCell align="right" sx={subHeadCsd}>UC</TableCell>
                  <TableCell sx={subHeadWater}>Water</TableCell>
                  <TableCell align="right" sx={subHeadWater}>PC</TableCell>
                  <TableCell align="right" sx={subHeadWater}>UC</TableCell>
                </TableRow>
                {Array.from({ length: rowCount }).map((_, index) => {
                  const csd = group.csd[index];
                  const water = group.water[index];
                  return (
                    <TableRow key={`${group.key}-${index}`} hover>
                      <TableCell sx={cellSx}>{csd?.sku || ""}</TableCell>
                      <TableCell align="right" sx={cellSx}>{csd ? metric(csd.pc) : metric(0)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{csd ? metric(csd.uc) : metric(0)}</TableCell>
                      <TableCell sx={cellSx}>{water?.sku || ""}</TableCell>
                      <TableCell align="right" sx={cellSx}>{water ? metric(water.pc) : metric(0)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{water ? metric(water.uc) : metric(0)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow sx={{ bgcolor: alpha(theme.palette.grey[700], 0.05) }}>
                  <TableCell sx={{ ...cellSx, fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="right" sx={cellSx}>{metric(group.totals.csdPC)}</TableCell>
                  <TableCell align="right" sx={cellSx}>{metric(group.totals.csdUC)}</TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="right" sx={cellSx}>{metric(group.totals.waterPC)}</TableCell>
                  <TableCell align="right" sx={cellSx}>{metric(group.totals.waterUC)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 0.25, border: 0 }} />
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function DispatchReportTable({ rows, styles, invoiceActionKey, onPrint, onSave }) {
  const { tableMaxH, headSx, cellSx, metric } = styles;

  return (
    <TableContainer sx={{ maxHeight: tableMaxH }}>
      <Table stickyHeader size="small" sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={headSx}>Invoice date</TableCell>
            <TableCell sx={headSx}>Invoice no.</TableCell>
            <TableCell sx={headSx}>Vehicle no.</TableCell>
            <TableCell sx={headSx}>Distributor</TableCell>
            <TableCell sx={headSx}>Order no.</TableCell>
            <TableCell align="right" sx={headSx}>CSD PC</TableCell>
            <TableCell align="right" sx={headSx}>CSD UC</TableCell>
            <TableCell align="right" sx={headSx}>Water PC</TableCell>
            <TableCell align="right" sx={headSx}>Water UC</TableCell>
            <TableCell align="center" sx={headSx}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const busy = invoiceActionKey === row.key;
            const disabled = busy || (!row.order && !row.hasUploadedInvoice);
            return (
              <TableRow key={row.key} hover>
                <TableCell sx={cellSx}>{row.invoiceDateDisplay}</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 600 }}>{row.invoiceNo}</TableCell>
                <TableCell sx={cellSx}>{row.vehicleNo}</TableCell>
                <TableCell sx={{ ...cellSx, fontWeight: 600 }}>{row.distributorName}</TableCell>
                <TableCell sx={cellSx}>{row.orderNumber}</TableCell>
                <TableCell align="right" sx={cellSx}>{metric(row.csdPC)}</TableCell>
                <TableCell align="right" sx={cellSx}>{metric(row.csdUC)}</TableCell>
                <TableCell align="right" sx={cellSx}>{metric(row.waterPC)}</TableCell>
                <TableCell align="right" sx={cellSx}>{metric(row.waterUC)}</TableCell>
                <TableCell align="center" sx={cellSx}>
                  <Stack direction="row" spacing={0.5} justifyContent="center">
                    <Tooltip title="Print invoice">
                      <span>
                        <IconButton size="small" disabled={disabled} onClick={() => onPrint(row)}>
                          {busy ? <CircularProgress size={16} /> : <PrintOutlinedIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Save invoice">
                      <span>
                        <IconButton size="small" disabled={disabled} onClick={() => onSave(row)}>
                          <SaveAltOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function SkuReportTables({ csdRows, waterRows, styles }) {
  const { tableMaxH, headSx, cellSx } = styles;
  const sections = [
    { title: "CSD SKU sales", color: "error.dark", rows: csdRows },
    { title: "Water SKU sales", color: "info.main", rows: waterRows },
  ];

  return (
    <Stack spacing={1.25} sx={{ p: 1.25 }} divider={<Divider flexItem />}>
      {sections.map(({ title, color, rows }) => (
        <Box key={title}>
          <Typography variant="caption" fontWeight={800} sx={{ color, mb: 0.5, display: "block" }}>
            {title}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: tableMaxH, borderRadius: 1 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headSx, width: 48 }}>#</TableCell>
                  <TableCell sx={headSx}>SKU</TableCell>
                  <TableCell align="center" sx={headSx}>Total PC</TableCell>
                  <TableCell align="center" sx={headSx}>Total UC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 2, ...cellSx }}>
                      No SKU data for current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow key={row.sku} hover>
                      <TableCell sx={cellSx}>{index + 1}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 600 }}>{row.sku}</TableCell>
                      <TableCell align="center" sx={cellSx}>{row.totalPC.toLocaleString()}</TableCell>
                      <TableCell align="center" sx={cellSx}>{row.totalUC.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Stack>
  );
}

export function ReportStatsRow({ distributorsCount, liftsCount, filteredCount, reportType }) {
  const filteredLabel = reportType === "dispatch" ? "orders" : "records";
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Chip
        size="small"
        icon={<PeopleOutlineIcon />}
        label={`${distributorsCount} distributors`}
        variant="outlined"
      />
      <Chip
        size="small"
        icon={<TableRowsOutlinedIcon />}
        label={`${liftsCount} lifts`}
        color="info"
        variant="outlined"
      />
      <Chip
        size="small"
        icon={<FilterListIcon />}
        label={`${filteredCount} ${filteredLabel}`}
        color="primary"
        variant="outlined"
      />
    </Stack>
  );
}
