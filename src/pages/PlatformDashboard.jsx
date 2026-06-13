import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Toolbar,
  Tooltip,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import SaasAppBarTitle from "../components/saas/SaasAppBarTitle";
import AppSnackbar from "../components/AppSnackbar";
import PlatformWorkspaceDialog from "../components/platform/PlatformWorkspaceDialog";
import PlatformUsersDialog from "../components/platform/PlatformUsersDialog";
import {
  PlatformFiltersPanel,
  PlatformWorkspacesTable,
} from "../components/platform/PlatformDashboardSections";
import {
  checkPlatformAdmin,
  listPlatformOrganizations,
  exportTenantsCsv,
  downloadCsv,
} from "../services/platformAdminService";
import { getCurrentUser } from "../services/supabaseService";
import { PLATFORM_NAME } from "../constants/saas";
import { filterPlatformOrgs, computePlatformStats } from "../utils/platformDashboardData";
import {
  saasAppBarSx,
  saasAppBarToolbarSx,
  saasDashboardMainSx,
  saasContentColumnSx,
  saasPageBackdropSx,
} from "../theme/saasChrome";

export default function PlatformDashboard({ onLogout }) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortId, setSortId] = useState("created_desc");
  const [operatorEmail, setOperatorEmail] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
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

  const filtered = useMemo(
    () => filterPlatformOrgs(orgs, { search, statusFilter, sortId }),
    [orgs, search, statusFilter, sortId]
  );

  const stats = useMemo(() => computePlatformStats(orgs), [orgs]);

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || sortId !== "created_desc";

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSortId("created_desc");
  };

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

  const headerSubtitle = [
    operatorEmail,
    lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : null,
    `${stats.total} workspaces · ${stats.active} active`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Box
      sx={{
        ...saasPageBackdropSx(theme),
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AppBar sx={saasAppBarSx(theme)}>
        <Toolbar sx={saasAppBarToolbarSx()}>
          <SaasAppBarTitle
            title={`${PLATFORM_NAME} Operator Console`}
            subtitle={headerSubtitle || "Platform administration"}
          />
          <Tooltip title="Platform operators">
            <Button
              color="inherit"
              size="small"
              startIcon={<PeopleOutlinedIcon />}
              onClick={() => setUsersDialogOpen(true)}
              sx={{ fontWeight: 700, display: { xs: "none", sm: "inline-flex" } }}
            >
              Operators
            </Button>
          </Tooltip>
          <Tooltip title="Platform operators">
            <span>
              <IconButton
                color="inherit"
                onClick={() => setUsersDialogOpen(true)}
                sx={{ display: { xs: "inline-flex", sm: "none" } }}
                aria-label="Platform operators"
              >
                <PeopleOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
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

      <Box
        component="main"
        sx={{
          ...saasDashboardMainSx(theme),
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Toolbar />

        <Container
          maxWidth={false}
          sx={{
            ...saasContentColumnSx(1400),
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            py: 0,
          }}
        >
          {error ? (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5, flexShrink: 0 }}>
              {error}
            </Alert>
          ) : null}

          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
              minHeight: 0,
            }}
          >
            <PlatformFiltersPanel
              search={search}
              statusFilter={statusFilter}
              sortId={sortId}
              filteredCount={filtered.length}
              totalCount={orgs.length}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onSortChange={setSortId}
              onExport={handleExport}
              exportDisabled={filtered.length === 0}
              onReset={resetFilters}
              hasActiveFilters={hasActiveFilters}
            />
            <PlatformWorkspacesTable
              rows={filtered}
              loading={loading}
              selectedId={selectedOrg?.id}
              onRowClick={openDetail}
              totalCount={orgs.length}
            />
          </Box>
        </Container>
      </Box>

      <PlatformUsersDialog
        open={usersDialogOpen}
        onClose={() => setUsersDialogOpen(false)}
        onToast={(message) => setToast({ open: true, message })}
      />

      <PlatformWorkspaceDialog
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
