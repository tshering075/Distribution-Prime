import React, { useState, useEffect } from "react";
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
  Avatar,
  Card,
  CardContent,
  InputAdornment,
  Paper,
  CircularProgress,
  Fade,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import GoogleIcon from "@mui/icons-material/Google";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { saveGmailCredentialsToSupabase, getGmailClientId, getGmailApiKey, isGmailConfigured, clearGmailCredentialsCache } from "../services/gmailService";

function GmailSettingsDialog({ open, onClose }) {
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  // Load current credentials when dialog opens
  useEffect(() => {
    if (open) {
      loadCredentials();
    }
  }, [open]);

  const loadCredentials = async () => {
    setLoading(true);
    setError("");
    try {
      const currentClientId = await getGmailClientId();
      const currentApiKey = await getGmailApiKey();
      
      setClientId(currentClientId || "");
      setApiKey(currentApiKey || "");
      
      const configured = await isGmailConfigured();
      setIsConfigured(configured);
    } catch (err) {
      console.error("Error loading Gmail credentials:", err);
      setError("Failed to load current credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId.trim() || !apiKey.trim()) {
      setError("Both Client ID and API Key are required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveGmailCredentialsToSupabase(clientId.trim(), apiKey.trim());
      
      // Clear cache to force reload on next access
      clearGmailCredentialsCache();
      
      setSuccess("Gmail credentials saved successfully! They will be available to all users.");
      setIsConfigured(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error("Error saving Gmail credentials:", err);
      setError("Failed to save credentials: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setClientId("");
    setApiKey("");
    setError("");
    setSuccess("");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          bgcolor: "#d61916",
          color: "white",
          py: 2,
          px: 3,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 48, height: 48 }}>
              <GoogleIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: "white" }}>
                Gmail API Settings
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                Configure Gmail API credentials (shared for all users)
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: "#f5f5f5" }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ m: 2 }} onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}

        <Box sx={{ p: 3 }}>
          {/* Info Card */}
          <Card sx={{ mb: 3, boxShadow: 2, borderLeft: "4px solid #d61916" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Gmail API Configuration
                </Typography>
                {isConfigured && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: 2 }}>
                    <CheckCircleIcon sx={{ color: "#4caf50", fontSize: 20 }} />
                    <Typography variant="caption" sx={{ color: "#4caf50", fontWeight: 600 }}>
                      Configured
                    </Typography>
                  </Box>
                )}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These credentials are stored in Supabase and shared across all users. Once saved, 
                all users can use Gmail API features without individual configuration.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Note:</strong> Credentials are stored securely in Supabase and will 
                persist even if browser cache is cleared.
              </Typography>
            </CardContent>
          </Card>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Fade in={!loading}>
              <Box>
                {/* Client ID */}
                <Card sx={{ mb: 3, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Gmail Client ID
                    </Typography>
                    <TextField
                      fullWidth
                      label="Client ID"
                      placeholder="xxxxx-xxxxx.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        setError("");
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <GoogleIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                      helperText="Your Google OAuth 2.0 Client ID from Google Cloud Console"
                    />
                  </CardContent>
                </Card>

                {/* API Key */}
                <Card sx={{ mb: 3, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Gmail API Key
                    </Typography>
                    <TextField
                      fullWidth
                      label="API Key"
                      placeholder="AIzaSy..."
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setError("");
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SettingsIcon color="action" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowApiKey(!showApiKey)}
                              edge="end"
                              size="small"
                            >
                              {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                      helperText="Your Google API Key from Google Cloud Console"
                    />
                  </CardContent>
                </Card>

                {/* Instructions */}
                <Paper variant="outlined" sx={{ p: 2, bgcolor: "#fff9c4", borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    How to get Gmail API credentials:
                  </Typography>
                  <Typography variant="body2" component="div">
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                      <li>Select your project: <strong>coke-sales-management-system</strong></li>
                      <li>Navigate to <strong>APIs & Services</strong> → <strong>Credentials</strong></li>
                      <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web application)</li>
                      <li>Get your <strong>API Key</strong> from the same page</li>
                      <li>Copy and paste both values above</li>
                    </ol>
                    <Typography variant="caption" sx={{ display: "block", mt: 1, fontStyle: "italic" }}>
                      See <strong>GMAIL_API_SETUP_GUIDE.md</strong> for detailed instructions.
                    </Typography>
                  </Typography>
                </Paper>
              </Box>
            </Fade>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ bgcolor: "white", borderTop: "1px solid #e0e0e0", px: 3, py: 2 }}>
        <Button onClick={handleClear} variant="outlined" disabled={saving || loading}>
          Clear
        </Button>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
          disabled={saving || loading || !clientId.trim() || !apiKey.trim()}
          sx={{
            bgcolor: "#d61916",
            "&:hover": {
              bgcolor: "#b01512",
            },
          }}
        >
          {saving ? "Saving..." : "Save Credentials"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default GmailSettingsDialog;
