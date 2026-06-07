import React, { useMemo, useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Slide,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { DEFAULT_GST_REGIONS, normalizeGstRegionName } from "../utils/globalGstSetting";

const normalizeRegionName = normalizeGstRegionName;

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const REGION_CHIP_COLOR = {
  Southern: "error",
  Western: "warning",
  Eastern: "info",
  Northern: "secondary",
};

function normalizePolicy(policy) {
  return {
    defaultEnabled: !!policy?.defaultEnabled,
    regionEnabled:
      policy?.regionEnabled && typeof policy.regionEnabled === "object"
        ? { ...policy.regionEnabled }
        : {},
    distributorEnabled:
      policy?.distributorEnabled && typeof policy.distributorEnabled === "object"
        ? { ...policy.distributorEnabled }
        : {},
  };
}

function resolveEffectiveGst(draft, dist) {
  const byDistributor = Object.prototype.hasOwnProperty.call(draft.distributorEnabled, dist.code)
    ? !!draft.distributorEnabled[dist.code]
    : null;
  const regionKey = normalizeRegionName(dist.region);
  const byRegion = Object.prototype.hasOwnProperty.call(draft.regionEnabled, regionKey)
    ? !!draft.regionEnabled[regionKey]
    : null;
  if (byDistributor != null) return byDistributor;
  if (byRegion != null) return byRegion;
  return !!draft.defaultEnabled;
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
  const theme = useTheme();
  const [draft, setDraft] = useState(() => normalizePolicy(policy));
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("All");

  useEffect(() => {
    if (!open) return;
    setDraft(normalizePolicy(policy));
    setQuery("");
    setRegionFilter("All");
  }, [open, policy]);

  const orderedRegions = useMemo(() => {
    const fromDistributors = (regions || []).map((r) => normalizeRegionName(r)).filter(Boolean);
    return Array.from(new Set([...DEFAULT_GST_REGIONS, ...fromDistributors])).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [regions]);

  const orderedDistributors = useMemo(() => {
    const rows = (distributors || [])
      .map((d) => ({
        code: String(d?.code || "").trim(),
        name: String(d?.name || "").trim() || String(d?.code || "").trim(),
        region: normalizeRegionName(d?.region),
      }))
      .filter((d) => d.code);
    rows.sort((a, b) => {
      const byRegion = (a.region || "").localeCompare(b.region || "");
      if (byRegion !== 0) return byRegion;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [distributors]);

  const filteredDistributors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orderedDistributors.filter((dist) => {
      if (regionFilter !== "All" && dist.region !== regionFilter) return false;
      if (!q) return true;
      return (
        dist.name.toLowerCase().includes(q) ||
        dist.code.toLowerCase().includes(q) ||
        (dist.region || "").toLowerCase().includes(q)
      );
    });
  }, [orderedDistributors, query, regionFilter]);

  const regionCounts = useMemo(() => {
    const counts = {};
    orderedRegions.forEach((r) => {
      counts[r] = orderedDistributors.filter((d) => d.region === r).length;
    });
    return counts;
  }, [orderedRegions, orderedDistributors]);

  const distributorOverrideCount = Object.keys(draft.distributorEnabled || {}).length;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullScreen
      TransitionComponent={Transition}
      TransitionProps={{ timeout: 200 }}
      scroll="paper"
      PaperProps={{
        elevation: 0,
        sx: {
          bgcolor: "background.default",
          color: "text.primary",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      {saving ? <LinearProgress color="warning" /> : null}

      <Box
        sx={{
          flexShrink: 0,
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.warning.dark} 0%, ${t.palette.warning.main} 55%, ${alpha(t.palette.warning.light, 0.95)} 100%)`,
          color: "#fff",
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 1.25, sm: 1.5 },
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          boxShadow: `0 4px 16px ${alpha(theme.palette.warning.dark, 0.35)}`,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LocalOfferOutlinedIcon sx={{ fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" }, lineHeight: 1.2 }}
          >
            GST Settings
          </Typography>
          <Typography
            variant="body2"
            sx={{ opacity: 0.92, mt: 0.25, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
          >
            Control 5% GST for all distributors · Priority: distributor → region → global default
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="inherit"
          size="small"
          startIcon={<SaveIcon />}
          disabled={saving}
          onClick={() => onSave && onSave(draft)}
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            textTransform: "none",
            fontWeight: 800,
            bgcolor: "rgba(255,255,255,0.22)",
            color: "#fff",
            "&:hover": { bgcolor: "rgba(255,255,255,0.32)" },
          }}
        >
          Save
        </Button>
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: "#fff" }} size="large" disabled={saving}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto", p: { xs: 1.5, sm: 2.5 } }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} lg={4}>
            <Stack spacing={2}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <PublicOutlinedIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={800}>
                    Global default
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
                  Applies to every distributor unless a region or individual override is set.
                </Typography>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.main, draft.defaultEnabled ? 0.1 : 0.04),
                    border: "1px solid",
                    borderColor: draft.defaultEnabled
                      ? alpha(theme.palette.warning.main, 0.35)
                      : "divider",
                  }}
                >
                  <FormControlLabel
                    sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
                    labelPlacement="start"
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
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={700}>
                          {draft.defaultEnabled ? "GST ON (5%)" : "GST OFF"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Workspace-wide baseline
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <StorefrontOutlinedIcon color="warning" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={800}>
                    Region overrides
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
                  Override the global default for an entire region.
                </Typography>
                <Stack spacing={1.25}>
                  {orderedRegions.map((region) => {
                    const hasOverride = Object.prototype.hasOwnProperty.call(draft.regionEnabled, region);
                    const checked = hasOverride ? !!draft.regionEnabled[region] : !!draft.defaultEnabled;
                    const count = regionCounts[region] || 0;
                    return (
                      <Box
                        key={region}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: hasOverride
                            ? alpha(theme.palette.warning.main, 0.4)
                            : "divider",
                          bgcolor: hasOverride
                            ? alpha(theme.palette.warning.main, 0.06)
                            : "background.paper",
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          spacing={1}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" fontWeight={800}>
                                {region}
                              </Typography>
                              <Chip
                                size="small"
                                label={`${count} dist.`}
                                color={REGION_CHIP_COLOR[region] || "default"}
                                variant="outlined"
                                sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                              {hasOverride ? (
                                <Chip
                                  size="small"
                                  label="Override"
                                  color="warning"
                                  sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }}
                                />
                              ) : null}
                            </Stack>
                            <Typography variant="caption" color="text.secondary">
                              {hasOverride ? "Custom for this region" : "Using global default"}
                            </Typography>
                          </Box>
                          <FormControlLabel
                            sx={{ m: 0, flexShrink: 0 }}
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
                            label={checked ? "ON" : "OFF"}
                          />
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Paper>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Paper
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                minHeight: { lg: "calc(100vh - 200px)" },
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800}>
                      Distributor overrides
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {orderedDistributors.length} distributors
                      {distributorOverrideCount > 0
                        ? ` · ${distributorOverrideCount} custom override${distributorOverrideCount !== 1 ? "s" : ""}`
                        : ""}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {["All", ...orderedRegions].map((tab) => (
                      <Chip
                        key={tab}
                        label={tab}
                        size="small"
                        clickable
                        color={regionFilter === tab ? "warning" : "default"}
                        variant={regionFilter === tab ? "filled" : "outlined"}
                        onClick={() => setRegionFilter(tab)}
                        sx={{ fontWeight: 700 }}
                      />
                    ))}
                  </Stack>
                </Stack>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search by name, code, or region"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  sx={{ mt: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <Box sx={{ flex: 1, overflow: "auto" }}>
                {filteredDistributors.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
                    {orderedDistributors.length === 0
                      ? "No distributors found. Add distributors first."
                      : "No distributors match your search."}
                  </Typography>
                ) : (
                  <Stack divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
                    {filteredDistributors.map((dist) => {
                      const hasOverride = Object.prototype.hasOwnProperty.call(
                        draft.distributorEnabled,
                        dist.code
                      );
                      const checked = resolveEffectiveGst(draft, dist);
                      return (
                        <Box
                          key={dist.code}
                          sx={{
                            px: 2,
                            py: 1.25,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 1.5,
                            bgcolor: hasOverride
                              ? alpha(theme.palette.warning.main, 0.04)
                              : "transparent",
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {dist.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ({dist.code})
                              </Typography>
                              {dist.region ? (
                                <Chip
                                  size="small"
                                  label={dist.region}
                                  color={REGION_CHIP_COLOR[dist.region] || "default"}
                                  variant="outlined"
                                  sx={{ height: 22, fontSize: "0.68rem" }}
                                />
                              ) : null}
                              {hasOverride ? (
                                <Chip
                                  size="small"
                                  label="Override"
                                  color="warning"
                                  sx={{ height: 22, fontSize: "0.68rem" }}
                                />
                              ) : null}
                            </Stack>
                          </Box>
                          <FormControlLabel
                            sx={{ m: 0, flexShrink: 0 }}
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
                  </Stack>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      <Paper
        elevation={8}
        square
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          bgcolor: "background.paper",
        }}
      >
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: "none", fontWeight: 700 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="warning"
          disabled={saving}
          startIcon={<SaveIcon />}
          onClick={() => onSave && onSave(draft)}
          sx={{ textTransform: "none", fontWeight: 800, minWidth: 120 }}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Paper>
    </Dialog>
  );
}
