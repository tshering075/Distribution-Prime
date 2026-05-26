import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  alpha,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TableRowsIcon from "@mui/icons-material/TableRows";

/**
 * Shown to distributors when sales_data (stock lifting) changes after an admin upload.
 */
export default function SalesDataRefreshNoticeDialog({
  open,
  onClose,
  liftingLineCount = null,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          elevation: 8,
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            background: (theme) =>
              `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${theme.palette.background.paper} 38%)`,
          },
        },
      }}
    >
      <DialogTitle sx={{ pt: 2.5, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
              color: "primary.main",
              flexShrink: 0,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 30 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="div" fontWeight={800} sx={{ lineHeight: 1.25, mb: 0.5 }}>
              Stock lifting updated
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
              Your administrator uploaded fresh sales data. Targets, achieved figures, and your stock lifting
              table are now in sync with the latest file.
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 0, pb: 1 }}>
        <Stack spacing={1.25} sx={{ mt: 1 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <TrendingUpIcon sx={{ fontSize: 20, color: "success.main", mt: 0.25 }} />
            <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.5 }}>
              <strong>Target Progress Tracker</strong> and <strong>Target Balance</strong> use these lifts, so your
              numbers may have changed.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <TableRowsIcon sx={{ fontSize: 20, color: "info.main", mt: 0.25 }} />
            <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.5 }}>
              Scroll to <strong>Stock lifting record</strong> below to review each invoice row.
              {typeof liftingLineCount === "number" && liftingLineCount >= 0 ? (
                <>
                  {" "}
                  You currently have <strong>{liftingLineCount}</strong>{" "}
                  {liftingLineCount === 1 ? "row" : "rows"} on file.
                </>
              ) : null}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1 }}>
        <Button variant="contained" size="large" onClick={onClose} sx={{ minWidth: 140, fontWeight: 700 }}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
