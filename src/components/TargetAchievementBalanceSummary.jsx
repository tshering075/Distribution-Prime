import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";

function formatMetric(value) {
  const n = Number(value) || 0;
  return n.toLocaleString();
}

function CategoryAchievementBalanceRow({ category, achievedPC, achievedUC, balancePC, balanceUC }) {
  const theme = useTheme();
  const balanceColor = (val) => (Number(val) < 0 ? "error.main" : "text.primary");

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(44px, 0.7fr) 1fr 1fr 1fr 1fr",
        alignItems: "center",
        columnGap: 0.75,
        py: 0.45,
        minHeight: 24,
        borderRadius: 0.5,
        mx: -0.25,
        px: 0.25,
        "&:nth-of-type(odd)": {
          bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.03 : 0.02),
        },
        "&:not(:last-of-type)": {
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", fontSize: "0.75rem" }}>
        {category}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: theme.palette.mode === "dark" ? "success.light" : "success.dark",
          fontSize: "0.75rem",
          textAlign: "right",
        }}
      >
        {formatMetric(achievedPC)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: theme.palette.mode === "dark" ? "success.light" : "success.dark",
          fontSize: "0.75rem",
          textAlign: "right",
        }}
      >
        {formatMetric(achievedUC)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: balanceColor(balancePC),
          fontSize: "0.75rem",
          textAlign: "right",
        }}
      >
        {formatMetric(balancePC)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: balanceColor(balanceUC),
          fontSize: "0.75rem",
          textAlign: "right",
        }}
      >
        {formatMetric(balanceUC)}
      </Typography>
    </Box>
  );
}

/** Achievement + balance mini-table (same layout as admin Target balance card). */
export default function TargetAchievementBalanceSummary({
  csdAchievedPC = 0,
  csdAchievedUC = 0,
  csdBalancePC = 0,
  csdBalanceUC = 0,
  waterAchievedPC = 0,
  waterAchievedUC = 0,
  waterBalancePC = 0,
  waterBalanceUC = 0,
  sx,
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        borderRadius: 1.25,
        border: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.95),
        overflow: "hidden",
        boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.04)} inset`,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(44px, 0.7fr) 1fr 1fr 1fr 1fr",
          alignItems: "center",
          columnGap: 0.75,
          bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.04 : 0.03),
          px: 1.1,
          py: 0.45,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
          Cat.
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: theme.palette.mode === "dark" ? "success.light" : "success.dark",
            fontSize: "0.6rem",
            letterSpacing: "0.04em",
            textAlign: "right",
            gridColumn: "span 2",
          }}
        >
          Achievement
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "text.secondary",
            fontSize: "0.6rem",
            letterSpacing: "0.04em",
            textAlign: "right",
            gridColumn: "span 2",
          }}
        >
          Balance
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(44px, 0.7fr) 1fr 1fr 1fr 1fr",
          alignItems: "center",
          columnGap: 0.75,
          px: 1.1,
          py: 0.15,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box />
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.disabled", fontSize: "0.55rem", textAlign: "right" }}>
          PC
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.disabled", fontSize: "0.55rem", textAlign: "right" }}>
          UC
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.disabled", fontSize: "0.55rem", textAlign: "right" }}>
          PC
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.disabled", fontSize: "0.55rem", textAlign: "right" }}>
          UC
        </Typography>
      </Box>
      <Box sx={{ px: 1.1, py: 0.55 }}>
        <CategoryAchievementBalanceRow
          category="CSD"
          achievedPC={csdAchievedPC}
          achievedUC={csdAchievedUC}
          balancePC={csdBalancePC}
          balanceUC={csdBalanceUC}
        />
        <CategoryAchievementBalanceRow
          category="Water"
          achievedPC={waterAchievedPC}
          achievedUC={waterAchievedUC}
          balancePC={waterBalancePC}
          balanceUC={waterBalanceUC}
        />
      </Box>
    </Box>
  );
}
