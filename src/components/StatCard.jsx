import React from "react";
import { Box, Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

/**
 * Compact KPI card (shipping + admin dashboards).
 */
const PALETTE_COLORS = new Set(["primary", "secondary", "success", "error", "warning", "info"]);

export default function StatCard({ title, value, hint, color = "primary", icon: Icon, active, onClick }) {
  const theme = useTheme();
  const paletteKey = PALETTE_COLORS.has(color) ? color : "primary";
  const mainColor = theme.palette[paletteKey].main;
  const clickable = typeof onClick === "function";

  const inner = (
    <CardContent sx={{ py: 1.5, px: 1.75, "&:last-child": { pb: 1.5 } }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        {Icon ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(mainColor, 0.14),
              color: `${paletteKey}.main`,
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        ) : null}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15, my: 0.25 }}>
            {value}
          </Typography>
          {hint ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
              {hint}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 2,
        borderWidth: active ? 2 : 1,
        borderColor: active ? `${paletteKey}.main` : "divider",
        bgcolor: active ? alpha(mainColor, 0.08) : "background.paper",
        transition: "border-color 0.2s, background-color 0.2s",
      }}
    >
      {clickable ? <CardActionArea onClick={onClick}>{inner}</CardActionArea> : inner}
    </Card>
  );
}
