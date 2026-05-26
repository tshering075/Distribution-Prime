import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { parseTargetPeriodBounds } from "../utils/targetPeriod";

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function monthTitle(year, month0, short = false) {
  const d = new Date(year, month0, 1);
  return d.toLocaleString("en-US", short ? { month: "short", year: "numeric" } : { month: "long", year: "numeric" });
}

/** @returns {(number | null)[]} cell list: null = empty padding, else day of month */
function buildMonthCells(year, month0) {
  const first = new Date(year, month0, 1);
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  const startWeekday = first.getDay();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= lastDay; d += 1) cells.push(d);
  return cells;
}

/**
 * Read-only month grid(s) for the active target period. Start / end days are emphasized; inclusive range is tinted.
 * @param {{ startYmd: string, endYmd: string, compact?: boolean, fillWidth?: boolean, stretchVertically?: boolean, minPanels?: number }} props
 */
export default function TargetPeriodCalendarPreview({
  startYmd,
  endYmd,
  compact = false,
  fillWidth = false,
  stretchVertically = false,
  minPanels = 1,
}) {
  const theme = useTheme();

  const { rangeStart, rangeEnd, months } = useMemo(() => {
    const { start, end } = parseTargetPeriodBounds(startYmd, endYmd);
    if (!start || !end) return { rangeStart: null, rangeEnd: null, months: [] };

    const rs = startOfLocalDay(start);
    const re = startOfLocalDay(end);

    const list = [];
    let y = rs.getFullYear();
    let m = rs.getMonth();
    const endY = re.getFullYear();
    const endM = re.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      list.push({ year: y, month: m });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }

    return { rangeStart: rs, rangeEnd: re, months: list };
  }, [startYmd, endYmd]);

  if (!rangeStart || !rangeEnd || months.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No period set
      </Typography>
    );
  }

  const inRange = (year, month0, day) => {
    const t = new Date(year, month0, day).getTime();
    return t >= rangeStart.getTime() && t <= rangeEnd.getTime();
  };

  const isStart = (year, month0, day) =>
    year === rangeStart.getFullYear() &&
    month0 === rangeStart.getMonth() &&
    day === rangeStart.getDate();

  const isEnd = (year, month0, day) =>
    year === rangeEnd.getFullYear() &&
    month0 === rangeEnd.getMonth() &&
    day === rangeEnd.getDate();

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const singleMonth = months.length === 1;
  // If the caller asks for multiple panels (e.g. minPanels=2) we want a single-month view
  // to visually match the multi-month compact sizing (no extra "tiny single month" mode).
  const safeMinPanels = Math.max(1, Number(minPanels) || 1);
  const normalizeSingleMonthSizing = compact && singleMonth && safeMinPanels > 1;
  const singleCompact = compact && singleMonth && !normalizeSingleMonthSizing;

  // Keep compact previews short to fit dashboard cards.
  const gap = singleCompact ? 0.3 : compact ? 0.45 : 1.25;
  const cellMin = singleCompact ? 12 : compact ? 14 : 22;
  const dayFont = singleCompact ? "0.5rem" : compact ? "0.54rem" : "0.72rem";
  const headFont = singleCompact ? "0.46rem" : compact ? "0.48rem" : "0.62rem";
  const monthMb = singleCompact ? 0.14 : compact ? 0.18 : 0.5;

  // Only auto-expand the month panel for a true single-panel layout.
  // If `minPanels` is > 1 we keep the single-month view in multi-panel geometry.
  const expandMonth = fillWidth && singleMonth && safeMinPanels === 1;
  /**
   * Only stretch to fill parent height when explicitly requested.
   * For compact previews, stretching a single-month view tends to look oversized.
   */
  const stretchMonthVertically = expandMonth && stretchVertically && !compact;

  const basePanels = months.map((m) => ({ ...m, __placeholder: false }));
  const panels = (() => {
    if (basePanels.length >= safeMinPanels) return basePanels;
    const first = basePanels[0];
    const needed = safeMinPanels - basePanels.length;
    const out = [...basePanels];
    for (let i = 0; i < needed; i += 1) {
      out.push({
        year: first.year,
        month: first.month,
        __placeholder: true,
        __key: `placeholder-${i}`,
      });
    }
    return out;
  })();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap,
        overflow: "hidden",
        pb: singleCompact ? 0.02 : compact ? 0.06 : 0.5,
        width: fillWidth ? "100%" : undefined,
        flex: stretchMonthVertically ? 1 : undefined,
        minHeight: stretchMonthVertically ? 0 : undefined,
        maxWidth: "100%",
        alignSelf: fillWidth ? "stretch" : undefined,
        justifyContent: stretchMonthVertically ? "stretch" : "flex-start",
        alignItems: stretchMonthVertically ? "stretch" : "flex-start",
      }}
    >
      {panels.map(({ year, month, __placeholder, __key }) => (
        <Box
          key={__key || `${year}-${month}`}
          sx={{
            flex: expandMonth ? "1 1 100%" : `1 1 ${compact ? 120 : 140}px`,
            minWidth: expandMonth ? 0 : compact ? 116 : 132,
            maxWidth: expandMonth ? "100%" : { xs: "100%", sm: compact ? 160 : 176 },
            width: expandMonth ? "100%" : undefined,
            display: expandMonth ? "flex" : undefined,
            flexDirection: expandMonth ? "column" : undefined,
            visibility: __placeholder ? "hidden" : "visible",
            pointerEvents: __placeholder ? "none" : undefined,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              display: "block",
              mb: monthMb,
              color: "text.secondary",
              letterSpacing: compact ? 0.05 : 0.2,
              fontSize: compact ? "0.65rem" : undefined,
            }}
          >
            {monthTitle(year, month, compact)}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: compact ? "1px" : "2px",
              flex: stretchMonthVertically ? 1 : undefined,
              minHeight: stretchMonthVertically ? 0 : undefined,
              alignContent: stretchMonthVertically ? "center" : undefined,
            }}
          >
            {weekdayLabels.map((w, i) => (
              <Typography
                key={`${year}-${month}-w-${i}`}
                variant="caption"
                sx={{
                  textAlign: "center",
                  color: "text.disabled",
                  fontSize: headFont,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {w}
              </Typography>
            ))}
            {buildMonthCells(year, month).map((day, idx) =>
              day == null ? (
                <Box key={`${year}-${month}-pad-${idx}`} sx={{ aspectRatio: "1", minHeight: cellMin }} />
              ) : (
                <Box
                  key={`${year}-${month}-d-${day}`}
                  sx={{
                    aspectRatio: "1",
                    minHeight: cellMin,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    fontSize: dayFont,
                    fontWeight: isStart(year, month, day) || isEnd(year, month, day) ? 800 : 600,
                    lineHeight: 1,
                    color: "text.primary",
                    bgcolor: !inRange(year, month, day)
                      ? "transparent"
                      : isStart(year, month, day)
                        ? alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.35 : 0.22)
                        : isEnd(year, month, day)
                          ? alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.4 : 0.26)
                          : alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.14 : 0.1),
                    border:
                      isStart(year, month, day) || isEnd(year, month, day)
                        ? `2px solid ${
                            isStart(year, month, day)
                              ? theme.palette.success.main
                              : theme.palette.warning.main
                          }`
                        : "2px solid transparent",
                  }}
                >
                  {day}
                </Box>
              )
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
