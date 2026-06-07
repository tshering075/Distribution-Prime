import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Alert,
  Chip,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  Collapse,
  CircularProgress,
  Link,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import SendIcon from "@mui/icons-material/Send";
import GroupIcon from "@mui/icons-material/Group";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import TuneIcon from "@mui/icons-material/Tune";
import {
  getRecipientGroups,
  splitGroupForSend,
  parseEmailListInput,
  isValidRecipientEmail,
  getSenderEmail,
} from "../services/emailService";
import AppSnackbar from "./AppSnackbar";

import { BRAND_PRIMARY } from "../constants/brand";

const BRAND = BRAND_PRIMARY;

function getDistributorPrimaryName(name) {
  const cleaned = String(name || "Distributor")
    .trim()
    .replace(/^(m\s*\/\s*s|m\s*s|ms|m\/s)\.?\s*/i, "")
    .replace(/^[.\-:/\s]+/, "")
    .trim();
  const firstName = cleaned.split(/\s+/).find(Boolean);
  return firstName || "Distributor";
}

function buildOrderEmailSubject(order) {
  const primaryName = getDistributorPrimaryName(order?.distributorName || order?.distributorCode);
  const orderNumber = order?.orderNumber || "";
  return orderNumber ? `${primaryName} Order #${orderNumber}` : primaryName;
}

const MESSAGE_TEMPLATES = [
  {
    id: "standard",
    label: "Standard request",
    text: (distributorName, captionBlock) =>
      `Dear Senior General Manager,\n\nPlease review and approve the order from ${distributorName}.${captionBlock}\nThank you.`,
  },
  {
    id: "urgent",
    label: "Urgent",
    text: (distributorName, captionBlock) =>
      `Dear Senior General Manager,\n\nPlease approve the following order from ${distributorName} at your earliest convenience.${captionBlock}\nThank you.`,
  },
];

function OrderEmailDialog({ open, onClose, order, onSend, onManageRecipients }) {
  const [customMessage, setCustomMessage] = useState("");
  const [srGeneralManager, setSrGeneralManager] = useState("");
  const [otherManagers, setOtherManagers] = useState([]);
  const [ccBulkText, setCcBulkText] = useState("");
  const [recipientGroups, setRecipientGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [customizeRecipients, setCustomizeRecipients] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
    duration: 3600,
  });

  const showToast = (message, severity = "success", duration = 3600) => {
    setToast({ open: true, message, severity, duration });
  };

  useEffect(() => {
    if (!open) {
      setGmailConnecting(false);
      setSending(false);
    }
  }, [open]);

  const applyGroup = (group) => {
    if (!group) return;
    const { to, cc } = splitGroupForSend(group);
    setSrGeneralManager(to);
    setOtherManagers(cc);
    setCcBulkText(cc.join("\n"));
  };

  useEffect(() => {
    if (open && order) {
      const groups = getRecipientGroups();
      setRecipientGroups(groups);

      if (groups.length > 0) {
        const first = groups[0];
        setSelectedGroupId(first.id);
        applyGroup(first);
      } else {
        setSelectedGroupId("");
        setSrGeneralManager("");
        setOtherManagers([]);
        setCcBulkText("");
      }

      const distributorName = order.distributorName || order.distributorCode || "Distributor";
      const orderCaption =
        (order.caption || "").trim() ||
        (Array.isArray(order.data) && typeof order.data[0]?.orderCaption === "string"
          ? order.data[0].orderCaption.trim()
          : "");
      const captionBlock = orderCaption ? `\n\n${orderCaption}\n` : "";
      setCustomMessage(MESSAGE_TEMPLATES[0].text(distributorName, captionBlock));
      setError("");
      setCustomizeRecipients(false);

      getSenderEmail()
        .then((email) => setSenderEmail(email || "Not logged in"))
        .catch(() => setSenderEmail(localStorage.getItem("admin_email") || "Not logged in"));

      setTimeout(() => checkGmailConnection(), 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order]);

  useEffect(() => {
    const restoreGmailSession = async () => {
      try {
        const { isGmailConfigured, warmupGmailSession, hasGmailSession } = await import("../services/gmailService");
        if (!(await isGmailConfigured())) return;
        const connected = await warmupGmailSession();
        if (connected || hasGmailSession()) {
          setGmailConnected(true);
        }
      } catch (err) {
        console.warn("Gmail session restore on load:", err);
      }
    };
    restoreGmailSession();
  }, []);

  const checkGmailConnection = async () => {
    try {
      const { isGmailConfigured, warmupGmailSession, hasGmailSession } = await import("../services/gmailService");
      if (!(await isGmailConfigured())) {
        setGmailConnected(false);
        return;
      }
      const connected = await warmupGmailSession();
      setGmailConnected(connected || hasGmailSession());
    } catch {
      const { hasGmailSession } = await import("../services/gmailService");
      setGmailConnected(hasGmailSession());
    }
  };

  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    setError("");
    try {
      const { isGmailConfigured, ensureGmailAuthenticated, startGmailKeepAlive } = await import("../services/gmailService");
      if (!(await isGmailConfigured())) {
        setError("Gmail API is not configured. Set credentials in Settings first.");
        return;
      }
      const connected = await ensureGmailAuthenticated({ interactive: true });
      if (connected) {
        startGmailKeepAlive();
        setGmailConnected(true);
        showToast(
          "Gmail connected on this device. Keep this browser signed in to Google for uninterrupted sending.",
          "success",
          5200
        );
      } else {
        throw new Error("Sign-in completed but connection not verified");
      }
    } catch (err) {
      setError(err.message || "Failed to connect Gmail");
      setGmailConnected(false);
    } finally {
      setGmailConnecting(false);
    }
  };

  const handleGroupChange = (groupId) => {
    setSelectedGroupId(groupId);
    const group = recipientGroups.find((g) => g.id === groupId);
    applyGroup(group);
  };

  const syncCcFromBulk = (text) => {
    setCcBulkText(text);
    const toLower = srGeneralManager.trim().toLowerCase();
    setOtherManagers(parseEmailListInput(text).filter((e) => e.toLowerCase() !== toLower));
  };

  const handleSend = async () => {
    const to = srGeneralManager.trim();
    if (!to) {
      setError("Primary approver email (To) is required");
      return;
    }
    if (!isValidRecipientEmail(to)) {
      setError("Invalid primary approver email");
      return;
    }
    if (!customMessage.trim()) {
      setError("Please enter a message");
      return;
    }

    const ccList = [
      ...otherManagers,
      ...parseEmailListInput(ccBulkText),
    ]
      .map((e) => e.trim())
      .filter((e) => isValidRecipientEmail(e) && e.toLowerCase() !== to.toLowerCase());
    const ccUnique = [...new Set(ccList.map((e) => e.toLowerCase()))].map(
      (lower) => ccList.find((e) => e.toLowerCase() === lower)
    );

    setError("");
    setSending(true);
    try {
      await onSend({
        to,
        cc: ccUnique.join(", "),
        subject: buildOrderEmailSubject(order),
        message: customMessage.trim(),
        order,
      });
      onClose();
    } catch (err) {
      setError(`Failed to send: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  };

  const selectedGroup = useMemo(
    () => recipientGroups.find((g) => g.id === selectedGroupId),
    [recipientGroups, selectedGroupId]
  );

  if (!order) return null;

  const distributorName = order.distributorName || order.distributorCode || "Distributor";
  const subjectPreview = buildOrderEmailSubject(order);
  const orderNumber = order.orderNumber ? `#${order.orderNumber}` : null;

  return (
    <>
      <Dialog
        fullScreen
        open={open}
        onClose={onClose}
        scroll="paper"
        PaperProps={{ sx: { display: "flex", flexDirection: "column" } }}
      >
        <DialogTitle sx={{ bgcolor: BRAND, color: "white", py: 2, px: 2.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Send for approval
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.25 }}>
                {distributorName}
                {orderNumber && ` · Order ${orderNumber}`}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent
          sx={{
            flex: 1,
            overflow: "auto",
            px: { xs: 2, sm: 3 },
            py: 2,
            bgcolor: "#fafafa",
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          {/* Order summary strip */}
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: "white" }}>
            <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
              {order.totalUC != null && (
                <Chip size="small" label={`UC ${Number(order.totalUC).toFixed(2)}`} />
              )}
              <Chip
                size="small"
                variant="outlined"
                label={new Date(order.timestamp || Date.now()).toLocaleDateString()}
              />
              <Chip size="small" variant="outlined" label="PNG attached" color="default" />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Subject: <strong>{subjectPreview}</strong>
            </Typography>
          </Paper>

          {/* Gmail status — compact */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              bgcolor: gmailConnected ? "#e8f5e9" : "#fff8e1",
              borderColor: gmailConnected ? "#a5d6a7" : "#ffe082",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {gmailConnected ? (
                <CheckCircleIcon color="success" fontSize="small" />
              ) : (
                <WarningAmberIcon color="warning" fontSize="small" />
              )}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {gmailConnected ? "Gmail connected (saved on this device)" : "Gmail not connected"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  From: {senderEmail}
                  {gmailConnected
                    ? " · Stays connected on this device until you disconnect or clear browser data"
                    : " · Connect once to send orders by email"}
                </Typography>
              </Box>
            </Box>
            {!gmailConnected && (
              <Button
                size="small"
                variant="contained"
                disabled={gmailConnecting}
                onClick={handleConnectGmail}
                sx={{ bgcolor: BRAND, "&:hover": { bgcolor: "#b01512" } }}
              >
                {gmailConnecting ? <CircularProgress size={18} color="inherit" /> : "Connect"}
              </Button>
            )}
          </Paper>

          {/* Recipients — group picker */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
            <GroupIcon fontSize="small" color="primary" />
            Recipients
          </Typography>

          {recipientGroups.length === 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              No recipient groups saved.{" "}
              {onManageRecipients ? (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => {
                    onClose();
                    onManageRecipients();
                  }}
                >
                  Set up groups
                </Link>
              ) : (
                "Open Email Recipients from Orders to add a group."
              )}
            </Alert>
          ) : (
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="recipient-group-label">Recipient group</InputLabel>
              <Select
                labelId="recipient-group-label"
                label="Recipient group"
                value={selectedGroupId}
                onChange={(e) => handleGroupChange(e.target.value)}
              >
                {recipientGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name} ({g.emails.length} email{g.emails.length !== 1 ? "s" : ""})
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                First email in the group is the approver (To); others are CC
              </FormHelperText>
            </FormControl>
          )}

          {selectedGroup && !customizeRecipients && (
            <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: "white" }}>
              <Stack spacing={0.75}>
                <Box>
                  <Chip size="small" label="To (approver)" color="primary" sx={{ mr: 1, mb: 0.5 }} />
                  <Typography variant="body2" component="span" sx={{ wordBreak: "break-all" }}>
                    {srGeneralManager || "—"}
                  </Typography>
                </Box>
                {otherManagers.length > 0 && (
                  <Box>
                    <Chip size="small" label="CC" variant="outlined" sx={{ mr: 1, mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                      {otherManagers.join(", ")}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          )}

          <Button
            size="small"
            startIcon={<TuneIcon />}
            onClick={() => setCustomizeRecipients((v) => !v)}
            sx={{ mb: customizeRecipients ? 1.5 : 2, textTransform: "none" }}
          >
            {customizeRecipients ? "Hide manual edit" : "Customize recipients for this email"}
          </Button>

          <Collapse in={customizeRecipients || recipientGroups.length === 0}>
            <TextField
              fullWidth
              size="small"
              label="Primary approver (To) *"
              value={srGeneralManager}
              onChange={(e) => setSrGeneralManager(e.target.value)}
              type="email"
              sx={{ mb: 1.5, bgcolor: "white" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              label="CC — paste multiple emails"
              placeholder="email1@company.com, email2@company.com"
              value={ccBulkText}
              onChange={(e) => syncCcFromBulk(e.target.value)}
              helperText="Comma or new line separated"
              sx={{ mb: 2, bgcolor: "white" }}
            />
          </Collapse>

          {onManageRecipients && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
              <Link component="button" variant="caption" onClick={onManageRecipients}>
                Manage recipient groups
              </Link>
            </Typography>
          )}

          <Divider sx={{ mb: 2 }} />

          {/* Message */}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Message
          </Typography>
          <Stack direction="row" spacing={0.75} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
            {MESSAGE_TEMPLATES.map((t) => (
              <Chip
                key={t.id}
                size="small"
                label={t.label}
                variant="outlined"
                onClick={() => {
                  const cap =
                    (order.caption || "").trim() ||
                    (Array.isArray(order.data) && typeof order.data[0]?.orderCaption === "string"
                      ? order.data[0].orderCaption.trim()
                      : "");
                  const captionBlock = cap ? `\n\n${cap}\n` : "";
                  setCustomMessage(t.text(distributorName, captionBlock));
                }}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            multiline
            minRows={5}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Write your message…"
            sx={{ bgcolor: "white" }}
          />
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "white",
            flexDirection: { xs: "column-reverse", sm: "row" },
            gap: 1,
          }}
        >
          <Button onClick={onClose} variant="outlined" disabled={sending} fullWidth sx={{ sm: { width: "auto" } }}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            variant="contained"
            fullWidth
            startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            disabled={sending || !srGeneralManager?.trim() || !customMessage.trim()}
            sx={{
              bgcolor: BRAND,
              "&:hover": { bgcolor: "#b01512" },
              sm: { ml: "auto", width: "auto", minWidth: 160 },
            }}
          >
            {sending ? "Sending…" : "Send for approval"}
          </Button>
        </DialogActions>
      </Dialog>

      <AppSnackbar
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        autoHideDuration={toast.duration}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      />
    </>
  );
}

export default OrderEmailDialog;
