import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { saasSurfaceCardSx } from "../../theme/saasChrome";
import { STATUS_LABELS } from "../../services/platformAdminService";
import {
  SORT_OPTIONS,
  formatPlatformDate,
  statusChipColor,
  orgNeedsAttention,
} from "../../utils/platformDashboardData";

export function PlatformFiltersPanel({
  search,
  statusFilter,
  sortId,
  filteredCount,
  totalCount,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onExport,
  exportDisabled,
  onReset,
  hasActiveFilters,
}) {
  const theme = useTheme();

  return (
    <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 1.5, borderRadius: 1.5, flexShrink: 0 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.25}
        alignItems={{ lg: "center" }}
        flexWrap="wrap"
        useFlexGap
      >
        <TextField
          size="small"
          placeholder="Search name, slug, or ID…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ flex: 1, minWidth: { xs: "100%", sm: 220 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={(e) => onStatusChange(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="trial">Trial</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={sortId} onChange={(e) => onSortChange(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {hasActiveFilters ? (
            <Button size="small" onClick={onReset} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Reset
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={onExport}
            disabled={exportDisabled}
            sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
          >
            Export
          </Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
        <Chip
          size="small"
          icon={<FilterListIcon sx={{ fontSize: "14px !important" }} />}
          label={`${filteredCount} of ${totalCount} workspace(s)`}
          variant="outlined"
          sx={{ height: 24, fontSize: "0.72rem", fontWeight: 700 }}
        />
        <Typography variant="caption" color="text.secondary">
          Click a row for team, lifecycle actions, and access links.
        </Typography>
      </Stack>
    </Paper>
  );
}

export function PlatformWorkspacesTable({ rows, loading, selectedId, onRowClick, totalCount }) {
  const theme = useTheme();

  if (loading) {
    return (
      <Paper
        variant="outlined"
        sx={{
          ...saasSurfaceCardSx(theme),
          borderRadius: 1.5,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
        }}
      >
        <CircularProgress size={32} />
      </Paper>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        ...saasSurfaceCardSx(theme),
        overflow: "hidden",
        borderRadius: 1.5,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Table stickyHeader size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "38%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <TableHead>
            <TableRow>
              {[
                "Workspace",
                "Status",
                "Admins",
                "Invites",
                "Created",
                "",
              ].map((label, idx) => (
                <TableCell
                  key={label || "action"}
                  align={idx >= 2 && idx <= 3 ? "right" : "left"}
                  sx={{
                    fontWeight: 800,
                    fontSize: "0.72rem",
                    py: 1,
                    bgcolor: alpha(theme.palette.grey[500], 0.08),
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Stack alignItems="center" spacing={1}>
                    <InboxOutlinedIcon color="disabled" sx={{ fontSize: 40 }} />
                    <Typography color="text.secondary" fontWeight={600}>
                      {totalCount === 0 ? "No workspaces registered yet" : "No matches — adjust filters"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((org, rowIdx) => {
                const needsAttention = orgNeedsAttention(org);
                return (
                  <TableRow
                    key={org.id}
                    hover
                    selected={selectedId === org.id}
                    sx={{
                      cursor: "pointer",
                      bgcolor:
                        rowIdx % 2 === 1
                          ? alpha(theme.palette.grey[500], 0.03)
                          : "transparent",
                      ...(needsAttention && {
                        bgcolor: alpha(
                          org.status === "suspended"
                            ? theme.palette.error.main
                            : theme.palette.warning.main,
                          0.07
                        ),
                      }),
                    }}
                    onClick={() => onRowClick(org)}
                  >
                    <TableCell sx={{ py: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        {needsAttention ? (
                          <WarningAmberOutlinedIcon fontSize="small" color="warning" sx={{ flexShrink: 0 }} />
                        ) : null}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {org.name}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            fontFamily="monospace"
                            noWrap
                            display="block"
                          >
                            {org.slug}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <Chip
                        size="small"
                        label={STATUS_LABELS[org.status] || org.status}
                        color={statusChipColor(org.status)}
                        sx={{ height: 22, fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1, fontVariantNumeric: "tabular-nums" }}>
                      {org.admin_count}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1, fontVariantNumeric: "tabular-nums" }}>
                      {org.pending_invites_count}
                    </TableCell>
                    <TableCell sx={{ py: 1, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {formatPlatformDate(org.created_at)}
                    </TableCell>
                    <TableCell sx={{ py: 1 }}>
                      <ChevronRightIcon fontSize="small" color="action" />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
