import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  acceptOrganizationInvite,
  getInviteByToken,
  inviteRoleToAppRole,
} from '../services/organizationService';
import { getCurrentUser } from '../services/supabaseService';
import { resolvePermissionsForRole } from '../utils/permissions';
import { PLATFORM_NAME } from '../constants/saas';
import { BRAND_MARK_SRC } from '../constants/brand';
import { logoSrcWithPublicUrl } from '../utils/organizationBrand';

const publicUrl = process.env.PUBLIC_URL || '';

function homePathForRole(role) {
  if (role === 'shipping') return '/shipping';
  if (role === 'distributor') return '/distributor';
  return '/admin';
}

export default function InviteAcceptPage({ onLogin }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await getInviteByToken(token);
        if (!cancelled) setInvite(row);
        if (!row && !cancelled) setError('This invite is invalid or has expired.');
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load invite');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const completeJoin = (appRole, org) => {
    localStorage.setItem('userRole', appRole);
    localStorage.setItem('userPermissions', JSON.stringify(resolvePermissionsForRole(appRole)));
    onLogin?.(appRole);
    navigate(homePathForRole(appRole), {
      replace: true,
      state: { joinedWorkspace: org?.name },
    });
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const user = await getCurrentUser();
      if (!user) {
        setAccepting(false);
        navigate(`/login?invite=${encodeURIComponent(token || '')}&email=${encodeURIComponent(invite?.email || '')}`, {
          replace: true,
        });
        return;
      }
      const { org, appRole } = await acceptOrganizationInvite(token, user);
      completeJoin(appRole || inviteRoleToAppRole(invite?.role), org);
    } catch (e) {
      setError(e?.message || 'Could not accept invite');
      setAccepting(false);
    }
  };

  const orgName = invite?.organizations?.name || 'a workspace';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 6 }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Box component="img" src={logoSrcWithPublicUrl(BRAND_MARK_SRC, publicUrl)} alt="" sx={{ width: 64 }} />
            <Typography variant="h5" fontWeight={900}>
              Join {orgName}
            </Typography>
            <Typography color="text.secondary">
              You were invited to collaborate on {PLATFORM_NAME}.
              {invite?.email ? ` Sign in as ${invite.email} to continue.` : ''}
            </Typography>
            {loading ? <CircularProgress /> : null}
            {error ? (
              <Alert severity="error" sx={{ width: '100%' }}>
                {error}
              </Alert>
            ) : null}
            {!loading && invite ? (
              <Stack spacing={1} sx={{ width: '100%' }}>
                <Button variant="contained" size="large" onClick={handleAccept} disabled={accepting}>
                  {accepting ? 'Joining…' : 'Accept invite'}
                </Button>
                <Button
                  component={RouterLink}
                  to={`/login?invite=${encodeURIComponent(token || '')}&email=${encodeURIComponent(invite.email || '')}`}
                  variant="text"
                >
                  Sign in with another account
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
