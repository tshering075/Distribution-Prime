import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Link as MuiLink,
  Zoom,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { BRAND_MARK_SRC } from "../constants/brand";
import { logoSrcWithPublicUrl } from "../utils/organizationBrand";
import { PLATFORM_NAME } from "../constants/saas";
import {
  signUpOrganization,
  normalizeOrganizationSlug,
  isValidOrganizationSlug,
} from "../services/organizationService";
import AppSnackbar from "../components/AppSnackbar";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import { useDayNightTheme } from "../theme/AppThemeProvider";
import "./LoginPage.css";

const publicUrl = process.env.PUBLIC_URL || "";

const SIGNUP_BENEFITS = [
  "Isolated data — never shared with other companies",
  "Invite admins, shipping, and distributors",
  "Orders, targets, rates, and reports in one place",
];

function SignUpPage({ onLogin }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const { isDayView } = useDayNightTheme();
  const isDarkUi = isDayView;

  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [organizationAddress, setOrganizationAddress] = useState("");
  const [organizationPostNo, setOrganizationPostNo] = useState("");
  const [organizationGstNo, setOrganizationGstNo] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const normalizedSlug = useMemo(
    () => normalizeOrganizationSlug(organizationSlug),
    [organizationSlug]
  );

  const signInPreview = normalizedSlug
    ? `${window.location.origin}${publicUrl}/w/${normalizedSlug}/login`
    : "";

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

  const handleSlugBlur = () => {
    if (!organizationSlug.trim() && organizationName.trim()) {
      setOrganizationSlug(normalizeOrganizationSlug(organizationName));
    } else if (organizationSlug.trim()) {
      setOrganizationSlug(normalizeOrganizationSlug(organizationSlug));
    }
  };

  const validateForm = () => {
    const next = {};
    const name = organizationName.trim();
    const slug = normalizeOrganizationSlug(organizationSlug);
    const email = ownerEmail.trim().toLowerCase();
    const password = ownerPassword;

    if (!name) next.organizationName = "Company name is required";
    if (!slug) next.organizationSlug = "Workspace ID is required";
    else if (!isValidOrganizationSlug(slug)) {
      next.organizationSlug = "Use 3–64 chars: lowercase letters, numbers, hyphens";
    }
    if (!email || !email.includes("@")) next.ownerEmail = "Valid email is required";
    if (!password || password.length < 8) next.ownerPassword = "At least 8 characters";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await signUpOrganization({
        organizationName: organizationName.trim(),
        organizationSlug: normalizedSlug,
        organizationAddress: organizationAddress.trim(),
        organizationPostNo: organizationPostNo.trim(),
        organizationGstNo: organizationGstNo.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPassword,
      });

      if (result.admin?.email) {
        localStorage.setItem("admin_email", result.admin.email);
      }
      localStorage.setItem("userRole", "admin");
      localStorage.setItem(
        "userPermissions",
        JSON.stringify(
          result.admin?.permissions || { read: true, write: true, delete: true, manageUsers: true }
        )
      );

      onLogin("admin");
      setSuccess(true);
      navigate("/admin?onboarding=1", { replace: true });
    } catch (err) {
      setError(err?.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      className={`login-container${isDarkUi ? " login-container--day" : ""}`}
      sx={{ minHeight: "100vh", color: "text.primary", position: "relative" }}
    >
      <Box className="login-orb login-orb--primary" aria-hidden />
      <Box className="login-orb login-orb--secondary" aria-hidden />

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
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Button
            component={RouterLink}
            to="/login"
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            Back to sign in
          </Button>
          <DayNightThemeToggle />
        </Stack>
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 2, py: { xs: 10, md: 6 } }}>
        <Box
          sx={{
            minHeight: { md: "calc(100vh - 96px)" },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 460px" },
            gap: { xs: 3, md: 6 },
            alignItems: "center",
          }}
        >
          <Fade in timeout={650}>
            <Stack spacing={3} sx={{ display: { xs: "none", md: "flex" }, maxWidth: 560 }}>
              <Chip
                icon={<VerifiedUserOutlinedIcon />}
                label="Free 14-day trial · no credit card"
                sx={{
                  alignSelf: "flex-start",
                  height: 36,
                  px: 1,
                  fontWeight: 800,
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
                    fontSize: { md: "3rem", lg: "3.6rem" },
                    mb: 2,
                  }}
                >
                  Create your workspace on {PLATFORM_NAME}
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ lineHeight: 1.65, fontWeight: 500 }}>
                  Set up a private company workspace in minutes. Your distributors, orders, and team stay
                  separate from every other organization on the platform.
                </Typography>
              </Box>
              <Stack spacing={1.35}>
                {SIGNUP_BENEFITS.map((point) => (
                  <Stack key={point} direction="row" spacing={1.25} alignItems="flex-start">
                    <CheckCircleOutlineIcon sx={{ color: "success.main", fontSize: 22, mt: 0.15 }} />
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.5 }}>{point}</Typography>
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
                p: { xs: 3, sm: 4 },
                maxWidth: { xs: "100%", md: 460 },
                mx: "auto",
                width: "100%",
              }}
            >
              <Chip
                icon={<VerifiedUserOutlinedIcon />}
                label="Free 14-day trial"
                size="small"
                sx={{
                  display: { xs: "flex", md: "none" },
                  alignSelf: "center",
                  mb: 2,
                  fontWeight: 800,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: "primary.main",
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />

              <Stack spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Box
                  component="img"
                  src={logoSrcWithPublicUrl(BRAND_MARK_SRC, publicUrl)}
                  alt={PLATFORM_NAME}
                  sx={{ width: 72, height: "auto" }}
                />
                <Zoom in timeout={850}>
                  <Typography variant="h5" sx={{ fontWeight: 950, textAlign: "center", letterSpacing: -0.3 }}>
                    Create your workspace
                  </Typography>
                </Zoom>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", lineHeight: 1.6 }}>
                  Company details and your owner account — you&apos;ll sign in at your workspace URL after this.
                </Typography>
              </Stack>

              {error ? (
                <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError("")}>
                  {error}
                </Alert>
              ) : null}

              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2.5}>
                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}>
                    Organization
                  </Typography>

                  <TextField
                    label="Company / organization name"
                    value={organizationName}
                    onChange={(e) => {
                      setOrganizationName(e.target.value);
                      if (fieldErrors.organizationName) {
                        setFieldErrors((f) => ({ ...f, organizationName: "" }));
                      }
                    }}
                    onBlur={handleSlugBlur}
                    required
                    fullWidth
                    error={!!fieldErrors.organizationName}
                    helperText={fieldErrors.organizationName || "Shown to your team and distributors"}
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

                  <TextField
                    label="Workspace ID"
                    value={organizationSlug}
                    onChange={(e) => {
                      setOrganizationSlug(e.target.value);
                      if (fieldErrors.organizationSlug) {
                        setFieldErrors((f) => ({ ...f, organizationSlug: "" }));
                      }
                    }}
                    onBlur={handleSlugBlur}
                    required
                    fullWidth
                    error={!!fieldErrors.organizationSlug}
                    helperText={
                      fieldErrors.organizationSlug ||
                      (signInPreview ? (
                        <>
                          Sign-in URL:{" "}
                          <Box component="span" sx={{ fontWeight: 700, color: "primary.main", wordBreak: "break-all" }}>
                            {signInPreview}
                          </Box>
                        </>
                      ) : (
                        "Lowercase letters, numbers, hyphens (e.g. acme-beverages)"
                      ))
                    }
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkOutlinedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}>
                    Invoice letterhead
                  </Typography>

                  <TextField
                    label="Address"
                    value={organizationAddress}
                    onChange={(e) => setOrganizationAddress(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="Street, town, dzongkhag"
                    helperText="Shown at the top of shipping invoices"
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                  />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Post No."
                      value={organizationPostNo}
                      onChange={(e) => setOrganizationPostNo(e.target.value)}
                      fullWidth
                      placeholder="e.g. 11001"
                      sx={fieldSx}
                    />
                    <TextField
                      label="GST No."
                      value={organizationGstNo}
                      onChange={(e) => setOrganizationGstNo(e.target.value)}
                      fullWidth
                      placeholder="Organization GST number"
                      sx={fieldSx}
                    />
                  </Stack>

                  <Divider sx={{ my: 0.5 }} />

                  <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}>
                    Owner account
                  </Typography>

                  <TextField
                    label="Your name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonOutlineIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    label="Owner email"
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => {
                      setOwnerEmail(e.target.value);
                      if (fieldErrors.ownerEmail) {
                        setFieldErrors((f) => ({ ...f, ownerEmail: "" }));
                      }
                    }}
                    required
                    fullWidth
                    autoComplete="email"
                    error={!!fieldErrors.ownerEmail}
                    helperText={fieldErrors.ownerEmail || "Used to sign in and recover access"}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={ownerPassword}
                    onChange={(e) => {
                      setOwnerPassword(e.target.value);
                      if (fieldErrors.ownerPassword) {
                        setFieldErrors((f) => ({ ...f, ownerPassword: "" }));
                      }
                    }}
                    required
                    fullWidth
                    autoComplete="new-password"
                    error={!!fieldErrors.ownerPassword}
                    helperText={fieldErrors.ownerPassword || "Minimum 8 characters"}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={fieldSx}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ color: "primary.main", fontSize: 20 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    fullWidth
                    sx={{
                      fontWeight: 900,
                      py: 1.45,
                      mt: 0.5,
                      borderRadius: "14px",
                      textTransform: "none",
                      fontSize: "1rem",
                      boxShadow: `0 14px 28px ${alpha(theme.palette.primary.main, 0.35)}`,
                      "&:hover": {
                        bgcolor: "primary.dark",
                        boxShadow: `0 18px 34px ${alpha(theme.palette.primary.main, 0.38)}`,
                        transform: "translateY(-2px)",
                      },
                      "&:active": { transform: "translateY(0)" },
                    }}
                  >
                    {loading ? (
                      <>
                        <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} />
                        Creating workspace…
                      </>
                    ) : (
                      "Create workspace"
                    )}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="body2" sx={{ mt: 3, textAlign: "center", color: "text.secondary" }}>
                Already have a workspace?{" "}
                <MuiLink component={RouterLink} to="/login" fontWeight={800} underline="hover">
                  Sign in
                </MuiLink>
              </Typography>
            </Paper>
          </Fade>
        </Box>
      </Container>

      <AppSnackbar open={success} message="Workspace created. Welcome!" severity="success" onClose={() => setSuccess(false)} />
    </Box>
  );
}

export default SignUpPage;
