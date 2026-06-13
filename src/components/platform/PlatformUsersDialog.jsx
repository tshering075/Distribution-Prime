import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  FormControl,
  IconButton,
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
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import {
  createPlatformAdminAccount,
  listPlatformAdmins,
  removePlatformAdmin,
  PLATFORM_ADMIN_ROLES,
  PLATFORM_ROLE_LABELS,
} from "../../services/platformAdminService";
import { getCurrentUser } from "../../services/supabaseService";
import { saasSurfaceCardSx } from "../../theme/saasChrome";

function formatWhen(iso) {
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

export default function PlatformUsersDialog({ open, onClose, onToast }) {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [operators, setOperators] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const loadOperators = useCallback(async () => {
    setLoadingList(true);
    setError("");
    try {
      const rows = await listPlatformAdmins();
      setOperators(rows);
    } catch (e) {
      setError(e?.message || "Could not load platform operators");
      setOperators([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(0);
    setEmail("");
    setPassword("");
    setRole("operator");
    setError("");
    loadOperators();
    (async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUserId(user?.id || null);
      } catch {
        setCurrentUserId(null);
      }
    })();
  }, [open, loadOperators]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createPlatformAdminAccount({ email, password, role });
      onToast?.(`Platform operator added: ${email.trim().toLowerCase()}`);
      setEmail("");
      setPassword("");
      setRole("operator");
      setTab(0);
      await loadOperators();
    } catch (err) {
      setError(err?.message || "Could not add platform operator");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row) => {
    if (!row?.user_id) return;
    const ok = window.confirm(`Remove platform access for ${row.email}?`);
    if (!ok) return;
    setRemovingId(row.user_id);
    setError("");
    try {
      await removePlatformAdmin(row.user_id);
      onToast?.(`Removed ${row.email}`);
      await loadOperators();
    } catch (err) {
      setError(err?.message || "Could not remove operator");
    } finally {
      setRemovingId(null);
    }
  };

  return (
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
        <Toolbar variant="dense" sx={{ minHeight: 48, gap: 1, color: "inherit" }}>
          <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 22 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: "0.95rem" }}>
              Platform operators
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.88, fontSize: "0.65rem", display: "block" }}>
              {operators.length} operator{operators.length === 1 ? "" : "s"} with console access
            </Typography>
          </Box>
          <IconButton size="small" color="inherit" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
          {error ? (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 1.5 }} onClose={() => setError("")}>
              {error}
            </Alert>
          ) : null}

          <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), borderRadius: 1.5, overflow: "hidden", mb: 2 }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="fullWidth"
              sx={{
                minHeight: 40,
                bgcolor: alpha(theme.palette.grey[500], 0.06),
                "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 700, fontSize: "0.8rem" },
              }}
            >
              <Tab icon={<PeopleOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Operators" />
              <Tab icon={<PersonAddOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Add operator" />
            </Tabs>
          </Paper>

          {tab === 0 ? (
            <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), borderRadius: 1.5, overflow: "hidden" }}>
              {loadingList ? (
                <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
                  <CircularProgress size={28} />
                </Box>
              ) : operators.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  No platform operators found. Add one in the Add operator tab.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Email", "Role", "Added", ""].map((label) => (
                          <TableCell
                            key={label || "actions"}
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
                      {operators.map((row) => {
                        const isSelf = row.user_id === currentUserId;
                        return (
                          <TableRow key={row.id || row.user_id} hover>
                            <TableCell sx={{ py: 1, fontSize: "0.85rem" }}>
                              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                <Typography variant="body2" fontWeight={600}>
                                  {row.email}
                                </Typography>
                                {isSelf ? (
                                  <Chip size="small" label="You" color="primary" sx={{ height: 20, fontSize: "0.65rem" }} />
                                ) : null}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <Chip
                                size="small"
                                label={PLATFORM_ROLE_LABELS[row.role] || row.role}
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                              {formatWhen(row.created_at)}
                            </TableCell>
                            <TableCell align="right" sx={{ py: 1 }}>
                              <Button
                                size="small"
                                color="error"
                                startIcon={
                                  removingId === row.user_id ? (
                                    <CircularProgress size={14} color="inherit" />
                                  ) : (
                                    <DeleteOutlineIcon fontSize="small" />
                                  )
                                }
                                disabled={isSelf || removingId === row.user_id || operators.length <= 1}
                                onClick={() => handleRemove(row)}
                                sx={{ fontWeight: 700 }}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ ...saasSurfaceCardSx(theme), p: 2, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                Add platform operator
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Creates a Supabase Auth account and grants access to this platform console.
              </Typography>

              <Box component="form" onSubmit={handleCreate}>
                <Stack spacing={1.5}>
                  <TextField
                    label="Email"
                    type="email"
                    size="small"
                    fullWidth
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={saving}
                    autoComplete="off"
                  />
                  <TextField
                    label="Password"
                    type="password"
                    size="small"
                    fullWidth
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={saving}
                    helperText="Minimum 6 characters (Supabase Auth policy)"
                    autoComplete="new-password"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}>
                      {PLATFORM_ADMIN_ROLES.map((r) => (
                        <MenuItem key={r} value={r}>
                          {PLATFORM_ROLE_LABELS[r] || r}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button variant="outlined" onClick={() => setTab(0)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={saving || !email.trim() || password.length < 6}
                      startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <PersonAddOutlinedIcon />}
                      sx={{ fontWeight: 800 }}
                    >
                      {saving ? "Adding…" : "Add operator"}
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
