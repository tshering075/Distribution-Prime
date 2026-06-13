import React, { useMemo } from "react";
import { Box, Card, Chip, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import {
  formatTargetPeriodDisplay,
  getDaysRemaining,
} from "../../../utils/targetPeriod";
import TargetPeriodCalendarPreview from "../../../components/TargetPeriodCalendarPreview";

/** Normalize status for today's-order filter (approved | pending | rejected). */
function normalizeTodayOrderStatus(raw) {
  const x = String(raw ?? "pending").toLowerCase().trim();
  if (x === "approve") return "approved";
  if (x === "reject") return "rejected";
  if (x === "sent") return "pending";
  return x;
}

function parseOrderCreatedMs(order) {
  if (!order || typeof order !== "object") return null;
  if (order.created_at) {
    const t = Date.parse(order.created_at);
    if (!Number.isNaN(t)) return t;
  }
  if (order.timestamp != null) {
    if (typeof order.timestamp === "number") return order.timestamp;
    const t = Date.parse(order.timestamp);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

function isSameLocalCalendarDay(ms, now = new Date()) {
  const a = new Date(ms);
  if (Number.isNaN(a.getTime())) return false;
  return (
    a.getFullYear() === now.getFullYear() &&
    a.getMonth() === now.getMonth() &&
    a.getDate() === now.getDate()
  );
}

/** Compact section title row: icon + labels + optional trailing control */
function SectionHeader({ icon: Icon, iconBg, iconColor, title, subtitle, action, sx }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.1,
        mb: { xs: 0.85, sm: 0.95 },
        flexWrap: "wrap",
        ...sx,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bgcolor: iconBg,
          border: "1px solid",
          borderColor: alpha(iconColor, theme.palette.mode === "dark" ? 0.35 : 0.22),
          boxShadow:
            theme.palette.mode === "dark"
              ? `0 1px 0 ${alpha(theme.palette.common.white, 0.06)} inset`
              : `0 1px 2px ${alpha(theme.palette.common.black, 0.06)}`,
        }}
      >
        <Icon sx={{ fontSize: 18, color: iconColor }} aria-hidden />
      </Box>
      <Box sx={{ flex: "1 1 140px", minWidth: 0 }}>
        <Typography
          component="h3"
          variant="overline"
          sx={{
            display: "block",
            letterSpacing: "0.06em",
            fontWeight: 700,
            fontSize: "0.625rem",
            color: "text.secondary",
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 0.15, lineHeight: 1.35, fontSize: "0.7rem" }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? (
        <Box sx={{ flexShrink: 0, ml: { xs: "auto", sm: 0 }, alignSelf: "center" }}>{action}</Box>
      ) : null}
    </Box>
  );
}

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
        transition: "background-color 0.15s ease",
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

/**
 * Target Balance + Target Period + Today's orders — admin dashboard summary card.
 */
function InfoCards({ balance, targetPeriod, targetPeriodIsSet = false, allOrders = [], getOrderStatus }) {
  const theme = useTheme();
  const remainingDays = targetPeriodIsSet && targetPeriod?.end ? getDaysRemaining(targetPeriod.end) : null;
  const ucAchieved = balance?.targetUcAchieved === true;

  const infoTint = alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.14 : 0.08);
  const successTint = alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.14 : 0.08);
  const ordersTint = alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.08);

  const todaysOrderRows = useMemo(() => {
    const allowed = new Set(["approved", "pending", "rejected"]);
    if (typeof getOrderStatus !== "function" || !Array.isArray(allOrders)) return [];

    const byKey = new Map();

    for (const order of allOrders) {
      const status = normalizeTodayOrderStatus(getOrderStatus(order));
      if (!allowed.has(status)) continue;

      const ms = parseOrderCreatedMs(order);
      if (ms == null || !isSameLocalCalendarDay(ms)) continue;

      const name =
        order.distributorName ||
        order.distributor_name ||
        order.distributorCode ||
        "Unknown";
      const key = String(order.distributorCode ?? name);

      const prev = byKey.get(key);
      if (!prev || ms > prev.ms) {
        byKey.set(key, { name, status, ms });
      }
    }

    return [...byKey.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, status }) => ({ name, status }));
  }, [allOrders, getOrderStatus]);

  const statusChipColor = (status) => {
    if (status === "approved") return "success";
    if (status === "rejected") return "error";
    if (status === "pending") return "warning";
    return "default";
  };

  const scrollAreaSx = {
    scrollbarWidth: "thin",
    scrollbarColor: `${alpha(theme.palette.text.secondary, 0.35)} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: alpha(theme.palette.text.secondary, 0.28),
      borderRadius: 3,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: alpha(theme.palette.divider, 0.35),
      borderRadius: 3,
    },
  };

  const statusChip = (
    <Chip
      size="small"
      label={ucAchieved ? "Achieved" : "In progress"}
      color={ucAchieved ? "success" : "warning"}
      variant={ucAchieved ? "filled" : "outlined"}
      sx={{ fontWeight: 600, fontSize: "0.65rem", height: 20, "& .MuiChip-label": { px: 0.85 } }}
    />
  );

  const daysLeftAction = targetPeriodIsSet ? (
    <Box sx={{ textAlign: "right", lineHeight: 1.15 }}>
      <Typography
        variant="overline"
        sx={{
          display: "block",
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontSize: "0.55rem",
          color: "text.secondary",
          lineHeight: 1.2,
        }}
      >
        Days left
      </Typography>
      <Typography
        component="span"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          color: "success.main",
          lineHeight: 1,
          fontSize: { xs: "1.2rem", sm: "1.28rem" },
        }}
      >
        {remainingDays}
      </Typography>
    </Box>
  ) : (
    <Chip
      size="small"
      label="Target date not set yet"
      color="warning"
      variant="outlined"
      sx={{ fontWeight: 700, fontSize: "0.62rem", height: 22, maxWidth: { xs: 140, sm: 180 } }}
    />
  );

  return (
    <Card
      component="section"
      elevation={0}
      aria-label="Dashboard summary: target balance, today's orders, and target period"
      sx={{
        overflow: "hidden",
        borderRadius: 2,
        mb: { xs: 1, sm: 1.5 },
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        boxShadow: "none",
      }}
    >
      <Box
        sx={{
          display: "grid",
          minHeight: 0,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gridTemplateRows: {
            xs: "repeat(6, auto)",
            md: "auto minmax(140px, auto)",
          },
          gridTemplateAreas: {
            xs: `
              "balHead"
              "balBody"
              "ordHead"
              "ordBody"
              "perHead"
              "perBody"
            `,
            md: `
              "balHead ordHead perHead"
              "balBody ordBody perBody"
            `,
          },
          columnGap: 0,
          rowGap: { xs: 0, md: 0.75 },
        }}
      >
        {/* Target balance — header */}
        <Box
          sx={{
            gridArea: "balHead",
            p: { xs: 0.8, sm: 0.9 },
            pt: { xs: 0.7, sm: 0.8 },
            borderTop: "3px solid",
            borderTopColor: "info.main",
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
            minHeight: 0,
          }}
        >
          <SectionHeader
            sx={{ mb: { md: 0 } }}
            icon={BarChartIcon}
            iconBg={infoTint}
            iconColor={theme.palette.info.main}
            title="Target balance"
            subtitle="Achievement vs remaining balance — UC sets achievement."
            action={statusChip}
          />
        </Box>

        {/* Target balance — table */}
        <Box
          sx={{
            gridArea: "balBody",
            px: { xs: 0.8, sm: 0.9 },
            pb: { xs: 0.8, sm: 0.9 },
            pt: { xs: 0, md: 0 },
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: { md: "100%" },
            }}
          >
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRadius: 1.25,
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.95),
                overflow: "hidden",
                minHeight: 0,
                boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.04)} inset`,
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(44px, 0.7fr) 1fr 1fr 1fr 1fr",
                  alignItems: "center",
                  columnGap: 0.75,
                  flexShrink: 0,
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
                  flexShrink: 0,
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
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  px: 1.1,
                  py: 0.55,
                  minHeight: 0,
                }}
              >
                <CategoryAchievementBalanceRow
                  category="CSD"
                  achievedPC={balance?.csdAchievedPC ?? 0}
                  achievedUC={balance?.csdAchievedUC ?? 0}
                  balancePC={balance?.csdPC ?? 0}
                  balanceUC={balance?.csdUC ?? 0}
                />
                <CategoryAchievementBalanceRow
                  category="Water"
                  achievedPC={balance?.waterAchievedPC ?? 0}
                  achievedUC={balance?.waterAchievedUC ?? 0}
                  balancePC={balance?.waterPC ?? 0}
                  balanceUC={balance?.waterUC ?? 0}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Today's orders — header */}
        <Box
          sx={{
            gridArea: "ordHead",
            p: { xs: 0.8, sm: 0.9 },
            pt: { xs: 0.7, sm: 0.8 },
            borderTop: "3px solid",
            borderTopColor: "primary.main",
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.05 : 0.03),
            minHeight: 0,
          }}
        >
          <SectionHeader
            sx={{ mb: { md: 0 } }}
            icon={LocalShippingOutlinedIcon}
            iconBg={ordersTint}
            iconColor={theme.palette.primary.main}
            title="Today's orders"
            subtitle="Distributors who placed an order today (approved, pending, or rejected)."
            action={
              <Chip
                size="small"
                label={String(todaysOrderRows.length)}
                color="primary"
                variant="outlined"
                sx={{
                  fontWeight: 700,
                  fontSize: "0.65rem",
                  height: 22,
                  "& .MuiChip-label": { px: 0.85 },
                }}
              />
            }
          />
        </Box>

        {/* Today's orders — list */}
        <Box
          sx={{
            gridArea: "ordBody",
            px: { xs: 0.8, sm: 0.9 },
            pb: { xs: 0.8, sm: 0.9 },
            pt: { xs: 0, md: 0 },
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.05 : 0.03),
          }}
        >
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: { md: "100%" } }}>
            <Box
              sx={{
                flex: 1,
                borderRadius: 1.25,
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.95),
                bgcolor: "background.paper",
                overflow: "auto",
                minHeight: { xs: 108, md: 0 },
                ...scrollAreaSx,
                boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.04)} inset`,
              }}
            >
              {typeof getOrderStatus !== "function" ? (
                <Box
                  sx={{
                    p: 1.35,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 0.75,
                  }}
                >
                  <ErrorOutlineIcon sx={{ fontSize: 28, color: "text.disabled", opacity: 0.85 }} aria-hidden />
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55, maxWidth: 220 }}>
                    Order status isn&apos;t available in this view. Open the full orders list when enabled.
                  </Typography>
                </Box>
              ) : todaysOrderRows.length === 0 ? (
                <Box
                  sx={{
                    p: 1.35,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 0.75,
                  }}
                >
                  <InboxOutlinedIcon sx={{ fontSize: 32, color: "text.disabled", opacity: 0.9 }} aria-hidden />
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55, maxWidth: 240, fontWeight: 500 }}>
                    No distributors yet today with approved, pending, or rejected orders.
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", lineHeight: 1.45 }}>
                    Same-day orders appear here automatically.
                  </Typography>
                </Box>
              ) : (
                <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {todaysOrderRows.map((row, idx) => (
                  <Box
                    component="li"
                    key={`${row.name}-${idx}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                      px: 1.1,
                      py: 0.55,
                      borderBottom:
                        idx < todaysOrderRows.length - 1 ? "1px solid" : "none",
                      borderColor: "divider",
                      transition: "background-color 0.15s ease",
                      "&:hover": {
                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.04),
                      },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        fontSize: "0.75rem",
                        color: "text.primary",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      }}
                    >
                      {row.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      color={statusChipColor(row.status)}
                      variant={row.status === "pending" ? "outlined" : "filled"}
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.65rem",
                        height: 22,
                        flexShrink: 0,
                      }}
                    />
                  </Box>
                ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Target period — header (Days left beside title) */}
        <Box
          sx={{
            gridArea: "perHead",
            p: { xs: 0.8, sm: 0.9 },
            pt: { xs: 0.7, sm: 0.8 },
            borderTop: "3px solid",
            borderTopColor: "success.main",
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
            bgcolor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.03 : 0.02),
            minHeight: 0,
          }}
        >
          <SectionHeader
            sx={{ mb: { md: 0 } }}
            icon={CalendarMonthIcon}
            iconBg={successTint}
            iconColor={theme.palette.success.main}
            title="Target period"
            subtitle="Invoice dates counted within this window."
            action={daysLeftAction}
          />
        </Box>

        {/* Target period — calendar full width */}
        <Box
          sx={{
            gridArea: "perBody",
            px: { xs: 0.8, sm: 0.9 },
            pb: { xs: 0.75, sm: 0.85 },
            pt: { xs: 0, md: 0 },
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            bgcolor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.03 : 0.02),
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0.4,
              minHeight: 0,
              height: { md: "100%" },
            }}
          >
            <Box
              sx={{
                flex: 1,
                borderRadius: 1.25,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                p: 0.3,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                boxShadow: `0 1px 0 ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.04)} inset`,
              }}
            >
              <TargetPeriodCalendarPreview
                compact
                fillWidth
                stretchVertically
                minPanels={2}
                mode={targetPeriodIsSet ? "period" : "today"}
                startYmd={targetPeriod?.start}
                endYmd={targetPeriod?.end}
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: { xs: 0.65, sm: 0.85 },
                rowGap: 0.35,
                flexShrink: 0,
              }}
            >
              {targetPeriodIsSet ? (
                <>
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, fontSize: "0.68rem", lineHeight: 1.35 }}>
                    {formatTargetPeriodDisplay(targetPeriod?.start, targetPeriod?.end)}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { sm: "auto" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "success.main", flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                        Start
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "warning.main", flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem" }}>
                        End
                      </Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, fontSize: "0.68rem", lineHeight: 1.35 }}>
                  Set target start and end dates in Targets to begin tracking this period.
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Card>
  );
}

export default InfoCards;
