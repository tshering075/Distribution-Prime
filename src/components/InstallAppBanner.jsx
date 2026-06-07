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

/**
 * Bottom banner + iOS instructions for “Install app” (PWA).
 * Shown on first visits until dismissed or installed.
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
  } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (!showBanner) return null;

  const handleInstall = async () => {
    if (showIosGuide && !canNativeInstall) {
      setIosOpen(true);
      return;
    }
    setInstalling(true);
    try {
      const { outcome } = await promptInstall();
      if (outcome === "unavailable" && showIosGuide) setIosOpen(true);
    } finally {
      setInstalling(false);
    }
  };

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
            startIcon={showIosGuide && !canNativeInstall ? <IosShareIcon /> : <GetAppIcon />}
            onClick={handleInstall}
            sx={{
              flexShrink: 0,
              fontWeight: 800,
              textTransform: "none",
              bgcolor: brand,
              "&:hover": { bgcolor: theme.palette.error.dark },
            }}
          >
            {showIosGuide && !canNativeInstall ? "How to" : "Install"}
          </Button>
          <IconButton size="small" aria-label="Dismiss install banner" onClick={dismissBanner}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      <Dialog open={iosOpen} onClose={() => setIosOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Install on iPhone / iPad</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Safari does not show a one-tap install button. Use <strong>Add to Home Screen</strong>:
          </Typography>
          <Stack spacing={1.25} component="ol" sx={{ pl: 2.5, m: 0 }}>
            <Typography component="li" variant="body2">
              Tap the <strong>Share</strong> button{" "}
              <IosShareIcon sx={{ fontSize: 18, verticalAlign: "text-bottom" }} /> at the bottom of Safari.
            </Typography>
            <Typography component="li" variant="body2">
              Scroll and choose <strong>Add to Home Screen</strong>.
            </Typography>
            <Typography component="li" variant="body2">
              Tap <strong>Add</strong> — {APP_SHORT_NAME} will open like an app.
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            Tip: Open this link in <strong>Safari</strong>, not inside another app&apos;s browser.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosOpen(false)} sx={{ fontWeight: 700 }}>
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Compact install button for landing / login headers. */
export function InstallAppButton({ size = "medium", sx = {} }) {
  const theme = useTheme();
  const brand = theme.palette.primary.main;
  const { canNativeInstall, showIosGuide, isStandalone, promptInstall } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (showIosGuide && !canNativeInstall) {
      setIosOpen(true);
      return;
    }
    setInstalling(true);
    try {
      const { outcome } = await promptInstall();
      if (outcome === "unavailable" && showIosGuide) setIosOpen(true);
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
      <Dialog open={iosOpen} onClose={() => setIosOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Install {APP_SHORT_NAME}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            In Safari: Share <IosShareIcon sx={{ fontSize: 16, verticalAlign: "text-bottom" }} /> →{" "}
            <strong>Add to Home Screen</strong> → Add.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
