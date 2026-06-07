import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import GetAppIcon from "@mui/icons-material/GetApp";
import IosShareIcon from "@mui/icons-material/IosShare";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { APP_SHORT_NAME, BRAND_MARK_SRC } from "../constants/brand";
import { logoSrcWithPublicUrl } from "../utils/organizationBrand";

function InstallGuideDialog({ open, mode, onClose }) {
  if (!mode || mode === "native") return null;

  const title =
    mode === "ios"
      ? "Install on iPhone / iPad"
      : mode === "android"
        ? "Install on Android"
        : mode === "in-app"
          ? "Open in your browser"
          : `Install ${APP_SHORT_NAME}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        {mode === "in-app" ? (
          <Typography variant="body2" color="text.secondary">
            In-app browsers (WhatsApp, Facebook, Instagram, etc.) cannot install apps. Tap{" "}
            <strong>⋮</strong> or <strong>⋯</strong> and choose <strong>Open in Chrome</strong> or{" "}
            <strong>Open in Safari</strong>, then tap Install again.
          </Typography>
        ) : null}

        {mode === "ios" ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Safari does not show a one-tap install button. Use <strong>Add to Home Screen</strong>:
            </Typography>
            <Stack spacing={1.25} component="ol" sx={{ pl: 2.5, m: 0 }}>
              <Typography component="li" variant="body2">
                Tap <strong>Share</strong>{" "}
                <IosShareIcon sx={{ fontSize: 18, verticalAlign: "text-bottom" }} /> at the bottom of Safari.
              </Typography>
              <Typography component="li" variant="body2">
                Choose <strong>Add to Home Screen</strong>.
              </Typography>
              <Typography component="li" variant="body2">
                Tap <strong>Add</strong> — {APP_SHORT_NAME} opens like an app.
              </Typography>
            </Stack>
          </>
        ) : null}

        {mode === "android" ? (
          <Stack spacing={1.25} component="ol" sx={{ pl: 2.5, m: 0 }}>
            <Typography component="li" variant="body2">
              Open this site in <strong>Chrome</strong> (not an in-app browser).
            </Typography>
            <Typography component="li" variant="body2">
              Tap the menu <strong>⋮</strong> (top right).
            </Typography>
            <Typography component="li" variant="body2">
              Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </Typography>
            <Typography component="li" variant="body2">
              Confirm — {APP_SHORT_NAME} will appear on your home screen.
            </Typography>
          </Stack>
        ) : null}

        {mode === "desktop" ? (
          <Stack spacing={1.25} component="ol" sx={{ pl: 2.5, m: 0 }}>
            <Typography component="li" variant="body2">
              Use <strong>Chrome</strong> or <strong>Edge</strong> on this site.
            </Typography>
            <Typography component="li" variant="body2">
              Look for the install icon in the address bar, or open the browser menu.
            </Typography>
            <Typography component="li" variant="body2">
              Choose <strong>Install {APP_SHORT_NAME}</strong> or <strong>Install app</strong>.
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}

async function runInstallFlow({ getInstallGuideMode, promptInstall, setGuideOpen }) {
  const mode = getInstallGuideMode();
  if (!mode) return;
  if (mode === "native") {
    const { outcome } = await promptInstall();
    if (outcome !== "accepted") {
      const fallback = getInstallGuideMode();
      setGuideOpen(fallback && fallback !== "native" ? fallback : "desktop");
    }
    return;
  }
  setGuideOpen(mode);
}

/**
 * Bottom banner + install instructions for “Install app” (PWA).
 */
export default function InstallAppBanner() {
  const theme = useTheme();
  const brand = theme.palette.primary.main;
  const {
    canNativeInstall,
    showBanner,
    showIosGuide,
    promptInstall,
    dismissBanner,
    getInstallGuideMode,
  } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMode, setGuideMode] = useState(null);
  const [installing, setInstalling] = useState(false);

  if (!showBanner) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await runInstallFlow({
        getInstallGuideMode,
        promptInstall,
        setGuideOpen: (mode) => {
          setGuideMode(mode);
          setGuideOpen(true);
        },
      });
    } finally {
      setInstalling(false);
    }
  };

  const showHowTo = showIosGuide && !canNativeInstall;

  return (
    <>
      <Paper
        elevation={12}
        sx={{
          position: "fixed",
          bottom: { xs: 12, sm: 20 },
          left: { xs: 12, sm: "50%" },
          right: { xs: 12, sm: "auto" },
          transform: { sm: "translateX(-50%)" },
          zIndex: theme.zIndex.snackbar + 2,
          width: { xs: "auto", sm: "min(480px, calc(100vw - 40px))" },
          px: 2,
          py: 1.5,
          borderRadius: 3,
          border: "1px solid",
          borderColor: alpha(brand, 0.25),
          bgcolor: "background.paper",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            component="img"
            src={logoSrcWithPublicUrl(BRAND_MARK_SRC)}
            alt=""
            sx={{ width: 44, height: 44, flexShrink: 0, objectFit: "contain" }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
              Install {APP_SHORT_NAME}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Add to your home screen for quick access — works like an app.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            disabled={installing}
            startIcon={showHowTo ? <IosShareIcon /> : <GetAppIcon />}
            onClick={handleInstall}
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: brand,
              "&:hover": { bgcolor: theme.palette.error.dark },
            }}
          >
            {showHowTo ? "How to" : "Install"}
          </Button>
          <IconButton size="small" aria-label="Dismiss install banner" onClick={dismissBanner}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      <InstallGuideDialog open={guideOpen} mode={guideMode} onClose={() => setGuideOpen(false)} />
    </>
  );
}

/** Compact install button for landing / login headers. */
export function InstallAppButton({ size = "medium", sx = {} }) {
  const theme = useTheme();
  const brand = theme.palette.primary.main;
  const { isStandalone, promptInstall, getInstallGuideMode } = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMode, setGuideMode] = useState(null);
  const [installing, setInstalling] = useState(false);

  if (isStandalone) return null;

  const handleClick = async () => {
    setInstalling(true);
    try {
      await runInstallFlow({
        getInstallGuideMode,
        promptInstall,
        setGuideOpen: (mode) => {
          setGuideMode(mode);
          setGuideOpen(true);
        },
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        disabled={installing}
        startIcon={<GetAppIcon />}
        onClick={handleClick}
        sx={{
          textTransform: "none",
          fontWeight: 800,
          borderColor: alpha(brand, 0.5),
          color: brand,
          ...sx,
        }}
      >
        Install app
      </Button>
      <InstallGuideDialog open={guideOpen} mode={guideMode} onClose={() => setGuideOpen(false)} />
    </>
  );
}
