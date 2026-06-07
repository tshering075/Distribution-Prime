import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Stack,
} from "@mui/material";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * Performance table toolbar: region filter, export, and optional clear (no Excel upload).
 */
export default function PerformanceToolbar({
  isMobile,
  onDownloadExcel,
  onDownloadPDF,
  onDeleteAll,
  deleting,
  canDelete,
  selectedRegion,
  onRegionChange,
}) {
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const saveMenuOpen = Boolean(saveMenuAnchor);

  const btnSx = {
    textTransform: "none",
    borderRadius: 1.5,
    fontWeight: 750,
    fontSize: { xs: "0.72rem", sm: "0.8rem" },
    height: 34,
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            Performance table
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Achieved = dispatches in this target period; orders dispatched after period end count in the next period
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 180 } }}>
            <InputLabel shrink>Region</InputLabel>
            <Select
              value={selectedRegion}
              label="Region"
              onChange={(e) => onRegionChange(e.target.value)}
              sx={{ bgcolor: "background.paper" }}
            >
              <MenuItem value="All">All Regions</MenuItem>
              <MenuItem value="Southern">Southern</MenuItem>
              <MenuItem value="Western">Western</MenuItem>
              <MenuItem value="Eastern">Eastern</MenuItem>
              <MenuItem value="PLING">PLING</MenuItem>
              <MenuItem value="THIM">THIM</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveAltIcon fontSize="small" />}
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setSaveMenuAnchor(e.currentTarget)}
              sx={{ ...btnSx, flex: { xs: "1 1 auto", sm: "0 0 auto" } }}
            >
              {isMobile ? "Save" : "Export"}
            </Button>
            <Menu anchorEl={saveMenuAnchor} open={saveMenuOpen} onClose={() => setSaveMenuAnchor(null)}>
              <MenuItem
                onClick={async () => {
                  setSaveMenuAnchor(null);
                  if (onDownloadPDF) await onDownloadPDF();
                }}
              >
                PDF
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setSaveMenuAnchor(null);
                  if (onDownloadExcel) onDownloadExcel();
                }}
              >
                Excel
              </MenuItem>
            </Menu>

            {canDelete ? (
              <Tooltip title="Reset all distributor achieved values and dispatch records">
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={
                    deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon fontSize="small" />
                  }
                  onClick={onDeleteAll}
                  disabled={deleting}
                  sx={{ ...btnSx, flex: { xs: "1 1 auto", sm: "0 0 auto" } }}
                >
                  {deleting ? "…" : isMobile ? "Clear" : "Clear data"}
                </Button>
              </Tooltip>
            ) : null}
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
