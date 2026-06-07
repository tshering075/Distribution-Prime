import React from "react";
import AppRouter from "./layout/AppRouter";
import { OrganizationProvider } from "./context/OrganizationProvider";
import { AppThemeProvider } from "./theme/AppThemeProvider";

// Explicitly define as non-async component for React 19 compatibility
const App = () => {
  return (
    <OrganizationProvider>
      <AppThemeProvider>
        <AppRouter />
      </AppThemeProvider>
    </OrganizationProvider>
  );
};

export default App;