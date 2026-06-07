import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import { useOrganizationOptional } from '../context/OrganizationProvider';
import { getActiveOrganizationName, getActiveOrganizationSlug } from '../services/tenantScope';

/** Shows active workspace name in app chrome. */
export default function WorkspaceChip({ sx }) {
  const orgCtx = useOrganizationOptional();
  const name =
    orgCtx?.organization?.name ||
    getActiveOrganizationName() ||
    'Workspace';
  const slug = orgCtx?.organization?.slug || getActiveOrganizationSlug();

  return (
    <Tooltip title={slug ? `Workspace ID: ${slug}` : name}>
      <Chip
        size="small"
        icon={<BusinessOutlinedIcon sx={{ fontSize: '16px !important' }} />}
        label={name}
        sx={{
          maxWidth: { xs: 140, sm: 220 },
          fontWeight: 700,
          color: 'inherit',
          borderColor: 'rgba(255,255,255,0.35)',
          bgcolor: 'rgba(255,255,255,0.12)',
          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
          ...sx,
        }}
        variant="outlined"
      />
    </Tooltip>
  );
}
