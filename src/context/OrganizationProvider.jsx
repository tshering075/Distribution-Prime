import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getActiveOrganizationId } from '../services/tenantScope';
import {
  fetchOrganizationById,
  updateOrganizationSettings,
} from '../services/organizationService';
import { resolveOrganizationBrand } from '../utils/organizationBrand';

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshOrganization = useCallback(async () => {
    const id = getActiveOrganizationId();
    if (!id) {
      setOrganization(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const row = await fetchOrganizationById(id);
      setOrganization(row);
      return row;
    } catch (e) {
      console.warn('Failed to load organization:', e);
      setOrganization(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrganization();
  }, [refreshOrganization]);

  const brand = useMemo(
    () => resolveOrganizationBrand(organization?.settings, organization?.name),
    [organization]
  );

  const saveSettings = useCallback(
    async (patch) => {
      const id = organization?.id || getActiveOrganizationId();
      if (!id) throw new Error('No active workspace');
      const updated = await updateOrganizationSettings(id, patch);
      setOrganization(updated);
      return updated;
    },
    [organization?.id]
  );

  const value = useMemo(
    () => ({
      organization,
      brand,
      loading,
      refreshOrganization,
      saveSettings,
    }),
    [organization, brand, loading, refreshOrganization, saveSettings]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return ctx;
}

/** Safe when provider is optional (public pages). */
export function useOrganizationOptional() {
  return useContext(OrganizationContext);
}
