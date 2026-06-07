import React from "react";
import { Box, IconButton, Typography, Link } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link as RouterLink } from "react-router-dom";
import { PRIVACY_POLICY_PATH, TERMS_OF_SERVICE_PATH } from "../../constants/brand";

const legalSx = {
  page: {
    minHeight: "100vh",
    bgcolor: "#fafafa",
    color: "#1a1a1a",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    lineHeight: 1.6,
  },
  main: {
    maxWidth: 720,
    mx: "auto",
    px: { xs: 2.5, sm: 3 },
    py: { xs: 3, sm: 4 },
    pb: 6,
    "& h1": { fontSize: "1.75rem", mt: 0, color: "#c62828" },
    "& h2": { fontSize: "1.15rem", mt: 3, color: "#333" },
    "& p, & li": { fontSize: "0.95rem" },
    "& ul": { pl: 2.5 },
    "& a": { color: "#c62828" },
    "& code": { fontSize: "0.9em", bgcolor: "#eee", px: 0.5, borderRadius: 0.5 },
  },
  meta: { color: "#666", fontSize: "0.875rem", mb: 3 },
  box: {
    bgcolor: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: 2,
    px: 2.25,
    py: 2,
    my: 2,
  },
  footer: {
    mt: 5,
    pt: 2,
    borderTop: "1px solid #ddd",
    fontSize: "0.85rem",
    color: "#666",
  },
};

export default function LegalPageLayout({ title, children, footerLinks }) {
  return (
    <Box sx={legalSx.page}>
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

      <Box component="main" sx={legalSx.main}>
        {children}
        <Box sx={legalSx.footer}>
          {footerLinks || (
            <Typography variant="body2" component="p">
              <Link component={RouterLink} to={TERMS_OF_SERVICE_PATH} color="inherit">
                Terms of Service
              </Link>
              {" · "}
              <Link component={RouterLink} to="/" color="inherit">
                Home
              </Link>
              {" · "}
              <Link component={RouterLink} to="/login" color="inherit">
                Sign in
              </Link>
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export { legalSx };
