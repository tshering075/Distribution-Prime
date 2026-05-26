import React from "react";
import AppRouter from "./layout/AppRouter";

// Explicitly define as non-async component for React 19 compatibility
const App = () => {
  return <AppRouter />;
};

export default App;