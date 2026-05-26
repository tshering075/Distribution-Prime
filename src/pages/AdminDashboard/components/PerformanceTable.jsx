import React, { useMemo } from "react";
import {
  Box,
  Typography,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Tooltip,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PeopleIcon from "@mui/icons-material/People";

function bodyStripeBg(theme, rowIdx) {
  const isDark = theme.palette.mode === "dark";
  return rowIdx % 2 === 0
    ? alpha(theme.palette.primary.main, isDark ? 0.14 : 0.05)
    : alpha(theme.palette.secondary.main, isDark ? 0.12 : 0.07);
}

function hoverRowBg(theme) {
  return alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.22 : 0.1);
}

const METRIC_KEYS = [
  { key: "CSD_PC", short: "C.PC", tip: "CSD PC" },
  { key: "CSD_UC", short: "C.UC", tip: "CSD UC" },
  { key: "Water_PC", short: "W.PC", tip: "Water PC" },
  { key: "Water_UC", short: "W.UC", tip: "Water UC" },
];

const compactCell = {
  px: { xs: 0.35, sm: 0.5 },
  py: { xs: 0.25, sm: 0.35 },
  fontSize: { xs: "0.62rem", sm: "0.72rem" },
  lineHeight: 1.15,
  whiteSpace: "nowrap",
};

const figureSx = {
  ...compactCell,
  textAlign: "center",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

function MetricHeaderCells({ top, zIndex = 15, sectionBorder = "none", sxExtra = {} }) {
  return METRIC_KEYS.map((m, i) => (
    <TableCell
      key={m.key}
      sx={{
        ...compactCell,
        fontWeight: 700,
        textAlign: "center",
        position: "sticky",
        top,
        zIndex,
        bgcolor: "secondary.main",
        color: (t) => t.palette.getContrastText(t.palette.secondary.main),
        borderLeft:
          i === 0 && (sectionBorder === "left" || sectionBorder === "both") ? "2px solid" : undefined,
        borderRight:
          i === METRIC_KEYS.length - 1 && (sectionBorder === "right" || sectionBorder === "both")
            ? "2px solid"
            : undefined,
        borderColor: "divider",
        ...sxExtra,
      }}
    >
      <Tooltip title={m.tip} placement="top" arrow>
        <span>{m.short}</span>
      </Tooltip>
    </TableCell>
  ));
}

function MetricBodyCells({ bucket, stripe, colorFn, sectionBorder = "none" }) {
  return METRIC_KEYS.map((m, i) => (
    <TableCell
      key={m.key}
      sx={{
        ...figureSx,
        bgcolor: stripe,
        color: colorFn ? colorFn(bucket?.[m.key]) : "text.primary",
        borderTop: 1,
        borderColor: "divider",
        borderLeft:
          i === 0 && (sectionBorder === "left" || sectionBorder === "both") ? "2px solid" : undefined,
        borderRight:
          i === METRIC_KEYS.length - 1 && (sectionBorder === "right" || sectionBorder === "both")
            ? "2px solid"
            : undefined,
      }}
    >
      {Math.round(bucket?.[m.key] || 0)}
    </TableCell>
  ));
}

function PerformanceTable({
  distributors,
  selectedRegion,
  isMobile,
  tableRef,
  onDistributorClick,
  salesDataLoaded = false,
}) {
  const theme = useTheme();

  const headerPrimary = useMemo(
    () => ({
      bg: theme.palette.primary.main,
      fg: theme.palette.primary.contrastText,
      divider: alpha(theme.palette.primary.contrastText, 0.35),
    }),
    [theme]
  );

  const totalRowBg = useMemo(
    () => alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.08),
    [theme]
  );

  const headerRowSx = {
    ...compactCell,
    fontWeight: 700,
    bgcolor: headerPrimary.bg,
    color: headerPrimary.fg,
    position: "sticky",
    top: 0,
    zIndex: 15,
    py: { xs: 0.35, sm: 0.45 },
  };

  const subHeaderTop = { xs: 22, sm: 26 };

  const normalizeRegionKey = (region) => {
    const map = { South: "Southern", West: "Western", East: "Eastern" };
    return map[region] || region;
  };

  const toNumber = (value) => Number(value || 0);

  const resolvedRegion = normalizeRegionKey(selectedRegion);
  const filteredDistributors = distributors.filter(
    (d) => selectedRegion === "All" || d.region === resolvedRegion
  );

  const totals = filteredDistributors.reduce(
    (acc, d) => ({
      targetCSD_PC: acc.targetCSD_PC + toNumber(d.target?.CSD_PC),
      targetCSD_UC: acc.targetCSD_UC + toNumber(d.target?.CSD_UC),
      targetWater_PC: acc.targetWater_PC + toNumber(d.target?.Water_PC),
      targetWater_UC: acc.targetWater_UC + toNumber(d.target?.Water_UC),
      achievedCSD_PC: acc.achievedCSD_PC + toNumber(d.achieved?.CSD_PC),
      achievedCSD_UC: acc.achievedCSD_UC + toNumber(d.achieved?.CSD_UC),
      achievedWater_PC: acc.achievedWater_PC + toNumber(d.achieved?.Water_PC),
      achievedWater_UC: acc.achievedWater_UC + toNumber(d.achieved?.Water_UC),
      balanceCSD_PC: acc.balanceCSD_PC + toNumber(d.balance?.CSD_PC),
      balanceCSD_UC: acc.balanceCSD_UC + toNumber(d.balance?.CSD_UC),
      balanceWater_PC: acc.balanceWater_PC + toNumber(d.balance?.Water_PC),
      balanceWater_UC: acc.balanceWater_UC + toNumber(d.balance?.Water_UC),
    }),
    {
      targetCSD_PC: 0,
      targetCSD_UC: 0,
      targetWater_PC: 0,
      targetWater_UC: 0,
      achievedCSD_PC: 0,
      achievedCSD_UC: 0,
      achievedWater_PC: 0,
      achievedWater_UC: 0,
      balanceCSD_PC: 0,
      balanceCSD_UC: 0,
      balanceWater_PC: 0,
      balanceWater_UC: 0,
    }
  );

  if (distributors.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 3, sm: 5 },
          color: "text.secondary",
        }}
      >
        <PeopleIcon sx={{ fontSize: { xs: 48, sm: 64 }, mb: 1.5, opacity: 0.45, color: "text.disabled" }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 0.25 }}>
          No distributors found
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          Add distributors to see their performance data
        </Typography>
      </Box>
    );
  }

  const achievedColor = (val) => ((val || 0) > 0 ? "success.main" : "text.primary");
  const balanceColor = (val) => ((val || 0) >= 0 ? "text.primary" : "error.main");
  const canOpenSkuDetail = typeof onDistributorClick === "function" && salesDataLoaded;

  return (
    <TableContainer
      ref={tableRef}
      component={Paper}
      elevation={theme.palette.mode === "dark" ? 3 : 1}
      sx={{
        width: "100%",
        maxHeight: { xs: "calc(100vh - 300px)", sm: "calc(100vh - 260px)" },
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "auto",
        minHeight: { xs: 200, sm: 240 },
        position: "relative",
        WebkitOverflowScrolling: "touch",
        "&::-webkit-scrollbar": { height: 6, width: 6 },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: (t) => alpha(t.palette.text.disabled, t.palette.mode === "dark" ? 0.5 : 0.35),
          borderRadius: 3,
        },
      }}
    >
      <Table
        stickyHeader
        size="small"
        sx={{
          minWidth: { xs: 520, sm: 680, md: 760 },
          borderCollapse: "collapse",
          "& .MuiTableCell-root": {
            border: "1px solid",
            borderColor: "divider",
          },
          "& .MuiTableHead tr:nth-of-type(1) .MuiTableCell-root": {
            borderColor: alpha(theme.palette.primary.contrastText, 0.4),
          },
        }}
      >
        <TableHead sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper" }}>
          <TableRow>
            <TableCell
              rowSpan={2}
              sx={{
                ...headerRowSx,
                left: 0,
                zIndex: 20,
                minWidth: { xs: 72, sm: 100 },
                maxWidth: { xs: 110, sm: 140 },
                verticalAlign: "middle",
              }}
            >
              <Tooltip title="Distributor name" placement="top" arrow>
                <span>Dist.</span>
              </Tooltip>
            </TableCell>
            <TableCell colSpan={4} sx={{ ...headerRowSx, textAlign: "center" }}>
              Target
            </TableCell>
            <TableCell
              colSpan={4}
              sx={{
                ...headerRowSx,
                textAlign: "center",
                borderLeft: "2px solid",
                borderLeftColor: headerPrimary.divider,
              }}
            >
              Achieved
            </TableCell>
            <TableCell
              colSpan={4}
              sx={{
                ...headerRowSx,
                textAlign: "center",
                borderLeft: "2px solid",
                borderLeftColor: headerPrimary.divider,
              }}
            >
              Balance
            </TableCell>
          </TableRow>
          <TableRow>
            <MetricHeaderCells top={subHeaderTop} />
            <MetricHeaderCells top={subHeaderTop} sectionBorder="both" />
            <MetricHeaderCells top={subHeaderTop} sectionBorder="left" />
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredDistributors.map((distributor, rowIdx) => {
            const stripe = bodyStripeBg(theme, rowIdx);
            return (
              <TableRow
                key={distributor.code || distributor.name}
                hover
                sx={{
                  bgcolor: stripe,
                  "&:hover": { bgcolor: hoverRowBg(theme) },
                }}
              >
                <TableCell
                  sx={{
                    ...compactCell,
                    fontWeight: 600,
                    position: "sticky",
                    left: 0,
                    bgcolor: stripe,
                    zIndex: 9,
                    minWidth: { xs: 72, sm: 100 },
                    maxWidth: { xs: 110, sm: 140 },
                    color: "text.primary",
                    borderTop: 1,
                    borderColor: "divider",
                    whiteSpace: "normal",
                  }}
                >
                  {canOpenSkuDetail ? (
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => onDistributorClick(distributor)}
                      title="View SKU liftings from uploaded sales"
                      sx={{
                        display: "block",
                        fontWeight: 700,
                        fontSize: "inherit",
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textAlign: "left",
                        p: 0,
                        border: "none",
                        bgcolor: "transparent",
                        color: "primary.main",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        "&:hover": { color: "primary.dark" },
                      }}
                    >
                      {distributor.name}
                    </Typography>
                  ) : (
                    <Typography
                      component="span"
                      sx={{
                        display: "block",
                        fontWeight: 700,
                        fontSize: "inherit",
                        lineHeight: 1.2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {distributor.name}
                    </Typography>
                  )}
                  {distributor.region ? (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        display: "block",
                        color: "text.secondary",
                        fontSize: "0.58rem",
                        lineHeight: 1.1,
                        mt: 0.15,
                      }}
                    >
                      {distributor.region}
                    </Typography>
                  ) : null}
                </TableCell>
                <MetricBodyCells bucket={distributor.target} stripe={stripe} />
                <MetricBodyCells
                  bucket={distributor.achieved}
                  stripe={stripe}
                  sectionBorder="both"
                  colorFn={(val) => achievedColor(val)}
                />
                <MetricBodyCells
                  bucket={distributor.balance}
                  stripe={stripe}
                  sectionBorder="left"
                  colorFn={(val) => balanceColor(val)}
                />
              </TableRow>
            );
          })}
          <TableRow sx={{ bgcolor: totalRowBg, "& td": { borderTop: "2px solid", borderColor: "divider" } }}>
            <TableCell
              sx={{
                ...compactCell,
                fontWeight: 800,
                position: "sticky",
                left: 0,
                bgcolor: totalRowBg,
                zIndex: 9,
                color: "text.primary",
              }}
            >
              TOTAL
            </TableCell>
            <MetricBodyCells
              bucket={{
                CSD_PC: totals.targetCSD_PC,
                CSD_UC: totals.targetCSD_UC,
                Water_PC: totals.targetWater_PC,
                Water_UC: totals.targetWater_UC,
              }}
              stripe={totalRowBg}
            />
            <MetricBodyCells
              bucket={{
                CSD_PC: totals.achievedCSD_PC,
                CSD_UC: totals.achievedCSD_UC,
                Water_PC: totals.achievedWater_PC,
                Water_UC: totals.achievedWater_UC,
              }}
              stripe={totalRowBg}
              sectionBorder="both"
              colorFn={(val) => achievedColor(val)}
            />
            <MetricBodyCells
              bucket={{
                CSD_PC: totals.balanceCSD_PC,
                CSD_UC: totals.balanceCSD_UC,
                Water_PC: totals.balanceWater_PC,
                Water_UC: totals.balanceWater_UC,
              }}
              stripe={totalRowBg}
              sectionBorder="left"
              colorFn={(val) => balanceColor(val)}
            />
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default PerformanceTable;
