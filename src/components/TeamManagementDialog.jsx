import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  createTeamInvite,
  listOrganizationMembers,
  listPendingInvites,
} from '../services/organizationService';
import AppSnackbar from './AppSnackbar';

export default function TeamManagementDialog({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [inviteUrl, setInviteUrl] = useState('');
  const [members, setMembers] = useState({ admins: [], members: [] });
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([listOrganizationMembers(), listPendingInvites()]);
      setMembers(m);
      setPending(p);
    } catch (e) {
      setError(e?.message || 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setInviteUrl('');
    refresh();
  }, [open, refresh]);

  const handleInvite = async () => {
    setError('');
    try {
      const result = await createTeamInvite({ email, role });
      setInviteUrl(result.inviteUrl);
      setEmail('');
      refresh();
    } catch (e) {
      setError(e?.message || 'Could not create invite');
    }
  };

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Team &amp; invites</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Invite colleagues to this workspace. They sign in with the invited email and open the
              invite link.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
              />
              <TextField
                select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="shipping">Shipping</MenuItem>
              </TextField>
            </Stack>
            <Button variant="contained" onClick={handleInvite} disabled={!email.trim()}>
              Create invite link
            </Button>

            {inviteUrl ? (
              <Alert
                severity="success"
                action={
                  <Tooltip title="Copy link">
                    <IconButton color="inherit" size="small" onClick={copyLink}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                  {inviteUrl}
                </Typography>
              </Alert>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Typography variant="subtitle2" fontWeight={800}>
              Pending invites
            </Typography>
            {pending.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No pending invites
              </Typography>
            ) : (
              <List dense>
                {pending.map((inv) => (
                  <ListItem key={inv.id}>
                    <ListItemText primary={inv.email} secondary={inv.role} />
                    <Chip label="Pending" size="small" />
                  </ListItem>
                ))}
              </List>
            )}

            <Typography variant="subtitle2" fontWeight={800}>
              Members
            </Typography>
            <List dense>
              {(members.admins || []).map((a) => (
                <ListItem key={a.uid}>
                  <ListItemText
                    primary={a.name || a.email}
                    secondary={`${a.role || 'admin'} · ${a.email}`}
                  />
                </ListItem>
              ))}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={refresh} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
      <AppSnackbar
        open={copied}
        message="Invite link copied"
        severity="success"
        onClose={() => setCopied(false)}
      />
    </>
  );
}
