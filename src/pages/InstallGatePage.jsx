import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import GetAppIcon from "@mui/icons-material/GetApp";
import IosShareIcon from "@mui/icons-material/IosShare";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { APP_NAME, APP_SHORT_NAME, BRAND_MARK_SRC } from "../constants/brand";

function StepCard({ number, title, children, highlight }) {
  const theme = useTheme();
  const brand = theme.palette.error.main;
  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        borderColor: highlight ? alpha(brand, 0.45) : "divider",
        bgcolor: highlight ? alpha(brand, 0.06) : "background.paper",
      }}
    >
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              bgcolor: brand,
              color: "#fff",
              fontWeight: 900,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {number}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.25 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {children}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Full-screen install-first page — shown before login/home when opening the link in a browser.
 */
export default function InstallGatePage({ onContinue }) {
  const theme = useTheme();
  const brand = theme.palette.error.main;
  const isDark = theme.palette.mode === "dark";
  const {
    canNativeInstall,
    isIos,
    inAppBrowser,
    showIosGuide,
    promptTimedOut,
    promptInstall,
  } = usePwaInstall();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const { outcome } = await promptInstall();
      if (outcome === "accepted") return;
    } finally {
      setInstalling(false);
    }
  };

  const showAndroidManual = !isIos && !canNativeInstall && promptTimedOut;
  const showIosSteps = showIosGuide;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        backgroundImage: isDark
          ? `radial-gradient(circle at 20% 0%, ${alpha(brand, 0.2)} 0, transparent 40%)`
          : `radial-gradient(circle at 20% 0%, ${alpha(brand, 0.1)} 0, transparent 42%), linear-gradient(180deg, #fff 0%, ${alpha(theme.palette.grey[50], 0.9)} 100%)`,
      }}
    >
      <Container maxWidth="sm" sx={{ flex: 1, py: { xs: 3, sm: 5 }, px: 2 }}>
        <Stack spacing={3} alignItems="center" sx={{ textAlign: "center" }}>
          <Box
            component="img"
            src={BRAND_MARK_SRC}
            alt={APP_NAME}
            sx={{ width: { xs: 100, sm: 120 }, height: "auto" }}
          />

          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.15, mb: 1 }}>
              Install {APP_SHORT_NAME}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 360, mx: "auto" }}>
              Install the app on your phone or computer first — then sign in. No app store required.
            </Typography>
          </Box>

          {inAppBrowser ? (
            <Card
              sx={{
                width: "100%",
                borderRadius: 3,
                border: "1px solid",
                borderColor: alpha(theme.palette.warning.main, 0.5),
                bgcolor: alpha(theme.palette.warning.main, 0.08),
              }}
            >
              <CardContent>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Open in Safari or Chrome first
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You opened this link inside another app (e.g. WhatsApp). Tap the menu{" "}
                  <MoreVertIcon sx={{ fontSize: 16, verticalAlign: "text-bottom" }} /> and choose{" "}
                  <strong>Open in browser</strong> or <strong>Open in Safari</strong>, then install from there.
                </Typography>
              </CardContent>
            </Card>
          ) : null}

          {!showIosSteps && !inAppBrowser ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={installing}
              startIcon={
                installing ? (
                  <CircularProgress size={22} color="inherit" />
                ) : (
                  <GetAppIcon />
                )
              }
              onClick={handleInstall}
              sx={{
                py: 1.75,
                fontSize: "1.1rem",
                fontWeight: 900,
                textTransform: "none",
                borderRadius: 3,
                maxWidth: 360,
                bgcolor: brand,
                boxShadow: `0 12px 32px ${alpha(brand, 0.35)}`,
                "&:hover": { bgcolor: theme.palette.error.dark },
              }}
            >
              {canNativeInstall
                ? "Install now"
                : installing
                  ? "Opening install…"
                  : "Install application"}
            </Button>
          ) : null}

          {!showIosSteps && !canNativeInstall && !promptTimedOut && !inAppBrowser ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={20} sx={{ color: brand }} />
              <Typography variant="body2" color="text.secondary">
                Preparing install…
              </Typography>
            </Stack>
          ) : null}

          {showAndroidManual && !inAppBrowser ? (
            <Stack spacing={1.5} sx={{ width: "100%" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, textAlign: "left" }}>
                Then tap:
              </Typography>
              <StepCard number="1" title="Browser menu">
                Tap <MoreVertIcon sx={{ fontSize: 18, verticalAlign: "text-bottom" }} /> (three dots) at the top
                of Chrome
              </StepCard>
              <StepCard number="2" title="Install" highlight>
                Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
              </StepCard>
            </Stack>
          ) : null}

          {showIosSteps ? (
            <Stack spacing={1.5} sx={{ width: "100%", textAlign: "left" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, textAlign: "center" }}>
                On iPhone / iPad — follow these steps:
              </Typography>
              <StepCard number="1" title="Tap Share" highlight>
                At the <strong>bottom of Safari</strong>, tap the Share button{" "}
                <IosShareIcon sx={{ fontSize: 20, verticalAlign: "text-bottom", color: brand }} />
              </StepCard>
              <StepCard number="2" title="Add to Home Screen">
                Scroll the menu and tap <strong>Add to Home Screen</strong>{" "}
                <AddBoxOutlinedIcon sx={{ fontSize: 18, verticalAlign: "text-bottom" }} />
              </StepCard>
              <StepCard number="3" title="Confirm">
                Tap <strong>Add</strong> in the top corner. Open {APP_SHORT_NAME} from your home screen.
              </StepCard>
            </Stack>
          ) : null}

          <Button
            variant="text"
            color="inherit"
            startIcon={<OpenInBrowserIcon />}
            onClick={onContinue}
            sx={{
              mt: 1,
              textTransform: "none",
              fontWeight: 700,
              color: "text.secondary",
            }}
          >
            Continue in browser without installing
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
