import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InstallGatePage from "../pages/InstallGatePage";
import { shouldShowInstallGate, skipInstallGate } from "../hooks/usePwaInstall";

/**
 * Blocks app content until the user installs (or chooses “Continue in browser”).
 * Used on / and /login entry links.
 */
export default function InstallGate({ children, defaultContinuePath = "/login" }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!shouldShowInstallGate()) {
    return children;
  }

  const continuePath =
    location.pathname === "/install"
      ? defaultContinuePath
      : `${location.pathname}${location.search}${location.hash}` || defaultContinuePath;

  const handleContinue = () => {
    skipInstallGate();
    navigate(continuePath, { replace: true });
  };

  return <InstallGatePage onContinue={handleContinue} />;
}
