import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
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
  Toolbar,
  Tooltip,
  Typography,
  Alert,
  AlertTitle,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BlockIcon from "@mui/icons-material/Block";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SaasAppBarTitle from "../components/saas/SaasAppBarTitle";
import AppSnackbar from "../components/AppSnackbar";
import PlatformTenantDetailDrawer from "../components/platform/PlatformTenantDetailDrawer";
import {
  checkPlatformAdmin,
  listPlatformOrganizations,
  exportTenantsCsv,
  downloadCsv,
  PLAN_LABELS,
  STATUS_LABELS,
} from "../services/platformAdminService";
import { getCurrentUser } from "../services/supabaseService";
import { PLATFORM_NAME } from "../constants/saas";
import {
  saasAppBarSx,
  saasAppBarToolbarSx,
  saasDashboardMainSx,
  saasSurfaceCardSx,
  saasContentColumnSx,
  saasPageBackdropSx,
} from "../theme/saasChrome";

const SORT_OPTIONS = [
  { id: "created_desc", label: "Newest first" },
  { id: "created_asc", label: "Oldest first" },
  { id: "name_asc", label: "Name A–Z" },
  { id: "distributors_desc", label: "Most distributors" },
  { id: "orders_desc", label: "Most orders" },
];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function statusChipColor(status) {
  if (status === "active") return "success";
  if (status === "suspended") return "error";
  return "warning";
}

function sortOrgs(rows, sortId) {
  const list = [...rows];
  switch (sortId) {
    case "created_asc":
      return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case "name_asc":
      return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    case "distributors_desc":
      return list.sort((a, b) => (b.distributor_count || 0) - (a.distributor_count || 0));
    case "orders_desc":
      return list.sort((a, b) => (b.orders_count || 0) - (a.orders_count || 0));
    default:
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

function KpiCard({ icon: Icon, label, value, hint, color = "primary" }) {
  const theme = useTheme();
  return (
    <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 2, flex: 1, minWidth: 140 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.12),
            color: `${color}.main`,
            display: "flex",
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="overline" color="text.secondary" fontWeight={800} lineHeight={1.2}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={900} lineHeight={1.1}>
            {value}
          </Typography>
          {hint ? (
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function PlatformDashboard({ onLogout }) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortId, setSortId] = useState("created_desc");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "" });

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const allowed = await checkPlatformAdmin();
      if (!allowed) {
        setError("You are not authorized for the platform console.");
        setOrgs([]);
        return;
      }
      const rows = await listPlatformOrganizations();
      setOrgs(rows);
      setLastRefresh(new Date());
      setSelectedOrg((prev) => {
        if (!prev) return prev;
        return rows.find((o) => o.id === prev.id) || prev;
      });
    } catch (e) {
      setError(e?.message || "Failed to load workspaces");
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (user?.email) setOperatorEmail(user.email);
      } catch {
        /* ignore */
      }
    })();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = orgs;
    if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (planFilter !== "all") {
      list = list.filter((o) => o.plan === planFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          String(o.name || "").toLowerCase().includes(q) ||
          String(o.slug || "").toLowerCase().includes(q) ||
          String(o.id || "").toLowerCase().includes(q)
      );
    }
    return sortOrgs(list, sortId);
  }, [orgs, search, statusFilter, planFilter, sortId]);

  const stats = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter((o) => o.status === "active").length;
    const suspended = orgs.filter((o) => o.status === "suspended").length;
    const trial = orgs.filter((o) => o.plan === "trial").length;
    const distributors = orgs.reduce((s, o) => s + (o.distributor_count || 0), 0);
    const orders = orgs.reduce((s, o) => s + (o.orders_count || 0), 0);
    return { total, active, suspended, trial, distributors, orders };
  }, [orgs]);

  const alerts = useMemo(() => {
    const items = [];
    const noAdmins = orgs.filter((o) => (o.admin_count || 0) === 0 && o.status !== "suspended");
    const suspended = orgs.filter((o) => o.status === "suspended");
    if (suspended.length > 0) {
      items.push({
        severity: "warning",
        title: `${suspended.length} suspended workspace(s)`,
        body: "These tenants cannot sign in until reactivated.",
      });
    }
    if (noAdmins.length > 0) {
      items.push({
        severity: "info",
        title: `${noAdmins.length} workspace(s) without admins`,
        body: "May be incomplete signup — open the workspace to inspect team.",
      });
    }
    return items;
  }, [orgs]);

  const openDetail = (org) => {
    setSelectedOrg(org);
    setDrawerOpen(true);
  };

  const handleOrgDeleted = useCallback(async () => {
    setDrawerOpen(false);
    setSelectedOrg(null);
    await load();
  }, [load]);

  const handleExport = () => {
    const csv = exportTenantsCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`distribution-prime-tenants-${date}.csv`, csv);
    setToast({ open: true, message: `Exported ${filtered.length} workspace(s)` });
  };

  return (
    <Box sx={saasPageBackdropSx(theme)}>
      <AppBar sx={saasAppBarSx(theme)}>
        <Toolbar sx={saasAppBarToolbarSx()}>
          <SaasAppBarTitle
            title={`${PLATFORM_NAME} Operator Console`}
            subtitle={
              operatorEmail
                ? `${operatorEmail}${lastRefresh ? ` · Updated ${lastRefresh.toLocaleTimeString()}` : ""}`
                : "Platform administration"
            }
          />
          <Tooltip title="Refresh data">
            <span>
              <IconButton color="inherit" onClick={load} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button color="inherit" startIcon={<LogoutIcon />} onClick={onLogout} sx={{ fontWeight: 700 }}>
            Log out
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={saasDashboardMainSx(theme)}>
        <Container maxWidth={false} sx={{ ...saasContentColumnSx(1400), py: 0 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab label="Overview" sx={{ fontWeight: 700, textTransform: "none" }} />
            <Tab label={`Workspaces (${orgs.length})`} sx={{ fontWeight: 700, textTransform: "none" }} />
          </Tabs>

          {error ? (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          ) : null}

          {tab === 0 && (
            <Stack spacing={2.5} sx={{ mb: 3 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
                <KpiCard icon={BusinessOutlinedIcon} label="Workspaces" value={stats.total} />
                <KpiCard
                  icon={CheckCircleOutlineIcon}
                  label="Active"
                  value={stats.active}
                  color="success"
                />
                <KpiCard icon={BlockIcon} label="Suspended" value={stats.suspended} color="error" />
                <KpiCard icon={StorefrontOutlinedIcon} label="Distributors (all tenants)" value={stats.distributors} />
                <KpiCard icon={GroupsOutlinedIcon} label="Orders (all tenants)" value={stats.orders} hint="Across workspaces" />
              </Stack>

              {alerts.length > 0 ? (
                <Stack spacing={1.5}>
                  {alerts.map((a) => (
                    <Alert key={a.title} severity={a.severity} sx={{ borderRadius: 2 }}>
                      <AlertTitle sx={{ fontWeight: 800 }}>{a.title}</AlertTitle>
                      {a.body}
                    </Alert>
                  ))}
                </Stack>
              ) : (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ borderRadius: 2 }}>
                  No operational alerts — all workspaces look healthy from a platform perspective.
                </Alert>
              )}

              <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 2.5 }}>
                <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                  Quick actions
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button variant="contained" onClick={() => setTab(1)} sx={{ fontWeight: 800 }}>
                    Manage workspaces
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadOutlinedIcon />}
                    onClick={handleExport}
                    disabled={filtered.length === 0}
                    sx={{ fontWeight: 700 }}
                  >
                    Export tenant report (CSV)
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                  For extended metrics (orders, sales, invites), run{" "}
                  <strong>supabase/platform_admin_v2.sql</strong> in Supabase SQL Editor.
                </Typography>
              </Paper>
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 2 }}>
                <Stack
                  direction={{ xs: "column", lg: "row" }}
                  spacing={2}
                  alignItems={{ lg: "center" }}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <TextField
                    size="small"
                    placeholder="Search name, slug, or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ flex: 1, minWidth: 220 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="all">All statuses</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="trial">Trial</MenuItem>
                      <MenuItem value="suspended">Suspended</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Plan</InputLabel>
                    <Select label="Plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                      <MenuItem value="all">All plans</MenuItem>
                      <MenuItem value="trial">Trial</MenuItem>
                      <MenuItem value="pro">Pro</MenuItem>
                      <MenuItem value="enterprise">Enterprise</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Sort</InputLabel>
                    <Select label="Sort" value={sortId} onChange={(e) => setSortId(e.target.value)}>
                      {SORT_OPTIONS.map((o) => (
                        <MenuItem key={o.id} value={o.id}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    startIcon={<FileDownloadOutlinedIcon />}
                    onClick={handleExport}
                    disabled={filtered.length === 0}
                    sx={{ fontWeight: 700 }}
                  >
                    Export
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
                  Showing {filtered.length} of {orgs.length} workspace(s). Click a row for full details, team, and
                  lifecycle actions.
                </Typography>
              </Paper>

              <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), overflow: "hidden" }}>
                {loading ? (
                  <Box sx={{ py: 10, display: "flex", justifyContent: "center" }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer sx={{ maxHeight: "calc(100vh - 320px)" }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Workspace</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Plan</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>
                            Dist.
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>
                            Orders
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>
                            Admins
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>
                            Invites
                          </TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Created</TableCell>
                          <TableCell width={48} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                              <Typography color="text.secondary">
                                {orgs.length === 0 ? "No workspaces registered yet" : "No matches — adjust filters"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filtered.map((org) => {
                            const needsAttention =
                              org.status === "suspended" || (org.admin_count || 0) === 0;
                            return (
                              <TableRow
                                key={org.id}
                                hover
                                selected={selectedOrg?.id === org.id}
                                sx={{
                                  cursor: "pointer",
                                  ...(needsAttention && {
                                    bgcolor: alpha(
                                      org.status === "suspended"
                                        ? theme.palette.error.main
                                        : theme.palette.warning.main,
                                      0.06
                                    ),
                                  }),
                                }}
                                onClick={() => openDetail(org)}
                              >
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    {needsAttention ? (
                                      <WarningAmberOutlinedIcon fontSize="small" color="warning" />
                                    ) : null}
                                    <Box>
                                      <Typography fontWeight={700}>{org.name}</Typography>
                                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                                        {org.slug}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={PLAN_LABELS[org.plan] || org.plan}
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={STATUS_LABELS[org.status] || org.status}
                                    color={statusChipColor(org.status)}
                                  />
                                </TableCell>
                                <TableCell align="right">{org.distributor_count}</TableCell>
                                <TableCell align="right">{org.orders_count}</TableCell>
                                <TableCell align="right">{org.admin_count}</TableCell>
                                <TableCell align="right">{org.pending_invites_count}</TableCell>
                                <TableCell>{formatDate(org.created_at)}</TableCell>
                                <TableCell>
                                  <ChevronRightIcon fontSize="small" color="action" />
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            </Stack>
          )}
        </Container>
      </Box>

      <PlatformTenantDetailDrawer
        open={drawerOpen}
        org={selectedOrg}
        onClose={() => setDrawerOpen(false)}
        onUpdated={load}
        onDeleted={handleOrgDeleted}
        onToast={(message) => setToast({ open: true, message })}
        busy={busyId}
        setBusy={setBusyId}
      />

      <AppSnackbar
        open={toast.open}
        message={toast.message}
        onClose={() => setToast({ open: false, message: "" })}
      />
    </Box>
  );
}
