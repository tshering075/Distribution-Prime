import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { onAuthStateChange, getCurrentUser, signOutUser, getDistributorByUid, getAdminByUid } from "../services/supabaseService";
import { loadOrganizationContext, getOrganizationBySlug } from "../services/organizationService";
import {
  clearActiveOrganization,
  getActiveOrganizationId,
  getLastWorkspaceSlug,
  getWorkspaceLoginPath,
} from "../services/tenantScope";
import { clearDistributorSessionToken } from "../utils/distributorSession";
import { checkPlatformAdmin } from "../services/platformAdminService";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import SaasLoadingScreen from "../components/saas/SaasLoadingScreen";

const LoginPage = lazy(() => import("../pages/LoginPage"));
const SignUpPage = lazy(() => import("../pages/SignUpPage"));
const WorkspaceLoginPage = lazy(() => import("../pages/WorkspaceLoginPage"));
const InviteAcceptPage = lazy(() => import("../pages/InviteAcceptPage"));
const LandingPage = lazy(() => import("../pages/LandingPage"));
const DistributorDashboard = lazy(() => import("../pages/DistributorDashboard"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const ShippingDashboard = lazy(() => import("../pages/ShippingDashboard"));
const PlatformLoginPage = lazy(() => import("../pages/PlatformLoginPage"));
const PlatformDashboard = lazy(() => import("../pages/PlatformDashboard"));
const PrivacyPolicyPage = lazy(() => import("../pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("../pages/TermsOfServicePage"));

const SESSION_ROLE_KEY = "session_role";
const SESSION_DISTRIBUTOR_INFO_KEY = "session_distributor_info";
const SESSION_AUTH_ACTIVE_KEY = "session_auth_active";

/** Distributor code+password sessions survive closing the browser; cleared on logout. Admins still use sessionStorage only. */
const DISTRIBUTOR_LS_ACTIVE = "coke_dist_session_active";
const DISTRIBUTOR_LS_ROLE = "coke_dist_session_role";
const DISTRIBUTOR_LS_INFO = "coke_dist_session_info";

function AppRouteFallback() {
  return <SaasLoadingScreen />;
}

function readPersistedDistributorInfo() {
  try {
    const raw = localStorage.getItem(DISTRIBUTOR_LS_INFO);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function clearDistributorLocalPersistence() {
  localStorage.removeItem(DISTRIBUTOR_LS_ACTIVE);
  localStorage.removeItem(DISTRIBUTOR_LS_ROLE);
  localStorage.removeItem(DISTRIBUTOR_LS_INFO);
}

function persistDistributorSession(info) {
  localStorage.setItem(DISTRIBUTOR_LS_ACTIVE, "true");
  localStorage.setItem(DISTRIBUTOR_LS_ROLE, "distributor");
  localStorage.setItem(DISTRIBUTOR_LS_INFO, JSON.stringify(info));
}

function readSessionDistributorInfo() {
  try {
    const raw = sessionStorage.getItem(SESSION_DISTRIBUTOR_INFO_KEY);
    if (raw && typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  const p = readPersistedDistributorInfo();
  return p || {};
}

// Inner component that can use useNavigate hook
function AppRouterInner() {
  const navigate = useNavigate();
  const [role, setRole] = useState(() => {
    const ss = sessionStorage.getItem(SESSION_ROLE_KEY);
    if (ss) return ss;
    if (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true") {
      return localStorage.getItem(DISTRIBUTOR_LS_ROLE);
    }
    return null;
  });
  const [distributorInfo, setDistributorInfo] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_DISTRIBUTOR_INFO_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      /* fall through */
    }
    return readPersistedDistributorInfo();
  });
  const [authLoading, setAuthLoading] = useState(true);

  // Restore distributor sessionStorage from localStorage after a full browser restart
  useEffect(() => {
    if (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) !== "true") return;
    const info = readPersistedDistributorInfo();
    sessionStorage.setItem(SESSION_AUTH_ACTIVE_KEY, "true");
    sessionStorage.setItem(SESSION_ROLE_KEY, "distributor");
    if (info) {
      sessionStorage.setItem(SESSION_DISTRIBUTOR_INFO_KEY, JSON.stringify(info));
    }
  }, []);
  
  // Helper function to check if user is authenticated (checks both state and localStorage)
  // Always prioritizes localStorage as it's the source of truth on page refresh
  const isAuthenticated = (requiredRole = null) => {
    const storedRole =
      sessionStorage.getItem(SESSION_ROLE_KEY) ||
      (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true" ? localStorage.getItem(DISTRIBUTOR_LS_ROLE) : null);
    const currentRole = storedRole || role;
    
    // Debug logging (can be removed later)
    if (process.env.NODE_ENV === 'development' && requiredRole) {
      console.log(`[Auth Check] Required: ${requiredRole}, Current: ${currentRole}, Stored: ${storedRole}, State: ${role}`);
    }
    
    if (!currentRole) {
      return false;
    }
    
    if (requiredRole) {
      // For specific role check, match exactly (case-insensitive for safety)
      const matches = currentRole.toLowerCase() === requiredRole.toLowerCase();
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Auth Check] Role match: ${matches} (${currentRole} === ${requiredRole})`);
      }
      return matches;
    }
    
    // For general check, allow admin, viewer, distributor, shipping, or platform operator
    const roleLower = currentRole.toLowerCase();
    return (
      roleLower === "admin" ||
      roleLower === "viewer" ||
      roleLower === "distributor" ||
      roleLower === "shipping" ||
      roleLower === "platform_admin"
    );
  };

  const getHomePathForRole = (r) => {
    const roleLower = (r || "").toLowerCase();
    if (roleLower === "platform_admin") return "/platform";
    if (roleLower === "distributor") return "/distributor";
    if (roleLower === "shipping") return "/shipping";
    return "/admin";
  };
  
  // Get current role from state or localStorage (prioritizes localStorage)
  const getCurrentRole = () => {
    const stored =
      sessionStorage.getItem(SESSION_ROLE_KEY) ||
      (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true" ? localStorage.getItem(DISTRIBUTOR_LS_ROLE) : null);
    const current = stored || role;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Get Current Role] Stored: ${stored}, State: ${role}, Returning: ${current}`);
    }
    return current;
  };

  // Listen to Supabase auth state changes
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChange(async (user) => {
      if (!isMounted) return;
      const hasActiveSession = sessionStorage.getItem(SESSION_AUTH_ACTIVE_KEY) === "true";
      
      if (user) {
        // App was reopened (sessionStorage cleared) but Supabase remembered user.
        // Keep user on login until they explicitly log in again.
        if (!hasActiveSession) {
          if (isMounted) {
            setAuthLoading(false);
          }
          return;
        }

        // User is signed in, check if they're platform operator or tenant user
        try {
          const storedRole = sessionStorage.getItem(SESSION_ROLE_KEY);
          if (storedRole === "platform_admin") {
            const isPlatform = await checkPlatformAdmin();
            if (isPlatform && isMounted) {
              clearActiveOrganization();
              setRole("platform_admin");
              setDistributorInfo(null);
              localStorage.setItem("userRole", "platform_admin");
              setAuthLoading(false);
              return;
            }
          }

          let preferredOrgId = getActiveOrganizationId();
          if (!preferredOrgId && getLastWorkspaceSlug()) {
            try {
              const org = await getOrganizationBySlug(getLastWorkspaceSlug());
              preferredOrgId = org?.id || null;
            } catch {
              /* use first matching admin row */
            }
          }

          const admin = await getAdminByUid(user.id, preferredOrgId || undefined);
          if (admin && isMounted) {
            // Get actual role from Supabase (admin or viewer)
            const actualRole = admin.role || "admin"; // admin | viewer | shipping
            clearDistributorLocalPersistence();
            if (admin.organization_id) {
              try {
                await loadOrganizationContext(admin.organization_id);
              } catch (orgErr) {
                console.warn("Could not load organization context:", orgErr);
              }
            }
            setRole(actualRole);
            setDistributorInfo(null);
            sessionStorage.setItem(SESSION_ROLE_KEY, actualRole);
            localStorage.setItem("userRole", actualRole);
            // Also store user role and permissions for permission checks
            localStorage.setItem("userRole", actualRole);
            if (admin.permissions) {
              localStorage.setItem("userPermissions", JSON.stringify(admin.permissions));
            }
            setAuthLoading(false);
            return;
          }
          
          const distributor = await getDistributorByUid(user.id);
          if (distributor && isMounted) {
            if (distributor.organization_id) {
              try {
                await loadOrganizationContext(distributor.organization_id);
              } catch (orgErr) {
                console.warn("Could not load organization context:", orgErr);
              }
            }
            setRole("distributor");
            const info = { name: distributor.name, code: distributor.code };
            setDistributorInfo(info);
            sessionStorage.setItem(SESSION_ROLE_KEY, "distributor");
            sessionStorage.setItem(SESSION_DISTRIBUTOR_INFO_KEY, JSON.stringify(info));
            persistDistributorSession(info);
            setAuthLoading(false);
            return;
          }
          
          if (isMounted) {
            setAuthLoading(false);
          }
        } catch (error) {
          console.error("Error checking user role:", error);
          if (isMounted) {
            setAuthLoading(false);
          }
        }
      } else {
        // Distributors can sign in with code + row credentials only (no Supabase Auth user).
        // Do not wipe their session when Auth reports no user.
        const keepDistributorSession =
          (sessionStorage.getItem(SESSION_AUTH_ACTIVE_KEY) === "true" &&
            sessionStorage.getItem(SESSION_ROLE_KEY) === "distributor") ||
          localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true";

        if (keepDistributorSession) {
          if (isMounted) {
            setAuthLoading(false);
          }
          return;
        }

        sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_ROLE_KEY);
        sessionStorage.removeItem(SESSION_DISTRIBUTOR_INFO_KEY);
        clearDistributorLocalPersistence();
        if (isMounted) {
          setRole(null);
          setDistributorInfo(null);
          setAuthLoading(false);
        }
      }
    });
    
    // Set loading to false after initial check
    const timeout = setTimeout(() => {
      if (isMounted) {
        setAuthLoading(false);
      }
    }, 1000);
    
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      try {
        unsubscribe();
      } catch (error) {
        console.error("Error unsubscribing from auth:", error);
      }
    };
  }, []);

  // Save role and distributor info to localStorage whenever they change
  useEffect(() => {
    if (role) {
      sessionStorage.setItem(SESSION_ROLE_KEY, role);
    } else {
      sessionStorage.removeItem(SESSION_ROLE_KEY);
      sessionStorage.removeItem(SESSION_DISTRIBUTOR_INFO_KEY);
      sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
      clearDistributorLocalPersistence();
      setDistributorInfo(null);
    }
  }, [role]);

  const handleLogin = (newRole, distributor = null) => {
    sessionStorage.setItem(SESSION_AUTH_ACTIVE_KEY, "true");
    if (newRole === "platform_admin") {
      clearActiveOrganization();
      clearDistributorLocalPersistence();
      setDistributorInfo(null);
    } else if (newRole === "distributor" && distributor) {
      const info = { name: distributor.name, code: distributor.code };
      setDistributorInfo(info);
      sessionStorage.setItem(SESSION_DISTRIBUTOR_INFO_KEY, JSON.stringify(info));
      persistDistributorSession(info);
    } else {
      clearDistributorLocalPersistence();
    }
    setRole(newRole);
  };

  const handleLogout = () => {
    // Get user info before clearing state (for logging)
    const userEmail = localStorage.getItem('admin_email') || 'Unknown';
    const userName = userEmail.split('@')[0];
    const userRole = role || 'Unknown';
    
    // Clear state and localStorage IMMEDIATELY (don't wait for async operations)
    setRole(null);
    setDistributorInfo(null);
    
    // Clear all auth-related localStorage items
    localStorage.removeItem("role");
    localStorage.removeItem("distributorInfo");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userPermissions");
    localStorage.removeItem("admin_email");
    sessionStorage.removeItem(SESSION_AUTH_ACTIVE_KEY);
    sessionStorage.removeItem(SESSION_ROLE_KEY);
    sessionStorage.removeItem(SESSION_DISTRIBUTOR_INFO_KEY);
    clearDistributorLocalPersistence();
    clearDistributorSessionToken();
    clearActiveOrganization();

    // Navigate immediately - don't wait for async operations
    navigate("/", { replace: true });
    
    // Fire async operations in the background (don't await them)
    // These will complete in the background and won't block logout
    (async () => {
      try {
        // Get current user for logging (if still available)
        const currentUser = await getCurrentUser().catch(() => null);
        
        // Log logout activity in background (fire and forget)
        if (currentUser || userEmail !== 'Unknown') {
          logActivity(
            ACTIVITY_TYPES.LOGOUT,
            `User logged out: ${userEmail} (${userRole})`,
            {
              userEmail,
              userName,
              role: userRole,
            }
          ).catch(error => {
            // Silently ignore errors - logout already completed
            if (error.name !== 'AbortError') {
              console.error("Error logging logout activity (non-blocking):", error);
            }
          });
        }
        
        // Sign out from Supabase in background (fire and forget)
        if (currentUser) {
          signOutUser().catch(error => {
            // Silently ignore errors - logout already completed
            if (error.name !== 'AbortError') {
              console.error("Error signing out from Supabase (non-blocking):", error);
            }
          });
        }
      } catch (error) {
        // Silently ignore all errors - logout already completed
        if (error.name !== 'AbortError') {
          console.error("Error in background logout operations (non-blocking):", error);
        }
      }
    })();
  };

  // If we have a stored role but state hasn't loaded yet, ensure role is set
  // This prevents authentication checks from failing during initial render
  // MUST be called before any conditional returns (React Hooks rule)
  const hasStoredRole = !!(
    sessionStorage.getItem(SESSION_ROLE_KEY) ||
    (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true" && localStorage.getItem(DISTRIBUTOR_LS_ROLE))
  );
  useEffect(() => {
    if (hasStoredRole && !role) {
      const storedRole =
        sessionStorage.getItem(SESSION_ROLE_KEY) ||
        (localStorage.getItem(DISTRIBUTOR_LS_ACTIVE) === "true" ? localStorage.getItem(DISTRIBUTOR_LS_ROLE) : null);
      if (storedRole) {
        setRole(storedRole);
        if (storedRole === "distributor") {
          const fromSession = sessionStorage.getItem(SESSION_DISTRIBUTOR_INFO_KEY);
          const fromLocal = localStorage.getItem(DISTRIBUTOR_LS_INFO);
          const raw = fromSession || fromLocal;
          if (raw) {
            try {
              setDistributorInfo(JSON.parse(raw));
            } catch (e) {
              console.error("Error parsing distributor info:", e);
            }
          }
        }
      }
    }
  }, [hasStoredRole, role]);

  // Show loading state while checking authentication
  // But only if we don't have a role in localStorage (first time load)
  // If we have a role, render routes immediately to preserve current page on refresh
  // Only show loading if we're truly loading AND don't have a stored role
  // This ensures that on refresh, if we have a role in localStorage, we render immediately
  // and preserve the current route
  if (authLoading && !hasStoredRole) {
    return <SaasLoadingScreen message="Checking your session…" />;
  }

  return (
    <Suspense fallback={<AppRouteFallback />}>
    <Routes>
      <Route path="/install" element={<Navigate to="/" replace />} />

      {/* Public home — OAuth verification: app purpose + name without login */}
      <Route
        path="/"
        element={
          isAuthenticated() ? (
            <Navigate to={getHomePathForRole(getCurrentRole())} replace />
          ) : (
            <LandingPage />
          )
        }
      />

      {/* Login */}
      <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

      <Route path="/signup" element={<SignUpPage onLogin={handleLogin} />} />

      <Route path="/w/:workspaceSlug/login" element={<WorkspaceLoginPage onLogin={handleLogin} />} />

      <Route
        path="/invite/:token"
        element={<InviteAcceptPage onLogin={handleLogin} />}
      />

      <Route
        path="/platform/login"
        element={<PlatformLoginPage onLogin={handleLogin} />}
      />

      <Route
        path="/platform"
        element={
          !isAuthenticated() ? (
            <Navigate to="/platform/login" replace />
          ) : !isAuthenticated("platform_admin") ? (
            <Navigate to={getHomePathForRole(getCurrentRole())} replace />
          ) : (
            <PlatformDashboard onLogout={handleLogout} />
          )
        }
      />

      {/* Distributor Dashboard - Preserve route on refresh */}
      <Route
        path="/distributor"
        element={
          !isAuthenticated() ? (
            <Navigate to="/login" replace />
          ) : !isAuthenticated("distributor") ? (
            <Navigate to={getHomePathForRole(getCurrentRole())} replace />
          ) : (
            (() => {
              const fromSession = readSessionDistributorInfo();
              return (
                <DistributorDashboard
                  distributorName={distributorInfo?.name || fromSession.name || "Distributor"}
                  distributorCode={distributorInfo?.code || fromSession.code}
                  onLogout={handleLogout}
                />
              );
            })()
          )
        }
      />

      {/* Admin Dashboard - Preserve route on refresh */}
      <Route
        path="/admin"
        element={
          !isAuthenticated() ? (
            <Navigate to="/login" replace />
          ) : isAuthenticated("distributor") ? (
            <Navigate to="/distributor" replace />
          ) : isAuthenticated("shipping") ? (
            <Navigate to="/shipping" replace />
          ) : isAuthenticated("admin") || isAuthenticated("viewer") ? (
            <AdminDashboard onLogout={handleLogout} />
          ) : (
            <Navigate to={getHomePathForRole(getCurrentRole())} replace />
          )
        }
      />

      {/* Shipping Dashboard — same workspace context as admin/distributor */}
      <Route
        path="/shipping"
        element={
          !isAuthenticated() ? (
            <Navigate to={getWorkspaceLoginPath()} replace />
          ) : !isAuthenticated("shipping") ? (
            <Navigate to={getHomePathForRole(getCurrentRole())} replace />
          ) : !getActiveOrganizationId() ? (
            <Navigate to={getWorkspaceLoginPath()} replace />
          ) : (
            <ShippingDashboard onLogout={handleLogout} />
          )
        }
      />

      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/privacy-policy.html" element={<Navigate to="/privacy-policy" replace />} />
      <Route path="/terms-of-service.html" element={<Navigate to="/terms-of-service" replace />} />

      {/* Unknown paths */}
      <Route
        path="*"
        element={
          !isAuthenticated() ? (
            <Navigate to="/login" replace />
          ) : (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <h2>404 - Page Not Found</h2>
              <p>The page you&apos;re looking for doesn&apos;t exist.</p>
            </div>
          )
        }
      />
    </Routes>
    </Suspense>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <AppRouterInner />
    </BrowserRouter>
  );
}

export default AppRouter;
