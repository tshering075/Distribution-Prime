import React from "react";
import { Paper, Stack, ToggleButton, ToggleButtonGroup, Typography, Chip } from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import AssignmentIcon from "@mui/icons-material/Assignment";

/**
 * Minimal view switcher — avoids duplicating OrdersSection filters and InfoCards content.
 */
export default function AdminSummaryStrip({
  showOrders,
  onShowPerformance,
  onShowOrders,
  pendingReviewCount,
  selectedRegion,
}) {
  const regionLabel = selectedRegion && selectedRegion !== "All" ? selectedRegion : "All regions";

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        px: { xs: 1.25, sm: 1.5 },
        py: 1.25,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={showOrders ? "orders" : "performance"}
          onChange={(_, v) => {
            if (!v) return;
            if (v === "orders") onShowOrders();
            else onShowPerformance();
          }}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          <ToggleButton
            value="performance"
            sx={{ textTransform: "none", fontWeight: 700, px: 2, flex: { xs: 1, sm: "none" } }}
          >
            <BarChartIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Performance
          </ToggleButton>
          <ToggleButton
            value="orders"
            sx={{ textTransform: "none", fontWeight: 700, px: 2, flex: { xs: 1, sm: "none" } }}
          >
            <AssignmentIcon sx={{ fontSize: 18, mr: 0.75 }} />
            Orders
            {pendingReviewCount > 0 ? (
              <Chip
                component="span"
                label={pendingReviewCount > 99 ? "99+" : pendingReviewCount}
                size="small"
                color="error"
                sx={{ ml: 1, height: 20, fontWeight: 800, verticalAlign: "middle" }}
              />
            ) : null}
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
          {showOrders
            ? "Approve or reject distributor orders · filters are below"
            : `Sales vs targets · ${regionLabel}`}
        </Typography>
      </Stack>
    </Paper>
  );
}
