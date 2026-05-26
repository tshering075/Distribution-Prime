import React, { useRef, useState } from "react";
import { Box, Typography, Button, Tooltip, CircularProgress, Menu, MenuItem, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

/**
 * HeaderActions Component
 * Displays title and action buttons (Upload Excel, Save as PDF/Excel, Delete All).
 * Upload uses fileInputRef (or internal hidden input) — do not trigger a second click from the parent.
 */
function HeaderActions({
  isMobile,
  loadingFile,
  onFileChange,
  onDownloadExcel,
  onDownloadPDF,
  onDeleteAll,
  deleting,
  canDelete,
  fileInputRef,
}) {
  const theme = useTheme();
  const hiddenFileRef = useRef(null);
  const fileRef = fileInputRef || hiddenFileRef;
  const [saveMenuAnchor, setSaveMenuAnchor] = useState(null);
  const saveMenuOpen = Boolean(saveMenuAnchor);

  // Single programmatic click only — calling click() twice (e.g. here + parent callback)
  // opens the OS file dialog twice on Windows and forces a second file selection.
  const triggerUpdate = () => {
    if (fileRef.current) fileRef.current.click();
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: { xs: "center", sm: "space-between" },
        alignItems: { xs: "flex-start", sm: "center" },
        mb: { xs: 0.75, sm: 1.5 },
        flexWrap: "wrap",
        gap: { xs: 1, sm: 2 },
        flexDirection: { xs: "column", sm: "row" },
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          color: "text.primary",
          fontSize: { xs: "1rem", sm: "1.2rem" },
          width: { xs: "100%", sm: "auto" },
          textAlign: { xs: "center", sm: "left" },
          letterSpacing: -0.2,
        }}
      >
        Performance table
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: { xs: 0.5, sm: 1 },
          flexWrap: "wrap",
          width: { xs: "100%", sm: "auto" },
          justifyContent: { xs: "center", sm: "flex-end" },
        }}
      >
        {/* Upload Excel Button */}
        <Tooltip title="Upload Excel file to update sales data">
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={loadingFile ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
            onClick={triggerUpdate}
            disabled={loadingFile}
            sx={{
              textTransform: "none",
              color: "#fff",
              borderRadius: 1.5,
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.5, sm: 0.65 },
              fontSize: { xs: "0.72rem", sm: "0.85rem" },
              fontWeight: 750,
              boxShadow: `0 8px 18px ${alpha(theme.palette.error.main, 0.24)}`,
              minWidth: { xs: 0, sm: 128 },
              height: 34,
              flex: { xs: "1 1 0", sm: "0 0 auto" },
              "&:hover": {
                boxShadow: 4,
                transform: { xs: "none", sm: "translateY(-2px)" },
              },
              transition: "all 0.2s",
            }}
          >
            {loadingFile ? "Uploading..." : isMobile ? "Upload" : "Upload Excel"}
          </Button>
        </Tooltip>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileChange}
          style={{ display: "none" }}
        />

        {/* Save as: PDF or Excel (same footprint as sibling toolbar buttons) */}
        <Tooltip title="Save performance table as PDF or Excel">
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<SaveAltIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
            endIcon={<ArrowDropDownIcon sx={{ fontSize: { xs: 18, sm: 20 }, ml: -0.25 }} />}
            onClick={(e) => setSaveMenuAnchor(e.currentTarget)}
            sx={{
              textTransform: "none",
              borderRadius: 1.5,
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.5, sm: 0.65 },
              fontSize: { xs: "0.72rem", sm: "0.85rem" },
              fontWeight: 750,
              minWidth: { xs: 0, sm: 128 },
              height: 34,
              flex: { xs: "1 1 0", sm: "0 0 auto" },
              "&:hover": {
                transform: { xs: "none", sm: "translateY(-2px)" },
              },
              transition: "all 0.2s",
            }}
          >
            {isMobile ? "Save" : "Save as"}
          </Button>
        </Tooltip>
        <Menu
          anchorEl={saveMenuAnchor}
          open={saveMenuOpen}
          onClose={() => setSaveMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: saveMenuAnchor ? saveMenuAnchor.clientWidth : 128 } } }}
        >
          <MenuItem
            onClick={async () => {
              setSaveMenuAnchor(null);
              if (onDownloadPDF) await onDownloadPDF();
            }}
            sx={{ fontSize: { xs: "0.875rem", sm: "0.9rem" }, fontWeight: 600 }}
          >
            PDF
          </MenuItem>
          <MenuItem
            onClick={() => {
              setSaveMenuAnchor(null);
              if (onDownloadExcel) onDownloadExcel();
            }}
            sx={{ fontSize: { xs: "0.875rem", sm: "0.9rem" }, fontWeight: 600 }}
          >
            Excel
          </MenuItem>
        </Menu>

        {/* Delete All Data Button */}
        <Tooltip title="Delete all achieved values and sales data from Supabase">
          <Button
            variant="outlined"
            size="small"
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteForeverIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />}
            onClick={onDeleteAll}
            disabled={deleting || loadingFile}
            sx={{
              textTransform: "none",
              color: "error.main",
              borderColor: "error.main",
              borderRadius: 1.5,
              px: { xs: 1.5, sm: 2 },
              py: { xs: 0.5, sm: 0.65 },
              fontSize: { xs: "0.72rem", sm: "0.85rem" },
              fontWeight: 750,
              minWidth: { xs: 0, sm: 128 },
              height: 34,
              flex: { xs: "1 1 0", sm: "0 0 auto" },
              "&:hover": {
                bgcolor: alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.15 : 0.08),
                borderColor: "error.dark",
                transform: { xs: "none", sm: "translateY(-2px)" },
              },
              transition: "all 0.2s",
            }}
          >
            {deleting ? "Deleting..." : isMobile ? "Delete" : "Delete All"}
          </Button>
        </Tooltip>

      </Box>
    </Box>
  );
}

export default HeaderActions;
