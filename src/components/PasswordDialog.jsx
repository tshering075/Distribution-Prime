import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  IconButton,
  InputAdornment,
  Alert,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { validateAdminLogin } from "../utils/distributorAuth";

/**
 * Password protection dialog for sensitive operations
 * Props:
 * - open: boolean
 * - onClose: function
 * - onSuccess: function() - called when password is correct
 * - title: string (optional)
 * - message: string (optional)
 */
export default function PasswordDialog({ 
  open, 
  onClose, 
  onSuccess, 
  title = "Password Required",
  message = "Please enter your admin password to continue"
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(false);
    setErrorMessage("");

    if (!password.trim()) {
      setError(true);
      setErrorMessage("Password is required");
      return;
    }

    // Validate admin password
    try {
      // Try with "admin" as username first (default)
      let isValid = validateAdminLogin("admin", password);
      
      // If that fails, try to get the actual admin username from storage
      if (!isValid) {
        try {
          const adminCreds = JSON.parse(localStorage.getItem("coke_admin_credentials") || "null");
          if (adminCreds && adminCreds.username) {
            isValid = validateAdminLogin(adminCreds.username, password);
          }
        } catch (e) {
          console.error("Error checking admin credentials:", e);
        }
      }
      
      if (isValid) {
        setPassword("");
        setError(false);
        if (onSuccess) {
          onSuccess();
        } else {
          console.error("PasswordDialog: onSuccess callback is not provided");
          setError(true);
          setErrorMessage("Error: Callback function not available");
        }
      } else {
        setError(true);
        setErrorMessage("Incorrect password. Please try again.");
        setPassword("");
      }
    } catch (error) {
      console.error("Error validating password:", error);
      setError(true);
      setErrorMessage("Error validating password. Please try again.");
      setPassword("");
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(false);
    setErrorMessage("");
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEnforceFocus={false}
      disableAutoFocus={false}
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LockIcon sx={{ color: "#e53935", fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#333" }}>
            {title}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
          {message}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} id="password-form">
          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            label="Admin Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            error={error}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: "#999" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2,
              }
            }}
          />
        </form>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2 }}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="password-form"
          variant="contained"
          sx={{
            bgcolor: "#e53935",
            borderRadius: 2,
            "&:hover": {
              bgcolor: "#c62828"
            }
          }}
        >
          Verify
        </Button>
      </DialogActions>
    </Dialog>
  );
}
