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
  Alert,
  Checkbox,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useNavigate, Link as RouterLink, useSearchParams } from "react-router-dom";
import { PLATFORM_NAME, PLATFORM_CONSOLE_LOGIN_PATH } from "../constants/saas";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import "./LoginPage.css";
import { logoSrcWithPublicUrl } from "../utils/organizationBrand";
import { APP_NAME, BRAND_MARK_SRC, PRIVACY_POLICY_PATH, TERMS_OF_SERVICE_PATH } from "../constants/brand";
import { useBrand } from "../hooks/useBrand";
import {
  validateDistributorLogin,
  validateAdminLogin,
  validateShippingLogin,
} from "../utils/distributorAuth";
import { signInDistributor, signInAdmin, supabase } from "../services/supabaseService";
import { getLastWorkspaceSlug } from "../services/tenantScope";
import { resolveOrganizationForLogin } from "../services/organizationService";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import { isProductionAuthMode } from "../utils/productionMode";
import AppSnackbar from "../components/AppSnackbar";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import { useDayNightTheme } from "../theme/AppThemeProvider";
import { markLandingSeen } from "../utils/landingSeen";
import { readRememberedLogin, writeRememberedLogin } from "../utils/loginRememberMe";

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

function LoginPage({
  onLogin,
  lockedWorkspaceSlug = null,
  workspaceDisplayName = null,
  subtitle: subtitleProp = null,
}) {
  const [searchParams] = useSearchParams();
  const [organizationSlug, setOrganizationSlug] = useState(
    lockedWorkspaceSlug ||
      searchParams.get("workspace") ||
      getLastWorkspaceSlug() ||
      ""
  );
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginAs, setLoginAs] = useState("distributor");
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setDistributorInfo] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ userId: "", password: "" });

  const navigate = useNavigate();
  const brand = useBrand();
  const displayName = workspaceDisplayName || brand.appName || APP_NAME;
  const markSrc = logoSrcWithPublicUrl(brand.markSrc || BRAND_MARK_SRC, publicUrl);
  const theme = useTheme();
  const { isDayView } = useDayNightTheme();

  useEffect(() => {
    markLandingSeen();
  }, []);

  const inviteToken = searchParams.get("invite");

  useEffect(() => {
    const inviteEmail = searchParams.get("email");
    if (inviteEmail && !userId) setUserId(inviteEmail);
  }, [searchParams, userId]);

  useEffect(() => {
    const slug =
      lockedWorkspaceSlug ||
      searchParams.get("workspace") ||
      getLastWorkspaceSlug() ||
      "";
    const remembered = readRememberedLogin(slug);
    if (!remembered) return;
    setRememberMe(true);
    if (!searchParams.get("email") && remembered.userId) {
      setUserId(remembered.userId);
    }
    if (remembered.password) {
      setPassword(remembered.password);
    }
  }, [lockedWorkspaceSlug, searchParams]);

  useEffect(() => {
    if (userId.includes("@")) {
      setLoginAs("admin");
    }
  }, [userId]);

  useEffect(() => {
    const inviteEmail = searchParams.get("email");
    if (inviteEmail) setLoginAs("admin");
  }, [searchParams]);

  const navigateAfterStaffLogin = (actualRole) => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/")) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (inviteToken) {
      navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
      return;
    }
    navigate(actualRole === "shipping" ? "/shipping" : "/admin", { replace: true });
  };
  const isDarkUi = isDayView;
  const greeting = getBhutanGreeting();
  const isSupabaseConfigured = supabase !== null;

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
        backgroundColor: theme.palette.grey[100],
        "&:hover": { backgroundColor: theme.palette.grey[200] },
        "&.Mui-focused": {
          backgroundColor: theme.palette.background.paper,
          boxShadow: "0 0 0 3px rgba(21, 101, 192, 0.1)",
        },
      };

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "14px",
      transition: "all 0.25s ease",
      ...inputSurfaceSx,
    },
    "& .MuiInputLabel-root": { fontWeight: 650 },
  };

  const isAdminLogin = loginAs === "admin";
  const UserFieldIcon = isAdminLogin ? EmailOutlinedIcon : PersonIcon;
  const userFieldLabel = !isSupabaseConfigured
    ? "User ID"
    : isAdminLogin
    ? "Work email"
    : "Distributor code or username";
  const userFieldHelper =
    fieldErrors.userId ||
    (!isSupabaseConfigured
      ? undefined
      : isAdminLogin
      ? "The email your admin invited you with"
      : "Your code from your admin — not your email address");
  const firstFieldAutofocus = isSupabaseConfigured && !lockedWorkspaceSlug ? "workspace" : "userId";

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);
    
    // Input validation
    const trimmedUserId = (userId || "").trim();
    const loginPassword = String(password ?? "");
    
    // Clear previous errors
    setFieldErrors({ userId: "", password: "" });
    
    let hasErrors = false;
    
    if (!trimmedUserId || trimmedUserId.length < 1) {
      setFieldErrors((prev) => ({
        ...prev,
        userId: isSupabaseConfigured
          ? isAdminLogin
            ? "Work email is required"
            : "Distributor code or username is required"
          : "User ID is required",
      }));
      hasErrors = true;
    }
    
    if (!loginPassword || loginPassword.length < 1) {
      setFieldErrors(prev => ({ ...prev, password: "Password is required" }));
      hasErrors = true;
    }
    
    if (hasErrors) {
      setErrorMessage("Please fill in all required fields");
      setLoading(false);
      return;
    }

    const rememberSlug = String(organizationSlug || lockedWorkspaceSlug || "").trim();
    const persistRememberMe = () => {
      writeRememberedLogin(rememberSlug, {
        userId: trimmedUserId,
        password: loginPassword,
        rememberMe,
      });
    };

    try {
      let normalizedSupabaseError = "";
      if (isSupabaseConfigured) {
        try {
          await resolveOrganizationForLogin(organizationSlug);
        } catch (orgError) {
          setErrorMessage(orgError.message || "Invalid workspace ID");
          setLoading(false);
          return;
        }
      }
      // Try Supabase Auth first if configured
      if (isSupabaseConfigured) {
        let supabaseAuthError = null;
        let distributorAuthError = null;
        try {
          // Distributor: code + password vs distributors.credentials in Supabase. Admin: email + Auth next.
          const distributor = await signInDistributor(trimmedUserId, loginPassword);
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
            
            persistRememberMe();
            onLogin("distributor", distributor);
            setSuccess(true);
            // Navigate immediately without delay
            navigate("/distributor", { replace: true });
            setLoading(false);
            return;
          }
        } catch (distributorError) {
          console.log("Supabase distributor login failed:", distributorError);
          distributorAuthError = distributorError;

          const localDistributor = !isProductionAuthMode()
            ? validateDistributorLogin(trimmedUserId, loginPassword)
            : null;
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
            persistRememberMe();
            onLogin("distributor", localDistributor);
            setSuccess(true);
            navigate("/distributor", { replace: true });
            setLoading(false);
            return;
          }

          supabaseAuthError = distributorError;
          const looksLikeAdminEmail = trimmedUserId.includes("@");
          // Only try admin auth when the user entered an email address.
          if (looksLikeAdminEmail) try {
            const admin = await signInAdmin(trimmedUserId, loginPassword);
            if (admin) {
              // Store admin email for email sending
              if (admin.email) {
                const { onAdminLogin } = await import('../services/gmailService');
                onAdminLogin(admin.email);
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
              
              persistRememberMe();
              onLogin(actualRole); // Pass actual role (admin, viewer, or shipping)
              setSuccess(true);
              navigateAfterStaffLogin(actualRole);
              setLoading(false);
              return;
            }
          } catch (adminError) {
            console.log("Supabase auth failed, trying localStorage fallback:", adminError);
            supabaseAuthError = adminError;
          }
        }

        if (distributorAuthError) {
          const distributorMsg = distributorAuthError?.message || "";
          const adminMsg = supabaseAuthError?.message || "";
          const distributorNotFound = /no distributor found/i.test(distributorMsg);
          const wrongDistributorPassword = /wrong password/i.test(distributorMsg);
          const workspaceHint = String(organizationSlug || lockedWorkspaceSlug || "").trim();

          if (wrongDistributorPassword) {
            normalizedSupabaseError =
              distributorMsg || "Wrong password for this distributor. Ask your admin to reset it.";
          } else if (distributorNotFound) {
            normalizedSupabaseError = workspaceHint
              ? `${distributorMsg} (Workspace ID: ${workspaceHint})`
              : distributorMsg || "Invalid distributor code or password";
            if (trimmedUserId.includes("@") && adminMsg && /invalid login credentials/i.test(adminMsg)) {
              normalizedSupabaseError +=
                " If you are an admin, use your admin email and password. Distributors should use their distributor code or username.";
            }
          } else {
            normalizedSupabaseError =
              distributorMsg || "Invalid distributor code or password";
          }
        } else if (supabaseAuthError) {
          const adminMsg = supabaseAuthError?.message || "";
          normalizedSupabaseError = adminMsg.includes("Invalid login credentials")
            ? "That email and password did not match an admin account."
            : adminMsg.includes("Email not confirmed")
            ? "Email not confirmed. Please confirm from inbox first, or disable email confirmation in Supabase Auth settings."
            : adminMsg || "Login failed. Please try again.";
        }
      }

      if (!isProductionAuthMode()) {
        const distributor = validateDistributorLogin(trimmedUserId, loginPassword);
        if (distributor) {
          setDistributorInfo({ name: distributor.name, code: distributor.code });
          persistRememberMe();
          onLogin("distributor", distributor);
          setSuccess(true);
          setTimeout(() => navigate("/distributor", { replace: true }), 1500);
          setLoading(false);
          return;
        }

        if (validateAdminLogin(trimmedUserId, loginPassword)) {
          persistRememberMe();
          onLogin("admin");
          setSuccess(true);
          if (inviteToken) {
            navigate(`/invite/${encodeURIComponent(inviteToken)}`, { replace: true });
          } else {
            setTimeout(() => navigate("/admin", { replace: true }), 1500);
          }
          setLoading(false);
          return;
        }
      }

      // Offline-only shipping login (requires workspace id like admin).
      if (!isProductionAuthMode() && !isSupabaseConfigured && validateShippingLogin(trimmedUserId, loginPassword)) {
        try {
          await resolveOrganizationForLogin(organizationSlug);
        } catch (orgError) {
          setErrorMessage(orgError.message || "Invalid workspace ID");
          setLoading(false);
          return;
        }
        logActivity(
          ACTIVITY_TYPES.LOGIN,
          `Shipping user logged in (offline): ${trimmedUserId}`,
          {
            userEmail: trimmedUserId,
            userName: trimmedUserId,
            role: "shipping",
          }
        ).catch((err) => console.error("Activity logging error:", err));
        persistRememberMe();
        onLogin("shipping");
        setSuccess(true);
        navigateAfterStaffLogin("shipping");
        setLoading(false);
        return;
      }

      // Invalid credentials
      setErrorMessage(normalizedSupabaseError || "Invalid User ID or Password");
      setLoading(false);
    } catch (error) {
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
              src={markSrc}
              alt={displayName}
              sx={{ width: 42, height: 42, objectFit: "contain", flexShrink: 0 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: "0.8rem", sm: "1rem" } }} noWrap>
                {displayName}
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
              startIcon={<ArrowBackIcon sx={{ display: { xs: "inline-flex", sm: "none" } }} />}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Home
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                Back
              </Box>
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
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
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
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: `0 28px 80px ${alpha(theme.palette.common.black, isDarkUi ? 0.5 : 0.14)}`,
                p: { xs: 2.5, sm: 3.25 },
                maxWidth: { xs: "100%", md: 430 },
                mx: "auto",
                width: "100%",
              }}
            >
              <Chip
                icon={<VerifiedUserOutlinedIcon />}
                label="Secure workspace access"
                size="small"
                sx={{
                  display: { xs: "flex", md: "none" },
                  alignSelf: "center",
                  mb: 2,
                  fontWeight: 800,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />

              <Box sx={{ textAlign: "center", mb: 2.75 }}>
                <Box
                  component="img"
                  src={markSrc}
                  alt={displayName}
                  sx={{
                    width: { xs: 64, sm: 86 },
                    height: "auto",
                    mb: 1.25,
                    display: { xs: "none", sm: "block" },
                    mx: "auto",
                  }}
                />
                <Zoom in timeout={850}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 950,
                      color: "text.primary",
                      mb: 0.5,
                      letterSpacing: -0.4,
                      fontSize: { xs: "1.65rem", sm: "2.125rem" },
                    }}
                  >
                    {greeting}
                  </Typography>
                </Zoom>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                  {subtitleProp ||
                    (lockedWorkspaceSlug
                      ? `Sign in to ${workspaceDisplayName || lockedWorkspaceSlug}`
                      : `Sign in to your ${PLATFORM_NAME} workspace`)}
                </Typography>
              </Box>

              {errorMessage ? (
                <Alert
                  severity="error"
                  sx={{ mb: 2.25, borderRadius: 2 }}
                  onClose={() => setErrorMessage("")}
                >
                  {errorMessage}
                </Alert>
              ) : null}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                {inviteToken ? (
                  <Alert severity="info" sx={{ mb: 2.25, borderRadius: 2 }}>
                    Sign in to accept your team invite. You will return here after signing in.
                  </Alert>
                ) : null}
                {!isSupabaseConfigured ? (
                  <Alert severity="warning" sx={{ mb: 2.25, borderRadius: 2 }}>
                    Database not connected. Set <strong>REACT_APP_SUPABASE_URL</strong> and{" "}
                    <strong>REACT_APP_SUPABASE_ANON_KEY</strong> in Cloudflare Pages → Settings →
                    Variables and Secrets (Production), then redeploy.
                  </Alert>
                ) : null}

                <Stack spacing={2}>
                  {isSupabaseConfigured && (
                    <>
                      <Typography
                        variant="overline"
                        sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}
                      >
                        Workspace
                      </Typography>
                      <TextField
                        fullWidth
                        label="Workspace ID"
                        variant="outlined"
                        value={organizationSlug}
                        disabled={Boolean(lockedWorkspaceSlug)}
                        autoFocus={firstFieldAutofocus === "workspace"}
                        onChange={(e) => {
                          setOrganizationSlug(e.target.value);
                          setErrorMessage("");
                        }}
                        helperText={
                          lockedWorkspaceSlug
                            ? `Signing in to workspace "${lockedWorkspaceSlug}"`
                            : "Your company's sign-in ID (e.g. acme-beverages)"
                        }
                        FormHelperTextProps={{ sx: { mx: 0 } }}
                        sx={fieldSx}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <BusinessOutlinedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </>
                  )}

                  {isSupabaseConfigured && (
                    <ToggleButtonGroup
                      value={loginAs}
                      exclusive
                      fullWidth
                      size="small"
                      onChange={(_, value) => {
                        if (value) setLoginAs(value);
                      }}
                      aria-label="Sign in as"
                      sx={{
                        "& .MuiToggleButton-root": {
                          py: 1,
                          textTransform: "none",
                          fontWeight: 800,
                          borderRadius: "12px !important",
                          border: `1px solid ${theme.palette.divider}`,
                          "&.Mui-selected": {
                            bgcolor: alpha(theme.palette.primary.main, 0.12),
                            color: "primary.main",
                            borderColor: alpha(theme.palette.primary.main, 0.35),
                            "&:hover": {
                              bgcolor: alpha(theme.palette.primary.main, 0.18),
                            },
                          },
                        },
                        gap: 1,
                        "& .MuiToggleButtonGroup-grouped": {
                          border: `1px solid ${theme.palette.divider} !important`,
                          "&:not(:first-of-type)": { ml: 0 },
                        },
                      }}
                    >
                      <ToggleButton value="distributor" aria-label="Sign in as distributor">
                        <StorefrontOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
                        Distributor
                      </ToggleButton>
                      <ToggleButton value="admin" aria-label="Sign in as admin or staff">
                        <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} />
                        Admin / staff
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}

                  <Typography
                    variant="overline"
                    sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}
                  >
                    Your credentials
                  </Typography>

                  <TextField
                    fullWidth
                    label={userFieldLabel}
                    type={isAdminLogin && isSupabaseConfigured ? "email" : "text"}
                    variant="outlined"
                    value={userId}
                    autoComplete={isAdminLogin ? "email" : "username"}
                    autoFocus={firstFieldAutofocus === "userId"}
                    placeholder={
                      isSupabaseConfigured
                        ? isAdminLogin
                          ? "you@company.com"
                          : "e.g. JD123"
                        : undefined
                    }
                    onChange={(e) => {
                      setUserId(e.target.value);
                      if (fieldErrors.userId) {
                        setFieldErrors((prev) => ({ ...prev, userId: "" }));
                      }
                      setErrorMessage("");
                    }}
                    error={!!fieldErrors.userId}
                    helperText={userFieldHelper}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <UserFieldIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
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
                        setFieldErrors((prev) => ({ ...prev, password: "" }));
                      }
                      setErrorMessage("");
                    }}
                    error={!!fieldErrors.password}
                    helperText={fieldErrors.password}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={handleTogglePasswordVisibility}
                            edge="end"
                            size="small"
                            sx={{ color: "text.secondary" }}
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={rememberMe}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRememberMe(checked);
                          if (!checked) {
                            writeRememberedLogin(
                              String(organizationSlug || lockedWorkspaceSlug || "").trim(),
                              { userId: "", password: "", rememberMe: false }
                            );
                          }
                        }}
                        color="primary"
                        size="small"
                      />
                    }
                    label="Remember me"
                    sx={{ ml: 0, userSelect: "none", "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
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
                </Stack>

                {isSupabaseConfigured && (
                  <Accordion
                    disableGutters
                    elevation={0}
                    sx={{
                      mt: 2,
                      bgcolor: "transparent",
                      "&:before": { display: "none" },
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: "14px !important",
                      overflow: "hidden",
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        minHeight: 48,
                        px: 1.5,
                        "& .MuiAccordionSummary-content": { my: 1 },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 750 }}>
                        Not sure what to enter?
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 1.75, pt: 0, pb: 1.75 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <StorefrontOutlinedIcon sx={{ color: "primary.main", fontSize: 20, mt: 0.15 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.25 }}>
                              Distributors
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              Use your workspace ID plus the distributor code or username from your admin — not your
                              personal email.
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <AdminPanelSettingsOutlinedIcon sx={{ color: "primary.main", fontSize: 20, mt: 0.15 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.25 }}>
                              Admins & viewers
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              Use your workspace ID and the work email you were invited with.
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" spacing={1.25} alignItems="flex-start">
                          <LocalShippingOutlinedIcon sx={{ color: "primary.main", fontSize: 20, mt: 0.15 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.25 }}>
                              Shipping team
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                              Sign in with the email and password your admin set up for dispatch access.
                            </Typography>
                          </Box>
                        </Stack>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>

              <Divider sx={{ my: 2.5 }} />

              {isSupabaseConfigured && (
                <Typography variant="body2" sx={{ textAlign: "center" }}>
                  New company?{" "}
                  <Box
                    component={RouterLink}
                    to="/signup"
                    sx={{ color: "primary.main", fontWeight: 800, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                  >
                    Create a workspace
                  </Box>
                </Typography>
              )}

              {isSupabaseConfigured && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.75, textAlign: "center" }}
                >
                  <AdminPanelSettingsOutlinedIcon
                    sx={{ fontSize: 18, verticalAlign: "text-bottom", mr: 0.5, opacity: 0.85 }}
                  />
                  {PLATFORM_NAME} platform owner?{" "}
                  <Box
                    component={RouterLink}
                    to={PLATFORM_CONSOLE_LOGIN_PATH}
                    sx={{
                      color: "primary.main",
                      fontWeight: 800,
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    Owner dashboard
                  </Box>
                </Typography>
              )}

              <Box
                component="nav"
                aria-label="Legal"
                sx={{
                  mt: 2.5,
                  pt: 2,
                  borderTop: 1,
                  borderColor: "divider",
                  textAlign: "center",
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  <Box
                    component={RouterLink}
                    to={PRIVACY_POLICY_PATH}
                    sx={{ color: "primary.main", textDecoration: "none", fontWeight: 800, "&:hover": { textDecoration: "underline" } }}
                  >
                    Privacy
                  </Box>
                  {" · "}
                  <Box
                    component={RouterLink}
                    to={TERMS_OF_SERVICE_PATH}
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
