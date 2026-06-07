import React from "react";
import { Select, MenuItem, Divider, ListItemIcon, ListItemText } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export const ADD_NEW_OPTION = "__add_new__";

/**
 * Compact select with an "Add new…" action for workspace-specific catalogue options.
 */
export default function CatalogSelectWithAdd({
  value,
  options = [],
  onChange,
  onAddNew,
  placeholder = "—",
  sx,
  disabled,
}) {
  const trimmed = String(value ?? "").trim();
  const optionList = options.filter(Boolean);
  const hasCurrent = trimmed && !optionList.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const selectValue = trimmed || "";

  return (
    <Select
      size="small"
      displayEmpty
      fullWidth
      disabled={disabled}
      value={selectValue}
      onChange={(e) => {
        const next = e.target.value;
        if (next === ADD_NEW_OPTION) {
          onAddNew?.();
          return;
        }
        onChange?.(next);
      }}
      renderValue={(v) => (v ? v : placeholder)}
      sx={sx}
    >
      <MenuItem value="" dense sx={{ fontSize: "0.8125rem", py: 0.5, fontStyle: "italic", opacity: 0.7 }}>
        {placeholder}
      </MenuItem>
      {optionList.map((opt) => (
        <MenuItem key={opt} value={opt} dense sx={{ fontSize: "0.8125rem", py: 0.5 }}>
          {opt}
        </MenuItem>
      ))}
      {hasCurrent ? (
        <MenuItem value={trimmed} dense sx={{ fontSize: "0.8125rem", py: 0.5 }}>
          {trimmed}
        </MenuItem>
      ) : null}
      <Divider sx={{ my: 0.25 }} />
      <MenuItem value={ADD_NEW_OPTION} dense sx={{ fontSize: "0.8125rem", py: 0.5, fontWeight: 700 }}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary="Add new…" primaryTypographyProps={{ fontSize: "0.8125rem" }} />
      </MenuItem>
    </Select>
  );
}
