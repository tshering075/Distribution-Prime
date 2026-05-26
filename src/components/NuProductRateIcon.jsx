import React from "react";
import { Box } from "@mui/material";

/** Text mark "Nu" used for Product & Rate Master entry points (replaces generic money icon). */
export default function NuProductRateIcon({ sx, ...props }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        userSelect: "none",
        ...sx,
      }}
      {...props}
    >
      Nu
    </Box>
  );
}
