import React, { useRef, useState } from "react";
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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * Single toolbar row: region filter + Excel actions (replaces stacked HeaderActions + FiltersSection).
 */
export default function PerformanceToolbar({
  isMobile,
  loadingFile,
  onFileChange,
  onDownloadExcel,
  onDownloadPDF,
  onDeleteAll,
  deleting,
  canDelete,
  fileInputRef,
  selectedRegion,
  onRegionChange,
  updatedDate,
}) {
  const hiddenFileRef = useRef(null);
  const fileRef = fileInputRef || hiddenFileRef;
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const saveMenuOpen = Boolean(saveMenuAnchor);

  const formatDateTime = (date) => {
    if (!date) return "";
    try {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const triggerUpdate = () => {
    if (fileRef.current) fileRef.current.click();
  };

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
          {updatedDate ? (
            <Typography variant="caption" color="text.secondary" display="block">
              Sales data updated {formatDateTime(updatedDate)}
            </Typography>
          ) : null}
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
            <Tooltip title="Upload Excel to update achieved sales">
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={
                  loadingFile ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon fontSize="small" />
                }
                onClick={triggerUpdate}
                disabled={loadingFile}
                sx={{
                  ...btnSx,
                  color: "#fff",
                  flex: { xs: "1 1 auto", sm: "0 0 auto" },
                }}
              >
                {loadingFile ? "Uploading…" : isMobile ? "Upload" : "Upload Excel"}
              </Button>
            </Tooltip>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} style={{ display: "none" }} />

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
            <Menu
              anchorEl={saveMenuAnchor}
              open={saveMenuOpen}
              onClose={() => setSaveMenuAnchor(null)}
            >
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
              <Tooltip title="Clear all achieved sales data">
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={
                    deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon fontSize="small" />
                  }
                  onClick={onDeleteAll}
                  disabled={deleting || loadingFile}
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
