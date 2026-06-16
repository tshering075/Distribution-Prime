import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { resolveOrganizationForLogin } from '../services/organizationService';
import { PLATFORM_NAME } from '../constants/saas';
import { getCurrentUser } from '../services/supabaseService';

const SESSION_ROLE_KEY = 'session_role';
const SESSION_AUTH_ACTIVE_KEY = 'session_auth_active';

function isStaffRole(role) {
  const value = String(role || '').toLowerCase();
  return value === 'admin' || value === 'viewer';
}

/**
 * Workspace Gmail authorize landing page linked from the welcome email.
 * Route: /w/:workspaceSlug/connect-gmail
 */
export default function ConnectGmailPage() {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');
  const [connectedEmail, setConnectedEmail] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  const loginPath = `/w/${encodeURIComponent(workspaceSlug || '')}/login?returnTo=${encodeURIComponent(
    `/w/${workspaceSlug}/connect-gmail`
  )}`;

  const runAuthorize = useCallback(async (emailHint) => {
    setConnecting(true);
    setError('');
    try {
      const { connectGmailAsAdmin, isGmailConfigured } = await import('../services/gmailService');
      if (!(await isGmailConfigured())) {
        throw new Error(
          'Gmail API is not configured for this workspace yet. Ask your platform operator to save Gmail credentials in the Platform console.'
        );
      }
      const connected = await connectGmailAsAdmin(emailHint);
      if (!connected) {
        throw new Error('Gmail authorization completed but the account could not be verified.');
      }
      setConnectedEmail(connected);
    } catch (err) {
      setError(err?.message || 'Failed to connect Gmail');
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const org = await resolveOrganizationForLogin(workspaceSlug);
        if (cancelled) return;
        setOrgName(org?.name || workspaceSlug || 'your workspace');

        const role =
          sessionStorage.getItem(SESSION_ROLE_KEY) ||
          localStorage.getItem('userRole');
        const hasSession = sessionStorage.getItem(SESSION_AUTH_ACTIVE_KEY) === 'true';

        if (!hasSession || !isStaffRole(role)) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }

        const user = await getCurrentUser().catch(() => null);
        const email = String(user?.email || localStorage.getItem('admin_email') || '').trim();
        if (email) {
          setOwnerEmail(email);
          const { onAdminLogin } = await import('../services/gmailService');
          onAdminLogin(email);
        }

        const { isGmailConfigured, warmupGmailSession, hasGmailSession, getConnectedGmailEmail } =
          await import('../services/gmailService');

        if (await isGmailConfigured()) {
          await warmupGmailSession();
          if (hasGmailSession()) {
            const existing = await getConnectedGmailEmail();
            if (existing) {
              setConnectedEmail(existing);
              setLoading(false);
              return;
            }
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not open this workspace');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, runAuthorize]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="sm">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                {PLATFORM_NAME}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                Connect Gmail
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Workspace: <strong>{orgName}</strong>
              </Typography>
            </Box>

            {needsLogin ? (
              <>
                <Alert severity="info">
                  Sign in as the workspace owner to authorize Gmail for order emails.
                </Alert>
                <Button variant="contained" fullWidth onClick={() => navigate(loginPath)}>
                  Sign in to authorize Gmail
                </Button>
              </>
            ) : connectedEmail ? (
              <>
                <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                  Gmail is connected as <strong>{connectedEmail}</strong>. You can send order emails from this device.
                </Alert>
                <Button variant="contained" fullWidth onClick={() => navigate('/admin', { replace: true })}>
                  Go to admin dashboard
                </Button>
              </>
            ) : (
              <>
                {error ? <Alert severity="error">{error}</Alert> : null}
                <Typography variant="body2" color="text.secondary">
                  Authorize {ownerEmail ? <strong>{ownerEmail}</strong> : 'your admin account'} with Google so order
                  emails send from your Gmail address.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={connecting}
                  startIcon={connecting ? <CircularProgress size={18} color="inherit" /> : <MailOutlineIcon />}
                  onClick={() => runAuthorize(ownerEmail)}
                >
                  {connecting ? 'Authorizing…' : 'Authorize Gmail'}
                </Button>
              </>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
