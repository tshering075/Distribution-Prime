import React from "react";
import { Box, Button, Typography, Badge } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/** Section title + optional subtitle and right-side action (e.g. “View all”). */
export function DashboardSectionHeading({ id, title, subtitle, action, sx }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        mb: 1.5,
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          id={id}
          variant="h6"
          component="h2"
          sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.2rem" }, lineHeight: 1.25 }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.45 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ?? null}
    </Box>
  );
}

/** Rounded icon container for dashboard panels (target, period, etc.). */
export function DashboardPanelIcon({ children, paletteColor = "primary" }) {
  const theme = useTheme();
  const main = theme.palette[paletteColor]?.main ?? theme.palette.primary.main;
  return (
    <Box
      sx={{
        p: { xs: 0.75, sm: 1.15 },
        borderRadius: 2,
        bgcolor: alpha(main, theme.palette.mode === "dark" ? 0.22 : 0.1),
        color: `${paletteColor}.main`,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Box>
  );
}

/** Bottom navigation item with active state and optional badge. */
export function DistributorBottomNavItem({
  label,
  icon,
  active = false,
  onClick,
  elevate = false,
  badgeContent,
  badgeColor = "error",
  badgeInvisible = true,
  badgeVariant,
}) {
  const theme = useTheme();

  if (elevate) {
    return (
      <Button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        sx={{
          minWidth: 0,
          flexDirection: "column",
          gap: 0.35,
          color: "primary.contrastText",
          bgcolor: "primary.main",
          borderRadius: 999,
          py: 1.15,
          px: { xs: 1, sm: 2 },
          mt: -2.5,
          boxShadow: 6,
          textTransform: "none",
          fontSize: { xs: "0.72rem", sm: "0.78rem" },
          fontWeight: 900,
          "&:hover": { bgcolor: "primary.dark" },
        }}
      >
        {icon}
        {label}
      </Button>
    );
  }

  const iconNode = badgeInvisible ? (
    icon
  ) : (
    <Badge
      variant={badgeVariant}
      badgeContent={badgeVariant === "dot" ? undefined : badgeContent}
      color={badgeColor}
      max={99}
    >
      {icon}
    </Badge>
  );

  return (
    <Button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      sx={{
        minWidth: 0,
        flexDirection: "column",
        gap: 0.35,
        py: 0.75,
        px: 0.5,
        color: active ? "primary.main" : "text.secondary",
        textTransform: "none",
        fontSize: "0.68rem",
        fontWeight: active ? 800 : 700,
        borderRadius: 2,
        bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : "transparent",
        "&:hover": {
          bgcolor: active
            ? alpha(theme.palette.primary.main, 0.14)
            : alpha(theme.palette.action.hover, 0.6),
        },
      }}
    >
      {iconNode}
      {label}
    </Button>
  );
}
