import React, { useCallback, useEffect, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SaveIcon from "@mui/icons-material/Save";
import {
  buildWorkspaceLoginUrl,
  deletePlatformOrganization,
  listTenantStaff,
  PLATFORM_STATUSES,
  PROTECTED_DEFAULT_ORG_ID,
  STATUS_LABELS,
  updatePlatformOrganization,
} from "../../services/platformAdminService";
import { statusChipColor } from "../../utils/platformDashboardData";
import {
  WorkspaceTabsBar,
  WorkspaceOverviewSection,
  WorkspaceSettingsSection,
  WorkspaceTeamSection,
  WorkspaceAccessSection,
  WorkspaceDangerSection,
} from "./PlatformWorkspaceDialogSections";

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default function PlatformWorkspaceDialog({
  open,
  org,
  onClose,
  onUpdated,
  onDeleted,
  onToast,
  busy,
  setBusy,
}) {
  const theme = useTheme();
  const [tab, setTab] = useState("overview");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab("overview");
  }, [open, org?.id]);

  useEffect(() => {
    if (!org) return;
    setEditName(org.name || "");
    setEditStatus(org.status || "active");
  }, [org]);

  const loadStaff = useCallback(async () => {
    if (!org?.id) return;
    setStaffLoading(true);
    try {
      const rows = await listTenantStaff(org.id);
      setStaff(rows);
    } catch (e) {
      onToast?.(e?.message || "Could not load team");
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  }, [org?.id, onToast]);

  useEffect(() => {
    if (open && org?.id) loadStaff();
  }, [open, org?.id, loadStaff]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast?.(`${label} copied`);
    } catch {
      onToast?.("Copy failed");
    }
  };

  const save = async (patch) => {
    if (!org?.id) return;
    setBusy(org.id);
    try {
      await updatePlatformOrganization(org.id, patch);
      await onUpdated?.();
      onToast?.("Workspace saved");
    } catch (e) {
      onToast?.(e?.message || "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveDetails = () => {
    save({
      name: editName.trim(),
      status: editStatus,
    });
  };

  const handleSuspend = async () => {
    setConfirmSuspend(false);
    await save({ status: "suspended" });
    setEditStatus("suspended");
  };

  const handleActivate = async () => {
    await save({ status: "active" });
    setEditStatus("active");
  };

  const handleDelete = async () => {
    if (!org?.id) return;
    setBusy(org.id);
    try {
      await deletePlatformOrganization(org.id);
      setConfirmDelete(false);
      setDeleteConfirmSlug("");
      onToast?.(`Workspace "${org.slug}" deleted`);
      onClose?.();
      await onDeleted?.();
    } catch (e) {
      onToast?.(e?.message || "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  if (!org) return null;

  const loginUrl = buildWorkspaceLoginUrl(org.slug);
  const isBusy = busy === org.id;
  const isProtectedDefault = org.id === PROTECTED_DEFAULT_ORG_ID;
  const deleteSlugOk = deleteConfirmSlug.trim() === String(org.slug || "").trim();

  const renderTabContent = () => {
    switch (tab) {
      case "settings":
        return (
          <Stack spacing={2}>
            <WorkspaceSettingsSection
              editName={editName}
              editStatus={editStatus}
              statusOptions={PLATFORM_STATUSES}
              isBusy={isBusy}
              onNameChange={setEditName}
              onStatusChange={setEditStatus}
              onSave={handleSaveDetails}
            />
            <WorkspaceDangerSection
              isProtectedDefault={isProtectedDefault}
              isBusy={isBusy}
              onDelete={() => {
                setDeleteConfirmSlug("");
                setConfirmDelete(true);
              }}
            />
          </Stack>
        );
      case "team":
        return <WorkspaceTeamSection staff={staff} staffLoading={staffLoading} />;
      case "access":
        return (
          <WorkspaceAccessSection loginUrl={loginUrl} orgId={org.id} onCopy={copy} />
        );
      default:
        return <WorkspaceOverviewSection org={org} formatDateTime={formatDateTime} />;
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen
        PaperProps={{ sx: { display: "flex", flexDirection: "column", bgcolor: "background.default" } }}
      >
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: "#fff",
          }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 52, gap: 1.25, color: "inherit" }}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.common.white, 0.15),
                display: "flex",
                flexShrink: 0,
              }}
            >
              <BusinessOutlinedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: "0.95rem" }} noWrap>
                {org.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ opacity: 0.9, fontSize: "0.68rem", display: "block", fontFamily: "monospace" }}
                noWrap
              >
                {org.slug}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={STATUS_LABELS[org.status] || org.status}
              color={statusChipColor(org.status)}
              sx={{ height: 24, fontWeight: 700, display: { xs: "none", sm: "flex" } }}
            />
            <IconButton size="small" color="inherit" onClick={onClose} aria-label="Close workspace">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <Container maxWidth="md" sx={{ py: 1.5, pb: 8 }}>
            <Stack spacing={1.5}>
              <WorkspaceTabsBar tab={tab} onChange={setTab} teamCount={staff.length} />
              {renderTabContent()}
            </Stack>
          </Container>
        </Box>

        <Paper
          elevation={4}
          square
          sx={{
            position: "sticky",
            bottom: 0,
            borderTop: 1,
            borderColor: "divider",
            px: { xs: 1.25, sm: 2 },
            py: 1,
          }}
        >
          <Container maxWidth="md" sx={{ px: 0 }}>
            <Stack direction="row" spacing={1} justifyContent="space-between" flexWrap="wrap" useFlexGap>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {editStatus === "suspended" ? (
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CheckCircleOutlineIcon />}
                    disabled={isBusy}
                    onClick={handleActivate}
                    sx={{ fontWeight: 800 }}
                  >
                    Activate
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    color="warning"
                    size="small"
                    startIcon={<BlockIcon />}
                    disabled={isBusy}
                    onClick={() => setConfirmSuspend(true)}
                    sx={{ fontWeight: 800 }}
                  >
                    Suspend
                  </Button>
                )}
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {tab === "settings" ? (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={isBusy ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    disabled={isBusy || !editName.trim()}
                    onClick={handleSaveDetails}
                    sx={{ fontWeight: 800 }}
                  >
                    {isBusy ? "Saving…" : "Save"}
                  </Button>
                ) : null}
                <Button variant="outlined" size="small" onClick={onClose} sx={{ fontWeight: 700 }}>
                  Close
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Paper>
      </Dialog>

      <Dialog open={confirmSuspend} onClose={() => setConfirmSuspend(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Suspend workspace?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Users signing in to <strong>{org.slug}</strong> will be blocked until you reactivate this workspace.
            Data is not deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSuspend(false)}>Cancel</Button>
          <Button color="warning" variant="contained" onClick={handleSuspend} sx={{ fontWeight: 800 }}>
            Suspend
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => !isBusy && setConfirmDelete(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>
          Delete workspace permanently?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will delete <strong>{org.name}</strong> (<code>{org.slug}</code>) and all related data in
            Supabase. Auth users are not removed from Supabase Authentication.
          </DialogContentText>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Type <strong>{org.slug}</strong> to confirm:
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={deleteConfirmSlug}
            onChange={(e) => setDeleteConfirmSlug(e.target.value)}
            placeholder={org.slug}
            autoComplete="off"
            disabled={isBusy}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={isBusy || !deleteSlugOk}
            onClick={handleDelete}
            sx={{ fontWeight: 800 }}
          >
            {isBusy ? "Deleting…" : "Delete forever"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
