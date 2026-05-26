import { alpha } from "@mui/material/styles";

/** Table header row — works with `color: "text.primary"` on cells */
export function tableHeaderBg(theme) {
  return theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[100];
}

export function tableStripeAt(theme, index) {
  if (theme.palette.mode === "dark") {
    return index % 2 === 0 ? alpha(theme.palette.common.white, 0.07) : alpha(theme.palette.common.white, 0.02);
  }
  return index % 2 === 0 ? "#f8f9fa" : "#ffffff";
}

export function tableRowHoverBg(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.info.main, 0.16) : "#e3f2fd";
}

export function tableFooterBandBg(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.08) : "#f5f5f5";
}

export function tableFooterBandBorder(theme) {
  return theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.14) : "#e0e0e0";
}

/** Yellow “receipt” shell around calculator results (light + dark) */
export function calculatorResultsShellSx(theme) {
  const isDark = theme.palette.mode === "dark";
  return {
    mt: 2,
    background: isDark ? alpha(theme.palette.secondary.main, 0.14) : "#fffde7",
    borderRadius: 3,
    boxShadow: 3,
    border: "2px solid",
    borderColor: isDark ? alpha(theme.palette.secondary.main, 0.42) : "#fbc02d",
    width: "100%",
  };
}

export function calculatorPageShellSx(theme, isMobile) {
  const isDark = theme.palette.mode === "dark";
  return {
    minHeight: "100vh",
    background: isDark
      ? `linear-gradient(160deg, ${theme.palette.grey[900]} 0%, ${alpha(theme.palette.primary.dark, 0.45)} 40%, ${theme.palette.background.default} 100%)`
      : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.92)} 0%, ${alpha(theme.palette.secondary.main, 0.75)} 55%, ${alpha(theme.palette.warning.light, 0.5)} 100%)`,
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
    background: isDark ? alpha(theme.palette.background.paper, 0.98) : "rgba(255,255,255,0.97)",
    boxSizing: "border-box",
    overflow: "hidden",
    boxShadow: isDark ? 8 : 12,
    ...(isDark
      ? { border: `1px solid ${alpha(theme.palette.common.white, 0.1)}` }
      : { border: `1px solid ${alpha(theme.palette.common.white, 0.85)}` }),
  };
}

/** Discount / gross / GST / net footer bands in calculator tables */
/** Table subheader band (replaces hardcoded `#f8f9fa` in dialogs). */
export function tableSubHeaderBandBg(theme) {
  return theme.palette.mode === "dark"
    ? alpha(theme.palette.common.white, 0.08)
    : alpha(theme.palette.grey[100], 0.98);
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
