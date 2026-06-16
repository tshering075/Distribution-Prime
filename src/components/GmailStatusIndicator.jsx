import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useOrganizationOptional } from "../context/OrganizationProvider";
import { getActiveOrganizationId } from "../services/tenantScope";

const GMAIL_SESSION_CHANGED_EVENT = "gmail-session-changed";

const STATUS = {
  loading: "loading",
  not_configured: "not_configured",
  not_connected: "not_connected",
  connected: "connected",
};

/**
 * Compact Gmail readiness indicator for admin app chrome.
 * Shows platform credentials + per-device OAuth connection status.
 */
export default function GmailStatusIndicator({ sx }) {
  const orgCtx = useOrganizationOptional();
  const orgId = orgCtx?.organization?.id || getActiveOrganizationId();
  const [status, setStatus] = useState(STATUS.loading);
  const [email, setEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const refresh = useCallback(async (clearCredentialsCache = false) => {
    setStatus(STATUS.loading);
    try {
      const {
        isGmailConfigured,
        clearGmailCredentialsCache,
        warmupGmailSession,
        hasGmailSession,
        getConnectedGmailEmail,
      } = await import("../services/gmailService");

      if (clearCredentialsCache) {
        clearGmailCredentialsCache();
      }

      if (!(await isGmailConfigured())) {
        setEmail("");
        setStatus(STATUS.not_configured);
        return;
      }

      const connected = await warmupGmailSession();
      const sessionOk = connected || hasGmailSession();
      if (sessionOk) {
        let gmailEmail = "";
        try {
          gmailEmail = (await getConnectedGmailEmail()) || "";
        } catch {
          gmailEmail = "";
        }
        setEmail(gmailEmail || String(localStorage.getItem("admin_email") || "").trim());
        setStatus(STATUS.connected);
        return;
      }

      setEmail("");
      setStatus(STATUS.not_connected);
    } catch {
      setEmail("");
      setStatus(STATUS.not_connected);
    }
  }, []);

  useEffect(() => {
    refresh(true);
  }, [orgId, refresh]);

  useEffect(() => {
    const onSessionChanged = () => refresh(false);
    const onFocus = () => refresh(false);
    window.addEventListener(GMAIL_SESSION_CHANGED_EVENT, onSessionChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(GMAIL_SESSION_CHANGED_EVENT, onSessionChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const {
        isGmailConfigured,
        ensureGmailAuthenticated,
        startGmailKeepAlive,
        getConnectedGmailEmail,
      } = await import("../services/gmailService");
      if (!(await isGmailConfigured())) {
        setStatus(STATUS.not_configured);
        return;
      }
      const ok = await ensureGmailAuthenticated({ interactive: true });
      if (ok) {
        startGmailKeepAlive();
        const gmailEmail = await getConnectedGmailEmail();
        setEmail(gmailEmail || String(localStorage.getItem("admin_email") || "").trim());
        setStatus(STATUS.connected);
        setAnchorEl(null);
      }
    } catch (err) {
      console.warn("Gmail connect failed:", err?.message || err);
    } finally {
      setConnecting(false);
    }
  };

  const handleOpen = (event) => {
    if (status === STATUS.not_connected) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => setAnchorEl(null);

  const tooltip =
    status === STATUS.loading
      ? "Checking Gmail status…"
      : status === STATUS.connected
        ? email
          ? `Gmail connected as ${email}. Ready to send order emails from this device.`
          : "Gmail connected on this device. Ready to send order emails."
        : status === STATUS.not_connected
          ? "Gmail API is configured. Connect your Gmail account once on this device to send order emails."
          : "Gmail API credentials are not set for this workspace. Ask your platform operator to configure them in the Platform console.";

  const chipIcon =
    status === STATUS.loading ? (
      <CircularProgress size={14} color="inherit" />
    ) : status === STATUS.connected ? (
      <CheckCircleIcon sx={{ fontSize: "16px !important" }} />
    ) : status === STATUS.not_connected ? (
      <WarningAmberIcon sx={{ fontSize: "16px !important" }} />
    ) : (
      <ErrorOutlineIcon sx={{ fontSize: "16px !important" }} />
    );

  const chipLabel =
    status === STATUS.loading
      ? "Gmail…"
      : status === STATUS.connected
        ? email
          ? `Gmail · ${email}`
          : "Gmail connected"
        : status === STATUS.not_connected
          ? "Connect Gmail"
          : "Gmail not set up";

  const chipColor =
    status === STATUS.connected
      ? "success"
      : status === STATUS.not_connected
        ? "warning"
        : status === STATUS.not_configured
          ? "default"
          : "default";

  const chipSx = {
    maxWidth: { xs: 120, sm: 200, md: 260 },
    fontWeight: 700,
    color: "inherit",
    borderColor:
      status === STATUS.connected
        ? "rgba(129, 199, 132, 0.85)"
        : status === STATUS.not_connected
          ? "rgba(255, 224, 130, 0.9)"
          : "rgba(255,255,255,0.35)",
    bgcolor:
      status === STATUS.connected
        ? "rgba(46, 125, 50, 0.28)"
        : status === STATUS.not_connected
          ? "rgba(255, 193, 7, 0.22)"
          : "rgba(255,255,255,0.1)",
    cursor: status === STATUS.not_connected ? "pointer" : "default",
    "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
    ...sx,
  };

  return (
    <>
      <Tooltip title={tooltip}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Chip
            size="small"
            icon={chipIcon}
            label={chipLabel}
            color={chipColor}
            variant="outlined"
            onClick={status === STATUS.not_connected ? handleOpen : undefined}
            sx={{
              ...chipSx,
              display: { xs: "none", sm: "flex" },
            }}
          />
          <IconButton
            color="inherit"
            aria-label={chipLabel}
            onClick={status === STATUS.not_connected ? handleOpen : undefined}
            size="small"
            sx={{
              display: { xs: "inline-flex", sm: "none" },
              bgcolor: chipSx.bgcolor,
              border: "1px solid",
              borderColor: chipSx.borderColor,
            }}
          >
            <MailOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 320 } } }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Connect Gmail
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Sign in once on this device. Order emails will send from your logged-in admin Gmail (
          {String(localStorage.getItem("admin_email") || "your account")}).
        </Typography>
        <Button
          variant="contained"
          size="small"
          fullWidth
          disabled={connecting}
          onClick={handleConnect}
          startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <MailOutlineIcon />}
        >
          {connecting ? "Connecting…" : "Connect Gmail"}
        </Button>
      </Popover>
    </>
  );
}
