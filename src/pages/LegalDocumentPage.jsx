import React from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link as RouterLink } from "react-router-dom";

/**
 * Embeds static legal HTML from public/ without a full-page navigation.
 * Avoids the PWA service worker returning index.html for .html routes.
 */
export default function LegalDocumentPage({ title, htmlPath }) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  const src = `${base}${htmlPath}`;

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "#f5f5f5" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <IconButton component={RouterLink} to="/" aria-label="Back to home" size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
      </Box>
      <Box
        component="iframe"
        title={title}
        src={src}
        sx={{ flex: 1, width: "100%", minHeight: "calc(100vh - 56px)", border: 0, bgcolor: "#fff" }}
      />
    </Box>
  );
}
