import { alpha } from "@mui/material/styles";

function lightPaper(theme) {
  return theme.palette.background.paper;
}

function lightDefault(theme) {
  return theme.palette.background.default;
}

/** Table header row — works with `color: "text.primary"` on cells */
export function tableHeaderBg(theme) {
  return theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200];
}

export function tableStripeAt(theme, index) {
  if (theme.palette.mode === "dark") {
    return index % 2 === 0 ? alpha(theme.palette.common.white, 0.07) : alpha(theme.palette.common.white, 0.02);
  }
  return index % 2 === 0 ? theme.palette.grey[200] : lightPaper(theme);
}

export function tableRowHoverBg(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.info.main, 0.16) : alpha(theme.palette.primary.main, 0.08);
}

export function tableFooterBandBg(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.08) : theme.palette.grey[200];
}

export function tableFooterBandBorder(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.14) : "#e0e0e0";
}

/** Yellow “receipt” shell around calculator results (light + dark) */
export function calculatorResultsShellSx(theme) {
  const isDark = theme.palette.mode === "dark";
  return {
    mt: 2,
    background: isDark ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.06),
    borderRadius: 3,
    boxShadow: 3,
    border: "2px solid",
    borderColor: isDark ? alpha(theme.palette.primary.main, 0.35) : alpha(theme.palette.primary.light, 0.65),
    width: "100%",
  };
}

/** Table header row — neutral band with primary accent (not a blue fill). */
export function tableHeadRowSx(theme) {
  return {
    bgcolor: tableHeaderBg(theme),
    borderBottom: `2px solid ${theme.palette.primary.main}`,
    boxShadow: "none",
  };
}

/** Table header cell typography — pair with `tableHeadRowSx`. */
export function tableHeadCellSx(extra = {}) {
  return {
    fontWeight: 700,
    color: "text.primary",
    ...extra,
  };
}

/** Admin / nav drawer surface — light slate, not primary or secondary fills. */
export function navDrawerPaperSx(theme, { isMobile = false } = {}) {
  const isDark = theme.palette.mode === "dark";
  return {
    width: { xs: 200, sm: 220 },
    boxSizing: "border-box",
    bgcolor: isDark ? theme.palette.background.paper : theme.palette.grey[100],
    color: theme.palette.text.primary,
    borderRight: isMobile ? "none" : `1px solid ${theme.palette.divider}`,
    px: { xs: 0.5, sm: 1 },
    display: "flex",
    flexDirection: "column",
    boxShadow: `12px 0 34px ${alpha(theme.palette.common.black, isDark ? 0.28 : 0.08)}`,
  };
}

export function navDrawerItemSx(theme, { active = false } = {}) {
  return {
    borderRadius: 2,
    color: "text.primary",
    bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : "transparent",
    borderLeft: `3px solid ${active ? theme.palette.primary.main : "transparent"}`,
    "&:hover": {
      bgcolor: alpha(theme.palette.primary.main, active ? 0.14 : 0.06),
    },
  };
}

export function brandBarGradient(theme) {
  const isDark = theme.palette.mode === "dark";
  return isDark
    ? `linear-gradient(135deg, ${theme.palette.grey[800]} 0%, ${theme.palette.background.paper} 100%)`
    : `linear-gradient(135deg, ${theme.palette.grey[200]} 0%, ${lightPaper(theme)} 100%)`;
}

export function brandHeroGradient(theme) {
  const isDark = theme.palette.mode === "dark";
  return isDark
    ? `linear-gradient(160deg, ${theme.palette.grey[900]} 0%, ${theme.palette.background.default} 100%)`
    : `linear-gradient(160deg, ${lightPaper(theme)} 0%, ${alpha(theme.palette.primary.light, 0.14)} 55%, ${alpha(theme.palette.info.light, 0.1)} 100%)`;
}

export function calculatorPageShellSx(theme, isMobile) {
  const isDark = theme.palette.mode === "dark";
  return {
    minHeight: "100vh",
    background: isDark
      ? `linear-gradient(160deg, ${theme.palette.grey[900]} 0%, ${theme.palette.grey[800]} 45%, ${theme.palette.background.default} 100%)`
      : `linear-gradient(145deg, ${lightDefault(theme)} 0%, ${alpha(theme.palette.primary.light, 0.22)} 42%, ${alpha(theme.palette.secondary.light, 0.18)} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    p: isMobile ? 1 : 4,
  };
}

export function calculatorPaperSx(theme, isMobile) {
  const isDark = theme.palette.mode === "dark";
  return {
    p: { xs: 2, sm: 3, md: 4 },
    borderRadius: 4,
    maxWidth: isMobile ? "100%" : 920,
    width: "100%",
    background: isDark ? alpha(theme.palette.background.paper, 0.98) : lightPaper(theme),
    boxSizing: "border-box",
    overflow: "hidden",
    boxShadow: isDark ? 8 : 12,
    ...(isDark
      ? { border: `1px solid ${alpha(theme.palette.common.white, 0.1)}` }
      : { border: `1px solid ${theme.palette.divider}` }),
  };
}

/** Discount / gross / GST / net footer bands in calculator tables */
/** Table subheader band (replaces hardcoded `#f8f9fa` in dialogs). */
export function tableSubHeaderBandBg(theme) {
  return theme.palette.mode === "dark"
    ? alpha(theme.palette.common.white, 0.08)
    : alpha(theme.palette.grey[100], 0.98);
}

/** Full-page shell gradient (dashboards, landing) — no pure white. */
export function appPageShellBackground(theme) {
  const isDark = theme.palette.mode === "dark";
  if (isDark) {
    return `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.12)}, transparent 30%), linear-gradient(180deg, ${theme.palette.grey[900]} 0%, ${theme.palette.background.default} 100%)`;
  }
  return `radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.08)}, transparent 30%), linear-gradient(180deg, ${lightDefault(theme)} 0%, ${alpha(theme.palette.grey[300], 0.45)} 46%, ${lightPaper(theme)} 100%)`;
}

export function calcSummaryRows(theme) {
  const d = theme.palette.mode === "dark";
  return {
    discountBg: d ? alpha(theme.palette.error.main, 0.22) : "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
    discountBorder: theme.palette.error.main,
    grossBg: d ? alpha(theme.palette.warning.main, 0.2) : "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
    grossBorder: theme.palette.warning.main,
    gstBg: d ? alpha(theme.palette.warning.light, 0.16) : "linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)",
    gstBorder: theme.palette.warning.light,
    netBg: d ? alpha(theme.palette.success.main, 0.2) : "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)",
    netBorder: theme.palette.success.main,
  };
}
