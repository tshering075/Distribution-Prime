import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Paper,
  Slide,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  LinearProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import { parseFgOpeningStockWorkbookArrayBuffer } from "../utils/parseFgOpeningStockXlsx";
import { getFgOpeningStock, saveFgOpeningStock, supabase } from "../services/supabaseService";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function FgStocksDialog({ open, onClose, onSaved, onNotify }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  /** Parent passes inline `onNotify` → must not put it in useCallback/deps or every toast re-renders re-fetch and wipe uploaded rows. */
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCloud = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const data = await getFgOpeningStock();
      if (data?.rows) {
        setRows(data.rows);
        setUpdatedAt(data.updatedAt);
        setUpdatedBy(data.updatedBy || "");
      } else {
        setRows([]);
        setUpdatedAt(null);
        setUpdatedBy("");
      }
    } catch (e) {
      onNotifyRef.current?.({
        severity: "error",
        title: "Could not load FG stock",
        message: e?.message || "Check your connection and Supabase settings.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadCloud();
    // Only when dialog opens — loadCloud is stable (empty deps)
  }, [open, loadCloud]);

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const { rows: parsed, errors } = parseFgOpeningStockWorkbookArrayBuffer(buf);
      if (errors.length && !parsed.length) {
        onNotifyRef.current?.({
          severity: "error",
          title: "Import failed",
          message: errors.join(" "),
        });
        return;
      }
      if (errors.length) {
        onNotifyRef.current?.({
          severity: "warning",
          title: "Imported with warnings",
          message: errors.join(" "),
        });
      }
      setRows(parsed);
      onNotifyRef.current?.({
        severity: "success",
        title: "File loaded",
        message: `Replaced preview with ${parsed.length} row(s) from this file only. Save to publish and overwrite the previous opening stock in the cloud.`,
      });
    } catch (err) {
      onNotifyRef.current?.({
        severity: "error",
        title: "Could not read file",
        message: err?.message || "Try a valid .xlsx file.",
      });
    }
  };

  const handleSave = async () => {
    if (!supabase) {
      onNotifyRef.current?.({
        severity: "error",
        title: "Not connected",
        message: "Supabase is not configured; opening stock cannot be saved.",
      });
      return;
    }
    if (!rows.length) {
      onNotifyRef.current?.({
        severity: "warning",
        title: "Nothing to save",
        message: "Upload an Excel file first.",
      });
      return;
    }
    setSaving(true);
    try {
      const email = (() => {
        try {
          return localStorage.getItem("admin_email") || "";
        } catch {
          return "";
        }
      })();
      const saved = await saveFgOpeningStock({ rows, updatedBy: email });
      setUpdatedAt(saved.updatedAt);
      setUpdatedBy(saved.updatedBy || email);
      onSaved?.(saved);
      onNotifyRef.current?.({
        severity: "success",
        title: "Opening stock updated",
        message: `Saved ${saved.rows.length} row(s). Distributors will see new availability beside SKUs.`,
      });
    } catch (err) {
      onNotifyRef.current?.({
        severity: "error",
        title: "Save failed",
        message: err?.message || "Could not save to the database.",
      });
    } finally {
      setSaving(false);
    }
  };

  const headCell = (text) => (
    <TableCell
      sx={{
        fontWeight: 700,
        color: theme.palette.primary.contrastText,
        bgcolor: "primary.main",
        fontSize: { xs: "0.7rem", sm: "0.8rem" },
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </TableCell>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      TransitionComponent={Transition}
      TransitionProps={{ timeout: 200 }}
      scroll="paper"
      PaperProps={{
        elevation: 0,
        sx: {
          bgcolor: "background.default",
          color: "text.primary",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          background: "linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)",
          color: "#fff",
          px: { xs: 1.5, sm: 2.5 },
          py: { xs: 1.25, sm: 1.5 },
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          boxShadow: "0 4px 12px rgba(183, 28, 28, 0.35)",
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Inventory2Icon sx={{ fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" }, lineHeight: 1.2 }}>
            FG stocks (opening stock)
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.25, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>
            Upload the daily opening stock Excel file. Data stays until you replace it with a new upload.
            {updatedAt ? ` Last saved: ${formatWhen(updatedAt)}` : ""}
            {updatedBy ? ` · ${updatedBy}` : ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close" sx={{ color: "#fff" }} size="large">
          <CloseIcon />
        </IconButton>
      </Box>

      <Paper
        elevation={0}
        square
        sx={{
          flexShrink: 0,
          px: { xs: 1.5, sm: 2.5 },
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          style={{ display: "none" }}
          tabIndex={-1}
          aria-hidden
          onChange={handleFile}
        />
        <Button
          type="button"
          variant="contained"
          color="primary"
          startIcon={<CloudUploadIcon />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fileRef.current?.click();
          }}
          disabled={saving}
        >
          Upload Excel
        </Button>
        <Button type="button" variant="contained" color="error" onClick={handleSave} disabled={loading || saving || !rows.length}>
          Save & publish
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ flex: "1 1 200px", minWidth: 0 }}>
          Columns required: Description, MFG Date, Batch No., Quantity, Expiry (header row is detected automatically).
        </Typography>
      </Paper>

      {loading && <LinearProgress />}

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: { xs: 1, sm: 2 } }}>
        <TableContainer
          component={Paper}
          elevation={theme.palette.mode === "dark" ? 4 : 2}
          sx={{
            borderRadius: 2,
            border: 1,
            borderColor: "divider",
            maxHeight: { xs: "calc(100vh - 220px)", sm: "calc(100vh - 200px)" },
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              borderCollapse: "collapse",
              "& .MuiTableCell-root": {
                border: "1px solid",
                borderColor: "divider",
              },
              "& .MuiTableHead .MuiTableCell-root": {
                borderColor: alpha(theme.palette.primary.contrastText, 0.4),
              },
            }}
          >
            <TableHead>
              <TableRow>
                {headCell("Description")}
                {headCell("MFG Date")}
                {headCell("Batch No.")}
                {headCell("Quantity")}
                {headCell("Expiry")}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>
                    {loading ? "Loading…" : "No data yet. Upload an Excel file to populate this table."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow
                    key={`${r.description}-${r.batchNo}-${idx}`}
                    hover
                    sx={{
                      "&:nth-of-type(odd)": {
                        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.14 : 0.05),
                      },
                      "&:nth-of-type(even)": {
                        bgcolor: alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.12 : 0.07),
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, color: "text.primary", maxWidth: 280 }}>{r.description}</TableCell>
                    <TableCell sx={{ color: "text.primary" }}>{r.mfgDate}</TableCell>
                    <TableCell sx={{ color: "text.primary" }}>{r.batchNo}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "text.primary" }}>
                      {typeof r.quantity === "number" ? r.quantity.toLocaleString() : r.quantity}
                    </TableCell>
                    <TableCell sx={{ color: "text.primary" }}>{r.expiry}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Dialog>
  );
}
