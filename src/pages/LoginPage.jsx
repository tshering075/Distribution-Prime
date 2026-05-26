import React, { useState, useEffect } from "react";
import { 
  Box, 
  Chip,
  Container,
  Paper, 
  Stack,
  Typography, 
  TextField, 
  Button, 
  CircularProgress,
  InputAdornment,
  IconButton,
  Fade,
  Zoom,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import "./LoginPage.css";
import { APP_NAME, BRAND_MARK_SRC, PRIVACY_POLICY_PATH } from "../constants/brand";
import {
  validateDistributorLogin,
  validateAdminLogin,
  validateShippingLogin,
} from "../utils/distributorAuth";
import { signInDistributor, signInAdmin, supabase } from "../services/supabaseService";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import AppSnackbar from "../components/AppSnackbar";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import { useDayNightTheme } from "../theme/AppThemeProvider";
import { markLandingSeen } from "../utils/landingSeen";

const publicUrl = process.env.PUBLIC_URL || "";
const LOGIN_POINTS = [
  "Admin dashboard",
  "Shipping dispatch",
  "Distributor access",
  "Order and target tracking",
];

function getBhutanGreeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Thimphu",
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) return "Good morning ☀️";
  if (hour >= 12 && hour < 17) return "Good afternoon 🌤️";
  if (hour >= 17 && hour < 21) return "Good evening 🌇";
  return "Good night 🌙";
}

function LoginPage({ onLogin }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setDistributorInfo] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ userId: "", password: "" });

  const navigate = useNavigate();
  const theme = useTheme();
  const { isDayView } = useDayNightTheme();

  useEffect(() => {
    markLandingSeen();
  }, []);
  const isDarkUi = isDayView;
  const greeting = getBhutanGreeting();

  const inputSurfaceSx = isDarkUi
    ? {
        backgroundColor: theme.palette.action.hover,
        "&:hover": { backgroundColor: theme.palette.action.selected },
        "&.Mui-focused": {
          backgroundColor: theme.palette.background.paper,
          boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.28)}`,
        },
      }
    : {
        backgroundColor: "#f8f9fa",
        "&:hover": { backgroundColor: "#f0f0f0" },
        "&.Mui-focused": {
          backgroundColor: "#fff",
          boxShadow: "0 0 0 3px rgba(229, 57, 53, 0.1)",
        },
      };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const isSupabaseConfigured = supabase !== null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    setErrorMessage("");
    setLoading(true);
    
    // Input validation
    const trimmedUserId = (userId || "").trim();
    const trimmedPassword = (password || "").trim();
    
    // Clear previous errors
    setFieldErrors({ userId: "", password: "" });
    
    let hasErrors = false;
    
    if (!trimmedUserId || trimmedUserId.length < 1) {
      setFieldErrors(prev => ({
        ...prev,
        userId: isSupabaseConfigured
          ? "Distributor code (or admin email) is required"
          : "User ID is required",
      }));
      hasErrors = true;
    }
    
    if (!trimmedPassword || trimmedPassword.length < 1) {
      setFieldErrors(prev => ({ ...prev, password: "Password is required" }));
      hasErrors = true;
    }
    
    if (hasErrors) {
      setError(true);
      setErrorMessage("Please fill in all required fields");
      setLoading(false);
      return;
    }
    
    try {
      let normalizedSupabaseError = "";
      // Try Supabase Auth first if configured
      if (isSupabaseConfigured) {
        let supabaseAuthError = null;
        try {
          // Distributor: code + password vs distributors.credentials in Supabase. Admin: email + Auth next.
          const distributor = await signInDistributor(trimmedUserId, trimmedPassword);
          if (distributor) {
            setDistributorInfo({ name: distributor.name, code: distributor.code });
            
            // Log login activity (non-blocking - fire and forget)
            logActivity(
              ACTIVITY_TYPES.LOGIN,
              `Distributor logged in: ${distributor.name} (${distributor.code})`,
              {
                distributorName: distributor.name,
                distributorCode: distributor.code,
                userEmail: trimmedUserId,
                userName: distributor.name,
              }
            ).catch(err => console.error('Activity logging error:', err));
            
            onLogin("distributor", distributor);
            setSuccess(true);
            // Navigate immediately without delay
            navigate("/distributor", { replace: true });
            setLoading(false);
            return;
          }
        } catch (distributorError) {
          console.log("Supabase distributor login failed:", distributorError);

          const localDistributor = validateDistributorLogin(trimmedUserId, trimmedPassword);
          if (localDistributor) {
            setDistributorInfo({ name: localDistributor.name, code: localDistributor.code });
            logActivity(
              ACTIVITY_TYPES.LOGIN,
              `Distributor logged in (offline cache): ${localDistributor.name} (${localDistributor.code})`,
              {
                distributorName: localDistributor.name,
                distributorCode: localDistributor.code,
                userEmail: trimmedUserId,
                userName: localDistributor.name,
              }
            ).catch((err) => console.error("Activity logging error:", err));
            onLogin("distributor", localDistributor);
            setSuccess(true);
            navigate("/distributor", { replace: true });
            setLoading(false);
            return;
          }

          supabaseAuthError = distributorError;
          // Try admin login
          try {
            const admin = await signInAdmin(trimmedUserId, trimmedPassword);
            if (admin) {
              // Store admin email for email sending
              if (admin.email) {
                localStorage.setItem('admin_email', admin.email);
                console.log('✅ Admin email stored:', admin.email);
              }
              if (admin.name) {
                localStorage.setItem('userName', admin.name);
              }
              // Get actual role from Firestore (admin or viewer)
              const actualRole = admin.role || "admin"; // Default to admin for backward compatibility
              // Store role and permissions for permission checks
              localStorage.setItem("userRole", actualRole);
              if (admin.permissions) {
                localStorage.setItem("userPermissions", JSON.stringify(admin.permissions));
              }
              
              // Log login activity (non-blocking - fire and forget)
              logActivity(
                ACTIVITY_TYPES.LOGIN,
                `User logged in: ${admin.email} (${actualRole})`,
                {
                  userEmail: admin.email,
                  userName: admin.name || admin.email?.split('@')[0] || 'User',
                  role: actualRole,
                }
              ).catch(err => console.error('Activity logging error:', err));
              
              onLogin(actualRole); // Pass actual role (admin, viewer, or shipping)
              setSuccess(true);
              navigate(
                actualRole === "shipping" ? "/shipping" : "/admin",
                { replace: true }
              );
              setLoading(false);
              return;
            }
          } catch (adminError) {
            console.log("Supabase auth failed, trying localStorage fallback:", adminError);
            supabaseAuthError = adminError;
          }
        }

        // Keep Supabase error message, but still allow local fallback below.
        if (supabaseAuthError) {
          const rawMsg = supabaseAuthError?.message || "";
          normalizedSupabaseError =
            rawMsg.includes("Invalid login credentials")
              ? "Invalid email or password"
              : rawMsg.includes("Email not confirmed")
              ? "Email not confirmed. Please confirm from inbox first, or disable email confirmation in Supabase Auth settings."
              : rawMsg || "Login failed. Please try again.";
        }
      }

      // Fallback to localStorage authentication
      // Check if it's a distributor login
      const distributor = validateDistributorLogin(trimmedUserId, trimmedPassword);
      if (distributor) {
        setDistributorInfo({ name: distributor.name, code: distributor.code });
        onLogin("distributor", distributor);
        setSuccess(true);
        setTimeout(() => navigate("/distributor", { replace: true }), 1500);
        setLoading(false);
        return;
      }

      // Check if it's admin login
      if (validateAdminLogin(trimmedUserId, trimmedPassword)) {
        onLogin("admin");
        setSuccess(true);
        setTimeout(() => navigate("/admin", { replace: true }), 1500);
        setLoading(false);
        return;
      }

      if (validateShippingLogin(trimmedUserId, trimmedPassword)) {
        logActivity(
          ACTIVITY_TYPES.LOGIN,
          `Shipping user logged in (offline): ${trimmedUserId}`,
          {
            userEmail: trimmedUserId,
            userName: trimmedUserId,
            role: "shipping",
          }
        ).catch((err) => console.error("Activity logging error:", err));
        onLogin("shipping");
        setSuccess(true);
        setTimeout(() => navigate("/shipping", { replace: true }), 1500);
        setLoading(false);
        return;
      }

      // Invalid credentials
      setError(true);
      setErrorMessage(normalizedSupabaseError || "Invalid User ID or Password");
      setLoading(false);
    } catch (error) {
      setError(true);
      setErrorMessage(error.message || "Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Box
      className={`login-container${isDarkUi ? " login-container--day" : ""}`}
      sx={{ position: "relative", color: "text.primary" }}
    >
      <Box className="login-orb login-orb--primary" />
      <Box className="login-orb login-orb--secondary" />

      <Box
        component="header"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Box
              component="img"
              src={`${publicUrl}${BRAND_MARK_SRC}`}
              alt=""
              sx={{ width: 42, height: 42, objectFit: "contain", flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: "0.8rem", sm: "1rem" } }} noWrap>
                {APP_NAME}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                Secure access
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              component={RouterLink}
              to="/"
              size="small"
              sx={{ textTransform: "none", fontWeight: 800, display: { xs: "none", sm: "inline-flex" } }}
            >
              Home
            </Button>
            <DayNightThemeToggle />
          </Stack>
        </Stack>
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 2, py: { xs: 10, sm: 11, md: 6 } }}>
        <Box
          sx={{
            minHeight: { md: "calc(100vh - 96px)" },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 430px" },
            gap: { xs: 3, md: 6 },
            alignItems: "center",
          }}
        >
          <Fade in timeout={650}>
            <Stack
              spacing={3}
              sx={{
                display: { xs: "none", md: "flex" },
                maxWidth: 620,
              }}
            >
              <Chip
                icon={<VerifiedUserOutlinedIcon />}
                label="Authorized users only"
                sx={{
                  alignSelf: "flex-start",
                  height: 36,
                  px: 1,
                  fontWeight: 900,
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: "error.main",
                  border: `1px solid ${alpha(theme.palette.error.main, 0.18)}`,
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />
              <Box>
                <Typography
                  component="h1"
                  variant="h2"
                  sx={{
                    fontWeight: 950,
                    letterSpacing: -1.1,
                    lineHeight: 1.06,
                    fontSize: { md: "3.35rem", lg: "4rem" },
                    mb: 2,
                  }}
                >
                  Sign in to manage daily distribution.
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.65, fontWeight: 500 }}>
                  Access order approvals, distributor targets, product rates, schemes, and performance updates from one workspace.
                </Typography>
              </Box>
              <Stack spacing={1.35}>
                {LOGIN_POINTS.map((point) => (
                  <Stack key={point} direction="row" spacing={1.25} alignItems="center">
                    <CheckCircleOutlineIcon sx={{ color: "success.main", fontSize: 22 }} />
                    <Typography sx={{ fontWeight: 750 }}>{point}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Fade>

          <Fade in timeout={800}>
            <Paper
              elevation={0}
              className="login-box"
              sx={{
                bgcolor: alpha(theme.palette.background.paper, isDarkUi ? 0.92 : 0.96),
                border: "1px solid",
                borderColor: alpha(theme.palette.divider, 0.85),
                boxShadow: `0 28px 80px ${alpha(theme.palette.common.black, isDarkUi ? 0.5 : 0.14)}`,
                backdropFilter: "blur(20px)",
              }}
            >
              <Box sx={{ textAlign: "center", mb: 3.25 }}>
                <Box
                  component="img"
                  src={`${publicUrl}${BRAND_MARK_SRC}`}
                  alt={APP_NAME}
                  sx={{ width: 86, height: "auto", mb: 1.5 }}
                />
                <Zoom in timeout={850}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 950,
                      color: "text.primary",
                      mb: 0.75,
                      letterSpacing: -0.4,
                    }}
                  >
                    {greeting}
                  </Typography>
                </Zoom>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                  Enter your distributor code or admin email to continue.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label={isSupabaseConfigured ? "Distributor code / admin email" : "User ID"}
                  variant="outlined"
                  value={userId}
                  autoComplete="username"
                  onChange={(e) => {
                    setUserId(e.target.value);
                    if (fieldErrors.userId) {
                      setFieldErrors(prev => ({ ...prev, userId: "" }));
                    }
                    setError(false);
                  }}
                  error={!!fieldErrors.userId}
                  helperText={fieldErrors.userId || undefined}
                  FormHelperTextProps={{ sx: { mx: 0 } }}
                  sx={{ mb: 2.25 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ color: "primary.main", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: "14px",
                      transition: "all 0.25s ease",
                      ...inputSurfaceSx,
                    },
                  }}
                  InputLabelProps={{ sx: { fontWeight: 650 } }}
                />

                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  variant="outlined"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors(prev => ({ ...prev, password: "" }));
                    }
                    setError(false);
                  }}
                  error={!!fieldErrors.password}
                  helperText={fieldErrors.password}
                  sx={{ mb: 2.75 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: "primary.main", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          sx={{ color: "text.secondary" }}
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: "14px",
                      transition: "all 0.25s ease",
                      ...inputSurfaceSx,
                    },
                  }}
                  InputLabelProps={{ sx: { fontWeight: 650 } }}
                />

                <Zoom in timeout={600}>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading}
                    color="primary"
                    sx={{
                      minHeight: 52,
                      fontWeight: 900,
                      borderRadius: "14px",
                      py: 1.45,
                      fontSize: "1rem",
                      textTransform: "none",
                      boxShadow: (t) => `0 14px 28px ${alpha(t.palette.primary.main, 0.3)}`,
                      transition: "all 0.25s ease",
                      "&:hover": {
                        bgcolor: "primary.dark",
                        boxShadow: (t) => `0 18px 34px ${alpha(t.palette.primary.main, 0.38)}`,
                        transform: "translateY(-2px)",
                      },
                      "&:active": { transform: "translateY(0)" },
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </Zoom>
              </Box>

              <Box
                component="nav"
                aria-label="Legal"
                sx={{
                  mt: 3,
                  pt: 2,
                  borderTop: 1,
                  borderColor: "divider",
                  textAlign: "center",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  <Box
                    component={RouterLink}
                    to="/"
                    sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, "&:hover": { textDecoration: "underline" } }}
                  >
                    Home
                  </Box>
                  {" | "}
                  <Box
                    component="a"
                    href={`${publicUrl}${PRIVACY_POLICY_PATH}`}
                    sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, "&:hover": { textDecoration: "underline" } }}
                  >
                    Privacy
                  </Box>
                  {" | "}
                  <Box
                    component="a"
                    href={`${publicUrl}/terms-of-service.html`}
                    sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, "&:hover": { textDecoration: "underline" } }}
                  >
                    Terms
                  </Box>
                </Typography>
              </Box>
            </Paper>
          </Fade>
        </Box>
      </Container>

      {/* Error Snackbar */}
      <AppSnackbar
        open={error}
        severity="error"
        message={errorMessage || "Invalid User ID or Password"}
        autoHideDuration={2500}
        onClose={() => setError(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      />

      {/* ✅ Success Snackbar */}
      <AppSnackbar
        open={success}
        severity="success"
        message="Successfully Logged In!"
        autoHideDuration={2000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      />
    </Box>
  );
}

export default LoginPage;
