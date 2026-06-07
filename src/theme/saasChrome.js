import { alpha } from "@mui/material/styles";
import { appPageShellBackground } from "./contrastSurfaces";

/** Fixed/sticky top bar used on admin, distributor, and shipping dashboards. */
export function saasAppBarSx(theme, { position = "fixed" } = {}) {
  const isDark = theme.palette.mode === "dark";
  return {
    position,
    zIndex: theme.zIndex.appBar,
    bgcolor: isDark ? theme.palette.grey[900] : theme.palette.primary.main,
    color: "primary.contrastText",
    borderBottom: 1,
    borderColor: isDark ? theme.palette.divider : alpha(theme.palette.common.white, 0.14),
    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, isDark ? 0.35 : 0.14)}`,
  };
}

export function saasAppBarToolbarSx() {
  return {
    minHeight: { xs: 52, sm: 60 },
    px: { xs: 1, sm: 2 },
    gap: 0.75,
  };
}

export function saasAppBarTitleBlockSx() {
  return {
    flexGrow: 1,
    minWidth: 0,
  };
}

export function saasAppBarTitleSx() {
  return {
    color: "inherit",
    fontWeight: 800,
    lineHeight: 1.15,
    fontSize: { xs: "0.95rem", sm: "1.1rem", md: "1.2rem" },
    letterSpacing: "-0.01em",
  };
}

export function saasAppBarSubtitleSx() {
  return {
    color: "inherit",
    opacity: 0.88,
    display: { xs: "none", sm: "block" },
    fontWeight: 600,
    fontSize: "0.72rem",
  };
}

/** Scrollable main panel below the app bar. */
export function saasDashboardMainSx(theme, { withBottomNav = false } = {}) {
  const bg =
    theme.palette.mode === "dark"
      ? `radial-gradient(circle at top left, ${alpha(theme.palette.common.white, 0.06)}, transparent 30%), linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 44%)`
      : appPageShellBackground(theme);

  return {
    flexGrow: 1,
    background: bg,
    p: { xs: 1.25, sm: 2, md: 2.5 },
    pb: withBottomNav ? { xs: 12, sm: 13 } : { xs: 2, sm: 2.5 },
    overflowX: "hidden",
    overflowY: "auto",
  };
}

/** Centered content column on dashboards. */
export function saasContentColumnSx(maxWidth = 1280) {
  return {
    width: "100%",
    maxWidth,
    mx: "auto",
  };
}

/** Standard elevated card for dashboard sections. */
export function saasSurfaceCardSx(theme) {
  return {
    borderRadius: 2.5,
    border: "1px solid",
    borderColor: "divider",
    bgcolor: theme.palette.background.paper,
    boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.06)}`,
  };
}

export function navDrawerSectionLabelSx() {
  return {
    px: 1.5,
    pt: 1.5,
    pb: 0.5,
    fontSize: "0.65rem",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "text.secondary",
  };
}

export function saasPageBackdropSx(theme) {
  const isDark = theme.palette.mode === "dark";
  return {
    minHeight: "100vh",
    bgcolor: "background.default",
    background: isDark
      ? `radial-gradient(ellipse at top, ${alpha(theme.palette.common.white, 0.05)}, transparent 55%)`
      : `radial-gradient(ellipse at top, ${alpha(theme.palette.primary.main, 0.07)}, transparent 52%)`,
  };
}
