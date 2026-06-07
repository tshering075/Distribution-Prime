import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import LoginPage from './LoginPage';
import { getOrganizationBySlug, resolveOrganizationForLogin } from '../services/organizationService';
import { resolveOrganizationBrand } from '../utils/organizationBrand';
import { PLATFORM_NAME } from '../constants/saas';

/**
 * Tenant-branded login: /w/:workspaceSlug/login
 */
export default function WorkspaceLoginPage({ onLogin }) {
  const { workspaceSlug } = useParams();
  const [ready, setReady] = useState(false);
  const [org, setOrg] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await resolveOrganizationForLogin(workspaceSlug);
        const row = await getOrganizationBySlug(workspaceSlug);
        if (!cancelled) {
          setOrg(row);
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Workspace not found');
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug]);

  if (!workspaceSlug) {
    return <Navigate to="/login" replace />;
  }

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Typography color="error" textAlign="center">
          {error}.{' '}
          <Typography component="a" href="/login" color="primary">
            Try main sign in
          </Typography>
        </Typography>
      </Box>
    );
  }

  const brand = resolveOrganizationBrand(org?.settings, org?.name);

  return (
    <LoginPage
      onLogin={onLogin}
      lockedWorkspaceSlug={workspaceSlug}
      workspaceDisplayName={brand.appName}
      subtitle={`${org?.name || brand.appName} on ${PLATFORM_NAME}`}
    />
  );
}
