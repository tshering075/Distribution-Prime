import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemText,
  CircularProgress,
  Typography,
} from '@mui/material';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { getCurrentUser } from '../services/supabaseService';
import {
  listOrganizationsForUser,
  switchActiveOrganization,
} from '../services/organizationService';
import { getActiveOrganizationId } from '../services/tenantScope';

export default function WorkspaceSwitcher({ sx }) {
  const [anchor, setAnchor] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentName, setCurrentName] = useState('Workspace');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const list = await listOrganizationsForUser(user.id);
      setOrgs(list);
      const activeId = getActiveOrganizationId();
      const active = list.find((o) => o.id === activeId);
      if (active?.name) setCurrentName(active.name);
    } catch (e) {
      console.warn('WorkspaceSwitcher:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (org) => {
    setAnchor(null);
    await switchActiveOrganization(org);
    window.location.reload();
  };

  if (orgs.length <= 1) return null;

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={loading ? <CircularProgress size={14} color="inherit" /> : <UnfoldMoreIcon />}
        sx={{
          textTransform: 'none',
          fontWeight: 800,
          maxWidth: { xs: 140, sm: 200 },
          ...sx,
        }}
      >
        <Typography noWrap variant="body2" component="span" sx={{ fontWeight: 800 }}>
          {currentName}
        </Typography>
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem disabled>
          <ListItemText primary="Switch workspace" secondary="Your account" />
        </MenuItem>
        {orgs.map((org) => (
          <MenuItem key={org.id} onClick={() => handleSelect(org)}>
            <ListItemText
              primary={org.name || org.slug}
              secondary={org.slug ? `ID: ${org.slug}` : undefined}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
