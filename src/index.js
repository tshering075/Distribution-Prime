import React from "react";
import ReactDOM from "react-dom/client";
import '@fontsource/roboto';
import App from "./App";
import "./index.css";
import { initializeAdminCredentials } from "./utils/distributorAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppThemeProvider } from "./theme/AppThemeProvider";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

// Initialize admin credentials on app start
try {
  initializeAdminCredentials();
} catch (error) {
  // Silently fail - app can still work without admin credentials initialized
}

// Helper to serialize error objects for better logging
const serializeError = (err) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.toString && err.toString() !== '[object Object]') return err.toString();
  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err));
  } catch {
    return String(err);
  }
};

// Global error handler to suppress AbortErrors (expected behavior when requests are cancelled)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason && (
    reason.name === 'AbortError' || 
    reason.message?.includes('aborted') ||
    reason.message?.includes('signal is aborted') ||
    (typeof reason === 'string' && reason.includes('aborted'))
  )) {
    // Suppress AbortErrors - they're expected when components unmount or requests are cancelled
    event.preventDefault();
    // Don't log to avoid console noise
    return;
  }
  
  // Log other unhandled rejections with proper serialization
  const errorMessage = serializeError(reason);
  console.error('Unhandled promise rejection:', errorMessage);
  // Let other errors through to React error boundary
});

// Also catch errors in error event
window.addEventListener('error', (event) => {
  const error = event.error;
  if (error && (
    error.name === 'AbortError' || 
    error.message?.includes('aborted') ||
    error.message?.includes('signal is aborted') ||
    (typeof error === 'string' && error.includes('aborted'))
  )) {
    // Suppress AbortErrors
    event.preventDefault();
    // Don't log to avoid console noise
    return;
  }
  
  // Log other errors with proper serialization
  const errorMessage = serializeError(error);
  console.error('Unhandled error:', errorMessage);
  // Let other errors through to React error boundary
});

const root = ReactDOM.createRoot(document.getElementById("root"));

// Workaround for React 19 async component detection issue
// Ensure App is not treated as async
const AppComponent = App;

function dismissSplash() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 600);
  }
}

root.render(
  <React.StrictMode>
    <AppThemeProvider>
      <ErrorBoundary>
        <AppComponent />
      </ErrorBoundary>
    </AppThemeProvider>
  </React.StrictMode>
);

dismissSplash();

if (process.env.NODE_ENV === "production") {
  serviceWorkerRegistration.register();
}
