import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  Paper,
  Typography,
  Box,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

export function formatStockLiftDate(record) {
  if (!record) return "—";
  if (record.invoiceDate) {
    try {
      return new Date(record.invoiceDate).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return String(record.invoiceDate);
    }
  }
  const raw = record.date || record.timestamp || record.created_at;
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return String(raw);
  }
}

/**
 * Stock lifting rows from sales_data / orders fallback — CSD & Water PC + UC.
 */
function sumRecords(records, field) {
  return records.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
}

export default function StockLiftingRecordsTable({
  records = [],
  stickyHeader = false,
  maxHeight,
  emptyMessage = "No stock lifting records found for this period.",
  /** Sum row at bottom (hidden when no data rows). */
  showTotalsRow = true,
  /** "grouped" = two-row CSD / Water band; "flat" = one row with explicit CSD/W column titles (better in dialogs). */
  headerLayout = "grouped",
  /** Adds a leading Distributor column (expects `record.distributorLabel`). Forces flat header layout. */
  showDistributorColumn = false,
  /** Visual style for the totals row / sticky footer. */
  totalsRowVariant = "error",
  /** Keep totals visible at the bottom of the scroll area (inside TableContainer). */
  stickyTotals = false,
  /** Click lift date on a row → SKU detail for that lift. */
  onLiftRowClick,
  /** Click Total row → SKU detail for all visible records. */
  onTotalsClick,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";
  const layout = showDistributorColumn ? "flat" : headerLayout;
  const colCount = showDistributorColumn ? 6 : 5;

  let totalsFooterBg;
  let totalsFooterBorder;
  let totalsFooterColor;
  if (totalsRowVariant === "primary") {
    totalsFooterBg = alpha(theme.palette.primary.main, isDark ? 0.45 : 0.18);
    totalsFooterBorder = theme.palette.primary.main;
    totalsFooterColor = theme.palette.getContrastText(totalsFooterBg);
  } else if (totalsRowVariant === "neutral") {
    totalsFooterBg = alpha(theme.palette.grey[500], isDark ? 0.2 : 0.1);
    totalsFooterBorder = theme.palette.divider;
    totalsFooterColor = theme.palette.text.primary;
  } else {
    totalsFooterBg = alpha(theme.palette.error.main, isDark ? 0.2 : 0.12);
    totalsFooterBorder = theme.palette.error.main;
    totalsFooterColor = theme.palette.text.primary;
  }
  const totalsFooterShadow = stickyTotals
    ? totalsRowVariant === "neutral"
      ? "0 -6px 16px rgba(0,0,0,0.08)"
      : "0 -6px 16px rgba(0,0,0,0.12)"
    : "none";

  const headBg = theme.palette.primary.main;
  const headFg = theme.palette.primary.contrastText;
  const subBg = theme.palette.secondary.main;
  const subFg = theme.palette.getContrastText(theme.palette.secondary.main);
  const subBorder = theme.palette.primary.dark;

  /** Stronger than old yellow 12% tint — works in light + dark; never hardcode #fff rows */
  const zebraOdd = alpha(theme.palette.primary.main, isDark ? 0.22 : 0.1);
  const zebraEven = theme.palette.background.paper;

  const headSx = {
    fontWeight: 700,
    color: headFg,
    bgcolor: headBg,
    textAlign: "center",
    py: 1.25,
    px: 1,
    fontSize: isMobile ? "0.7rem" : "0.8125rem",
    lineHeight: 1.3,
    borderBottom: "none",
  };

  const subHeadSx = {
    fontWeight: 700,
    textAlign: "center",
    verticalAlign: "middle",
    py: 1,
    px: 1,
    fontSize: isMobile ? "0.68rem" : "0.78rem",
    bgcolor: subBg,
    color: subFg,
    borderBottom: `2px solid ${subBorder}`,
  };

  const cellSx = {
    fontSize: isMobile ? "0.72rem" : "0.875rem",
    fontWeight: 700,
    py: 1.1,
    px: 1,
    verticalAlign: "middle",
    boxSizing: "border-box",
    color: "text.primary",
  };

  const footerCellSx = {
    ...cellSx,
    fontWeight: 800,
    color: totalsFooterColor,
    bgcolor: totalsFooterBg,
    borderBottom: "none",
    borderTop: `2px solid ${totalsFooterBorder}`,
  };

  /** PC / UC: same alignment as sub-headers + tabular figures for a straight digit column */
  const numericCellInnerSx = {
    display: "block",
    width: "100%",
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: '"tnum"',
    letterSpacing: "0.01em",
  };

  const totalCsdPC = sumRecords(records, "csdPC");
  const totalCsdUC = sumRecords(records, "csdUC");
  const totalWaterPC = sumRecords(records, "waterPC");
  const totalWaterUC = sumRecords(records, "waterUC");

  const flatHeadSx = {
    ...headSx,
    whiteSpace: "nowrap",
  };

  return (
    <TableContainer
      component={Paper}
      elevation={2}
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        overflow: "auto",
        maxHeight: maxHeight ?? "none",
        ...(stickyHeader ? { maxHeight: maxHeight || { xs: "70vh", sm: "60vh" } } : {}),
      }}
    >
      <Table
        size={isMobile ? "small" : "medium"}
        stickyHeader={stickyHeader}
        sx={{
          minWidth: 520,
          width: "100%",
          tableLayout: "fixed",
          // Same horizontal padding for head/body numeric columns (MUI can differ by variant)
          "& .MuiTableCell-head": { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
          "& .MuiTableCell-body": { paddingLeft: theme.spacing(1), paddingRight: theme.spacing(1) },
        }}
      >
        <colgroup>
          {showDistributorColumn ? (
            <col style={{ width: isMobile ? "28%" : "22%" }} />
          ) : null}
          <col style={{ width: showDistributorColumn ? (isMobile ? "26%" : "24%") : isMobile ? "34%" : "30%" }} />
          <col style={{ width: isMobile ? "16.5%" : "17.5%" }} />
          <col style={{ width: isMobile ? "16.5%" : "17.5%" }} />
          <col style={{ width: isMobile ? "16.5%" : "17.5%" }} />
          <col style={{ width: isMobile ? "16.5%" : "17.5%" }} />
        </colgroup>
        <TableHead>
          {layout === "flat" ? (
            <TableRow>
              {showDistributorColumn ? (
                <TableCell sx={{ ...flatHeadSx, verticalAlign: "middle", minWidth: 100 }}>Distributor</TableCell>
              ) : null}
              <TableCell sx={{ ...flatHeadSx, verticalAlign: "middle", minWidth: 120 }}>Lift date</TableCell>
              <TableCell sx={flatHeadSx}>
                <Box component="span" sx={{ display: "block", fontWeight: 800 }}>CSD</Box>
                <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 600 }}>
                  PC
                </Typography>
              </TableCell>
              <TableCell sx={flatHeadSx}>
                <Box component="span" sx={{ display: "block", fontWeight: 800 }}>CSD</Box>
                <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 600 }}>
                  UC
                </Typography>
              </TableCell>
              <TableCell sx={flatHeadSx}>
                <Box component="span" sx={{ display: "block", fontWeight: 800 }}>Water</Box>
                <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 600 }}>
                  PC
                </Typography>
              </TableCell>
              <TableCell sx={flatHeadSx}>
                <Box component="span" sx={{ display: "block", fontWeight: 800 }}>Water</Box>
                <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 600 }}>
                  UC
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            <>
              <TableRow>
                <TableCell rowSpan={2} sx={{ ...headSx, verticalAlign: "middle", minWidth: 120 }}>
                  Lift date
                </TableCell>
                <TableCell colSpan={2} sx={{ ...headSx, verticalAlign: "middle" }}>
                  CSD
                  <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 500, mt: 0.25 }}>
                    Physical cases & unit cases
                  </Typography>
                </TableCell>
                <TableCell colSpan={2} sx={{ ...headSx, verticalAlign: "middle" }}>
                  Water (Kinley)
                  <Typography component="span" variant="caption" sx={{ display: "block", opacity: 0.92, fontWeight: 500, mt: 0.25 }}>
                    Physical cases & unit cases
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={subHeadSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    PC
                  </Box>
                </TableCell>
                <TableCell sx={subHeadSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    UC
                  </Box>
                </TableCell>
                <TableCell sx={subHeadSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    PC
                  </Box>
                </TableCell>
                <TableCell sx={subHeadSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    UC
                  </Box>
                </TableCell>
              </TableRow>
            </>
          )}
        </TableHead>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} align="center" sx={{ py: 4, color: "text.secondary" }}>
                <Box sx={{ maxWidth: 360, mx: "auto" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    No records yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            records.map((record, idx) => (
              <TableRow
                key={record.id || `${record.invoiceDate || record.date || idx}-${idx}`}
                hover
                sx={{
                  "&:nth-of-type(odd)": { bgcolor: zebraOdd },
                  "&:nth-of-type(even)": { bgcolor: zebraEven },
                  "&:hover": {
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08),
                  },
                }}
              >
                {showDistributorColumn ? (
                  <TableCell sx={{ ...cellSx, textAlign: "left", fontWeight: 600 }}>
                    <Typography variant="body2" noWrap title={record.distributorLabel || ""}>
                      {record.distributorLabel || "—"}
                    </Typography>
                  </TableCell>
                ) : null}
                <TableCell sx={cellSx}>
                  {typeof onLiftRowClick === "function" ? (
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => onLiftRowClick(record)}
                      title="View SKU-wise lifting for this row"
                      sx={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        p: 0,
                        border: "none",
                        bgcolor: "transparent",
                        color: "primary.main",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "inherit",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        "&:hover": { color: "primary.dark" },
                      }}
                    >
                      {formatStockLiftDate(record)}
                    </Typography>
                  ) : (
                    formatStockLiftDate(record)
                  )}
                </TableCell>
                <TableCell sx={cellSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    {Math.round(Number(record.csdPC) || 0).toLocaleString()}
                  </Box>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    {Math.round(Number(record.csdUC) || 0).toLocaleString()}
                  </Box>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    {Math.round(Number(record.waterPC) || 0).toLocaleString()}
                  </Box>
                </TableCell>
                <TableCell sx={cellSx}>
                  <Box component="span" sx={numericCellInnerSx}>
                    {Math.round(Number(record.waterUC) || 0).toLocaleString()}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {showTotalsRow && records.length > 0 ? (
          <TableFooter
            sx={{
              bgcolor: totalsFooterBg,
              ...(stickyTotals
                ? {
                    position: "sticky",
                    bottom: 0,
                    zIndex: 4,
                    boxShadow: totalsFooterShadow,
                  }
                : {}),
            }}
          >
            <TableRow
              hover={typeof onTotalsClick === "function"}
              onClick={typeof onTotalsClick === "function" ? () => onTotalsClick(records) : undefined}
              sx={
                typeof onTotalsClick === "function"
                  ? {
                      cursor: "pointer",
                      "&:hover td": {
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.14),
                      },
                    }
                  : undefined
              }
            >
              {showDistributorColumn ? (
                <TableCell sx={footerCellSx}>Total</TableCell>
              ) : null}
              <TableCell sx={footerCellSx}>
                {typeof onTotalsClick === "function" ? (
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 900,
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                    }}
                  >
                    {showDistributorColumn ? "All lifts (SKU detail)" : "Total · all lifts"}
                  </Typography>
                ) : showDistributorColumn ? (
                  "—"
                ) : (
                  "Total"
                )}
              </TableCell>
              <TableCell sx={footerCellSx}>
                <Box component="span" sx={{ ...numericCellInnerSx, color: "inherit" }}>
                  {Math.round(totalCsdPC).toLocaleString()}
                </Box>
              </TableCell>
              <TableCell sx={footerCellSx}>
                <Box component="span" sx={{ ...numericCellInnerSx, color: "inherit" }}>
                  {Math.round(totalCsdUC).toLocaleString()}
                </Box>
              </TableCell>
              <TableCell sx={footerCellSx}>
                <Box component="span" sx={{ ...numericCellInnerSx, color: "inherit" }}>
                  {Math.round(totalWaterPC).toLocaleString()}
                </Box>
              </TableCell>
              <TableCell sx={footerCellSx}>
                <Box component="span" sx={{ ...numericCellInnerSx, color: "inherit" }}>
                  {Math.round(totalWaterUC).toLocaleString()}
                </Box>
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </TableContainer>
  );
}
