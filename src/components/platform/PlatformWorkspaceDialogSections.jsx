import React from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
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
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import { saasSurfaceCardSx } from "../../theme/saasChrome";
import { STATUS_LABELS, statusChipColor } from "../../utils/platformDashboardData";

export const WORKSPACE_TABS = [
  { value: "overview", label: "Overview", icon: DashboardOutlinedIcon },
  { value: "settings", label: "Settings", icon: SettingsOutlinedIcon },
  { value: "team", label: "Team", icon: GroupsOutlinedIcon },
  { value: "access", label: "Access", icon: LinkOutlinedIcon },
];

function SectionCard({ title, caption, children, action }) {
  const theme = useTheme();
  return (
    <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 2, borderRadius: 1.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: caption || children ? 1.5 : 0 }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1.2}>
            {title}
          </Typography>
          {caption ? (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          ) : null}
        </Box>
        {action || null}
      </Stack>
      {children}
    </Paper>
  );
}

function StatTile({ label, value, icon: Icon }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        flex: "1 1 120px",
        minWidth: 0,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        {Icon ? (
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              display: "flex",
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: "primary.main",
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        ) : null}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={900} lineHeight={1.1}>
            {value ?? "—"}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export function WorkspaceTabsBar({ tab, onChange, teamCount }) {
  const theme = useTheme();

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
      <Tabs
        value={tab}
        onChange={(_, v) => onChange(v)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          bgcolor: alpha(theme.palette.grey[500], 0.06),
          "& .MuiTab-root": {
            minHeight: 40,
            py: 0.75,
            textTransform: "none",
            fontWeight: 700,
            fontSize: "0.78rem",
            gap: 0.5,
          },
          "& .MuiTab-iconWrapper": { fontSize: 17 },
        }}
      >
        {WORKSPACE_TABS.map(({ value, label, icon: Icon }) => (
          <Tab
            key={value}
            value={value}
            label={value === "team" ? `${label} (${teamCount})` : label}
            icon={<Icon sx={{ fontSize: 17 }} />}
            iconPosition="start"
          />
        ))}
      </Tabs>
    </Paper>
  );
}

export function WorkspaceOverviewSection({ org, formatDateTime }) {
  return (
    <Stack spacing={2}>
      <SectionCard title="Workspace identity" caption="Core identifiers for this tenant.">
        <Stack spacing={1.25}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Display name
            </Typography>
            <Typography variant="body1" fontWeight={800}>
              {org.name}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Workspace slug
            </Typography>
            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
              {org.slug}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={STATUS_LABELS[org.status] || org.status}
              color={statusChipColor(org.status)}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title="Usage metrics" caption="Live counts from this workspace database.">
        <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
          <StatTile label="Admins" value={org.admin_count} icon={AdminPanelSettingsOutlinedIcon} />
          <StatTile label="Members" value={org.member_count} icon={GroupsOutlinedIcon} />
          <StatTile label="Sales rows" value={org.sales_count} />
          <StatTile label="Pending invites" value={org.pending_invites_count} icon={MailOutlineIcon} />
        </Stack>
      </SectionCard>

      <SectionCard title="Timeline" caption="When this workspace was provisioned and last updated.">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Created
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatDateTime(org.created_at)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              Last updated
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {formatDateTime(org.updated_at)}
            </Typography>
          </Box>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function WorkspaceSettingsSection({
  editName,
  editStatus,
  statusOptions,
  isBusy,
  onNameChange,
  onStatusChange,
  onSave,
}) {
  return (
    <Stack spacing={2}>
      <SectionCard
        title="Workspace configuration"
        caption="Update display name and lifecycle status."
      >
        <Stack spacing={2}>
          <TextField
            label="Display name"
            size="small"
            fullWidth
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isBusy}
          />
          <TextField
            select
            label="Status"
            size="small"
            fullWidth
            value={editStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={isBusy}
            sx={{ maxWidth: { md: 280 } }}
          >
            {statusOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS_LABELS[s] || s}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={isBusy || !editName.trim()}
            sx={{ alignSelf: "flex-start", fontWeight: 800 }}
          >
            {isBusy ? "Saving…" : "Save changes"}
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard title="Status guide" caption="What each status means for tenant users.">
        <Stack spacing={1}>
          <Typography variant="body2">
            <strong>Active</strong> — workspace users can sign in and use the app normally.
          </Typography>
          <Typography variant="body2">
            <strong>Trial</strong> — evaluation period; users can sign in normally.
          </Typography>
          <Typography variant="body2">
            <strong>Suspended</strong> — all sign-ins blocked until reactivated. Data is preserved.
          </Typography>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

export function WorkspaceTeamSection({ staff, staffLoading }) {
  const theme = useTheme();

  return (
    <SectionCard
      title="Team members"
      caption="Admins and organization members linked to this workspace."
      action={
        <Chip
          size="small"
          label={`${staff.length} member${staff.length === 1 ? "" : "s"}`}
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      }
    >
      {staffLoading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={28} />
        </Box>
      ) : staff.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No admin or member records found for this workspace.
        </Typography>
      ) : (
        <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["Name", "Email", "Role"].map((label) => (
                  <TableCell
                    key={label}
                    sx={{
                      fontWeight: 800,
                      fontSize: "0.72rem",
                      py: 1,
                      bgcolor: alpha(theme.palette.grey[500], 0.08),
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {staff.map((row, idx) => (
                <TableRow key={`${row.user_id}-${idx}`} hover>
                  <TableCell sx={{ py: 1 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <PersonOutlineIcon fontSize="small" color="action" />
                      <Typography variant="body2" fontWeight={600}>
                        {row.name || "—"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ py: 1, fontSize: "0.8rem" }}>{row.email || "—"}</TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <Chip
                      size="small"
                      icon={<BadgeOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                      label={row.role || row.staff_type}
                      variant="outlined"
                      sx={{ height: 24, fontSize: "0.7rem", fontWeight: 700 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
  );
}

export function WorkspaceAccessSection({ loginUrl, orgId, onCopy }) {
  return (
    <Stack spacing={2}>
      <SectionCard title="Workspace login URL" caption="Share this link with tenant admins and distributors.">
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.default" }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1, wordBreak: "break-all" }}>
              {loginUrl}
            </Typography>
            <Tooltip title="Copy login URL">
              <IconButton size="small" onClick={() => onCopy(loginUrl, "Login URL")}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open in new tab">
              <IconButton
                size="small"
                component="a"
                href={loginUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
        <Button
          variant="outlined"
          size="small"
          startIcon={<OpenInNewIcon />}
          component="a"
          href={loginUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mt: 1.5, fontWeight: 700 }}
        >
          Open workspace login
        </Button>
      </SectionCard>

      <SectionCard title="Organization ID" caption="Use for support, SQL queries, or API integrations.">
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "background.default" }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" fontFamily="monospace" sx={{ flex: 1, wordBreak: "break-all" }}>
              {orgId}
            </Typography>
            <Tooltip title="Copy organization ID">
              <IconButton size="small" onClick={() => onCopy(orgId, "Organization UUID")}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
      </SectionCard>
    </Stack>
  );
}

export function WorkspaceDangerSection({ isProtectedDefault, isBusy, onDelete }) {
  return (
    <SectionCard title="Danger zone" caption="Permanent deletion — cannot be undone.">
      {isProtectedDefault ? (
        <Typography variant="body2" color="text.secondary">
          The default legacy workspace cannot be deleted.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Permanently removes this workspace and all related data: organization, distributors, orders,
            sales, targets, schemes, admins, invites, and members. Supabase Auth users are not removed.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            disabled={isBusy}
            onClick={onDelete}
            sx={{ alignSelf: "flex-start", fontWeight: 800 }}
          >
            Delete workspace permanently
          </Button>
        </Stack>
      )}
    </SectionCard>
  );
}
