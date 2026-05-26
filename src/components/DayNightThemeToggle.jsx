import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useDayNightTheme } from "../theme/AppThemeProvider";

/**
 * Switch between Day (dark theme) and Night (light theme).
 */
export default function DayNightThemeToggle({ sx: sxProp }) {
  const { toggleView, isDayView } = useDayNightTheme();

  const label = isDayView
    ? "Switch to Night view (light theme)"
    : "Switch to Day view (dark theme)";

  return (
    <Tooltip title={label}>
      <IconButton
        color="inherit"
        onClick={toggleView}
        aria-label={label}
        size="medium"
        sx={sxProp}
      >
        {isDayView ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
