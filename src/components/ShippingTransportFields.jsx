import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Stack,
  InputAdornment,
  Divider,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import PinOutlinedIcon from "@mui/icons-material/PinOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  SHIPPING_TRANSPORTER_OPTIONS,
  buildVehicleTypeOptions,
  formatBhutanVehicleNo,
  isValidBhutanVehicleNo,
  readCustomVehicleTypes,
  vehicleNoHelperText,
  writeCustomVehicleTypes,
} from "../constants/shippingTransport";
import CatalogSelectWithAdd from "./CatalogSelectWithAdd";
import { getActiveOrganizationId } from "../services/tenantScope";

function fieldLabelSx(compact) {
  return {
    fontSize: compact ? 11 : 12,
    fontWeight: 700,
    color: "text.secondary",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    mb: 0.5,
    display: "flex",
    alignItems: "center",
    gap: 0.5,
  };
}

function transportProgress(transport, required) {
  const checks = [
    Boolean(String(transport.transporterVehicle || "").trim()),
    Boolean(String(transport.vehicleType || "").trim()),
    Boolean(transport.vehicleNo) && isValidBhutanVehicleNo(transport.vehicleNo),
  ];
  const done = checks.filter(Boolean).length;
  const total = required ? 3 : checks.length;
  return { done, total, complete: done === 3 && checks.every(Boolean) };
}

function formatChargesDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `Nu. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function ReadOnlySummary({ transport, compact }) {
  const theme = useTheme();
  const rows = [
    { icon: DirectionsCarOutlinedIcon, label: "Transporter", value: transport.transporterVehicle || "—" },
    { icon: CategoryOutlinedIcon, label: "Vehicle type", value: transport.vehicleType || "—" },
    {
      icon: PinOutlinedIcon,
      label: "Vehicle no.",
      value: transport.vehicleNo ? formatBhutanVehicleNo(transport.vehicleNo) : "—",
      mono: true,
    },
    {
      icon: PaymentsOutlinedIcon,
      label: "Charges",
      value: formatChargesDisplay(transport.transportationCharges),
    },
  ];

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      sx={{ mt: 0.5 }}
    >
      {rows.map(({ icon: Icon, label, value, mono }) => (
        <Paper
          key={label}
          variant="outlined"
          sx={{
            flex: { xs: "1 1 100%", sm: "1 1 calc(50% - 8px)", md: "1 1 calc(25% - 12px)" },
            minWidth: { sm: 140 },
            px: 1.25,
            py: compact ? 0.85 : 1.1,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04),
            borderColor: alpha(theme.palette.divider, 0.9),
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.35 }}>
            <Icon sx={{ fontSize: 15, color: "primary.main", opacity: 0.9 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              {label}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
              letterSpacing: mono ? 0.5 : 0,
              wordBreak: "break-word",
            }}
          >
            {value}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}

/**
 * Transporter / vehicle details required before shipping marks an order dispatched.
 */
export default function ShippingTransportFields({
  value,
  onChange,
  disabled = false,
  error = "",
  required = true,
  compact = false,
}) {
  const theme = useTheme();
  const brand = theme.palette.primary.main;

  const transport = useMemo(
    () =>
      value || {
        transporterVehicle: "",
        vehicleType: "",
        vehicleNo: "",
        transportationCharges: "",
      },
    [value]
  );

  const orgId = getActiveOrganizationId();
  const [customVehicleTypes, setCustomVehicleTypes] = useState(() =>
    readCustomVehicleTypes(orgId)
  );
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [newVehicleType, setNewVehicleType] = useState("");
  const [addTypeError, setAddTypeError] = useState("");

  const vehicleTypeOptions = useMemo(
    () => buildVehicleTypeOptions(customVehicleTypes),
    [customVehicleTypes]
  );

  const vehicleNoInvalid =
    Boolean(transport.vehicleNo) && !isValidBhutanVehicleNo(transport.vehicleNo);

  const progress = transportProgress(transport, required);
  const showReadOnly = disabled;

  const setField = (field, val) => {
    onChange?.({ ...transport, [field]: val });
  };

  const handleVehicleNoBlur = useCallback(() => {
    const formatted = formatBhutanVehicleNo(transport.vehicleNo);
    if (formatted !== transport.vehicleNo) {
      onChange?.({ ...transport, vehicleNo: formatted });
    }
  }, [transport, onChange]);

  const handleAddVehicleType = useCallback(() => {
    const label = String(newVehicleType || "").trim();
    if (!label) {
      setAddTypeError("Enter a vehicle type name.");
      return;
    }
    const exists = vehicleTypeOptions.some(
      (t) => t.toLowerCase() === label.toLowerCase()
    );
    if (exists) {
      setAddTypeError("This vehicle type already exists.");
      return;
    }
    const next = writeCustomVehicleTypes([...customVehicleTypes, label], orgId);
    setCustomVehicleTypes(next);
    onChange?.({ ...transport, vehicleType: label });
    setNewVehicleType("");
    setAddTypeError("");
    setAddTypeOpen(false);
  }, [customVehicleTypes, newVehicleType, orgId, vehicleTypeOptions, transport, onChange]);

  const labelSize = compact ? 12 : 13;
  const inputSize = compact ? 12 : 14;
  const pad = compact ? 1.5 : 2;

  const borderColor = error
    ? theme.palette.error.main
    : progress.complete
      ? alpha(theme.palette.success.main, 0.55)
      : alpha(theme.palette.divider, 1);

  const headerBg = alpha(
    brand,
    theme.palette.mode === "dark" ? 0.14 : 0.06
  );

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          mt: 2,
          overflow: "hidden",
          borderRadius: 2.5,
          borderColor,
          bgcolor: "background.paper",
          boxShadow: progress.complete
            ? `0 0 0 1px ${alpha(theme.palette.success.main, 0.12)}`
            : "none",
        }}
      >
        <Box
          sx={{
            px: pad,
            py: compact ? 1 : 1.25,
            bgcolor: headerBg,
            borderBottom: "1px solid",
            borderColor: alpha(theme.palette.divider, 0.8),
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
            spacing={1}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(brand, 0.12),
                  color: "primary.main",
                  flexShrink: 0,
                }}
              >
                <LocalShippingOutlinedIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  Transportation details
                  {required && !showReadOnly ? (
                    <Typography component="span" color="error.main" sx={{ ml: 0.35 }}>
                      *
                    </Typography>
                  ) : null}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {showReadOnly
                    ? "Recorded for this dispatch"
                    : "Required before Save & dispatch"}
                </Typography>
              </Box>
            </Stack>

            {!showReadOnly && required ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
                <Chip
                  size="small"
                  icon={
                    progress.complete ? (
                      <CheckCircleOutlineIcon sx={{ fontSize: "16px !important" }} />
                    ) : undefined
                  }
                  label={`${progress.done}/${progress.total} complete`}
                  color={progress.complete ? "success" : "default"}
                  variant={progress.complete ? "filled" : "outlined"}
                  sx={{ fontWeight: 700, height: 26 }}
                />
                <Tooltip
                  title="Regions: 1 Western · 2 Central · 3 Southern · 4 Eastern. Plate types: BP, BT, BG, BHT."
                  arrow
                  placement="top"
                >
                  <InfoOutlinedIcon sx={{ fontSize: 18, color: "text.disabled", cursor: "help" }} />
                </Tooltip>
              </Stack>
            ) : null}
          </Stack>

          {!showReadOnly && required ? (
            <LinearProgress
              variant="determinate"
              value={(progress.done / progress.total) * 100}
              sx={{
                mt: 1.25,
                height: 4,
                borderRadius: 2,
                bgcolor: alpha(brand, 0.08),
                "& .MuiLinearProgress-bar": {
                  borderRadius: 2,
                  bgcolor: progress.complete ? "success.main" : "primary.main",
                },
              }}
            />
          ) : null}
        </Box>

        <Box sx={{ p: pad }}>
          {showReadOnly ? (
            <ReadOnlySummary transport={transport} compact={compact} />
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: compact ? 1.5 : 2,
              }}
            >
              <Box>
                <Typography sx={fieldLabelSx(compact)}>
                  <DirectionsCarOutlinedIcon sx={{ fontSize: 14 }} />
                  Transporter vehicle
                </Typography>
                <FormControl size="small" fullWidth required={required} disabled={disabled}>
                  <InputLabel id="shipping-transporter-label" sx={{ fontSize: labelSize }}>
                    Select transporter
                  </InputLabel>
                  <Select
                    labelId="shipping-transporter-label"
                    label="Select transporter"
                    value={transport.transporterVehicle || ""}
                    onChange={(e) => setField("transporterVehicle", e.target.value)}
                    sx={{ fontSize: inputSize, "& .MuiSelect-select": { py: compact ? 0.85 : 1.1 } }}
                  >
                    <MenuItem value="">
                      <em>Choose one…</em>
                    </MenuItem>
                    {SHIPPING_TRANSPORTER_OPTIONS.map((name) => (
                      <MenuItem key={name} value={name} sx={{ fontSize: inputSize }}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <Typography sx={fieldLabelSx(compact)}>
                  <CategoryOutlinedIcon sx={{ fontSize: 14 }} />
                  Vehicle type
                </Typography>
                <FormControl size="small" fullWidth required={required} disabled={disabled}>
                  <CatalogSelectWithAdd
                    value={transport.vehicleType || ""}
                    options={vehicleTypeOptions}
                    placeholder="Select type"
                    disabled={disabled}
                    onChange={(next) => setField("vehicleType", next)}
                    onAddNew={() => {
                      setNewVehicleType("");
                      setAddTypeError("");
                      setAddTypeOpen(true);
                    }}
                    sx={{
                      fontSize: inputSize,
                      "& .MuiSelect-select": { py: compact ? 0.85 : 1.1 },
                    }}
                  />
                </FormControl>
              </Box>

              <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                <Divider sx={{ mb: compact ? 1 : 1.25, opacity: 0.6 }} />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx(compact)}>
                  <PinOutlinedIcon sx={{ fontSize: 14 }} />
                  Vehicle number
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  required={required}
                  disabled={disabled}
                  placeholder="BP-1-A1234 or BHT-3-KA12345"
                  value={transport.vehicleNo || ""}
                  onChange={(e) => setField("vehicleNo", e.target.value.toUpperCase())}
                  onBlur={handleVehicleNoBlur}
                  error={vehicleNoInvalid}
                  helperText={vehicleNoHelperText(transport.vehicleNo)}
                  inputProps={{
                    style: {
                      fontSize: inputSize,
                      textTransform: "uppercase",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      letterSpacing: 0.6,
                    },
                    spellCheck: false,
                  }}
                  InputLabelProps={{ sx: { fontSize: labelSize } }}
                  FormHelperTextProps={{ sx: { fontSize: labelSize - 1, mx: 0, mt: 0.75 } }}
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx(compact)}>
                  <PaymentsOutlinedIcon sx={{ fontSize: 14 }} />
                  Transportation charges
                  <Typography component="span" sx={{ fontWeight: 500, textTransform: "none", ml: 0.5 }}>
                    (optional)
                  </Typography>
                </Typography>
                <TextField
                  size="small"
                  fullWidth
                  disabled={disabled}
                  placeholder="0.00"
                  type="number"
                  inputProps={{ min: 0, step: "0.01", style: { fontSize: inputSize } }}
                  value={transport.transportationCharges ?? ""}
                  onChange={(e) => setField("transportationCharges", e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary" }}>
                          Nu.
                        </Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          )}

          {error ? (
            <Typography
              variant="body2"
              color="error"
              sx={{
                mt: 1.5,
                fontWeight: 600,
                fontSize: labelSize,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.error.main, 0.08),
              }}
            >
              {error}
            </Typography>
          ) : null}
        </Box>
      </Paper>

      <Dialog open={addTypeOpen} onClose={() => setAddTypeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Add vehicle type</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            New types are saved for this workspace only (e.g. Mini truck, Pickup).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Type name"
            placeholder="e.g. Mini truck"
            value={newVehicleType}
            onChange={(e) => {
              setNewVehicleType(e.target.value);
              if (addTypeError) setAddTypeError("");
            }}
            error={Boolean(addTypeError)}
            helperText={addTypeError}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddVehicleType();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddTypeOpen(false)} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddVehicleType} sx={{ fontWeight: 800 }}>
            Add type
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
