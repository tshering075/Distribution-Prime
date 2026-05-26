import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const STORAGE_KEY = "coke_day_night_view";
const LEGACY_PRESET_KEY = "coke_theme_preset";

/** `night` = light theme (current look). `day` = dark theme (high-contrast). */
const VALID_VIEWS = new Set(["day", "night"]);

function createNightTheme() {
  return createTheme({
    palette: {
      mode: "light",
      primary: { main: "#e53935", dark: "#c62828", light: "#ff6b6b" },
      secondary: { main: "#fbc02d", dark: "#f9a825", light: "#ffdf7e" },
      background: { default: "#eceff1", paper: "#ffffff" },
      error: { main: "#c62828" },
      info: { main: "#0277bd" },
      warning: { main: "#e65100" },
      success: { main: "#1b5e20" },
      /** Stronger than MUI default 0.6 secondary — improves labels on tinted cards & sidebars */
      text: {
        primary: "rgba(0, 0, 0, 0.9)",
        secondary: "rgba(0, 0, 0, 0.72)",
        disabled: "rgba(0, 0, 0, 0.48)",
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
      fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
    },
    shape: { borderRadius: 8 },
    components: {
      MuiAppBar: {
        defaultProps: { color: "primary", enableColorOnDark: true },
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
            color: "rgba(0, 0, 0, 0.68)",
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: "rgba(0, 0, 0, 0.65)",
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          body: {
            color: "rgba(0, 0, 0, 0.88)",
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
      primary: { main: "#ff6b6b" },
      secondary: { main: "#ffd54f" },
      background: { default: "#121212", paper: "#1e1e1e" },
      error: { main: "#ff8a80" },
      info: { main: "#4fc3f7" },
      warning: { main: "#ffb74d" },
      success: { main: "#81c784" },
      divider: "rgba(255, 255, 255, 0.12)",
      text: {
        primary: "rgba(255, 255, 255, 0.95)",
        secondary: "rgba(255, 255, 255, 0.68)",
        disabled: "rgba(255, 255, 255, 0.38)",
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
            color: "rgba(255, 255, 255, 0.72)",
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            color: "rgba(255, 255, 255, 0.65)",
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

  const theme = useMemo(() => (view === "day" ? createDayTheme() : createNightTheme()), [view]);

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
