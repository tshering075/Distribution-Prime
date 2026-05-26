import React from "react";
import { Box, FormControl, InputLabel, Select, MenuItem, Typography } from "@mui/material";

/**
 * FiltersSection Component
 * Displays region filter dropdown and last updated timestamp
 */
function FiltersSection({ selectedRegion, onRegionChange, updatedDate }) {
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

  return (
    <Box
      sx={{
        display: "flex",
        gap: { xs: 0.75, sm: 2 },
        mb: { xs: 0.75, sm: 1.25 },
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <FormControl
        size="small"
        sx={{
          minWidth: { xs: 120, sm: 200 },
          width: { xs: "100%", sm: "auto" },
          // Extra top room so the label is never clipped on mobile
          mt: { xs: 1, sm: 0 },
        }}
      >
        <InputLabel
          shrink
          sx={{
            fontSize: { xs: "0.78rem", sm: "0.95rem" },
            bgcolor: "background.default",
            px: 0.5,
            lineHeight: 1,
          }}
        >
          Filter by Region
        </InputLabel>
        <Select
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value)}
          label="Filter by Region"
          sx={{
            fontSize: { xs: "0.8rem", sm: "0.95rem" },
            bgcolor: "background.paper",
            "& .MuiSelect-select": {
              py: 0.85,
            },
          }}
        >
          <MenuItem value="All" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            All Regions
          </MenuItem>
          <MenuItem value="Southern" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            Southern
          </MenuItem>
          <MenuItem value="Western" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            Western
          </MenuItem>
          <MenuItem value="Eastern" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            Eastern
          </MenuItem>
          <MenuItem value="PLING" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            PLING
          </MenuItem>
          <MenuItem value="THIM" sx={{ fontSize: { xs: "0.75rem", sm: "1rem" } }}>
            THIM
          </MenuItem>
        </Select>
      </FormControl>

      {updatedDate && (
        <Typography
          variant="body2"
          sx={{
            ml: { xs: 0, sm: "auto" },
            color: "text.secondary",
            fontSize: { xs: "0.7rem", sm: "0.85rem" },
            width: { xs: "100%", sm: "auto" },
          }}
        >
          Last updated: {formatDateTime(updatedDate)}
        </Typography>
      )}
    </Box>
  );
}

export default FiltersSection;
