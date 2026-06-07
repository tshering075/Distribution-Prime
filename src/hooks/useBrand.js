import { useMemo } from 'react';
import { useOrganizationOptional } from '../context/OrganizationProvider';
import { resolveOrganizationBrand } from '../utils/organizationBrand';
import { getActiveOrganizationName } from '../services/tenantScope';

/**
 * Effective brand for UI and documents (tenant override or app defaults).
 */
export function useBrand() {
  const orgCtx = useOrganizationOptional();
  return useMemo(() => {
    if (orgCtx?.brand) return orgCtx.brand;
    return resolveOrganizationBrand(null, getActiveOrganizationName());
  }, [orgCtx?.brand]);
}
