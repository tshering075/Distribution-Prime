import React from "react";
import { Snackbar, Alert, Slide, Typography, Box } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

function SlideTransition(props) {
  return <Slide {...props} direction="down" />;
}

const severityIcon = {
  success: <CheckCircleOutlineIcon sx={{ fontSize: 22 }} />,
  error: <ErrorOutlineIcon sx={{ fontSize: 22 }} />,
  warning: <WarningAmberOutlinedIcon sx={{ fontSize: 22 }} />,
  info: <InfoOutlinedIcon sx={{ fontSize: 22 }} />,
};

/**
 * App-wide toast: short title + clear body, strong contrast, readable on mobile.
 *
 * @param {string} [props.title] — Short headline (e.g. "Order sent")
 * @param {React.ReactNode} props.message — Main text (string or node)
 */
export default function AppSnackbar({
  open,
  message,
  title,
  severity = "info",
  onClose,
  autoHideDuration = 4000,
  anchorOrigin = { vertical: "top", horizontal: "right" },
}) {
  const icon = severityIcon[severity] || severityIcon.info;

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      TransitionComponent={SlideTransition}
      sx={{
        zIndex: (t) => t.zIndex.snackbar + 1,
      }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        icon={icon}
        sx={{
          width: "100%",
          minWidth: { xs: "min(100vw - 32px, 360px)", sm: 360 },
          maxWidth: { xs: "calc(100vw - 24px)", sm: 440 },
          borderRadius: 2,
          boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
          alignItems: "flex-start",
          py: 1.25,
          px: 1.5,
          "& .MuiAlert-icon": {
            mt: 0.35,
            opacity: 0.95,
          },
          "& .MuiAlert-message": {
            width: "100%",
            pr: 0.5,
            pt: 0.1,
          },
          "& .MuiAlert-action": {
            pt: 0.5,
            alignItems: "flex-start",
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {title ? (
            <Typography
              component="div"
              variant="subtitle2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "0.9rem", sm: "0.95rem" },
                lineHeight: 1.3,
                letterSpacing: "0.01em",
              }}
            >
              {title}
            </Typography>
          ) : null}
          <Typography
            component="div"
            variant="body2"
            sx={{
              fontWeight: title ? 500 : 700,
              fontSize: { xs: "0.82rem", sm: "0.875rem" },
              lineHeight: 1.45,
              opacity: title ? 0.95 : 1,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );
}
