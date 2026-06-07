import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  buildWorkspaceLoginUrl,
  deletePlatformOrganization,
  listTenantStaff,
  PLATFORM_PLANS,
  PLATFORM_STATUSES,
  PLAN_LABELS,
  PROTECTED_DEFAULT_ORG_ID,
  STATUS_LABELS,
  updatePlatformOrganization,
} from "../../services/platformAdminService";

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

function MetricTile({ label, value }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PlatformTenantDetailDrawer({
  open,
  org,
  onClose,
  onUpdated,
  onDeleted,
  onToast,
  busy,
  setBusy,
}) {
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("trial");
  const [editStatus, setEditStatus] = useState("active");
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmSlug, setDeleteConfirmSlug] = useState("");

  useEffect(() => {
    if (!org) return;
    setEditName(org.name || "");
    setEditPlan(org.plan || "trial");
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
      plan: editPlan,
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

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 480, md: 520 }, maxWidth: "100vw" },
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Stack
            direction="row"
            alignItems="flex-start"
            justifyContent="space-between"
            sx={{ p: 2.5, pb: 2, borderBottom: 1, borderColor: "divider" }}
          >
            <Box sx={{ minWidth: 0, pr: 1 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={800}>
                Workspace
              </Typography>
              <Typography variant="h6" fontWeight={900} noWrap>
                {org.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                {org.slug}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={PLAN_LABELS[org.plan] || org.plan}
                  color={org.plan === "enterprise" ? "secondary" : "default"}
                />
                <Chip
                  size="small"
                  label={STATUS_LABELS[org.status] || org.status}
                  color={org.status === "active" ? "success" : org.status === "suspended" ? "error" : "warning"}
                />
              </Stack>
            </Box>
            <IconButton onClick={onClose} edge="end" aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
              Usage snapshot
            </Typography>
            <Grid container spacing={1.25} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Distributors" value={org.distributor_count} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Admins" value={org.admin_count} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Members" value={org.member_count} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Orders" value={org.orders_count} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Sales rows" value={org.sales_count} />
              </Grid>
              <Grid item xs={6} sm={4}>
                <MetricTile label="Pending invites" value={org.pending_invites_count} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
              Configuration
            </Typography>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField
                label="Display name"
                size="small"
                fullWidth
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isBusy}
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  select
                  label="Plan"
                  size="small"
                  fullWidth
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  disabled={isBusy}
                >
                  {PLATFORM_PLANS.map((p) => (
                    <MenuItem key={p} value={p}>
                      {PLAN_LABELS[p] || p}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Status"
                  size="small"
                  fullWidth
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={isBusy}
                >
                  {PLATFORM_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {STATUS_LABELS[s] || s}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Button
                variant="contained"
                onClick={handleSaveDetails}
                disabled={isBusy || !editName.trim()}
                sx={{ alignSelf: "flex-start", fontWeight: 800 }}
              >
                {isBusy ? "Saving…" : "Save changes"}
              </Button>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              Access links
            </Typography>
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, wordBreak: "break-all" }}>
                  {loginUrl}
                </Typography>
                <Tooltip title="Copy login URL">
                  <IconButton size="small" onClick={() => copy(loginUrl, "Login URL")}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open login">
                  <IconButton size="small" component="a" href={loginUrl} target="_blank" rel="noopener noreferrer">
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                onClick={() => copy(org.id, "Organization UUID")}
                sx={{ alignSelf: "flex-start" }}
              >
                Copy organization ID
              </Button>
            </Stack>

            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              Team ({staff.length})
            </Typography>
            {staffLoading ? (
              <Box sx={{ py: 3, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={28} />
              </Box>
            ) : staff.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No admin or member records found for this workspace.
              </Typography>
            ) : (
              <TableContainer sx={{ mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staff.map((row, idx) => (
                      <TableRow key={`${row.user_id}-${idx}`}>
                        <TableCell>{row.name || "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.8rem" }}>{row.email || "—"}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.role || row.staff_type} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Created {formatDateTime(org.created_at)} · Updated {formatDateTime(org.updated_at)}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            <Typography variant="subtitle2" fontWeight={800} color="error.main" sx={{ mb: 1 }}>
              Danger zone
            </Typography>
            {isProtectedDefault ? (
              <Typography variant="body2" color="text.secondary">
                The default legacy workspace cannot be deleted.
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Permanently removes this workspace from Supabase: organization row, distributors,
                  orders, sales, targets, schemes, admins, invites, and members. This cannot be undone.
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  disabled={isBusy}
                  onClick={() => {
                    setDeleteConfirmSlug("");
                    setConfirmDelete(true);
                  }}
                  sx={{ fontWeight: 800 }}
                >
                  Delete workspace permanently
                </Button>
              </>
            )}
          </Box>

          <Stack
            direction="row"
            spacing={1}
            sx={{ p: 2, borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}
          >
            {editStatus === "suspended" ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleOutlineIcon />}
                disabled={isBusy}
                onClick={handleActivate}
                sx={{ fontWeight: 800 }}
              >
                Activate workspace
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<BlockIcon />}
                disabled={isBusy}
                onClick={() => setConfirmSuspend(true)}
                sx={{ fontWeight: 800 }}
              >
                Suspend workspace
              </Button>
            )}
          </Stack>
        </Stack>
      </Drawer>

      <Dialog open={confirmSuspend} onClose={() => setConfirmSuspend(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Suspend workspace?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Users signing in to <strong>{org.slug}</strong> will be blocked until you reactivate this
            workspace. Data is not deleted.
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
            This will delete <strong>{org.name}</strong> (<code>{org.slug}</code>) and all related data
            in Supabase. Auth users are not removed from Supabase Authentication.
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
