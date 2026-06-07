import React, { useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Link,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LoginIcon from "@mui/icons-material/Login";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import { InstallAppButton } from "../components/InstallAppBanner";
import { BRAND_MARK_SRC, PRIVACY_POLICY_PATH, TERMS_OF_SERVICE_PATH } from "../constants/brand";
import { logoSrcWithPublicUrl } from "../utils/organizationBrand";
import { PLATFORM_NAME, PLATFORM_TAGLINE, PLATFORM_DESCRIPTION } from "../constants/saas";
import { markLandingSeen } from "../utils/landingSeen";
import { appPageShellBackground } from "../theme/contrastSurfaces";

const publicUrl = process.env.PUBLIC_URL || "";

const FEATURES = [
  {
    icon: AssessmentOutlinedIcon,
    title: "Target tracking",
    body: "See target, achieved, and balance figures clearly for each distributor.",
  },
  {
    icon: Inventory2OutlinedIcon,
    title: "Order workflow",
    body: "Create orders, monitor approvals, and review stock lifting from one dashboard.",
  },
  {
    icon: PaidOutlinedIcon,
    title: "Rate control",
    body: "Keep product prices, schemes, and calculator results aligned across the team.",
  },
];

const PREVIEW_STATS = [
  { label: "Target Balance", value: "82%", tone: "success" },
  { label: "Open Orders", value: "12", tone: "warning" },
  { label: "Active Products", value: "23", tone: "info" },
];

const TRUST_POINTS = ["Isolated workspaces", "Team invites", "Role-based access"];

const WORKFLOW_STEPS = [
  "Set targets and product rates",
  "Distributors place orders",
  "Admins monitor progress",
];

export default function LandingPage() {
  const theme = useTheme();
  const brand = theme.palette.primary.main;
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    markLandingSeen();
  }, []);

  const previewBg = isDark
    ? alpha(theme.palette.background.paper, 0.72)
    : alpha(theme.palette.background.paper, 0.92);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        backgroundImage: isDark
          ? `radial-gradient(circle at 18% 10%, ${alpha(brand, 0.22)} 0, transparent 28%), radial-gradient(circle at 84% 18%, ${alpha(theme.palette.info.main, 0.16)} 0, transparent 30%), linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.45)} 0%, transparent 50%)`
          : appPageShellBackground(theme),
      }}
    >
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid",
          borderColor: alpha(theme.palette.divider, 0.8),
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backdropFilter: "blur(16px)",
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar disableGutters sx={{ minHeight: { xs: 60, sm: 68 }, justifyContent: "space-between", gap: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
              <Box
                component="img"
                src={logoSrcWithPublicUrl(BRAND_MARK_SRC, publicUrl)}
                alt=""
                sx={{ width: { xs: 38, sm: 44 }, height: { xs: 38, sm: 44 }, objectFit: "contain", flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.15 }} noWrap>
                  {PLATFORM_NAME}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  Distribution management
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={{ xs: 0.75, sm: 1 }}>
              <DayNightThemeToggle />
              <InstallAppButton size="small" sx={{ display: { xs: "none", sm: "inline-flex" } }} />
              <Button
                component={RouterLink}
                to="/login"
                variant="contained"
                startIcon={<LoginIcon />}
                sx={{
                  minWidth: { xs: 0, sm: 108 },
                  px: { xs: 1.5, sm: 2.5 },
                  textTransform: "none",
                  fontWeight: 900,
                  borderRadius: 999,
                  bgcolor: brand,
                  boxShadow: `0 10px 22px ${alpha(brand, 0.25)}`,
                  "& .MuiButton-startIcon": { display: { xs: "none", sm: "inherit" } },
                  "&:hover": { bgcolor: theme.palette.error.dark },
                }}
              >
                Sign in
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </Box>

      <Box component="main" sx={{ flex: 1, py: { xs: 3, sm: 5, md: 7 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Paper
            elevation={0}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: { xs: 3, md: 5 },
              border: "1px solid",
              borderColor: alpha(brand, isDark ? 0.26 : 0.14),
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.9),
              boxShadow: `0 28px 90px ${alpha(theme.palette.common.black, isDark ? 0.36 : 0.1)}`,
            }}
          >
            <Box
              sx={{
                position: "absolute",
                right: { xs: -110, md: -70 },
                top: { xs: -120, md: -80 },
                width: { xs: 260, md: 380 },
                height: { xs: 260, md: 380 },
                borderRadius: "50%",
                bgcolor: alpha(brand, isDark ? 0.12 : 0.08),
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: { xs: -140, md: -90 },
                bottom: { xs: -160, md: -130 },
                width: { xs: 280, md: 360 },
                height: { xs: 280, md: 360 },
                borderRadius: "50%",
                bgcolor: alpha(theme.palette.info.main, isDark ? 0.12 : 0.08),
              }}
            />

            <Box
              sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.08fr) minmax(320px, 0.92fr)" },
                gap: { xs: 4, md: 5 },
                alignItems: "center",
                p: { xs: 2.25, sm: 4, md: 6 },
              }}
            >
              <Stack spacing={{ xs: 2.25, sm: 3 }} alignItems={{ xs: "center", md: "flex-start" }} textAlign={{ xs: "center", md: "left" }}>
                <Chip
                  icon={<VerifiedUserOutlinedIcon />}
                  label="Multi-tenant SaaS"
                  sx={{
                    height: 34,
                    px: 0.75,
                    fontWeight: 900,
                    bgcolor: alpha(brand, isDark ? 0.16 : 0.1),
                    color: isDark ? theme.palette.error.light : theme.palette.error.dark,
                    border: `1px solid ${alpha(brand, 0.18)}`,
                    "& .MuiChip-icon": { color: "inherit" },
                  }}
                />

                <Box>
                  <Typography
                    component="p"
                    variant="overline"
                    sx={{ fontWeight: 900, letterSpacing: 1.2, color: "text.secondary", mb: 0.75 }}
                  >
                    {PLATFORM_NAME}
                  </Typography>
                  <Typography
                    component="h1"
                    variant="h2"
                    sx={{
                      fontWeight: 950,
                      letterSpacing: { xs: -0.8, sm: -1.3 },
                      lineHeight: 1.04,
                      fontSize: { xs: "2.15rem", sm: "3rem", md: "4rem" },
                      maxWidth: 690,
                    }}
                  >
                    {PLATFORM_TAGLINE}
                  </Typography>
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{
                      mt: { xs: 1.5, sm: 2 },
                      maxWidth: 590,
                      lineHeight: 1.65,
                      fontWeight: 500,
                      fontSize: { xs: "1rem", sm: "1.15rem" },
                    }}
                  >
                    {PLATFORM_DESCRIPTION}
                  </Typography>
                </Box>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                  alignItems="stretch"
                >
                  <Button
                    component={RouterLink}
                    to="/login"
                    variant="outlined"
                    size="large"
                    startIcon={<LoginIcon />}
                    sx={{
                      minHeight: 50,
                      textTransform: "none",
                      fontWeight: 950,
                      borderRadius: 2.25,
                      px: 3.25,
                    }}
                  >
                    Sign in
                  </Button>
                  <InstallAppButton
                    size="large"
                    sx={{
                      minHeight: 50,
                      borderRadius: 2.25,
                      px: 3.25,
                    }}
                  />
                  <Button
                    component="a"
                    href={`${publicUrl}${TERMS_OF_SERVICE_PATH}`}
                    variant="outlined"
                    size="large"
                    sx={{
                      minHeight: 50,
                      textTransform: "none",
                      fontWeight: 850,
                      borderRadius: 2.25,
                      px: 3.25,
                      bgcolor: alpha(theme.palette.background.paper, 0.45),
                    }}
                  >
                    View terms
                  </Button>
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  justifyContent={{ xs: "center", md: "flex-start" }}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ pt: 0.5 }}
                >
                  {TRUST_POINTS.map((item) => (
                    <Chip
                      key={item}
                      icon={<CheckCircleOutlineIcon />}
                      label={item}
                      variant="outlined"
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.background.paper, 0.4),
                        fontWeight: 800,
                        "& .MuiChip-icon": { color: "success.main" },
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              <Paper
                elevation={0}
                sx={{
                  borderRadius: { xs: 3, sm: 4 },
                  p: { xs: 2, sm: 2.5 },
                  bgcolor: previewBg,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.8),
                  boxShadow: `0 20px 55px ${alpha(theme.palette.common.black, isDark ? 0.32 : 0.1)}`,
                  backdropFilter: "blur(14px)",
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      component="img"
                      src={logoSrcWithPublicUrl(BRAND_MARK_SRC, publicUrl)}
                      alt={PLATFORM_NAME}
                      sx={{ width: { xs: 58, sm: 70 }, height: "auto", flexShrink: 0 }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontWeight: 950, lineHeight: 1.2 }}>
                        Operations overview
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fast view for admins and distributors
                      </Typography>
                    </Box>
                  </Stack>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)", md: "1fr" },
                      gap: 1.25,
                    }}
                  >
                    {PREVIEW_STATS.map((stat) => (
                      <Paper
                        key={stat.label}
                        elevation={0}
                        sx={{
                          p: 1.75,
                          borderRadius: 2.5,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: alpha(theme.palette.background.paper, 0.75),
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                              {stat.label}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 950, mt: 0.25 }}>
                              {stat.value}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 2,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              bgcolor: alpha(theme.palette[stat.tone].main, 0.12),
                              color: `${stat.tone}.main`,
                            }}
                          >
                            <TrendingUpIcon />
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Box>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: alpha(brand, isDark ? 0.14 : 0.07),
                      border: `1px solid ${alpha(brand, 0.16)}`,
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 950, mb: 0.75 }}>
                      Built for daily use
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      Clear actions, quick sign-in, and responsive screens for field teams on phones or managers on desktop.
                    </Typography>
                  </Paper>
                </Stack>
              </Paper>
            </Box>
          </Paper>

          <Box sx={{ mt: { xs: 4, md: 5 } }}>
            <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 950, letterSpacing: 1.2 }}>
                Core workflow
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 950, fontSize: { xs: "1.65rem", sm: "2.15rem" } }}>
                Simple tools for the work that matters.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
                gap: { xs: 1.5, sm: 2 },
              }}
            >
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <Card
                  key={title}
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    bgcolor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.9),
                    transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                    "&:hover": {
                      transform: { xs: "none", md: "translateY(-4px)" },
                      borderColor: alpha(brand, 0.3),
                      boxShadow: `0 16px 34px ${alpha(theme.palette.common.black, isDark ? 0.28 : 0.08)}`,
                    },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2.25, sm: 3 }, "&:last-child": { pb: { xs: 2.25, sm: 3 } } }}>
                    <Stack direction={{ xs: "row", sm: "column" }} spacing={2} alignItems={{ xs: "flex-start", sm: "flex-start" }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2.25,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: alpha(brand, 0.1),
                          color: brand,
                          flexShrink: 0,
                        }}
                      >
                        <Icon />
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 950, mb: 0.75, lineHeight: 1.25 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                          {body}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>

            <Paper
              elevation={0}
              sx={{
                mt: { xs: 3, md: 4 },
                p: { xs: 2.25, sm: 3 },
                borderRadius: 3,
                border: "1px solid",
                borderColor: alpha(brand, isDark ? 0.24 : 0.14),
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.92),
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={{ xs: 2, md: 3 }}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 950, letterSpacing: 1 }}>
                    How teams use it
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 950, mt: 0.25 }}>
                    From rate setup to order review in one simple flow.
                  </Typography>
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                  {WORKFLOW_STEPS.map((step, index) => (
                    <Chip
                      key={step}
                      label={`${index + 1}. ${step}`}
                      sx={{
                        height: 36,
                        fontWeight: 850,
                        bgcolor: alpha(brand, index === 1 ? 0.1 : 0.06),
                        color: isDark ? theme.palette.error.light : theme.palette.error.dark,
                        border: `1px solid ${alpha(brand, 0.14)}`,
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Box>

        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: { xs: 2.25, sm: 2.75 } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "center", sm: "center" }}
            justifyContent="space-between"
            textAlign={{ xs: "center", sm: "left" }}
          >
            <Typography variant="caption" color="text.secondary">
              &copy; {new Date().getFullYear()} {PLATFORM_NAME}
            </Typography>
            <Typography variant="caption" component="nav" aria-label="Legal">
              <Link component={RouterLink} to="/platform/login" underline="hover" color="text.secondary" fontWeight={800}>
                Platform console
              </Link>
              <Box component="span" sx={{ mx: 1, color: "text.disabled" }}>
                |
              </Box>
              <Link href={`${publicUrl}${PRIVACY_POLICY_PATH}`} underline="hover" color="text.secondary" fontWeight={800}>
                Privacy Policy
              </Link>
              <Box component="span" sx={{ mx: 1, color: "text.disabled" }}>
                |
              </Box>
              <Link href={`${publicUrl}${TERMS_OF_SERVICE_PATH}`} underline="hover" color="text.secondary" fontWeight={800}>
                Terms of Service
              </Link>
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
