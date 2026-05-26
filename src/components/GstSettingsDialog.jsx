import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
} from "@mui/material";

function normalizePolicy(policy) {
  return {
    defaultEnabled: !!policy?.defaultEnabled,
    regionEnabled: policy?.regionEnabled && typeof policy.regionEnabled === "object"
      ? { ...policy.regionEnabled }
      : {},
    distributorEnabled: policy?.distributorEnabled && typeof policy.distributorEnabled === "object"
      ? { ...policy.distributorEnabled }
      : {},
  };
}

export default function GstSettingsDialog({
  open,
  onClose,
  policy,
  regions = [],
  distributors = [],
  saving = false,
  onSave,
}) {
  const [draft, setDraft] = useState(() => normalizePolicy(policy));

  useEffect(() => {
    if (!open) return;
    setDraft(normalizePolicy(policy));
  }, [open, policy]);

  const orderedRegions = useMemo(() => {
    const unique = Array.from(
      new Set(
        (regions || [])
          .map((r) => String(r || "").trim())
          .filter(Boolean)
      )
    );
    return unique.sort((a, b) => a.localeCompare(b));
  }, [regions]);

  const orderedDistributors = useMemo(() => {
    const rows = (distributors || [])
      .map((d) => ({
        code: String(d?.code || "").trim(),
        name: String(d?.name || "").trim() || String(d?.code || "").trim(),
        region: String(d?.region || "").trim(),
      }))
      .filter((d) => d.code);
    rows.sort((a, b) => {
      const byRegion = (a.region || "").localeCompare(b.region || "");
      if (byRegion !== 0) return byRegion;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [distributors]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>GST Settings</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Admin controls GST for all distributors. Priority: distributor override, then region override, then global default.
        </Typography>
        <Box sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1.5, mb: 2 }}>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Switch
                color="warning"
                checked={!!draft.defaultEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDraft((prev) => ({ ...prev, defaultEnabled: checked }));
                }}
              />
            }
            label={draft.defaultEnabled ? "Global default: GST ON (5%)" : "Global default: GST OFF"}
          />
        </Box>

        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Region Overrides
        </Typography>
        {orderedRegions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No regions found from distributor list.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {orderedRegions.map((region) => {
              const hasOverride = Object.prototype.hasOwnProperty.call(draft.regionEnabled, region);
              const checked = hasOverride ? !!draft.regionEnabled[region] : !!draft.defaultEnabled;
              return (
                <Box
                  key={region}
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
                >
                  <Typography variant="body2">{region}</Typography>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        color="warning"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setDraft((prev) => ({
                            ...prev,
                            regionEnabled: {
                              ...prev.regionEnabled,
                              [region]: next,
                            },
                          }));
                        }}
                      />
                    }
                    label={checked ? "GST ON" : "GST OFF"}
                  />
                </Box>
              );
            })}
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Distributor Overrides
        </Typography>
        {orderedDistributors.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No distributors found.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 280, overflowY: "auto", pr: 0.5 }}>
            {orderedDistributors.map((dist) => {
              const byDistributor = Object.prototype.hasOwnProperty.call(draft.distributorEnabled, dist.code)
                ? !!draft.distributorEnabled[dist.code]
                : null;
              const byRegion = Object.prototype.hasOwnProperty.call(draft.regionEnabled, dist.region)
                ? !!draft.regionEnabled[dist.region]
                : null;
              const checked = byDistributor != null
                ? byDistributor
                : byRegion != null
                  ? byRegion
                  : !!draft.defaultEnabled;
              return (
                <Box
                  key={dist.code}
                  sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap>{dist.name} ({dist.code})</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {dist.region || "No Region"}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        color="warning"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setDraft((prev) => ({
                            ...prev,
                            distributorEnabled: {
                              ...prev.distributorEnabled,
                              [dist.code]: next,
                            },
                          }));
                        }}
                      />
                    }
                    label={checked ? "GST ON" : "GST OFF"}
                  />
                </Box>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained"
          color="warning"
          disabled={saving}
          onClick={() => onSave && onSave(draft)}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
