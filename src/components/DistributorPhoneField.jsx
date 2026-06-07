import React from "react";
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from "@mui/material";
import {
  PHONE_COUNTRIES,
  digitsOnly,
  getPhoneCountryMeta,
  validateLocalPhone,
} from "../utils/distributorPhone";

export default function DistributorPhoneField({
  countryDial,
  localValue,
  onCountryChange,
  onLocalChange,
  size = "small",
  sx,
  fieldSx,
}) {
  const meta = getPhoneCountryMeta(countryDial);
  const validation = validateLocalPhone(countryDial, localValue);
  const showError = Boolean(localValue) && !validation.valid;

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={sx}>
      <FormControl size={size} sx={{ minWidth: { xs: 108, sm: 120 }, flexShrink: 0 }}>
        <InputLabel id="distributor-phone-code-label">Code</InputLabel>
        <Select
          labelId="distributor-phone-code-label"
          label="Code"
          value={countryDial}
          onChange={(e) => onCountryChange(e.target.value)}
          sx={{ borderRadius: 2, ...(fieldSx?.select || {}) }}
        >
          {PHONE_COUNTRIES.map((c) => (
            <MenuItem key={c.dial} value={c.dial}>
              {c.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        fullWidth
        size={size}
        label="Phone no."
        type="tel"
        value={localValue}
        onChange={(e) => {
          const next = digitsOnly(e.target.value).slice(0, meta.localLength);
          onLocalChange(next);
        }}
        placeholder={meta.placeholder}
        error={showError}
        helperText={
          showError
            ? validation.message
            : `Optional · ${meta.localLength} digits (${meta.name})`
        }
        inputProps={{ inputMode: "numeric", maxLength: meta.localLength }}
        sx={fieldSx}
      />
    </Stack>
  );
}
