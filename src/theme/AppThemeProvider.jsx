import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useOrganizationOptional } from "../context/OrganizationProvider";
import { applyBrandToTheme } from "./tenantTheme";

const STORAGE_KEY = "coke_day_night_view";
const LEGACY_PRESET_KEY = "coke_theme_preset";

/** `night` = light theme (current look). `day` = dark theme (high-contrast). */
const VALID_VIEWS = new Set(["day", "night"]);

/** Light-mode surfaces — soft grey instead of pure white (easier on eyes). */
export const LIGHT_SURFACE = {
  default: "#e4e8ec",
  paper: "#eef0f3",
  elevated: "#f4f5f7",
};

/** Crisp labels — avoid rgba text + blur compositing on chrome bars. */
const sharpTextBaseline = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "auto",
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      root: {
        WebkitFontSmoothing: "antialiased",
      },
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: {
        WebkitFontSmoothing: "antialiased",
      },
    },
  },
};

function createNightTheme() {
  return createTheme({
    palette: {
      mode: "light",
      primary: { main: "#1565c0", dark: "#0d47a1", light: "#42a5f5", contrastText: "#ffffff" },
      secondary: { main: "#00acc1", dark: "#00838f", light: "#4dd0e1", contrastText: "#ffffff" },
      background: { default: LIGHT_SURFACE.default, paper: LIGHT_SURFACE.paper },
      error: { main: "#d32f2f" },
      info: { main: "#0288d1" },
      warning: { main: "#ed6c02" },
      success: { main: "#2e7d32" },
      /** Stronger than MUI default 0.6 secondary — improves labels on tinted cards & sidebars */
      text: {
        primary: "#1a1a1a",
        secondary: "#5f6368",
        disabled: "#9aa0a6",
      },
      divider: "rgba(0, 0, 0, 0.14)",
      action: {
        active: "rgba(0, 0, 0, 0.65)",
        hover: "rgba(0, 0, 0, 0.06)",
        selected: "rgba(0, 0, 0, 0.1)",
        disabled: "rgba(0, 0, 0, 0.38)",
        disabledBackground: "rgba(0, 0, 0, 0.12)",
      },
    },
    typography: {
      fontFamily: '"Segoe UI","Roboto","Helvetica","Arial",sans-serif',
      h4: { fontWeight: 800, letterSpacing: "-0.02em" },
      h5: { fontWeight: 800 },
      h6: { fontWeight: 700, letterSpacing: "-0.01em" },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      ...sharpTextBaseline,
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "auto",
            backgroundColor: LIGHT_SURFACE.default,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: LIGHT_SURFACE.paper,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
            backgroundColor: LIGHT_SURFACE.paper,
          },
        },
      },
      MuiAppBar: {
        defaultProps: { color: "primary", enableColorOnDark: true },
      },
      MuiButton: {
        defaultProps: { disableElevation: false },
        styleOverrides: {
          root: {
            textTransform: "none",
            borderRadius: 10,
            fontWeight: 600,
          },
          containedPrimary: {
            boxShadow: "0 4px 14px rgba(21, 101, 192, 0.22)",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: "1px solid",
            borderColor: "rgba(0, 0, 0, 0.08)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            backgroundImage: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 56,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          colorPrimary: {
            backgroundColor: "rgba(21, 101, 192, 0.12)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(0, 0, 0, 0.32)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
            },
          },
          notchedOutline: {
            borderColor: "rgba(0, 0, 0, 0.26)",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: "#424242",
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: "#616161",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          body: {
            color: "#212121",
          },
        },
      },
    },
  });
}

function createDayTheme() {
  return createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#64b5f6", dark: "#42a5f5", light: "#90caf9", contrastText: "#ffffff" },
      secondary: { main: "#4dd0e1", dark: "#26c6da", light: "#80deea", contrastText: "#ffffff" },
      background: { default: "#121212", paper: "#1e1e1e" },
      error: { main: "#ff8a80" },
      info: { main: "#4fc3f7" },
      warning: { main: "#ffb74d" },
      success: { main: "#81c784" },
      divider: "rgba(255, 255, 255, 0.12)",
      text: {
        primary: "#f5f5f5",
        secondary: "#b0b0b0",
        disabled: "#757575",
      },
      action: {
        active: "rgba(255, 255, 255, 0.56)",
        hover: "rgba(255, 255, 255, 0.08)",
        selected: "rgba(255, 255, 255, 0.16)",
        disabled: "rgba(255, 255, 255, 0.3)",
        disabledBackground: "rgba(255, 255, 255, 0.12)",
      },
    },
    typography: {
      fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
    },
    shape: { borderRadius: 8 },
    components: {
      ...sharpTextBaseline,
      MuiAppBar: {
        defaultProps: { color: "primary", enableColorOnDark: true },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          outlined: {
            borderColor: "rgba(255, 255, 255, 0.24)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(255, 255, 255, 0.28)",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderWidth: 2,
            },
          },
          notchedOutline: {
            borderColor: "rgba(255, 255, 255, 0.22)",
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: "#d0d0d0",
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: "#a3a3a3",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          body: {
            color: "inherit",
            borderColor: "rgba(255, 255, 255, 0.08)",
          },
          head: {
            color: "inherit",
            borderColor: "rgba(255, 255, 255, 0.08)",
          },
        },
      },
    },
  });
}

const AppThemeContext = createContext(null);

export function useDayNightTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error("useDayNightTheme must be used within AppThemeProvider");
  }
  return ctx;
}

export function AppThemeProvider({ children }) {
  const orgCtx = useOrganizationOptional();
  const tenantBrand = orgCtx?.brand;

  const [view, setViewState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_VIEWS.has(stored)) return stored;
      const legacy = localStorage.getItem(LEGACY_PRESET_KEY);
      if (legacy && ["midnight", "zero", "slate"].includes(legacy)) return "day";
    } catch {
      /* ignore */
    }
    return "night";
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const setView = useCallback((next) => {
    if (VALID_VIEWS.has(next)) setViewState(next);
  }, []);

  const toggleView = useCallback(() => {
    setViewState((v) => (v === "day" ? "night" : "day"));
  }, []);

  const theme = useMemo(() => {
    const base = view === "day" ? createDayTheme() : createNightTheme();
    return applyBrandToTheme(base, tenantBrand);
  }, [view, tenantBrand]);

  const value = useMemo(
    () => ({
      view,
      setView,
      toggleView,
      /** True when dark UI (Day view) is active */
      isDayView: view === "day",
    }),
    [view, setView, toggleView]
  );

  return (
    <AppThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}
