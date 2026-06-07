import React, { useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Link as MuiLink,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import LockIcon from "@mui/icons-material/Lock";
import PersonIcon from "@mui/icons-material/Person";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { BRAND_MARK_SRC } from "../constants/brand";
import { logoSrcWithPublicUrl } from "../utils/organizationBrand";
import { PLATFORM_NAME } from "../constants/saas";
import { signInPlatformAdmin } from "../services/platformAdminService";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import { useDayNightTheme } from "../theme/AppThemeProvider";

const publicUrl = process.env.PUBLIC_URL || "";

export default function PlatformLoginPage({ onLogin }) {
  const navigate = useNavigate();
  const { isDayView } = useDayNightTheme();
  const isDarkUi = isDayView;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signInPlatformAdmin(email, password);
      if (user.email) {
        localStorage.setItem("admin_email", user.email);
      }
      localStorage.setItem("userRole", "platform_admin");
      onLogin?.("platform_admin");
      navigate("/platform", { replace: true });
    } catch (err) {
      setError(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className={`login-container${isDarkUi ? " login-container--day" : ""}`}
      sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <Box sx={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
        <DayNightThemeToggle />
      </Box>

      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", py: 4 }}>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: 1,
            borderColor: "divider",
          }}
        >
          <Stack spacing={2.5} alignItems="center" sx={{ mb: 3 }}>
            <Box
              component="img"
              src={logoSrcWithPublicUrl(BRAND_MARK_SRC, publicUrl)}
              alt={PLATFORM_NAME}
              sx={{ width: 56, height: 56, objectFit: "contain" }}
            />
            <Stack spacing={0.5} alignItems="center" textAlign="center">
              <AdminPanelSettingsOutlinedIcon color="primary" sx={{ fontSize: 32 }} />
              <Typography variant="h5" fontWeight={800}>
                Platform console
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {PLATFORM_NAME} operator sign-in — manage all workspaces
              </Typography>
            </Stack>
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Operator email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: "text.secondary" }} />,
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 2.5 }}
              InputProps={{
                startAdornment: <LockIcon sx={{ mr: 1, color: "text.secondary" }} />,
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ borderRadius: 2, py: 1.25, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign in to console"}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mt: 3 }}>
            <MuiLink component={RouterLink} to="/login" underline="hover">
              Workspace sign in
            </MuiLink>
            {" · "}
            <MuiLink component={RouterLink} to="/" underline="hover">
              Home
            </MuiLink>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
