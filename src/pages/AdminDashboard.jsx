import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
   Box,
   AppBar,
   Toolbar,
   IconButton,
   Drawer,
   List,
   ListItem,
   ListItemButton,
   ListItemText,
   Typography,
  Button,
  Paper,
  Tooltip,
  Badge,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { navDrawerPaperSx, navDrawerItemSx } from "../theme/contrastSurfaces";
import {
  saasAppBarSx,
  saasAppBarToolbarSx,
  saasDashboardMainSx,
  navDrawerSectionLabelSx,
} from "../theme/saasChrome";
import SaasAppBarTitle from "../components/saas/SaasAppBarTitle";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LogoutIcon from "@mui/icons-material/Logout";                    
import BarChartIcon from "@mui/icons-material/BarChart";
import { Dialog, DialogActions, DialogTitle, DialogContent } from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import CalculateIcon from "@mui/icons-material/Calculate";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import HistoryIcon from "@mui/icons-material/History";
import TargetsDialog from "../components/TargetsDialog";
import DistributorsDialog from "../components/DistributorsDialog";
import ReportsDialog from "../components/ReportsDialog";
import EmailRecipientsDialog from "../components/EmailRecipientsDialog";
import OrderPreviewDialog from "../components/OrderPreviewDialog";
import OrderEmailDialog from "../components/OrderEmailDialog";
import UserPermissionManagementDialog from "../components/UserPermissionManagementDialog";
import ActivityDialog from "../components/ActivityDialog";
import GmailSettingsDialog from "../components/GmailSettingsDialog";
import SchemeDiscountDialog from "../components/SchemeDiscountDialog";
import RateMasterDialog from "../components/RateMasterDialog";
import GstSettingsDialog from "../components/GstSettingsDialog";
import PhysicalStockAdminDialog from "../components/PhysicalStockAdminDialog";
import AdminStockLiftingRecordsDialog from "../components/AdminStockLiftingRecordsDialog";
import AppSnackbar from "../components/AppSnackbar";
import { useLogoutConfirmation } from "../components/LogoutConfirmDialog";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import WorkspaceChip from "../components/WorkspaceChip";
import WorkspaceSettingsDialog from "../components/WorkspaceSettingsDialog";
import TeamManagementDialog from "../components/TeamManagementDialog";
import OnboardingWizardDialog from "../components/OnboardingWizardDialog";
import WorkspaceSwitcher from "../components/WorkspaceSwitcher";
import { useOrganization } from "../context/OrganizationProvider";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import { playOrderApprovedChime } from "../utils/orderApprovedSound";
import { playNewOrderIncomingAlert, playTargetAchievedBell } from "../utils/newOrderAlertSound";
import { isCombinedTargetAchievedUC } from "../utils/targetAchievement";
import { getTargetReminderNotificationIconUrl } from "../utils/targetReminder";
import NuProductRateIcon from "../components/NuProductRateIcon";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import TableChartIcon from "@mui/icons-material/TableChart";
import CokeCalculator from "../cokecalculator";
import { getDistributors, saveDistributors } from "../utils/distributorAuth";
import {
  readTenantJson,
  removeTenantJson,
  writeTenantJson,
} from "../utils/tenantLocalStorage";
import { readOrdersCache, writeOrdersCache } from "../utils/ordersLocalStorage";
// Import extracted components
import InfoCards from "./AdminDashboard/components/InfoCards";
import PerformanceTable from "./AdminDashboard/components/PerformanceTable";
import DistributorPerformanceSkuDialog from "../components/DistributorPerformanceSkuDialog";
import PerformanceToolbar from "./AdminDashboard/components/PerformanceToolbar";
import OrdersSection from "./AdminDashboard/components/OrdersSection";
import AdminSummaryStrip from "./AdminDashboard/components/AdminSummaryStrip";
import { getTargetPeriod, saveTargetPeriod } from "../utils/targetPeriod";
import { buildDistributorPerformanceSkuDetailRows } from "../utils/performanceSkuAggregation";
import { backfillDispatchedOrdersToSalesData } from "../services/deliveredOrderAchievement";
import {
  buildPerformanceAchievedByDistributor,
  EMPTY_ACHIEVED,
  normalizeAchievedShape,
} from "../utils/achievedFromDispatches";
import { 
  getAllDistributors, 
  saveDistributor, 
  updateDistributor, 
  deleteDistributor,
  subscribeToDistributors,
  getAllSalesData,
  getAllOrders,
  subscribeToSalesData,
  deleteAllSalesDataFromAdmin,
  getAllTargets,
  saveTargetsBatch,
  deleteTargetsBatch,
  getAllSchemes,
  saveScheme,
  deleteScheme,
  supabase,
  getCurrentUser,
  getAdminByUid,
  updateUserLastActive,
  getProductRates,
  updateOrderStatus as updateOrderStatusInSupabaseService,
  getGlobalTargetPeriod,
  getGlobalGstPolicy,
  saveGlobalGstPolicy,
} from "../services/supabaseService";
import { 
  sendOrderEmail, 
  orderToHTML, 
  createMailtoLink
} from "../services/emailService";
import { getCurrentUserRole, getUserPermissions } from "../utils/permissions";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import { readProductRatesFromLocalStorage, writeProductRatesToLocalStorage } from "../utils/productRatesStorage";
import { ensureProductCatalog } from "../utils/productCatalog";
import {
  DEFAULT_GST_REGIONS,
  readGlobalGstPolicyFromLocalStorage,
  writeGlobalGstPolicyToLocalStorage,
  resolveGstEnabledForRegion,
} from "../utils/globalGstSetting";
import {
  ensureAdminPhysicalStockBaseline,
  countDistributorsWithNewPhysicalStock,
  markAdminPhysicalStockNotificationsSeen,
} from "../utils/adminPhysicalStockSignals";
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  canTransitionOrderStatus,
  appendOrderStatusHistory,
  getOrderApprovalSlaHours,
  isoDeadlineFromNowHours,
  getOrderApprovalDueMs,
  getOrderStatusLabel,
  resolveOrderStatus,
  buildOrderStatusMapFromOrders,
} from "../utils/orderStatus";

const ADMIN_REGION_STORAGE_KEY = "coke_admin_dashboard_region";
const ADMIN_REGION_OPTIONS = ["All", "Southern", "Western", "Eastern", "PLING", "THIM"];

function readStoredAdminRegion() {
  try {
    const v = localStorage.getItem(ADMIN_REGION_STORAGE_KEY);
    if (v && ADMIN_REGION_OPTIONS.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return "All";
}

function AdminDashboard({ onLogout }) {
  const { requestLogout, logoutConfirmDialog } = useLogoutConfirmation(onLogout);
  const { organization } = useOrganization();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile); // Open by default on desktop
  const [selectedRegion, setSelectedRegion] = useState(readStoredAdminRegion);

  const handleRegionChange = useCallback((region) => {
    setSelectedRegion(region);
    try {
      localStorage.setItem(ADMIN_REGION_STORAGE_KEY, region);
    } catch {
      /* ignore */
    }
  }, []);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [distributorsOpen, setDistributorsOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [emailRecipientsOpen, setEmailRecipientsOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [gmailSettingsOpen, setGmailSettingsOpen] = useState(false);
  const [schemeDiscountOpen, setSchemeDiscountOpen] = useState(false);
  const [rateMasterOpen, setRateMasterOpen] = useState(false);
  const [physicalStockAdminOpen, setPhysicalStockAdminOpen] = useState(false);
  const [stockLiftingRecordsOpen, setStockLiftingRecordsOpen] = useState(false);
  const [performanceSkuDialog, setPerformanceSkuDialog] = useState(null);
  const [productRates, setProductRates] = useState(null);
  const [gstSettingsOpen, setGstSettingsOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const onboardingTriggered = useRef(false);
  const [globalGstPolicy, setGlobalGstPolicy] = useState(() => readGlobalGstPolicyFromLocalStorage());
  const [savingGlobalGst, setSavingGlobalGst] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null); // Order ID being sent
  const [emailToast, setEmailToast] = useState({
    open: false,
    message: "",
    title: "",
    severity: "success",
    duration: 4500,
  });
  const [previewOrder, setPreviewOrder] = useState(null); // Order to preview
  const [previewOpen, setPreviewOpen] = useState(false); // Preview dialog state
  const [emailOrder, setEmailOrder] = useState(null); // Order to send email for
  const [emailDialogOpen, setEmailDialogOpen] = useState(false); // Email composition dialog state
  const [orderStatuses, setOrderStatuses] = useState(() => {
    // Load order statuses from localStorage
    try {
      const stored = localStorage.getItem('order_statuses');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  
  // User role and permissions state - initialize from localStorage immediately for instant sidebar rendering
  const [userRole, setUserRole] = useState(() => {
    // Read from localStorage synchronously on initial render
    const storedRole = localStorage.getItem('userRole');
    return storedRole || null;
  });
  const [userPermissions, setUserPermissions] = useState(() => {
    // Read from localStorage synchronously on initial render
    try {
      const storedPermissions = localStorage.getItem('userPermissions');
      return storedPermissions ? JSON.parse(storedPermissions) : null;
    } catch {
      return null;
    }
  });
  const [, setPermissionsLoading] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [adminPhysicalStockBadgeTick, setAdminPhysicalStockBadgeTick] = useState(0);
  const dialogBackHistoryRef = useRef(false);

  // Target period: local default first; Supabase global overwrites on load when configured
  const [targetPeriod, setTargetPeriod] = useState(() => getTargetPeriod());

  const augment = (arr) => {
    if (!Array.isArray(arr)) {
      console.warn('augment called with non-array:', arr);
      return [];
    }
    return arr
      .filter(d => d && d.code) // Filter out invalid entries
      .map(d => {
        try {
          const balance = {
            CSD_PC: (d.target?.CSD_PC||0) - (d.achieved?.CSD_PC||0),
            CSD_UC: (d.target?.CSD_UC||0) - (d.achieved?.CSD_UC||0),
            Water_PC: (d.target?.Water_PC||0) - (d.achieved?.Water_PC||0),
            Water_UC: (d.target?.Water_UC||0) - (d.achieved?.Water_UC||0),
          };
          return { ...d, balance };
        } catch (error) {
          console.error('Error augmenting distributor:', d, error);
          return { ...d, balance: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 } };
        }
      });
  };

  const buildNormalizedTarget = (target = {}) => ({
    CSD_PC: Number(target?.CSD_PC || 0),
    CSD_UC: Number(target?.CSD_UC || 0),
    Water_PC: Number(target?.Water_PC || 0),
    Water_UC: Number(target?.Water_UC || 0),
  });

  const EMPTY_TARGET = buildNormalizedTarget();

  // Check if Supabase is configured
  const isSupabaseConfigured = supabase !== null;

  const productRatesRef = useRef(productRates);
  productRatesRef.current = productRates;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await getGlobalTargetPeriod();
        if (cancelled || !remote?.start || !remote?.end) return;
        saveTargetPeriod(remote.start, remote.end);
        setTargetPeriod({ start: remote.start, end: remote.end });
      } catch (e) {
        console.warn("Could not load global target period from Supabase:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured]);

  // Only show welcome wizard right after workspace signup (?onboarding=1), not on every visit.
  useEffect(() => {
    if (onboardingTriggered.current) return;
    if (searchParams.get("onboarding") !== "1" || !organization?.id) return;
    onboardingTriggered.current = true;
    setOnboardingOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("onboarding");
    setSearchParams(next, { replace: true });
  }, [organization?.id, searchParams, setSearchParams]);

  // Restore Gmail session silently after admin login (connect once per browser)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { isGmailConfigured, warmupGmailSession, startGmailKeepAlive, hasGmailSession } =
          await import("../services/gmailService");
        if (cancelled || !(await isGmailConfigured())) return;
        await warmupGmailSession();
        if (!cancelled && hasGmailSession()) startGmailKeepAlive();
      } catch (e) {
        console.warn("Gmail session restore:", e);
      }
    })();
    return () => {
      cancelled = true;
      import("../services/gmailService")
        .then(({ stopGmailKeepAlive }) => stopGmailKeepAlive())
        .catch(() => {});
    };
  }, []);
  
  // Load user role and permissions on mount
  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        // Note: userRole and userPermissions are already initialized from localStorage in useState
        // This useEffect will verify and update from Supabase if needed
        
        // Get current values from localStorage (in case they changed)
        const storedRole = localStorage.getItem('userRole');
        const storedPermissions = localStorage.getItem('userPermissions');
        
        // If we have localStorage data but state is null, set it immediately
        if (storedRole && !userRole) {
          setUserRole(storedRole);
        }
        if (storedPermissions && !userPermissions) {
          try {
            const parsedPermissions = JSON.parse(storedPermissions);
            setUserPermissions(parsedPermissions);
          } catch (e) {
            console.error('Error parsing stored permissions:', e);
          }
        }
        
        if (storedRole && storedPermissions) {
          console.log('✅ Using permissions from localStorage:', { role: storedRole, permissions: JSON.parse(storedPermissions) });
          // Don't set loading to false yet - still need to verify from Supabase
        }
        
        // Then fetch from Supabase to ensure it's up to date
        if (isSupabaseConfigured) {
          const currentUser = await getCurrentUser();
          if (currentUser) {
            console.log('Loading permissions from Supabase for user:', currentUser.id);
            const role = await getCurrentUserRole();
            const permissions = await getUserPermissions(currentUser.id);
            
            console.log('✅ Loaded from Supabase:', { role, permissions });
            
            // Use the actual role and permissions from Supabase
            // If role is null, try to get it from the admin doc directly
            let finalRole = role;
            if (!finalRole) {
              const adminDoc = await getAdminByUid(currentUser.id);
              if (adminDoc && adminDoc.role) {
                finalRole = adminDoc.role;
                console.log('Got role from adminDoc:', finalRole);
              } else {
                // If still no role, default to viewer (more secure)
                finalRole = 'viewer';
                console.warn('No role found, defaulting to viewer');
              }
            }
            
            setUserRole(finalRole);
            localStorage.setItem('userRole', finalRole);
            
            if (permissions) {
              setUserPermissions(permissions);
              localStorage.setItem('userPermissions', JSON.stringify(permissions));
            } else {
              // If no permissions found, use role to determine permissions
              const rolePermissions = finalRole === 'viewer' 
                ? { read: true, write: false, delete: false, manageUsers: false }
                : { read: true, write: true, delete: true, manageUsers: true };
              setUserPermissions(rolePermissions);
              localStorage.setItem('userPermissions', JSON.stringify(rolePermissions));
              console.log('Set permissions based on role:', rolePermissions);
            }
            
            // Store admin email for email sending
            if (currentUser.email) {
              localStorage.setItem('admin_email', currentUser.email);
              console.log('✅ Admin email stored for email sending:', currentUser.email);
            }
          } else {
            console.warn('No current user found');
            // If no user, default to viewer (more secure)
            setUserRole('viewer');
            setUserPermissions({ read: true, write: false, delete: false, manageUsers: false });
          }
        } else {
          // If Supabase not configured, use localStorage or default to viewer
          if (!storedRole || !storedPermissions) {
            setUserRole('viewer');
            setUserPermissions({ read: true, write: false, delete: false, manageUsers: false });
          }
        }
      } catch (error) {
        console.error('Error loading user permissions:', error);
        // Default to viewer permissions on error (more secure than admin)
        setUserRole('viewer');
        setUserPermissions({ read: true, write: false, delete: false, manageUsers: false });
      } finally {
        setPermissionsLoading(false);
      }
    };
    
    loadUserPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupabaseConfigured]);
  
  // Update user's lastActive timestamp periodically (heartbeat)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    
    const loadAndUpdate = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return;
        
        // Update immediately (non-blocking - errors are handled in the function)
        updateUserLastActive(currentUser.id).catch(() => {
          // Silently ignore errors - they're already handled in updateUserLastActive
        });
        
        // Update every 2 minutes while user is active
        const heartbeatInterval = setInterval(async () => {
          try {
            await updateUserLastActive(currentUser.id);
          } catch (error) {
            // Silently ignore errors - they're already handled in updateUserLastActive
            // AbortErrors are expected when component unmounts
          }
        }, 2 * 60 * 1000); // 2 minutes
        
        return () => clearInterval(heartbeatInterval);
      } catch (error) {
        // Silently ignore errors - this is a non-critical operation
        if (error?.name !== 'AbortError') {
          console.warn('Error in loadAndUpdate (non-blocking):', error);
        }
      }
    };
    
    let heartbeatInterval = null;
    loadAndUpdate().then(cleanup => {
      if (cleanup) {
        heartbeatInterval = cleanup;
      }
    });
    
    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [isSupabaseConfigured]);
  
  // Load distributors from Supabase or localStorage
  const SALES_DATA_STORAGE_KEY = "admin_sales_data";
  const SKIP_DISPATCH_BACKFILL_KEY = "admin_skip_dispatch_backfill";
  const SCHEMES_STORAGE_KEY = "schemes";

  const [distributors, setDistributors] = useState(() => {
    if (isSupabaseConfigured) return [];
    const stored = getDistributors();
    return stored.length > 0 ? augment(stored) : [];
  });
  const [, setSupabaseLoading] = useState(isSupabaseConfigured);

  // Load distributors from Supabase on mount
  useEffect(() => {
    let isMounted = true;
    
    if (isSupabaseConfigured) {
      const loadDistributors = async () => {
        try {
          console.log('🔄 Loading distributors from Supabase...');
          const supabaseDistributors = await getAllDistributors().catch(err => {
            if (err.name === 'AbortError') {
              console.log('Request aborted, ignoring error');
              return [];
            }
            console.error('Error loading distributors:', err);
            return [];
          });
          
          if (!isMounted) return;
          
          console.log(`📦 Loaded ${supabaseDistributors.length} distributors from Supabase`);
          
          // Load targets from separate targets collection
          console.log('🔄 Loading targets from Supabase targets collection...');
          const targetsMap = await getAllTargets().catch(err => {
            if (err.name === 'AbortError') {
              console.log('Request aborted, ignoring error');
              return {};
            }
            console.error('Error loading targets:', err);
            return {};
          });
          
          if (!isMounted) return;
          
          console.log(`📊 Loaded ${Object.keys(targetsMap).length} targets from Supabase`);
          
          if (supabaseDistributors.length > 0) {
            // Merge targets from targets collection with distributor data
            const distributorsWithTargets = supabaseDistributors.map(d => {
              const targetFromCollection = targetsMap[d.code];
              if (targetFromCollection) {
                // Use target from targets collection (priority)
                return {
                  ...d,
                  target: buildNormalizedTarget(targetFromCollection)
                };
              } else {
                // Fallback to target in distributor document (for backward compatibility)
                return d;
              }
            });
            
            // Log target and achieved values to verify they're loaded
            console.log('📊 Distributors loaded from Supabase with targets and achieved values:');
            distributorsWithTargets.forEach(d => {
              const hasTarget = !!d.target;
              const hasAchieved = !!d.achieved;
              const targetValues = d.target ? {
                CSD_PC: d.target.CSD_PC || 0,
                CSD_UC: d.target.CSD_UC || 0,
                Water_PC: d.target.Water_PC || 0,
                Water_UC: d.target.Water_UC || 0,
              } : null;
              const achievedValues = d.achieved ? {
                CSD_PC: d.achieved.CSD_PC || 0,
                CSD_UC: d.achieved.CSD_UC || 0,
                Water_PC: d.achieved.Water_PC || 0,
                Water_UC: d.achieved.Water_UC || 0,
              } : null;
              console.log(`  - ${d.name} (${d.code}):`, {
                hasTarget,
                hasAchieved,
                targetValues,
                achievedValues
              });
            });
            
            const augmented = augment(distributorsWithTargets);
            setDistributors(augmented);
            console.log(`✅ Set ${augmented.length} distributors with targets from targets collection and calculated balances`);
            
            // Verify that target and achieved values are preserved
            let missingCount = 0;
            let distributorsWithAchieved = 0;
            augmented.forEach(d => {
              if (!d.target || !d.achieved) {
                missingCount++;
                console.warn(`⚠️ Distributor ${d.name} (${d.code}) missing:`, {
                  target: !d.target ? 'MISSING' : 'OK',
                  achieved: !d.achieved ? 'MISSING' : 'OK'
                });
              } else {
                // Check if achieved values are non-zero
                const hasNonZeroAchieved = (d.achieved.CSD_PC || 0) > 0 || 
                                          (d.achieved.CSD_UC || 0) > 0 || 
                                          (d.achieved.Water_PC || 0) > 0 || 
                                          (d.achieved.Water_UC || 0) > 0;
                if (hasNonZeroAchieved) {
                  distributorsWithAchieved++;
                }
              }
            });
            if (missingCount === 0) {
              console.log(`✅ All ${augmented.length} distributors have target and achieved values`);
              console.log(`📊 ${distributorsWithAchieved} distributor(s) have non-zero achieved values`);
            } else {
              console.warn(`⚠️ ${missingCount} distributor(s) missing target or achieved values`);
            }
            
            // IMPORTANT: Log that performance table should now show this data
            console.log('📋 Performance table will display achieved values from loaded distributors');
          } else {
            console.log('✅ New workspace has no distributors yet — starting empty');
            setDistributors([]);
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Request aborted, ignoring error');
            return;
          }
          if (!isMounted) return;
          console.error("❌ Error loading distributors from Supabase:", error);
          if (!isSupabaseConfigured) {
            const stored = getDistributors();
            if (stored.length > 0) {
              console.log(`📦 Fallback: Loaded ${stored.length} distributors from localStorage`);
              setDistributors(augment(stored));
            }
          }
        } finally {
          if (isMounted) {
            setSupabaseLoading(false);
          }
        }
      };
      loadDistributors();
    } else {
      setSupabaseLoading(false);
    }
    
    return () => {
      isMounted = false;
    };
  }, [isSupabaseConfigured]);

  // Subscribe to real-time distributor updates from Supabase
  useEffect(() => {
    if (isSupabaseConfigured) {
      const unsubscribe = subscribeToDistributors(async (supabaseDistributors) => {
        try {
          if (isApplyingAchievementsRef.current) {
            console.log("⏸️ Skipping realtime distributor sync during bulk achievement apply");
            return;
          }

          const targetsMap = await getAllTargets().catch((err) => {
            console.warn("Could not refresh targets during distributor subscription update:", err);
            return {};
          });

          // Ensure supabaseDistributors is an array
          if (!Array.isArray(supabaseDistributors)) {
            console.warn('⚠️ Subscription received non-array data:', supabaseDistributors);
            return;
          }
          
          // Always update from Supabase (even if empty) to reflect deletions
          console.log(`📡 Real-time update: ${supabaseDistributors.length} distributors from Supabase`);
          
          // Filter out distributors that were recently deleted locally
          // This prevents the subscription from re-adding distributors that were just deleted
          const deletedCodes = deletedDistributorCodesRef.current;
          const filteredDistributors = supabaseDistributors.filter(d => {
            if (!d || !d.code) return false; // Skip invalid entries
            const shouldInclude = !deletedCodes.has(d.code);
            if (!shouldInclude) {
              console.log(`🚫 Filtering out deleted distributor from subscription: ${d.code}`);
            }
            return shouldInclude;
          });
          
          // Merge with locally added distributors that might not be in Supabase yet
          // This prevents the subscription from removing distributors that were just added during bulk upload
          const newlyAddedCodes = newlyAddedDistributorCodesRef.current;
          
          // Use functional update to get current state and merge with Supabase data
          setDistributors(prevDistributors => {
          try {
            // Ensure prevDistributors is an array
            const safePrevDistributors = Array.isArray(prevDistributors) ? prevDistributors : [];
            
            const locallyAddedDistributors = safePrevDistributors.filter(d => 
              d && d.code && newlyAddedCodes.has(d.code) && !filteredDistributors.some(sd => sd && sd.code === d.code)
            );
            
            if (locallyAddedDistributors.length > 0) {
              console.log(`➕ Preserving ${locallyAddedDistributors.length} locally added distributor(s) not yet in Supabase:`, 
                locallyAddedDistributors.map(d => d.code).filter(Boolean));
            }
            
            // Combine Supabase distributors with locally added ones
            // Filter out any null/undefined entries
            const mergedDistributors = [...filteredDistributors, ...locallyAddedDistributors].filter(d => d && d.code);

            // Always enrich with targets from targets table first to avoid empty/fluctuating targets.
            const mergedWithTargets = mergedDistributors.map((d) => {
              const targetFromCollection = targetsMap[d.code];
              if (!targetFromCollection) return d;
              return {
                ...d,
                target: buildNormalizedTarget(targetFromCollection),
              };
            });
            
            // Log achieved values in real-time update
            const distributorsWithAchieved = mergedWithTargets.filter(d => d.achieved);
            console.log(`📊 ${distributorsWithAchieved.length} out of ${mergedWithTargets.length} distributors have achieved values in real-time update`);
            
            // Update from merged list (Supabase + locally added)
            const augmented = augment(mergedWithTargets);
            
            // Also update localStorage to keep it in sync with Supabase
            // Wrap in try-catch to prevent errors from breaking the state update
            try {
              if (mergedWithTargets.length > 0) {
                const toSave = mergedWithTargets.map(({ balance, ...rest }) => rest).filter(d => d && d.code);
                saveDistributors(toSave);
              } else {
                // If Supabase is empty, clear localStorage too
                saveDistributors([]);
              }
            } catch (saveError) {
              console.error('Error saving distributors to localStorage in subscription:', saveError);
              // Don't throw - just log the error
            }
            
            // Update ref to prevent auto-save from re-saving
            try {
              prevDistributorsRef.current = [...augmented];
            } catch (refError) {
              console.error('Error updating ref in subscription:', refError);
            }
            
            console.log(`✅ Updated distributors from real-time subscription and synced localStorage`);
            
            return augmented;
          } catch (error) {
            console.error('Error in subscription callback state update:', error);
            // Return previous state on error to prevent breaking the app
            return prevDistributors;
          }
        });
        } catch (error) {
          console.error('Error in subscription callback:', error);
          // Don't throw - just log the error to prevent app crash
        }
      });
      return () => unsubscribe();
    }
  }, [isSupabaseConfigured]);

  // Save distributors to Firestore or localStorage whenever they change
  // Achievements update when shipping marks orders delivered (distributor.achieved + sales_data)
  // Use a ref to track previous distributors to avoid duplicate saves
  // Use a ref to track if we're doing a bulk update (to skip auto-save)
  const prevDistributorsRef = useRef([]);
  const isBulkUpdatingRef = useRef(false);
  const isApplyingAchievementsRef = useRef(false); // Prevent realtime overwrite during bulk achieved updates
  const deletedDistributorCodesRef = useRef(new Set()); // Track recently deleted distributor codes
  const newlyAddedDistributorCodesRef = useRef(new Set()); // Track recently added distributor codes to prevent subscription from removing them
  const autoSaveTimeoutRef = useRef(null);
  const isSavingRef = useRef(false); // Track if a save operation is in progress
  
  // Helper function to serialize error objects for better logging
  const serializeError = (error) => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.toString && error.toString() !== '[object Object]') return error.toString();
    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error));
    } catch {
      return String(error);
    }
  };
  
  useEffect(() => {
    // Skip auto-save during bulk distributor updates
    if (isBulkUpdatingRef.current) {
      console.log('⏭️ Skipping auto-save during bulk update');
      return;
    }
    
    // Clear any pending auto-save timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Debounce auto-save to prevent too many rapid saves
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Skip if already saving
      if (isSavingRef.current) {
        console.log('⏭️ Skipping auto-save - previous save still in progress');
        return;
      }
      
      if (distributors.length > 0) {
        const toSave = distributors.map(({ balance, ...rest }) => rest);
        
        // Filter out deleted distributors before saving
        const deletedCodes = deletedDistributorCodesRef.current;
        const toSaveFiltered = toSave.filter(d => !deletedCodes.has(d.code));
        
        if (toSaveFiltered.length !== toSave.length) {
          console.log(`🚫 Filtered out ${toSave.length - toSaveFiltered.length} deleted distributor(s) from auto-save`);
        }
        
        // Only save to localStorage immediately (always needed)
        saveDistributors(toSaveFiltered);
        
        if (isSupabaseConfigured) {
          // Only save NEW or CHANGED distributors to Supabase to avoid duplicate saves
          // Compare with previous state to find what changed
          const prevDistributors = prevDistributorsRef.current;
          const prevMap = new Map(prevDistributors.map(d => [d.code, d]));
          
          // Find distributors that are new or changed (excluding deleted ones)
          const toSaveToFirebase = toSaveFiltered.filter(distributor => {
            const prev = prevMap.get(distributor.code);
            if (!prev) {
              // New distributor
              return true;
            }
            // Check if distributor data changed (compare key fields)
            return JSON.stringify(prev) !== JSON.stringify(distributor);
          });
          
          // Save to Supabase sequentially with delays to avoid overwhelming network
          if (toSaveToFirebase.length > 0) {
            // Filter out any undefined/null distributors before saving
            const validDistributors = toSaveToFirebase.filter(d => d && d.code);
            
            // Limit batch size to prevent too many concurrent requests
            const BATCH_SIZE = 10;
            const DELAY_BETWEEN_SAVES = 100; // 100ms delay between saves
            const DELAY_BETWEEN_BATCHES = 500; // 500ms delay between batches
            
            const saveSequentially = async () => {
              isSavingRef.current = true;
              try {
                for (let i = 0; i < validDistributors.length; i++) {
                  const distributor = validDistributors[i];
                  
                  try {
                    if (!distributor || !distributor.code) {
                      console.warn('⚠️ Skipping invalid distributor:', distributor);
                      continue;
                    }
                    
                    await saveDistributor(distributor);
                    // Silent success - avoid spamming console during bulk uploads
                    
                    // Add delay between saves to prevent network resource exhaustion
                    if (i < validDistributors.length - 1) {
                      // Add longer delay between batches
                      if ((i + 1) % BATCH_SIZE === 0) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                      } else {
                        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SAVES));
                      }
                    }
                  } catch (error) {
                    // Ignore AbortError (usually caused by navigation/unmount)
                    const errorMessage = serializeError(error);
                    if (errorMessage.includes('AbortError') || error?.name === 'AbortError') {
                      console.warn(`⚠️ Supabase save aborted for distributor ${distributor?.code || 'unknown'} (likely navigation/unmount).`);
                      continue;
                    }
                    
                    // Check for network resource errors
                    if (errorMessage.includes('ERR_INSUFFICIENT_RESOURCES') || 
                        errorMessage.includes('Failed to fetch') ||
                        errorMessage.includes('network')) {
                      console.warn(`⚠️ Network resource error saving distributor ${distributor?.code || 'unknown'}. Will retry on next auto-save.`);
                      // Don't throw - allow other saves to continue
                      continue;
                    }
                    
                    console.error(`❌ Error saving distributor ${distributor?.code || 'unknown'} to Supabase:`, errorMessage);
                    if (errorMessage.includes("permission") || errorMessage.includes("Permission")) {
                      console.warn("⚠️ Supabase permission denied. Data saved locally only. Update Supabase RLS/security rules to enable cloud sync.");
                    }
                  }
                }
              } finally {
                isSavingRef.current = false;
              }
            };
            
            // Fire and forget, but sequential inside
            saveSequentially();
          }
          
          // Update ref for next comparison
          prevDistributorsRef.current = toSave;
        }
      } else {
        // Update ref even if empty
        prevDistributorsRef.current = [];
      }
    }, 1000); // 1 second debounce delay
    
    // Cleanup timeout on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [distributors, isSupabaseConfigured]);

  const normalize = (v) => (v === null || v === undefined) ? "" : String(v).toLowerCase().trim();

  const tableRef = useRef(null); // Ref for PDF export (TableContainer)
  const performancePaperRef = useRef(null); // Parent Paper — overflow:hidden clips html2canvas capture
  const [showOrders, setShowOrders] = useState(false); // Toggle orders view
  const [allOrders, setAllOrders] = useState([]); // All orders from all distributors
  const ADMIN_VIEW_STORAGE_KEY = "admin_current_view";
  const [allSalesData, setAllSalesData] = useState([]); // All sales data from Supabase
  const [salesDataHydrated, setSalesDataHydrated] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false); // Track delete-all-data operation
  const newOrderIdsNotifyInitRef = useRef(false);
  const previousOrderIdsRef = useRef(new Set());
  const approvalSnapshotRef = useRef({});
  const approvalNotifyInitRef = useRef(false);
  /** orderId -> last time we fired an overdue-approval reminder (throttle). */
  const approvalReminderLastRef = useRef(new Map());
  /** Tracks UC target achievement per region + period so we notify once on transition to achieved. */
  const adminUcAchievementNotifyRef = useRef({ scope: "", prevAchieved: false });
  const [schemes, setSchemes] = useState([]); // All schemes and discounts
  
  // Load schemes from Firestore
  useEffect(() => {
    const loadSchemes = async () => {
      try {
        if (isSupabaseConfigured) {
          console.log('🔄 Loading schemes from Firebase...');
          const firebaseSchemes = await getAllSchemes();
          setSchemes(firebaseSchemes);
          console.log(`✅ Loaded ${firebaseSchemes.length} schemes from Firebase`);
        } else {
          const parsedSchemes = readTenantJson(SCHEMES_STORAGE_KEY);
          if (parsedSchemes) {
            setSchemes(parsedSchemes);
            console.log(`📦 Loaded ${parsedSchemes.length} schemes from localStorage`);
          }
        }
      } catch (error) {
        console.error("Error loading schemes:", error);
        const parsedSchemes = readTenantJson(SCHEMES_STORAGE_KEY);
        if (parsedSchemes) {
          setSchemes(parsedSchemes);
        }
      }
    };
    loadSchemes();
  }, [isSupabaseConfigured]);

  // Load product rates: Supabase when available (mirror to localStorage), else localStorage backup
  useEffect(() => {
    const loadRates = async () => {
      try {
        if (isSupabaseConfigured) {
          const ratesDoc = await getProductRates();
          if (ratesDoc) {
            const next = ensureProductCatalog(ratesDoc);
            setProductRates(next);
            writeProductRatesToLocalStorage(next);
            return;
          }
        }
      } catch (error) {
        console.error("Error loading product rates from Supabase:", error);
      }
      const local = readProductRatesFromLocalStorage();
      if (local) {
        setProductRates(ensureProductCatalog(local));
      }
    };
    loadRates();
  }, [isSupabaseConfigured]);

  useEffect(() => {
    const loadGlobalGst = async () => {
      try {
        if (isSupabaseConfigured) {
          const remote = await getGlobalGstPolicy();
          if (remote && typeof remote === "object") {
            setGlobalGstPolicy(remote);
            writeGlobalGstPolicyToLocalStorage(remote);
            return;
          }
        }
      } catch (error) {
        console.error("Error loading global GST setting:", error);
      }
      setGlobalGstPolicy(readGlobalGstPolicyFromLocalStorage());
    };
    loadGlobalGst();
  }, [isSupabaseConfigured]);

  const gstRegions = useMemo(() => {
    const fromDistributors = Array.isArray(distributors)
      ? distributors.map((d) => String(d?.region || "").trim()).filter(Boolean)
      : [];
  const defaults = DEFAULT_GST_REGIONS;
    return Array.from(new Set([...fromDistributors, ...defaults]));
  }, [distributors]);

  const handleSaveGlobalGstPolicy = useCallback(
    async (policy) => {
      const next = {
        defaultEnabled: !!policy?.defaultEnabled,
        regionEnabled: policy?.regionEnabled && typeof policy.regionEnabled === "object"
          ? { ...policy.regionEnabled }
          : {},
        distributorEnabled: policy?.distributorEnabled && typeof policy.distributorEnabled === "object"
          ? { ...policy.distributorEnabled }
          : {},
      };
      setGlobalGstPolicy(next);
      writeGlobalGstPolicyToLocalStorage(next);

      if (!isSupabaseConfigured) {
        setEmailToast({
          open: true,
          title: "GST Setting",
          message: "GST settings saved locally. Connect Supabase to apply to all distributors.",
          severity: "info",
          duration: 4200,
        });
        setGstSettingsOpen(false);
        return;
      }

      setSavingGlobalGst(true);
      try {
        await saveGlobalGstPolicy(next);
        setEmailToast({
          open: true,
          title: "GST Setting",
          message: "GST settings saved for all distributors.",
          severity: "success",
          duration: 3600,
        });
        setGstSettingsOpen(false);
      } catch (error) {
        console.error("Error saving global GST setting:", error);
        setEmailToast({
          open: true,
          title: "GST Setting",
          message: "Failed to save global GST setting to Supabase.",
          severity: "error",
          duration: 4600,
        });
      } finally {
        setSavingGlobalGst(false);
      }
    },
    [isSupabaseConfigured]
  );

  // Load orders from Supabase or localStorage
  useEffect(() => {
    const loadOrders = async () => {
      try {
        if (isSupabaseConfigured) {
          const supabaseOrders = await getAllOrders();
          if (supabaseOrders && supabaseOrders.length > 0) {
            setAllOrders(supabaseOrders);
            console.log(`✅ Loaded ${supabaseOrders.length} orders from Supabase`);
          } else {
            setAllOrders([]);
            console.log('⚠️ No orders found in Supabase');
          }
        } else {
          console.log('🔄 Loading orders from localStorage...');
          const orders = readOrdersCache();
          if (orders.length > 0) {
            setAllOrders(orders);
            console.log(`✅ Loaded ${orders.length} orders from localStorage`);
          } else {
            console.log('⚠️ No orders found in localStorage');
          }
        }
      } catch (error) {
        console.error("Error loading orders:", error);
      }
    };
    loadOrders();
  }, [isSupabaseConfigured]);

  // Function to refresh orders from Supabase/localStorage
  const refreshOrders = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        const supabaseOrders = await getAllOrders();
        if (supabaseOrders) {
          setAllOrders(supabaseOrders);
          console.log(`✅ Refreshed ${supabaseOrders.length} orders from Supabase`);
        }
      } else {
        console.log('🔄 Fetching orders from localStorage...');
        const orders = readOrdersCache();
        if (orders.length > 0) {
          setAllOrders(orders);
          console.log(`✅ Refreshed ${orders.length} orders from localStorage`);
        } else {
          console.log('⚠️ No orders found in localStorage');
          setAllOrders((prevOrders) => prevOrders);
        }
      }
    } catch (error) {
      console.error("Error refreshing orders:", error);
      setAllOrders((prevOrders) => prevOrders);
    }
  }, [isSupabaseConfigured]);

  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured) {
      const refreshOrdersSafe = async () => {
        if (!isMounted) return;
        if (typeof document !== "undefined" && document.hidden) return;
        try {
          await refreshOrders();
        } catch (error) {
          if (error.name === "AbortError") {
            console.log("Request aborted, ignoring error");
            return;
          }
          if (isMounted) {
            console.error("Error refreshing orders:", error);
          }
        }
      };

      const interval = setInterval(refreshOrdersSafe, 5000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }

    const interval = setInterval(() => {
      if (!isMounted) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const orders = readOrdersCache();
        if (orders.length > 0) {
          setAllOrders(orders);
        }
      } catch {
        // Ignore errors
      }
    }, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSupabaseConfigured, refreshOrders]);

  // Load sales data from Firebase and localStorage
  useEffect(() => {
    const loadSalesData = async () => {
      const normalizeSalesRecord = (record = {}) => {
        const read = (keys, fallback = null) => {
          for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined && record[key] !== null) {
              return record[key];
            }
          }
          return fallback;
        };

        const invoiceRaw = read(["invoiceDate", "invoice_date", "date"], Date.now());
        const invoiceDate = invoiceRaw?.toDate
          ? invoiceRaw.toDate()
          : invoiceRaw instanceof Date
          ? invoiceRaw
          : new Date(invoiceRaw);

        return {
          ...record,
          distributorCode: read(["distributorCode", "distributor_code", "code"], record.distributorCode || null),
          distributorName: read(
            ["distributorName", "distributor_name", "distributor", "name"],
            record.distributorName || null
          ),
          csdPC: Number(read(["csdPC", "csd_pc", "CSD_PC"], 0) || 0),
          csdUC: Number(read(["csdUC", "csd_uc", "CSD_UC"], 0) || 0),
          waterPC: Number(read(["waterPC", "water_pc", "Water_PC"], 0) || 0),
          waterUC: Number(read(["waterUC", "water_uc", "Water_UC"], 0) || 0),
          source: read(["source"], record.source || ""),
          invoiceDate: Number.isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
        };
      };

      // ALWAYS try Firebase first (if configured) - this is the source of truth
      if (isSupabaseConfigured) {
        try {
          const salesData = await getAllSalesData();
          // Supabase is source of truth: empty table means clear UI + cache (do not revive from localStorage)
          if (Array.isArray(salesData) && salesData.length > 0) {
            const salesDataWithDates = salesData.map(normalizeSalesRecord);
            
            setAllSalesData(salesDataWithDates);
            console.log(`✅ Loaded ${salesDataWithDates.length} sales data records from Supabase`);
            
            // Sync to localStorage as backup
            try {
              const serializableData = salesDataWithDates.map(record => ({
                ...record,
                invoiceDate: record.invoiceDate instanceof Date 
                  ? record.invoiceDate.toISOString() 
                  : record.invoiceDate
              }));
              writeTenantJson(SALES_DATA_STORAGE_KEY, serializableData);
              console.log(`✅ Synced ${serializableData.length} sales data records to localStorage`);
            } catch (syncError) {
              console.error("Error syncing Supabase data to localStorage:", syncError);
            }
          } else {
            setAllSalesData([]);
            removeTenantJson(SALES_DATA_STORAGE_KEY);
            console.log("✅ Supabase has no sales_data rows — cleared in-app sales cache for this workspace");
          }
          setSalesDataHydrated(true);
        } catch (error) {
          console.error("Error loading sales data from Firebase:", error);
          try {
            const salesData = readTenantJson(SALES_DATA_STORAGE_KEY);
            if (Array.isArray(salesData) && salesData.length > 0) {
              const salesDataWithDates = salesData.map(normalizeSalesRecord);
              setAllSalesData(salesDataWithDates);
              console.log(`✅ Loaded ${salesDataWithDates.length} sales data records from localStorage (Firebase error)`);
            }
          } catch (e) {
            console.error("Error loading sales data from localStorage:", e);
          }
          setSalesDataHydrated(true);
        }

        // Subscribe to real-time updates
        const unsubscribe = subscribeToSalesData((salesData) => {
          if (!Array.isArray(salesData)) return;
          const salesDataWithDates = salesData.map(normalizeSalesRecord);
          setAllSalesData(salesDataWithDates);
          setSalesDataHydrated(true);
          try {
            if (salesDataWithDates.length > 0) {
              const serializableData = salesDataWithDates.map(record => ({
                ...record,
                invoiceDate: record.invoiceDate instanceof Date 
                  ? record.invoiceDate.toISOString() 
                  : record.invoiceDate
              }));
              writeTenantJson(SALES_DATA_STORAGE_KEY, serializableData);
            } else {
              removeTenantJson(SALES_DATA_STORAGE_KEY);
            }
          } catch (syncError) {
            console.error("Error syncing real-time sales data to localStorage:", syncError);
          }
        });
        return () => unsubscribe();
      } else {
        try {
          const salesData = readTenantJson(SALES_DATA_STORAGE_KEY);
          if (Array.isArray(salesData) && salesData.length > 0) {
            const salesDataWithDates = salesData.map(normalizeSalesRecord);
            setAllSalesData(salesDataWithDates);
            console.log(`✅ Loaded ${salesDataWithDates.length} sales data records from localStorage`);
          }
        } catch (e) {
          console.error("Error loading sales data from localStorage:", e);
        }
        setSalesDataHydrated(true);
      }
    };
    
    loadSalesData();
  }, [isSupabaseConfigured]);

  const salesBackfillRanRef = useRef(false);
  useEffect(() => {
    if (!isSupabaseConfigured || !allOrders?.length || salesBackfillRanRef.current) return;
    if (readTenantJson(SKIP_DISPATCH_BACKFILL_KEY)) return;
    salesBackfillRanRef.current = true;
    void backfillDispatchedOrdersToSalesData(allOrders, 50).then(async ({ applied, errors }) => {
      if (applied > 0) {
        console.log(`Synced ${applied} dispatched order(s) to sales_data in Supabase`);
        try {
          const salesData = await getAllSalesData();
          if (Array.isArray(salesData)) {
            setAllSalesData(
              salesData.map((record) => {
                const invoiceRaw = record.invoiceDate ?? record.invoice_date ?? Date.now();
                const invoiceDate =
                  invoiceRaw instanceof Date ? invoiceRaw : new Date(invoiceRaw);
                return {
                  ...record,
                  distributorCode:
                    record.distributorCode ?? record.distributor_code ?? record.code ?? null,
                  csdPC: Number(record.csdPC ?? record.csd_pc ?? 0) || 0,
                  csdUC: Number(record.csdUC ?? record.csd_uc ?? 0) || 0,
                  waterPC: Number(record.waterPC ?? record.water_pc ?? 0) || 0,
                  waterUC: Number(record.waterUC ?? record.water_uc ?? 0) || 0,
                  source: record.source || "",
                  invoiceDate: Number.isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
                };
              })
            );
          }
        } catch (e) {
          console.warn("Could not refresh sales data after dispatch backfill:", e);
        }
      }
      if (errors > 0) {
        console.warn(`${errors} dispatched order(s) could not be synced to sales_data`);
      }
    });
  }, [isSupabaseConfigured, allOrders]);

  // Download Excel function
  const handleDownloadExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const filteredDistributors = selectedRegion === "All"
        ? filteredDistributorsFromPerformance
        : filteredDistributorsFromPerformance.filter(d => d.region === selectedRegion);
      
      // Calculate totals
      const totals = filteredDistributors.reduce((acc, d) => ({
        targetCSD_PC: acc.targetCSD_PC + (d.target?.CSD_PC || 0),
        targetCSD_UC: acc.targetCSD_UC + (d.target?.CSD_UC || 0),
        targetWater_PC: acc.targetWater_PC + (d.target?.Water_PC || 0),
        targetWater_UC: acc.targetWater_UC + (d.target?.Water_UC || 0),
        achievedCSD_PC: acc.achievedCSD_PC + (d.achieved?.CSD_PC || 0),
        achievedCSD_UC: acc.achievedCSD_UC + (d.achieved?.CSD_UC || 0),
        achievedWater_PC: acc.achievedWater_PC + (d.achieved?.Water_PC || 0),
        achievedWater_UC: acc.achievedWater_UC + (d.achieved?.Water_UC || 0),
        balanceCSD_PC: acc.balanceCSD_PC + (d.balance?.CSD_PC || 0),
        balanceCSD_UC: acc.balanceCSD_UC + (d.balance?.CSD_UC || 0),
        balanceWater_PC: acc.balanceWater_PC + (d.balance?.Water_PC || 0),
        balanceWater_UC: acc.balanceWater_UC + (d.balance?.Water_UC || 0),
      }), {
        targetCSD_PC: 0, targetCSD_UC: 0, targetWater_PC: 0, targetWater_UC: 0,
        achievedCSD_PC: 0, achievedCSD_UC: 0, achievedWater_PC: 0, achievedWater_UC: 0,
        balanceCSD_PC: 0, balanceCSD_UC: 0, balanceWater_PC: 0, balanceWater_UC: 0,
      });

      // Prepare data for Excel
      const excelData = [
        // Headers
        ["Distributor", "Target CSD PC", "Target CSD UC", "Target Water PC", "Target Water UC", 
         "Achieved CSD PC", "Achieved CSD UC", "Achieved Water PC", "Achieved Water UC",
         "Balance CSD PC", "Balance CSD UC", "Balance Water PC", "Balance Water UC"],
        // Data rows
        ...filteredDistributors.map(d => [
          d.name,
          Math.round(d.target?.CSD_PC || 0),
          Math.round(d.target?.CSD_UC || 0),
          Math.round(d.target?.Water_PC || 0),
          Math.round(d.target?.Water_UC || 0),
          Math.round(d.achieved?.CSD_PC || 0),
          Math.round(d.achieved?.CSD_UC || 0),
          Math.round(d.achieved?.Water_PC || 0),
          Math.round(d.achieved?.Water_UC || 0),
          Math.round(d.balance?.CSD_PC || 0),
          Math.round(d.balance?.CSD_UC || 0),
          Math.round(d.balance?.Water_PC || 0),
          Math.round(d.balance?.Water_UC || 0),
        ]),
        // Total row
        ["TOTAL", 
         Math.round(totals.targetCSD_PC), Math.round(totals.targetCSD_UC),
         Math.round(totals.targetWater_PC), Math.round(totals.targetWater_UC),
         Math.round(totals.achievedCSD_PC), Math.round(totals.achievedCSD_UC),
         Math.round(totals.achievedWater_PC), Math.round(totals.achievedWater_UC),
         Math.round(totals.balanceCSD_PC), Math.round(totals.balanceCSD_UC),
         Math.round(totals.balanceWater_PC), Math.round(totals.balanceWater_UC)]
      ];

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Performance summary");

      // Set column widths (aggregate sheet)
      ws["!cols"] = [
        { wch: 25 }, // Distributor
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }, // Target columns
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }, // Achieved columns
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 }, // Balance columns
      ];

      const exportCodes = new Set(
        filteredDistributors.map((d) => String(d.code ?? "").trim()).filter(Boolean)
      );
      const skuDetailRows = buildDistributorPerformanceSkuDetailRows(
        allSalesData,
        distributors,
        exportCodes,
        productRates
      );
      const wsSku = XLSX.utils.json_to_sheet(skuDetailRows);
      wsSku["!cols"] = [
        { wch: 28 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 36 },
        { wch: 14 },
        { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsSku, "SKU sale details");

      const regionSuffix = selectedRegion !== "All" ? `_${selectedRegion}` : "";
      const filename = `Distributor_Performance${regionSuffix}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      alert(`Excel file downloaded successfully as "${filename}" (summary + SKU sale details).`);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      alert("Failed to download Excel file. Please try again.");
    }
  };

  // Download PDF function
  const handleDownloadPDF = async () => {
    const tableEl = tableRef.current;
    const paperEl = performancePaperRef.current;
    if (!tableEl) {
      alert("Table not found. Please try again.");
      return;
    }

    const originalTable = {
      maxHeight: tableEl.style.maxHeight,
      overflow: tableEl.style.overflow,
      height: tableEl.style.height,
    };
    const originalPaper = paperEl
      ? { overflow: paperEl.style.overflow }
      : null;

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      alert("Generating PDF... Please wait.");

      // Beat MUI sx + parent Paper overflow:hidden (both clip html2canvas to the viewport)
      tableEl.style.setProperty("max-height", "none", "important");
      tableEl.style.setProperty("overflow", "visible", "important");
      tableEl.style.setProperty("height", "auto", "important");
      if (paperEl) {
        paperEl.style.setProperty("overflow", "visible", "important");
      }
      tableEl.scrollTop = 0;
      tableEl.scrollLeft = 0;

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      await new Promise((resolve) => setTimeout(resolve, 150));

      const innerTable = tableEl.querySelector("table");
      // html2canvas uses the element's layout box; wide tables with horizontal scroll get clipped unless
      // the container is expanded to the full table scroll width before capture.
      const measureFullWidth = () =>
        Math.ceil(
          Math.max(
            tableEl.scrollWidth,
            tableEl.clientWidth,
            innerTable?.scrollWidth ?? 0,
            innerTable?.offsetWidth ?? 0,
            1
          )
        );

      let captureWidth = measureFullWidth();
      tableEl.style.setProperty("width", `${captureWidth}px`, "important");
      tableEl.style.setProperty("min-width", `${captureWidth}px`, "important");
      tableEl.style.setProperty("max-width", "none", "important");
      if (innerTable) {
        innerTable.style.width = `${captureWidth}px`;
        innerTable.style.minWidth = `${captureWidth}px`;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 80));
      const w2 = measureFullWidth();
      if (w2 > captureWidth) {
        captureWidth = w2;
        tableEl.style.setProperty("width", `${captureWidth}px`, "important");
        tableEl.style.setProperty("min-width", `${captureWidth}px`, "important");
        if (innerTable) {
          innerTable.style.width = `${captureWidth}px`;
          innerTable.style.minWidth = `${captureWidth}px`;
        }
      }

      const sh = Math.max(
        tableEl.scrollHeight,
        tableEl.clientHeight,
        innerTable?.scrollHeight ?? 0,
        innerTable?.offsetHeight ?? 0
      );
      const maxCanvasSide = 8192;
      const scale = Math.min(1.5, maxCanvasSide / Math.max(captureWidth, sh, 1));

      const canvas = await html2canvas(tableEl, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        // Do not pass width/height — underestimated height clips the bottom; let html2canvas size to content.
        scrollX: 0,
        scrollY: 0,
        allowTaint: true,
        removeContainer: false,
        onclone: (_doc, cloned) => {
          cloned.style.setProperty("max-height", "none", "important");
          cloned.style.setProperty("overflow", "visible", "important");
          cloned.style.setProperty("height", "auto", "important");
          cloned.style.setProperty("width", `${captureWidth}px`, "important");
          cloned.style.setProperty("min-width", `${captureWidth}px`, "important");
          cloned.style.setProperty("max-width", "none", "important");
          const cTable = cloned.querySelector("table");
          if (cTable) {
            cTable.style.width = `${captureWidth}px`;
            cTable.style.minWidth = `${captureWidth}px`;
          }
          let p = cloned.parentElement;
          while (p && p !== cloned.ownerDocument?.body) {
            p.style.setProperty("overflow", "visible", "important");
            p.style.setProperty("max-height", "none", "important");
            p = p.parentElement;
          }
          // Negative row margins + html2canvas often draw a phantom hairline (e.g. under Achieved Water UC).
          cloned.querySelectorAll("thead tr").forEach((tr) => {
            tr.style.setProperty("margin", "0", "important");
          });
          cloned.querySelectorAll("th, td").forEach((cell) => {
            const win = cloned.ownerDocument.defaultView;
            if (!win) return;
            if (win.getComputedStyle(cell).position === "sticky") {
              cell.style.setProperty("position", "relative", "important");
              cell.style.setProperty("top", "auto", "important");
              cell.style.setProperty("left", "auto", "important");
              cell.style.setProperty("z-index", "auto", "important");
            }
          });
        },
      });

      const imgData = canvas.toDataURL("image/png", 1.0);

      // Force landscape using positional constructor (most reliable across jsPDF versions)
      const pdf = new jsPDF("l", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth(); // ~297 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // ~210 mm
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const margin = 8; // slightly tighter horizontal margins so wide tables (incl. Balance) fit A4 landscape
      const availableWidth = pdfWidth - margin * 2;

      // mm per canvas pixel — scale to full page width, paginate vertically (do not shrink whole table to one page).
      const ratio = availableWidth / imgWidth;
      const imgScaledWidth = availableWidth;
      const imgScaledHeight = imgHeight * ratio;

      // Add title
      pdf.setFontSize(16);
      pdf.text("Distributor Performance Report", pdfWidth / 2, 12, { align: "center" });

      // Add date and region filter info
      pdf.setFontSize(10);
      const dateStr = new Date().toLocaleDateString();
      const regionStr = selectedRegion !== "All" ? `Region: ${selectedRegion}` : "All Regions";
      pdf.text(`Generated: ${dateStr} | ${regionStr}`, pdfWidth / 2, 18, { align: "center" });

      const startX = (pdfWidth - imgScaledWidth) / 2;
      const startY = 25;
      const firstPageMaxH = pdfHeight - startY - margin;
      const nextPageMaxH = pdfHeight - 2 * margin;

      if (imgScaledHeight <= firstPageMaxH) {
        pdf.addImage(imgData, "PNG", startX, startY, imgScaledWidth, imgScaledHeight);
      } else {
        let yPosition = startY;
        let sourceY = 0;
        let firstSlice = true;

        while (sourceY < imgHeight - 0.25) {
          const pageMaxH = firstSlice ? firstPageMaxH : nextPageMaxH;
          const remainingPx = imgHeight - sourceY;
          const remainingMm = remainingPx * ratio;
          const heightToShowMm = Math.min(remainingMm, pageMaxH);
          let sourceHeightPx = heightToShowMm / ratio;
          if (sourceHeightPx > remainingPx) sourceHeightPx = remainingPx;
          if (sourceHeightPx < 1 && remainingPx > 0) sourceHeightPx = Math.min(remainingPx, 1);

          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = imgWidth;
          pageCanvas.height = Math.max(1, Math.ceil(sourceHeightPx));
          const ctx = pageCanvas.getContext("2d");
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeightPx, 0, 0, imgWidth, sourceHeightPx);

          const pageImgData = pageCanvas.toDataURL("image/png", 1.0);
          pdf.addImage(pageImgData, "PNG", startX, yPosition, imgScaledWidth, heightToShowMm);

          sourceY += sourceHeightPx;
          firstSlice = false;

          if (sourceY < imgHeight - 0.25) {
            pdf.addPage("a4", "landscape");
            yPosition = margin;
          }
        }
      }

      const regionSuffix = selectedRegion !== "All" ? `_${selectedRegion}` : "";
      const filename = `Distributor_Performance${regionSuffix}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);

      alert(`PDF file downloaded successfully as "${filename}"`);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download PDF file. Please try again.");
    } finally {
      tableEl.style.removeProperty("max-height");
      tableEl.style.removeProperty("overflow");
      tableEl.style.removeProperty("height");
      tableEl.style.removeProperty("width");
      tableEl.style.removeProperty("min-width");
      tableEl.style.removeProperty("max-width");
      if (originalTable.maxHeight) tableEl.style.maxHeight = originalTable.maxHeight;
      if (originalTable.overflow) tableEl.style.overflow = originalTable.overflow;
      if (originalTable.height) tableEl.style.height = originalTable.height;
      const innerForRestore = tableEl.querySelector("table");
      if (innerForRestore) {
        innerForRestore.style.removeProperty("width");
        innerForRestore.style.removeProperty("min-width");
      }
      if (paperEl && originalPaper) {
        paperEl.style.removeProperty("overflow");
        if (originalPaper.overflow) paperEl.style.overflow = originalPaper.overflow;
      }
    }
  };

  // Delete all achieved values and sales data from app and Supabase
  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to DELETE ALL achieved data?\n\n" +
      "This will:\n" +
      "- Reset all achieved values to 0 for every distributor\n" +
      "- Delete all dispatch achievement records from Supabase\n" +
      "- Clear local sales data cache\n\n" +
      "Targets and distributor info will be kept.\n\n" +
      "This action cannot be undone!"
    );
    if (!confirmed) return;

    setDeletingAll(true);
    try {
      // Pause realtime distributor sync while bulk reset runs.
      isApplyingAchievementsRef.current = true;

      // 1. Reset achieved values to zero for every distributor in Supabase
      const zeroAchieved = { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 };
      const nowIso = new Date().toISOString();
      const distributorCodes = Array.from(
        new Set(distributors.map((d) => d?.code).filter(Boolean))
      );
      const resetFailures = [];

      if (isSupabaseConfigured && supabase) {
        const updatePromises = distributorCodes.map(async (code) => {
          try {
            await updateDistributor(code, { achieved: zeroAchieved });
          } catch (err) {
            resetFailures.push(code);
            console.error(`Failed to reset achieved for ${code}:`, err);
          }
        });

        await Promise.all(updatePromises);
      } else {
        // Local mode fallback
        const updatePromises = distributors.map((d) => {
          if (!d.code) return Promise.resolve();
          return updateDistributor(d.code, { achieved: zeroAchieved }).catch((err) => {
            resetFailures.push(d.code);
            console.error(`Failed to reset achieved for ${d.code}:`, err);
          });
        });
        await Promise.allSettled(updatePromises);
      }
      console.log("✅ Reset achieved values for all distributors in Supabase/local");

      // 2. Delete all delivery achievement rows from Supabase sales_data
      try {
        await deleteAllSalesDataFromAdmin();
        console.log("✅ Deleted all sales_data rows from Supabase");
      } catch (err) {
        console.error("Error deleting sales_data:", err);
      }

      // 3. Update local state
      const cleaned = distributors.map((d) => {
        const balance = {
          CSD_PC: d.target?.CSD_PC || 0,
          CSD_UC: d.target?.CSD_UC || 0,
          Water_PC: d.target?.Water_PC || 0,
          Water_UC: d.target?.Water_UC || 0,
        };
        return { ...d, achieved: { ...zeroAchieved }, balance };
      });
      setDistributors(cleaned);
      setAllSalesData([]);

      // 4. Clear localStorage sales cache; block dispatch backfill from restoring old lifts
      removeTenantJson(SALES_DATA_STORAGE_KEY);
      writeTenantJson(SKIP_DISPATCH_BACKFILL_KEY, { clearedAt: nowIso });
      salesBackfillRanRef.current = true;

      // 5. Save cleaned distributors to localStorage
      saveDistributors(cleaned.map(({ balance, ...rest }) => rest));
      prevDistributorsRef.current = cleaned.map(({ balance, ...rest }) => rest);

      // 5b. Re-fetch distributors from Supabase so state matches DB (stops realtime from restoring old achieved)
      if (isSupabaseConfigured) {
        try {
          const freshList = await getAllDistributors();
          const targetsMap = await getAllTargets().catch(() => ({}));
          if (Array.isArray(freshList) && freshList.length > 0) {
            const withTargets = freshList.map((d) => {
              const targetFromCollection = targetsMap[d.code];
              if (targetFromCollection) {
                return {
                  ...d,
                  target: buildNormalizedTarget(targetFromCollection),
                };
              }
              return d;
            });
            const augmentedFresh = augment(withTargets);
            setDistributors(augmentedFresh);
            saveDistributors(augmentedFresh.map(({ balance, ...rest }) => rest));
            prevDistributorsRef.current = augmentedFresh.map(({ balance, ...rest }) => rest);
            console.log("✅ Re-synced distributors from Supabase after delete-all");
          }
        } catch (refetchErr) {
          console.warn("Could not re-fetch distributors after delete-all:", refetchErr);
        }
      }

      // 6. Log activity
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.SALES_DATA_UPDATED,
        "Deleted all achieved values and sales data",
        {
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split("@")[0] || "Admin",
        }
      );

      if (resetFailures.length > 0) {
        const uniqueFailures = Array.from(new Set(resetFailures));
        showEmailToast(
          `The performance table and local data are cleared, but these distributor codes could not be fully reset in the database: ${uniqueFailures.join(", ")}.\n\nTry Delete all data again, or fix the issue in Supabase and refresh the page.`,
          "warning",
          16000,
          "Delete finished with warnings"
        );
      } else {
        showEmailToast(
          "Every distributor’s achieved values are set back to zero and dispatch achievement records are removed from the database (and this browser’s cache). Targets are unchanged.",
          "success",
          9000,
          "Achievement data cleared"
        );
      }
    } catch (error) {
      console.error("Error deleting all data:", error);
      showEmailToast(
        error?.message || "Something went wrong while clearing data. Nothing may have been deleted — refresh and try again.",
        "error",
        8000,
        "Could not delete data"
      );
    } finally {
      isApplyingAchievementsRef.current = false;
      setDeletingAll(false);
    }
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const setAdminCurrentView = (view) => {
    try {
      localStorage.setItem(ADMIN_VIEW_STORAGE_KEY, view);
    } catch (error) {
      console.warn("Could not persist admin current view:", error);
    }
  };

  useEffect(() => {
    try {
      const savedView = localStorage.getItem(ADMIN_VIEW_STORAGE_KEY);
      if (!savedView) return;

      if (savedView === "orders") setShowOrders(true);
      if (savedView === "calculator") setShowCalculator(true);
      if (savedView === "targets") setTargetsOpen(true);
      if (savedView === "scheme_discount") setSchemeDiscountOpen(true);
      if (savedView === "rate_master") setRateMasterOpen(true);
      if (savedView === "physical_stock") setPhysicalStockAdminOpen(true);
      if (savedView === "stock_lifting_records") setStockLiftingRecordsOpen(true);
      if (savedView === "distributors") setDistributorsOpen(true);
      if (savedView === "reports") setReportsOpen(true);
      if (savedView === "activity") setActivityOpen(true);
      if (savedView === "gmail_settings") setGmailSettingsOpen(true);
      if (savedView === "gst_settings") setGstSettingsOpen(true);
      if (savedView === "user_permissions") setUserManagementOpen(true);
    } catch (error) {
      console.warn("Could not restore admin current view:", error);
    }
  }, []);

  /** Achieved per distributor for the viewed target period; late dispatches roll to next period. */
  const achievedByDistributorCode = useMemo(() => {
    if (!isSupabaseConfigured || !salesDataHydrated) return null;
    return buildPerformanceAchievedByDistributor(allSalesData, allOrders, {
      viewPeriod: targetPeriod,
    });
  }, [isSupabaseConfigured, salesDataHydrated, allSalesData, allOrders, targetPeriod]);

  const performanceDistributors = useMemo(() => {
    const toNumber = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };
    const useDispatchAchieved = Boolean(achievedByDistributorCode);

    return distributors.map((d) => {
      const code = String(d.code || "").trim();
      const achieved = useDispatchAchieved
        ? normalizeAchievedShape(achievedByDistributorCode.get(code) || EMPTY_ACHIEVED)
        : normalizeAchievedShape(d.achieved);

      const target = {
        CSD_PC: toNumber(d.target?.CSD_PC),
        CSD_UC: toNumber(d.target?.CSD_UC),
        Water_PC: toNumber(d.target?.Water_PC),
        Water_UC: toNumber(d.target?.Water_UC),
      };
      return {
        ...d,
        achieved,
        balance: {
          CSD_PC: target.CSD_PC - achieved.CSD_PC,
          CSD_UC: target.CSD_UC - achieved.CSD_UC,
          Water_PC: target.Water_PC - achieved.Water_PC,
          Water_UC: target.Water_UC - achieved.Water_UC,
        },
      };
    });
  }, [distributors, achievedByDistributorCode]);

  const filteredDistributorsFromPerformance = useMemo(() => {
    const map = { South: "Southern", West: "Western", East: "Eastern", PLING: "PLING", THIM: "THIM" };
    const regionKey = (selectedRegion === "All") ? null : (map[selectedRegion] || selectedRegion);
    if (!regionKey) return performanceDistributors.slice();
    const normKey = normalize(regionKey);
    return performanceDistributors.filter(d => normalize(d.region) === normKey);
  }, [selectedRegion, performanceDistributors]);

  // Calculate balance from distributor targets and achieved values (for Target Balance card)
  const calculateBalanceFromDistributors = useMemo(() => {
    // Use filtered distributors based on selected region
    // filteredDistributors is defined above in the component
    
    // Sum up all targets and achieved values
    let totalTargetCSD_PC = 0, totalTargetCSD_UC = 0, totalTargetWater_PC = 0, totalTargetWater_UC = 0;
    let totalAchievedCSD_PC = 0, totalAchievedCSD_UC = 0, totalAchievedWater_PC = 0, totalAchievedWater_UC = 0;
    
    filteredDistributorsFromPerformance.forEach(d => {
      // Sum targets
      totalTargetCSD_PC += Number(d.target?.CSD_PC || 0);
      totalTargetCSD_UC += Number(d.target?.CSD_UC || 0);
      totalTargetWater_PC += Number(d.target?.Water_PC || 0);
      totalTargetWater_UC += Number(d.target?.Water_UC || 0);
      
      // Sum achieved
      totalAchievedCSD_PC += Number(d.achieved?.CSD_PC || 0);
      totalAchievedCSD_UC += Number(d.achieved?.CSD_UC || 0);
      totalAchievedWater_PC += Number(d.achieved?.Water_PC || 0);
      totalAchievedWater_UC += Number(d.achieved?.Water_UC || 0);
    });
    
    // Calculate balance (target - achieved)
    const targetUcAchieved = isCombinedTargetAchievedUC(
      totalTargetCSD_UC,
      totalAchievedCSD_UC,
      totalTargetWater_UC,
      totalAchievedWater_UC
    );
    return {
      csdPC: Math.round(totalTargetCSD_PC - totalAchievedCSD_PC),
      csdUC: Math.round(totalTargetCSD_UC - totalAchievedCSD_UC),
      waterPC: Math.round(totalTargetWater_PC - totalAchievedWater_PC),
      waterUC: Math.round(totalTargetWater_UC - totalAchievedWater_UC),
      csdAchievedPC: Math.round(totalAchievedCSD_PC),
      csdAchievedUC: Math.round(totalAchievedCSD_UC),
      waterAchievedPC: Math.round(totalAchievedWater_PC),
      waterAchievedUC: Math.round(totalAchievedWater_UC),
      targetUcAchieved,
    };
  }, [filteredDistributorsFromPerformance]);

  // Add/update/delete handlers (same as before)
  // Track if we're in bulk upload mode to suppress individual alerts
  const handleAddDistributor = async (payload, suppressAlert = false) => {
    // Allow all admins and viewers to add distributors
    
    // Add distributor locally (saved to Firestore/localStorage by effect)
    try {
      console.log("Adding distributor with payload:", payload);
      
      // Validate payload
      if (!payload || !payload.code || !payload.name) {
        console.error("❌ Invalid payload received:", {
          hasPayload: !!payload,
          hasCode: !!payload?.code,
          hasName: !!payload?.name,
          code: payload?.code,
          name: payload?.name,
          fullPayload: payload
        });
        if (!suppressAlert) {
          alert("Error: Invalid distributor data. Missing code or name.");
        }
        return;
      }
      
      // Debug: Log the payload being saved
      console.log(`💾 Saving distributor:`, {
        name: payload.name,
        code: payload.code,
        username: payload.credentials?.username,
        hasCode: !!payload.code,
        codeValue: payload.code
      });
      
      // Check if distributor already exists
      const exists = distributors.find(d => d.code === payload.code || d.name === payload.name);
      if (exists) {
        if (!suppressAlert) {
          alert(`Error: Distributor with code "${payload.code}" or name "${payload.name}" already exists.`);
        }
        return;
      }
      
      let firestoreSuccess = false;
      let firebaseError = null;
      
      if (isSupabaseConfigured) {
        // Save to Supabase database
        try {
          console.log(`💾 Attempting to save distributor to Supabase: ${payload.name} (Code: ${payload.code})`);
          const savedDistributor = await saveDistributor(payload);
          console.log("✅ Distributor saved to Supabase successfully:", savedDistributor?.code || payload.code);
          firestoreSuccess = true;
        } catch (error) {
          firebaseError = error;
          const errorMsg = serializeError(error);
          console.error("❌ Error saving distributor to Supabase:", {
            distributor: payload.name,
            code: payload.code,
            error: errorMsg
          });
          // During bulk upload, we want to track Supabase failures separately
          // Re-throw the error so bulk upload can mark it as failed
          // For single adds (suppressAlert=false), show alert but continue with local save
          if (suppressAlert) {
            // During bulk upload, throw error to mark as failed
            throw new Error(`Failed to save to Supabase: ${errorMsg}`);
          } else {
            // Enforce cloud sync when Supabase is configured.
            alert(`Failed to save distributor to Supabase. No local change was made.\n\n${errorMsg}`);
            return;
          }
        }
      }
      
      // Add to local state (this will trigger the useEffect to save to localStorage)
      // CRITICAL: Ensure code is preserved in payload
      const payloadWithCode = {
        ...payload,
        code: payload.code || payload.code, // Explicitly ensure code is present
      };
      
      // Validate code is present before adding
      if (!payloadWithCode.code) {
        console.error("❌ CRITICAL: Payload missing code before adding to state!", payload);
        if (!suppressAlert) {
          alert("Error: Code is missing from distributor data. Cannot save distributor.");
        }
        return;
      }
      
      setDistributors(prev => {
        const updated = [...prev, payloadWithCode];
        console.log(`✅ Added distributor to state: ${payloadWithCode.name} (Code: ${payloadWithCode.code})`);
        console.log("Updated distributors list:", updated.length);
        
        // ALWAYS update localStorage immediately to keep it in sync (even if using Supabase)
        // This ensures the distributor is saved locally even if Supabase save failed
        try {
          const toSave = updated.map(({ balance, ...rest }) => rest);
          saveDistributors(toSave);
          console.log(`✅ Saved distributor to localStorage: ${payloadWithCode.name} (${payloadWithCode.code})`);
        } catch (localStorageError) {
          console.error("Error saving to localStorage:", localStorageError);
          // Don't throw - continue with state update
        }
        
        // Track this as a newly added distributor to prevent subscription from removing it
        newlyAddedDistributorCodesRef.current.add(payloadWithCode.code);
        
        // Clean up the tracking after 30 seconds (enough time for Supabase to sync)
        setTimeout(() => {
          newlyAddedDistributorCodesRef.current.delete(payloadWithCode.code);
          console.log(`🧹 Cleaned up newly added distributor code from tracking: ${payloadWithCode.code}`);
        }, 30 * 1000); // 30 seconds
        
        // Verify code is in the updated list
        const addedDist = updated.find(d => d.name === payloadWithCode.name);
        if (addedDist && !addedDist.code) {
          console.error("❌ CRITICAL: Code missing after adding to state!", addedDist);
        }
        return updated;
      });
      
      // Log activity
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.DISTRIBUTOR_ADDED,
        `Added distributor: ${payload.name} (${payload.code})`,
        {
          distributorName: payload.name,
          distributorCode: payload.code,
          region: payload.region,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split('@')[0] || 'Admin',
        }
      );
      
      // Show appropriate success message only if not suppressed (bulk upload suppresses these)
      if (!suppressAlert) {
        if (firestoreSuccess) {
          alert("✅ Distributor registered successfully and saved to cloud!");
        } else if (isSupabaseConfigured && firebaseError) {
          alert("⚠️ Distributor saved locally only.\n\nCloud sync failed due to Firestore security rules.\n\nPlease update Firestore security rules to enable cloud sync.\n\nCheck browser console (F12) for details.");
        } else {
      alert("Distributor registered successfully!");
        }
      }
    } catch (error) {
      console.error("Error adding distributor:", error);
      if (!suppressAlert) {
      alert("Failed to register distributor: " + (error?.message || error));
      }
    }
  };

  const handleUpdateDistributor = async (codeOrName, updates) => {
    try {
      const distributor = distributors.find(d => d.code === codeOrName || d.name === codeOrName);
      if (!distributor) {
        alert("Error: Distributor not found");
        return;
      }
      
      const merged = { ...distributor, ...updates };
      merged.target = { ...(distributor.target||{}), ...(updates.target||{}) };
      merged.achieved = { ...(distributor.achieved||{}), ...(updates.achieved||{}) };
      // Handle credentials update - merge with existing if password not changed
      if (updates.credentials) {
        if (updates.credentials.passwordHash) {
          // New password provided
          merged.credentials = updates.credentials;
        } else {
          // Only username changed, keep existing password hash
          merged.credentials = {
            ...(distributor.credentials || {}),
            username: updates.credentials.username
          };
        }
      }
        const balance = {
          CSD_PC: (merged.target?.CSD_PC||0) - (merged.achieved?.CSD_PC||0),
          CSD_UC: (merged.target?.CSD_UC||0) - (merged.achieved?.CSD_UC||0),
          Water_PC: (merged.target?.Water_PC||0) - (merged.achieved?.Water_PC||0),
          Water_UC: (merged.target?.Water_UC||0) - (merged.achieved?.Water_UC||0),
        };
      const updated = { ...merged, balance };
      
      // Enforce cloud sync first when Supabase is configured.
      if (isSupabaseConfigured) {
        try {
          // Update in Supabase (remove balance before saving)
          const { balance: _, ...toSave } = updated;
          await updateDistributor(distributor.code, toSave);
          console.log("Distributor updated in Supabase successfully");
        } catch (supabaseError) {
          console.error("Error updating in Supabase:", supabaseError);
          alert(`Failed to update distributor in Supabase. No local change was made.\n\n${supabaseError?.message || supabaseError}`);
          return;
        }
      }

      // Update local state after successful cloud sync (or local-only mode)
      setDistributors(prev => prev.map(d => {
        if (d.code === codeOrName || d.name === codeOrName) {
          return updated;
        }
        return d;
      }));

      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.DISTRIBUTOR_UPDATED,
        `Distributor updated: ${updated.name || updated.code} (${updated.code})`,
        {
          distributorName: updated.name,
          distributorCode: updated.code,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split("@")[0] || "Admin",
        }
      );
      
      alert("Distributor updated successfully!");
    } catch (error) {
      console.error("Error updating distributor:", error);
      alert("Failed to update distributor: " + (error?.message || error));
    }
  };

  const handleDeleteDistributor = async (codeOrName, options = {}) => {
    const { suppressNotification = false } = options;
    // Check delete permission
    if (!userPermissions?.delete) {
      if (!suppressNotification) {
        alert("You don't have permission to delete distributors. Only admins can delete distributors.");
      }
      return;
    }
    
    try {
      if (!codeOrName) {
        if (!suppressNotification) {
          alert("Error: Cannot delete distributor - missing code or name");
        }
        return;
      }
      
      const distributor = distributors.find(d => d.code === codeOrName || d.name === codeOrName);
      if (!distributor) {
        if (!suppressNotification) {
          alert(`Error: Distributor with code/name "${codeOrName}" not found`);
        }
        return;
      }
      
      // Log activity before deletion
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.DISTRIBUTOR_DELETED,
        `Deleted distributor: ${distributor.name} (${distributor.code})`,
        {
          distributorName: distributor.name,
          distributorCode: distributor.code,
          region: distributor.region,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split('@')[0] || 'Admin',
        }
      );
      
      // Track this distributor code as deleted to prevent subscription from re-adding it
      deletedDistributorCodesRef.current.add(distributor.code);
      
      if (isSupabaseConfigured) {
        // Delete from Supabase first (required for consistency)
        try {
          const deletedCount = await deleteDistributor(distributor.code);
          console.log(`✅ Deleted ${deletedCount} distributor row(s) "${distributor.name}" (${distributor.code}) from Supabase`);

          if (deletedCount === 0) {
            alert(`Distributor was not deleted in Supabase (0 rows affected). No local delete was performed.`);
            return;
          } else if (deletedCount > 1) {
            console.warn(`⚠️ Deleted ${deletedCount} rows with code "${distributor.code}". This indicates duplicate entries in the database.`);
          }
        } catch (supabaseError) {
          console.error("Error deleting from Supabase:", supabaseError);
          alert(`Failed to delete distributor from Supabase. No local delete was performed.\n\n${supabaseError?.message || supabaseError}`);
          return;
        }
      }
      
      // Remove from local state using functional update so multiple deletions work correctly
      setDistributors(prevDistributors => {
        const updatedDistributors = prevDistributors.filter(
          d => !(d.code === codeOrName || d.name === codeOrName)
        );
        // ALWAYS update localStorage to keep it in sync (even if using Supabase)
        // This prevents deleted distributors from reappearing on refresh
        saveDistributors(updatedDistributors);
        console.log(`✅ Removed distributor from localStorage. ${updatedDistributors.length} distributors remaining.`);
        return updatedDistributors;
      });
      
      // Clean up deleted codes after a delay (5 minutes) to allow for eventual consistency
      setTimeout(() => {
        deletedDistributorCodesRef.current.delete(distributor.code);
        console.log(`🧹 Cleaned up deleted distributor code from tracking: ${distributor.code}`);
      }, 5 * 60 * 1000); // 5 minutes
      
      if (!suppressNotification) {
        alert(`Distributor "${distributor.name}" deleted successfully`);
      }
    } catch (error) {
      console.error("Error deleting distributor:", error);
      if (!suppressNotification) {
        alert("Failed to delete distributor: " + (error?.message || error));
      }
    }
  };

  // Handler for applying targets from TargetsDialog
  const handleDeleteTargets = async (selectedDistributors = []) => {
    const selected = (selectedDistributors || []).filter((d) => d?.code || d?.name);
    if (selected.length === 0) return;

    const selectedCodes = selected.map((d) => d.code).filter(Boolean);
    const selectedNames = selected.map((d) => d.name).filter(Boolean);

    if (isSupabaseConfigured && selectedCodes.length > 0) {
      try {
        await deleteTargetsBatch(selectedCodes);
        const syncUpdates = selectedCodes.map((code) =>
          updateDistributor(code, { target: { ...EMPTY_TARGET } }).catch((err) => {
            throw new Error(`Could not sync distributor target reset for ${code}: ${err?.message || err}`);
          })
        );
        await Promise.all(syncUpdates);
      } catch (error) {
        console.error("Failed to delete targets from Supabase:", error);
        alert(`Failed to delete targets in Supabase. No local target changes were made.\n\n${error.message}`);
        return;
      }
    }

    setDistributors((prev) => {
      const updated = prev.map((d) => {
        const matched = selected.some(
          (s) => (s.code && d.code === s.code) || (s.name && d.name === s.name)
        );
        if (!matched) return d;

        const target = { ...EMPTY_TARGET };
        const achieved = d.achieved || {};
        const balance = {
          CSD_PC: Number(target.CSD_PC) - Number(achieved.CSD_PC || 0),
          CSD_UC: Number(target.CSD_UC) - Number(achieved.CSD_UC || 0),
          Water_PC: Number(target.Water_PC) - Number(achieved.Water_PC || 0),
          Water_UC: Number(target.Water_UC) - Number(achieved.Water_UC || 0),
        };
        return { ...d, target, balance };
      });

      try {
        const toSave = updated.map(({ balance, ...rest }) => rest);
        saveDistributors(toSave);
      } catch (storageError) {
        console.warn("Could not sync localStorage after target delete:", storageError);
      }
      return updated;
    });

    // Clear target cache entries from localStorage map.
    try {
      const storedTargets = localStorage.getItem("targets");
      if (storedTargets) {
        const targetMap = JSON.parse(storedTargets);
        selectedCodes.forEach((code) => delete targetMap[code]);
        localStorage.setItem("targets", JSON.stringify(targetMap));
      }
    } catch (cacheError) {
      console.warn("Could not update targets cache in localStorage:", cacheError);
    }

    alert(`Deleted targets for ${selected.length} distributor(s): ${selectedNames.join(", ")}`);
  };

  // Handler for applying targets from TargetsDialog
  const handleApplyTargets = async (updatesByName) => {
    // Allow all admins and viewers to update targets
    
    // Log activity
    const currentUser = await getCurrentUser();
    const updatedCount = Object.keys(updatesByName).length;
    logActivity(
      ACTIVITY_TYPES.TARGET_UPDATED,
      `Updated targets for ${updatedCount} distributor(s)`,
      {
        distributorCount: updatedCount,
        distributors: Object.keys(updatesByName),
        userEmail: currentUser?.email,
        userName: currentUser?.email?.split('@')[0] || 'Admin',
      }
    );
    
    // Prepare targets map for Supabase targets table.
    const targetsMap = {};
    Object.entries(updatesByName).forEach(([distributorNameKey, updates]) => {
      const matchedDistributor = distributors.find((d) => d.name === distributorNameKey);
      if (!matchedDistributor?.code) return;
      targetsMap[matchedDistributor.code] = {
        CSD_PC: Number(updates?.CSD_PC || 0),
        CSD_UC: Number(updates?.CSD_UC || 0),
        Water_PC: Number(updates?.Water_PC || 0),
        Water_UC: Number(updates?.Water_UC || 0),
      };
    });

    // Enforce cloud sync first when Supabase is configured.
    if (isSupabaseConfigured && Object.keys(targetsMap).length > 0) {
      try {
        console.log(`💾 Saving ${Object.keys(targetsMap).length} targets to Supabase targets collection...`);
        await saveTargetsBatch(targetsMap);

        const updatePromises = Object.entries(targetsMap).map(([distributorCode, targetData]) =>
          updateDistributor(distributorCode, { target: targetData })
        );
        await Promise.all(updatePromises);
        console.log("✅ Targets synced to Supabase successfully");
      } catch (error) {
        console.error("❌ Error saving targets to Supabase:", error);
        alert(`Failed to save targets to Supabase. No local target changes were made.\n\n${error.message}`);
        return;
      }
    }
    
    setDistributors(prev => prev.map(d => {
      const updates = updatesByName[d.name];
      if (updates) {
        const targetData = {
          CSD_PC: Number(updates.CSD_PC || 0),
          CSD_UC: Number(updates.CSD_UC || 0),
          Water_PC: Number(updates.Water_PC || 0),
          Water_UC: Number(updates.Water_UC || 0),
        };
        
        const updated = {
          ...d,
          target: targetData,
        };
        const balance = {
          CSD_PC: (updated.target?.CSD_PC||0) - (updated.achieved?.CSD_PC||0),
          CSD_UC: (updated.target?.CSD_UC||0) - (updated.achieved?.CSD_UC||0),
          Water_PC: (updated.target?.Water_PC||0) - (updated.achieved?.Water_PC||0),
          Water_UC: (updated.target?.Water_UC||0) - (updated.achieved?.Water_UC||0),
        };
        
        return { ...updated, balance };
      }
      return d;
    }));
    
    alert("Targets updated successfully!");
  };

  // Get unique order ID
  const getOrderId = useCallback((order) => {
    // Prioritize order number for tracking (most reliable)
    if (order.orderNumber) {
      return `ORD-${order.orderNumber}`;
    }
    // Try to use Firebase document ID
    if (order.id) return order.id;
    // Fallback to timestamp + distributor code
    if (order.timestamp && order.distributorCode) {
      return `${order.timestamp}_${order.distributorCode}`;
    }
    // Last resort: use timestamp
    if (order.timestamp) return order.timestamp;
    // Final fallback
    return JSON.stringify(order);
  }, []);

  const getOrderNumberToken = (order) => {
    const raw = order?.orderNumber;
    if (raw == null || String(raw).trim() === "") return "";
    return String(raw).trim();
  };

  const replyMentionsOrderNumber = (reply, body, orderNumberToken) => {
    if (!orderNumberToken) return true;
    const subject = String(reply?.payload?.headers?.find((h) => String(h?.name || "").toLowerCase() === "subject")?.value || "");
    const haystack = `${subject}\n${String(body || "")}`.toLowerCase();
    const token = orderNumberToken.toLowerCase();
    return (
      haystack.includes(`#${token}`) ||
      haystack.includes(`order ${token}`) ||
      haystack.includes(`order#${token}`) ||
      haystack.includes(token)
    );
  };

  // Prefer status on the order row (Supabase refresh); cache is fallback only.
  const getOrderStatus = useCallback(
    (order) => resolveOrderStatus(order, orderStatuses, getOrderId(order)),
    [orderStatuses, getOrderId]
  );

  // Sync localStorage status cache when orders refresh (e.g. shipping marks delivered).
  useEffect(() => {
    if (!Array.isArray(allOrders) || allOrders.length === 0) return;
    const fromRows = buildOrderStatusMapFromOrders(allOrders, getOrderId);
    if (Object.keys(fromRows).length === 0) return;
    setOrderStatuses((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, st] of Object.entries(fromRows)) {
        if (next[id] !== st) {
          next[id] = st;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allOrders, getOrderId]);

  /** Orders awaiting admin review (sidebar badge). */
  const adminActionableOrdersCount = useMemo(() => {
    if (!Array.isArray(allOrders)) return 0;
    return allOrders.filter((order) => {
      const s = getOrderStatus(order);
      return (
        s === ORDER_STATUS.PENDING ||
        s === ORDER_STATUS.SENT ||
        s === ORDER_STATUS.PENDING_EMAIL_FAILED
      );
    }).length;
  }, [allOrders, getOrderStatus]);

  useEffect(() => {
    if (!Array.isArray(distributors) || distributors.length === 0) return;
    ensureAdminPhysicalStockBaseline(distributors);
  }, [distributors]);

  const pendingPhysicalStockUpdatesCount = useMemo(() => {
    void adminPhysicalStockBadgeTick;
    return countDistributorsWithNewPhysicalStock(distributors);
  }, [distributors, adminPhysicalStockBadgeTick]);

  const handlePhysicalStockAdminDialogOpened = useCallback(() => {
    markAdminPhysicalStockNotificationsSeen(distributors);
    setAdminPhysicalStockBadgeTick((t) => t + 1);
  }, [distributors]);

  const syncOrderStatusToSupabase = async (orderLikeOrKey, status, extraFields = {}) => {
    try {
      if (!isSupabaseConfigured) return;

      const resolvedOrder =
        typeof orderLikeOrKey === "object" && orderLikeOrKey
          ? orderLikeOrKey
          : allOrders.find((o) => getOrderId(o) === orderLikeOrKey);

      const statusFallback =
        resolvedOrder?.distributorCode &&
        resolvedOrder?.orderNumber != null &&
        String(resolvedOrder.orderNumber).trim() !== ""
          ? {
              distributorCode: String(resolvedOrder.distributorCode).trim(),
              orderNumber: resolvedOrder.orderNumber,
            }
          : null;

      if (!resolvedOrder?.id && !statusFallback) {
        console.warn("Skipping Supabase order status sync: missing order.id and distributorCode/orderNumber", {
          key: typeof orderLikeOrKey === "string" ? orderLikeOrKey : getOrderId(orderLikeOrKey || {}),
          status,
        });
        return;
      }

      await updateOrderStatusInSupabaseService(resolvedOrder.id, status, extraFields, statusFallback);
    } catch (syncError) {
      console.error("Failed to sync order status to Supabase:", syncError);
      showEmailToast(
        `Order status changed locally, but Supabase sync failed: ${syncError?.message || syncError}`,
        "warning",
        5200
      );
    }
  };

  const pushNotification = (message, type = "info") => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      type,
      timestamp: new Date().toLocaleString(),
    };
    setNotifications(prev => [entry, ...prev].slice(0, 50));
    setUnreadNotifications(prev => prev + 1);
  };

  /** Toast for admin actions (sales upload, delete, email). Optional short title for context. */
  const showEmailToast = (message, severity = "success", duration = 4500, title = "") => {
    setEmailToast({ open: true, message, severity, duration, title });
  };

  // New orders from distributors: SMS-style sound + toast + OS notification (detect by id, not only count)
  useEffect(() => {
    if (!Array.isArray(allOrders)) return;

    const idsNow = new Set(allOrders.map((o) => getOrderId(o)));

    if (!newOrderIdsNotifyInitRef.current) {
      previousOrderIdsRef.current = idsNow;
      newOrderIdsNotifyInitRef.current = true;
      return;
    }

    const prev = previousOrderIdsRef.current;
    const newlyAdded = allOrders.filter((o) => !prev.has(getOrderId(o)));

    if (newlyAdded.length > 0) {
      playNewOrderIncomingAlert();

      const lines = newlyAdded.slice(0, 3).map((o) => {
        const name = o.distributorName || o.distributorCode || "Distributor";
        const num = o.orderNumber != null ? `#${o.orderNumber}` : getOrderId(o);
        return `${name} — Order ${num}`;
      });
      const summary =
        newlyAdded.length === 1
          ? `New order: ${lines[0]}`
          : `${newlyAdded.length} new orders received`;

      pushNotification(
        newlyAdded.length === 1 ? summary : `${summary}. ${lines.join(" · ")}`,
        "info"
      );
      showEmailToast(
        newlyAdded.length === 1
          ? lines[0]
          : `${newlyAdded.length} new orders — open Orders to review.`,
        "info",
        7000,
        "New order"
      );

      (async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        try {
          const iconUrl = getTargetReminderNotificationIconUrl();
          const title = newlyAdded.length === 1 ? "New order" : `${newlyAdded.length} new orders`;
          const body =
            newlyAdded.length === 1
              ? lines[0]
              : `${lines.slice(0, 2).join(" · ")}${newlyAdded.length > 2 ? "…" : ""}`;
          if (Notification.permission === "granted") {
            new Notification(title, { body, icon: iconUrl, tag: "coke-new-order" });
          } else if (Notification.permission === "default") {
            const p = await Notification.requestPermission();
            if (p === "granted") {
              new Notification(title, { body, icon: iconUrl, tag: "coke-new-order" });
            }
          }
        } catch (e) {
          console.warn("New order browser notification failed:", e);
        }
      })();
    }

    previousOrderIdsRef.current = idsNow;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders]);

  // Combined UC target achieved (region totals): bell + toast + in-app + browser notification once per scope when crossing to achieved
  useEffect(() => {
    const achieved = calculateBalanceFromDistributors.targetUcAchieved === true;
    const scope = `${selectedRegion}|${targetPeriod?.end || ""}`;
    const r = adminUcAchievementNotifyRef.current;
    if (r.scope !== scope) {
      r.scope = scope;
      r.prevAchieved = achieved;
      return;
    }
    if (r.prevAchieved === false && achieved === true) {
      playTargetAchievedBell();
      const regionLabel = selectedRegion === "All" ? "all regions" : `region ${selectedRegion}`;
      const body = `CSD and Kinley water UC targets are met for ${regionLabel} for the current period (or CSD UC above target covers the Kinley water UC shortfall per policy).`;
      pushNotification(body, "success");
      showEmailToast(body, "success", 9500, "Target achieved");
      (async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        try {
          const iconUrl = getTargetReminderNotificationIconUrl();
          if (Notification.permission === "granted") {
            new Notification("Target achieved", { body, icon: iconUrl, tag: "coke-target-achieved-admin" });
          } else if (Notification.permission === "default") {
            const p = await Notification.requestPermission();
            if (p === "granted") {
              new Notification("Target achieved", { body, icon: iconUrl, tag: "coke-target-achieved-admin" });
            }
          }
        } catch (e) {
          console.warn("Target achieved browser notification failed:", e);
        }
      })();
    }
    r.prevAchieved = achieved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    calculateBalanceFromDistributors.targetUcAchieved,
    selectedRegion,
    targetPeriod?.end,
  ]);

  // Order status changes from Supabase refresh or local actions: notify + chime when an order becomes approved
  useEffect(() => {
    if (!Array.isArray(allOrders)) return;

    const next = {};
    allOrders.forEach((order) => {
      const id = getOrderId(order);
      next[id] = getOrderStatus(order);
    });

    const prev = approvalSnapshotRef.current;

    if (!approvalNotifyInitRef.current) {
      approvalNotifyInitRef.current = true;
      approvalSnapshotRef.current = next;
      return;
    }

    const ids = new Set([...Object.keys(prev), ...Object.keys(next)]);
    ids.forEach((id) => {
      const was = prev[id];
      const now = next[id];
      if (now === undefined) return;
      if (was === now) return;

      if (now === ORDER_STATUS.APPROVED && was !== ORDER_STATUS.APPROVED) {
        playOrderApprovedChime();
      }

      if (now === ORDER_STATUS.APPROVED && was !== ORDER_STATUS.APPROVED) {
        pushNotification(`Order ${id} approved.`, "success");
      } else if (now === ORDER_STATUS.DELIVERED && was !== ORDER_STATUS.DELIVERED) {
        pushNotification(`Order ${id} was dispatched from shipping.`, "success");
      } else if (now === ORDER_STATUS.REJECTED && was !== ORDER_STATUS.REJECTED) {
        pushNotification(`Order ${id} rejected.`, "error");
      } else if (was !== undefined) {
        pushNotification(`Order ${id} status changed to ${getOrderStatusLabel(now)}.`, "info");
      }
    });

    approvalSnapshotRef.current = next;
    // getOrderId / pushNotification are stable enough for this comparison window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, orderStatuses]);

  // Update order status
  const updateOrderStatus = async (order, status, meta = {}) => {
    const orderId = getOrderId(order);
    const currentStatus = getOrderStatus(order);
    const nextStatus = normalizeOrderStatus(status);
    const sentAtIso =
      nextStatus === ORDER_STATUS.SENT ? new Date().toISOString() : null;
    const dueAtIso =
      nextStatus === ORDER_STATUS.SENT
        ? isoDeadlineFromNowHours(getOrderApprovalSlaHours())
        : null;
    const sentAuditFields =
      sentAtIso && dueAtIso
        ? { approval_sent_at: sentAtIso, approval_due_at: dueAtIso }
        : {};
    if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
      showEmailToast(
        `Invalid status transition: ${currentStatus} -> ${nextStatus}`,
        "warning",
        4200,
        "Status blocked"
      );
      return;
    }
    console.log('updateOrderStatus called:', { orderId, status: nextStatus, order });
    setOrderStatuses(prev => {
      const newStatuses = {
        ...prev,
        [orderId]: nextStatus
      };
      console.log('Order statuses updated:', newStatuses);
      return newStatuses;
    });

    // Persist status in order objects for reliability across refresh/reload
    setAllOrders(prevOrders =>
      prevOrders.map((o) => {
        if (getOrderId(o) !== orderId) return o;
        return {
          ...o,
          status: nextStatus,
          statusUpdatedAt: new Date().toISOString(),
          statusHistory: appendOrderStatusHistory(o, nextStatus, meta),
          ...sentAuditFields,
        };
      })
    );
    const orderHistory = appendOrderStatusHistory(order, nextStatus, meta);

    try {
      const orders = readOrdersCache();
      if (orders.length > 0) {
        const updatedOrders = orders.map((o) =>
          getOrderId(o) === orderId
            ? {
                ...o,
                status: nextStatus,
                statusUpdatedAt: new Date().toISOString(),
                statusHistory: appendOrderStatusHistory(o, nextStatus, meta),
                ...sentAuditFields,
              }
            : o
        );
        writeOrdersCache(updatedOrders);
      }
    } catch (error) {
      console.warn("Error saving order status to localStorage:", error);
    }

    await syncOrderStatusToSupabase(order, nextStatus, {
      status_updated_at: new Date().toISOString(),
      status_history: orderHistory,
      approval_source: meta.source || "manual",
      ...sentAuditFields,
      ...(nextStatus === ORDER_STATUS.APPROVED || nextStatus === ORDER_STATUS.REJECTED
        ? { resolved_at: new Date().toISOString() }
        : {}),
    });
  };
  
  // Update order status by ID (for use in callbacks)
  const updateOrderStatusById = async (orderId, status, meta = {}) => {
    const currentOrder = allOrders.find((o) => getOrderId(o) === orderId);
    const currentStatus = normalizeOrderStatus(
      (currentOrder && (orderStatuses[orderId] || currentOrder.status)) || ORDER_STATUS.PENDING
    );
    const nextStatus = normalizeOrderStatus(status);
    const sentAtIsoById =
      nextStatus === ORDER_STATUS.SENT ? new Date().toISOString() : null;
    const dueAtIsoById =
      nextStatus === ORDER_STATUS.SENT
        ? isoDeadlineFromNowHours(getOrderApprovalSlaHours())
        : null;
    const sentAuditFieldsById =
      sentAtIsoById && dueAtIsoById
        ? { approval_sent_at: sentAtIsoById, approval_due_at: dueAtIsoById }
        : {};
    if (!canTransitionOrderStatus(currentStatus, nextStatus)) {
      showEmailToast(
        `Invalid status transition: ${currentStatus} -> ${nextStatus}`,
        "warning",
        4200,
        "Status blocked"
      );
      return;
    }
    console.log('updateOrderStatusById called:', { orderId, status: nextStatus });
    setOrderStatuses(prev => {
      const newStatuses = {
        ...prev,
        [orderId]: nextStatus
      };
      console.log('Order statuses updated by ID:', newStatuses);
      return newStatuses;
    });

    // Also persist status into order objects so it survives refresh/reload
    setAllOrders(prevOrders =>
      prevOrders.map((order) => {
        if (getOrderId(order) !== orderId) return order;
        return {
          ...order,
          status: nextStatus,
          statusUpdatedAt: new Date().toISOString(),
          statusHistory: appendOrderStatusHistory(order, nextStatus, meta),
          ...sentAuditFieldsById,
        };
      })
    );
    const currentHistory = appendOrderStatusHistory(currentOrder || {}, nextStatus, meta);

    try {
      const orders = readOrdersCache();
      if (orders.length > 0) {
        const updatedOrders = orders.map((order) =>
          getOrderId(order) === orderId
            ? {
                ...order,
                status: nextStatus,
                statusUpdatedAt: new Date().toISOString(),
                statusHistory: appendOrderStatusHistory(order, nextStatus, meta),
                ...sentAuditFieldsById,
              }
            : order
        );
        writeOrdersCache(updatedOrders);
      }
    } catch (error) {
      console.warn("Error persisting order status to localStorage:", error);
    }

    await syncOrderStatusToSupabase(orderId, nextStatus, {
      status_updated_at: new Date().toISOString(),
      status_history: currentHistory,
      approval_source: meta.source || "manual",
      ...sentAuditFieldsById,
      ...(nextStatus === ORDER_STATUS.APPROVED || nextStatus === ORDER_STATUS.REJECTED
        ? { resolved_at: new Date().toISOString() }
        : {}),
    });
  };

  /** Overdue approval reminders: throttle per order; bump escalation every 3rd reminder. */
  useEffect(() => {
    const TICK_MS = 5 * 60 * 1000;
    const REMINDER_COOLDOWN_MS = 4 * 60 * 60 * 1000;

    const run = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!Array.isArray(allOrders) || allOrders.length === 0) return;

      const now = Date.now();
      const patches = [];

      for (const order of allOrders) {
        const id = getOrderId(order);
        const st = getOrderStatus(order);
        if (st !== ORDER_STATUS.SENT) continue;

        const dueMs = getOrderApprovalDueMs(order);
        if (dueMs == null || now <= dueMs) continue;

        const lastFire = approvalReminderLastRef.current.get(id) || 0;
        if (now - lastFire < REMINDER_COOLDOWN_MS) continue;

        approvalReminderLastRef.current.set(id, now);

        const prevCount =
          Number(order.reminder_count ?? order.reminderCount ?? 0) || 0;
        const nextCount = prevCount + 1;
        const prevEsc =
          Number(order.escalation_level ?? order.escalationLevel ?? 0) || 0;
        const nextEsc = Math.min(3, Math.floor(nextCount / 3));
        const escBump = nextEsc > prevEsc;
        const lastReminderIso = new Date().toISOString();

        patches.push({
          id,
          patch: {
            last_reminder_at: lastReminderIso,
            reminder_count: nextCount,
            escalation_level: nextEsc,
            ...(escBump ? { escalated_at: lastReminderIso } : {}),
          },
          notify: {
            orderNumber: order.orderNumber,
            name: order.distributorName || order.distributorCode || "Distributor",
            escBump,
            nextEsc,
          },
          supabaseId: order.id,
          statusFallback:
            order.distributorCode &&
            order.orderNumber != null &&
            String(order.orderNumber).trim() !== ""
              ? {
                  distributorCode: String(order.distributorCode).trim(),
                  orderNumber: order.orderNumber,
                }
              : null,
        });
      }

      if (patches.length === 0) return;

      setAllOrders((prev) =>
        prev.map((o) => {
          const p = patches.find((x) => x.id === getOrderId(o));
          return p ? { ...o, ...p.patch } : o;
        })
      );

      try {
        const orders = readOrdersCache();
        if (orders.length > 0) {
          const updated = orders.map((o) => {
            const p = patches.find((x) => x.id === getOrderId(o));
            return p ? { ...o, ...p.patch } : o;
          });
          writeOrdersCache(updated);
        }
      } catch (e) {
        console.warn("Error persisting reminder fields to localStorage:", e);
      }

      for (const p of patches) {
        const num = p.notify.orderNumber != null ? p.notify.orderNumber : p.id;
        pushNotification(
          p.notify.escBump
            ? `Escalation (L${p.notify.nextEsc}): Order #${num} (${p.notify.name}) overdue for GM approval.`
            : `Reminder: Order #${num} (${p.notify.name}) is past the approval deadline.`,
          p.notify.escBump ? "warning" : "info"
        );
      }

      if (!isSupabaseConfigured) return;

      void (async () => {
        for (const p of patches) {
          try {
            await updateOrderStatusInSupabaseService(
              p.supabaseId,
              ORDER_STATUS.SENT,
              p.patch,
              p.statusFallback
            );
          } catch (e) {
            console.warn("Supabase reminder sync failed:", p.id, e);
          }
        }
      })();
    };

    const timer = setInterval(run, TICK_MS);
    run();
    return () => clearInterval(timer);
    // getOrderId is stable in practice; order list drives the scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, orderStatuses, isSupabaseConfigured]);

  // Delete order from all sources (state, localStorage, Supabase)
  const deleteOrderFromAllSources = async (order) => {
    try {
      const orderId = getOrderId(order);
      const orderNumber = order.orderNumber || orderId;
      const distributorName = order.distributorName || order.distributorCode || "Unknown";
      
      console.log('🗑️ Deleting order:', orderId);
      
      // 1. Remove from state
      setAllOrders(prevOrders => prevOrders.filter(o => getOrderId(o) !== orderId));
      
      // 2. Remove from localStorage
      try {
        const orders = readOrdersCache();
        if (orders.length > 0) {
          const filteredOrders = orders.filter(o => getOrderId(o) !== orderId);
          writeOrdersCache(filteredOrders);
          console.log('✅ Order deleted from localStorage');
        }
      } catch (localStorageError) {
        console.warn('Error deleting from localStorage:', localStorageError);
      }
      
      // 3. Remove from Supabase (if order has Supabase document ID)
      let supabaseDeleteSuccess = false;
      if (isSupabaseConfigured && order.id) {
        try {
          const { deleteOrder } = await import('../services/supabaseService');
          await deleteOrder(order.id);
          supabaseDeleteSuccess = true;
          console.log('✅ Order deleted from Supabase');
        } catch (supabaseError) {
          console.warn('Error deleting from Supabase:', supabaseError);
          // Continue even if Supabase deletion fails
        }
      }
      
      // 4. Remove status from orderStatuses
      setOrderStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[orderId];
        return newStatuses;
      });
      
      console.log('✅ Order deleted successfully from all sources');
      
      // Show success message
      if (isSupabaseConfigured && order.id && !supabaseDeleteSuccess) {
        alert(`Order deleted from local storage.\n\nNote: Could not delete from Supabase. The order may still appear after refresh.`);
      } else {
        alert(`Order deleted successfully!\n\nOrder #: ${orderNumber}\nDistributor: ${distributorName}`);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert(`Error deleting order: ${error.message || 'Unknown error'}\n\nPlease try again or check the console for details.`);
    }
  };

  // Convert order to PNG image
  const convertOrderToPNG = async (order) => {
    try {
      // If table image is already stored in order, use it directly
      if (order.tableImageData) {
        console.log('✅ Using stored table PNG from order');
        return order.tableImageData;
      }
      
      // Otherwise, generate from HTML (fallback)
      console.log('📝 Generating table PNG from order HTML (fallback)');
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = '#fff';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      const htmlContent = orderToHTML(order);
      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);
      
      // Convert to canvas using html2canvas
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      });
      
      // Remove temp div
      document.body.removeChild(tempDiv);
      
      // Convert canvas to PNG data URL
      const imageData = canvas.toDataURL('image/png');
      return imageData;
    } catch (error) {
      console.error('Error converting order to PNG:', error);
      throw error;
    }
  };

  // Open email composition dialog
  const handleSendOrderEmail = (order) => {
    setEmailOrder(order);
    setEmailDialogOpen(true);
  };

  // Send order email (called from OrderEmailDialog)
  const handleSendEmailWithDetails = async ({ to, cc, subject, message, order }) => {
    const orderId = getOrderId(order);
    setSendingEmail(orderId);
    
    try {
      // Convert order to PNG
      console.log('🖼️ Converting order to PNG image for attachment...');
      const imageData = await convertOrderToPNG(order);
      
      if (!imageData) {
        throw new Error('Failed to generate order image');
      }
      console.log(`✅ Order image generated successfully (${imageData.length} characters)`);
      
      // Get order number for tracking
      const orderNumber = order.orderNumber || 'N/A';
      const orderNumberToken = getOrderNumberToken(order);
      const finalSubject = subject;
      
      // Create email content with custom message only (order details are in attachment)
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <p>${message.replace(/\n/g, '<br>')}</p>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            <em>Please see the attached order details image.</em>
          </p>
        </div>
      `;
      
      // Try to send via Gmail API first, then EmailJS, then mailto
      try {
        // Check if Gmail API is configured
        const { isGmailConfigured, sendEmailViaGmail, monitorOrderReplies } = await import('../services/gmailService');
        
        if (await isGmailConfigured()) {
          // Send via Gmail API
          console.log('Sending email via Gmail API...');
          const gmailResponse = await sendEmailViaGmail({
            to: to,
            cc: cc || "",
            subject: finalSubject,
            htmlBody: htmlBody,
            imageData: imageData
          });
          
          console.log('Gmail API response:', gmailResponse);
          
          // Show success notification
          showEmailToast(
            `Email sent via Gmail. Message ID: ${gmailResponse?.result?.id || 'N/A'}`,
            "success",
            4300
          );
          
          // Start monitoring for replies using order number in subject
          console.log(`📧 Starting reply monitoring for order ${orderId} (Order #${orderNumber})`);
          
          // Store the order reference for the callback
          const orderRef = { ...order };
          
          monitorOrderReplies(
            orderId,
            finalSubject,
            async (reply, body) => {
              // Approval detected
              console.log('✅ Approval callback triggered for order:', orderId);
              try {
                // Find the current order in allOrders to ensure we have the latest version
                const currentOrder = allOrders.find(o => getOrderId(o) === orderId) || orderRef;
                
                console.log('Updating order status for orderId:', orderId);
                console.log('Current order found:', currentOrder ? 'Yes' : 'No');
                console.log('All orders count:', allOrders.length);
                console.log('Current orderStatuses:', orderStatuses);
                
                // Update status using the orderId directly
                if (!replyMentionsOrderNumber(reply, body, orderNumberToken)) {
                  console.warn("Ignoring approval reply because order number token was not found in reply content.");
                  return;
                }
                await updateOrderStatusById(orderId, ORDER_STATUS.APPROVED, {
                  source: "gmail-reply",
                  actor: "gm-email-reply",
                  note: `reply:${reply?.id || ""}`,
                });
                console.log('Order status updated to approved');
                
                await logActivity(
                  ACTIVITY_TYPES.ORDER_APPROVED,
                  `Order approved via email reply: ${currentOrder.distributorName || currentOrder.distributorCode} - Order #${orderNumber}`,
                  {
                    orderId: orderId,
                    orderNumber: orderNumber,
                    distributorName: currentOrder.distributorName || currentOrder.distributorCode,
                    replyId: reply.id,
                    replyBody: body.substring(0, 200), // First 200 chars
                  }
                );
                
                // Status updated automatically - no need for user interaction
                console.log('✅ Order approved automatically from email reply');

                setAllOrders((prevOrders) =>
                  prevOrders.map((o) =>
                    getOrderId(o) === orderId ? { ...o, approvedAt: Date.now() } : o
                  )
                );

                try {
                  const orders = readOrdersCache();
                  if (orders.length > 0) {
                    const updatedOrders = orders.map((o) =>
                      getOrderId(o) === orderId ? { ...o, approvedAt: Date.now() } : o
                    );
                    writeOrdersCache(updatedOrders);
                    console.log('✅ Order updated in localStorage with approvedAt timestamp');
                  }
                } catch (error) {
                  console.warn('Error updating order in localStorage:', error);
                }
                
                // Refresh orders to show updated list (order stays with Approved status)
                await refreshOrders();
              } catch (error) {
                console.error('Error in approval callback:', error);
                console.error('Error stack:', error.stack);
                // Log error but don't block user with alert
                console.error('⚠️ Order approved but error updating status. Please refresh the page.');
              }
            },
            async (reply, body) => {
              // Rejection detected
              console.log('❌ Rejection callback triggered for order:', orderId);
              try {
                // Find the current order in allOrders to ensure we have the latest version
                const currentOrder = allOrders.find(o => getOrderId(o) === orderId) || orderRef;
                
                console.log('Updating order status for orderId:', orderId);
                console.log('Current order found:', currentOrder ? 'Yes' : 'No');
                
                // Update status using the orderId directly
                if (!replyMentionsOrderNumber(reply, body, orderNumberToken)) {
                  console.warn("Ignoring rejection reply because order number token was not found in reply content.");
                  return;
                }
                await updateOrderStatusById(orderId, ORDER_STATUS.REJECTED, {
                  source: "gmail-reply",
                  actor: "gm-email-reply",
                  note: `reply:${reply?.id || ""}`,
                });
                console.log('Order status updated to rejected');
                
                await logActivity(
                  ACTIVITY_TYPES.ORDER_REJECTED,
                  `Order rejected via email reply: ${currentOrder.distributorName || currentOrder.distributorCode}`,
                  {
                    orderId: orderId,
                    distributorName: currentOrder.distributorName || currentOrder.distributorCode,
                    replyId: reply.id,
                    replyBody: body.substring(0, 200),
                  }
                );
                
                alert('Order rejected. Reply detected from email.');
                
                // Refresh orders to show updated status
                await refreshOrders();
              } catch (error) {
                console.error('Error in rejection callback:', error);
                console.error('Error stack:', error.stack);
                alert('Order rejected but error updating status. Please refresh the page.');
              }
            },
            {
              sentMessageId: gmailResponse?.result?.id || null,
              sentThreadId: gmailResponse?.result?.threadId || null,
              senderEmail: localStorage.getItem('admin_email') || '',
              expectedRecipients: [
                ...(to ? [to] : []),
                ...(cc ? cc.split(',').map(email => email.trim()) : [])
              ],
              sentAtMs: Date.now()
            }
          );
          
          // Store stop function for this order (optional - for manual stopping)
          console.log('Reply monitoring started. Checking every 15 seconds...');
        } else {
          // Fallback to EmailJS
          await sendOrderEmail({
            to: to,
            cc: cc || "",
            subject: finalSubject,
            htmlBody: htmlBody,
            imageData: imageData,
            orderId: orderId
          });
        }
        
        // Log activity
        const currentUser = await getCurrentUser();
        await logActivity(
          ACTIVITY_TYPES.ORDER_SENT_FOR_APPROVAL,
          `Order sent for approval: ${order.distributorName || order.distributorCode}`,
          {
            orderId: orderId,
            distributorName: order.distributorName || order.distributorCode,
            to: to,
            cc: cc || "",
            userEmail: currentUser?.email || localStorage.getItem('admin_email') || '',
            userName: currentUser?.email?.split('@')[0] || localStorage.getItem('admin_email')?.split('@')[0] || 'Admin',
          }
        );
        
        showEmailToast("Email sent successfully.", "success", 3800);
        await updateOrderStatus(order, ORDER_STATUS.SENT, {
          source: "email-send",
          actor: "admin",
          note: "Email sent to GM",
        });
        setEmailDialogOpen(false);
        setEmailOrder(null);
      } catch (emailError) {
        // Fallback to mailto link
        console.warn('Email sending failed, using mailto fallback:', emailError);
        const recipients = cc ? `${to}, ${cc}` : to;
        const mailtoLink = createMailtoLink({
          to: recipients,
          cc: cc,
          subject: finalSubject,
          body: `${message}\n\nOrder Details:\nDistributor: ${order.distributorName || order.distributorCode}\nDate: ${new Date(order.timestamp || Date.now()).toLocaleDateString()}\nTotal UC: ${(order.totalUC || 0).toFixed(2)}\n\nPlease review the attached order details.`
        });
        window.location.href = mailtoLink;
        await updateOrderStatus(order, ORDER_STATUS.PENDING_EMAIL_FAILED, {
          source: "email-fallback",
          actor: "admin",
          note: "Gmail/EmailJS failed; opened mail client fallback",
        });
        showEmailToast("Opening email client. Please attach the order image manually.", "info", 5000);
        setEmailDialogOpen(false);
        setEmailOrder(null);
      }
    } catch (error) {
      console.error('Error sending order email:', error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || 'Unknown error occurred';
      showEmailToast(`Failed to send email: ${errorMessage}`, "error", 5200);
      throw error;
    } finally {
      setSendingEmail(null);
    }
  };

  // Handle order approval
  const handleApproveOrder = async (order) => {
    if (window.confirm('Are you sure you want to approve this order?')) {
      const orderId = getOrderId(order);

      await updateOrderStatus(order, ORDER_STATUS.APPROVED, {
        source: "manual",
        actor: "admin",
        note: "Manual approval from dashboard",
      });

      // Merge approvedAt onto the row that already has status: approved from updateOrderStatus
      setAllOrders(prevOrders =>
        prevOrders.map((o) =>
          getOrderId(o) === orderId ? { ...o, approvedAt: Date.now() } : o
        )
      );

      try {
        const orders = readOrdersCache();
        if (orders.length > 0) {
          const updatedOrders = orders.map((o) =>
            getOrderId(o) === orderId ? { ...o, approvedAt: Date.now() } : o
          );
          writeOrdersCache(updatedOrders);
          console.log('✅ Order updated in localStorage with approvedAt timestamp');
        }
      } catch (error) {
        console.warn('Error updating order in localStorage:', error);
      }

      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.ORDER_APPROVED,
        `Order manually approved: ${orderId} (${order.distributorName || order.distributorCode || ""})`,
        {
          orderId,
          distributorCode: order.distributorCode,
          distributorName: order.distributorName,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split("@")[0] || "Admin",
          source: "manual",
        }
      );

      alert(
        "Order approved! Dispatched orders move to History after the retention period (Settings in Orders view). Data stays in the database until you delete an order."
      );
    }
  };

  // Handle order rejection
  const handleRejectOrder = async (order) => {
    if (window.confirm('Are you sure you want to reject this order?')) {
      await updateOrderStatus(order, ORDER_STATUS.REJECTED, {
        source: "manual",
        actor: "admin",
        note: "Manual rejection from dashboard",
      });

      const orderId = getOrderId(order);
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.ORDER_REJECTED,
        `Order manually rejected: ${orderId} (${order.distributorName || order.distributorCode || ""})`,
        {
          orderId,
          distributorCode: order.distributorCode,
          distributorName: order.distributorName,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split("@")[0] || "Admin",
          source: "manual",
        }
      );

      alert('Order rejected.');
    }
  };

  // Handler for updating target period (keeps dashboard + dialog props in sync)
  const handleUpdatePeriod = (startIso, endIso) => {
    if (startIso && endIso) {
      saveTargetPeriod(startIso, endIso);
      setTargetPeriod({ start: startIso, end: endIso });
    }
  };

  // Handler for saving scheme
  const handleSaveScheme = async (schemeData) => {
    try {
      if (isSupabaseConfigured) {
        await saveScheme(schemeData);
        // Reload schemes
        const updatedSchemes = await getAllSchemes();
        setSchemes(updatedSchemes);
        alert("Scheme saved successfully!");
      } else {
        // Save to localStorage
        const updatedSchemes = [...schemes, schemeData];
        localStorage.setItem("schemes", JSON.stringify(updatedSchemes));
        setSchemes(updatedSchemes);
        alert("Scheme saved successfully!");
      }
    } catch (error) {
      console.error("Error saving scheme:", error);
      alert("Failed to save scheme: " + (error?.message || error));
    }
  };

  // Handler for deleting scheme
  const handleDeleteScheme = async (schemeId) => {
    try {
      if (isSupabaseConfigured) {
        await deleteScheme(schemeId);
        // Reload schemes
        const updatedSchemes = await getAllSchemes();
        setSchemes(updatedSchemes);
        alert("Scheme deleted successfully!");
      } else {
        // Delete from localStorage
        const updatedSchemes = schemes.filter(s => s.id !== schemeId);
        localStorage.setItem("schemes", JSON.stringify(updatedSchemes));
        setSchemes(updatedSchemes);
        alert("Scheme deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting scheme:", error);
      alert("Failed to delete scheme: " + (error?.message || error));
    }
  };

  const anyAdminDialogOpen =
    notificationsOpen ||
    targetsOpen ||
    distributorsOpen ||
    showCalculator ||
    reportsOpen ||
    emailRecipientsOpen ||
    userManagementOpen ||
    activityOpen ||
    gmailSettingsOpen ||
    gstSettingsOpen ||
    schemeDiscountOpen ||
    rateMasterOpen ||
    physicalStockAdminOpen ||
    stockLiftingRecordsOpen ||
    previewOpen ||
    emailDialogOpen ||
    (isMobile && sidebarOpen);

  const closeTopAdminDialog = useCallback(() => {
    if (emailDialogOpen) {
      setEmailDialogOpen(false);
      setEmailOrder(null);
      return;
    }
    if (previewOpen) {
      setPreviewOpen(false);
      setPreviewOrder(null);
      return;
    }
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    if (targetsOpen) {
      setTargetsOpen(false);
      return;
    }
    if (distributorsOpen) {
      setDistributorsOpen(false);
      return;
    }
    if (showCalculator) {
      setShowCalculator(false);
      return;
    }
    if (reportsOpen) {
      setReportsOpen(false);
      return;
    }
    if (emailRecipientsOpen) {
      setEmailRecipientsOpen(false);
      return;
    }
    if (userManagementOpen) {
      setUserManagementOpen(false);
      return;
    }
    if (activityOpen) {
      setActivityOpen(false);
      return;
    }
    if (gmailSettingsOpen) {
      setGmailSettingsOpen(false);
      return;
    }
    if (gstSettingsOpen) {
      setGstSettingsOpen(false);
      return;
    }
    if (schemeDiscountOpen) {
      setSchemeDiscountOpen(false);
      return;
    }
    if (rateMasterOpen) {
      setRateMasterOpen(false);
      return;
    }
    if (physicalStockAdminOpen) {
      setPhysicalStockAdminOpen(false);
      return;
    }
    if (stockLiftingRecordsOpen) {
      setStockLiftingRecordsOpen(false);
      return;
    }
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [
    emailDialogOpen,
    previewOpen,
    notificationsOpen,
    targetsOpen,
    distributorsOpen,
    showCalculator,
    reportsOpen,
    emailRecipientsOpen,
    userManagementOpen,
    activityOpen,
    gmailSettingsOpen,
    gstSettingsOpen,
    schemeDiscountOpen,
    rateMasterOpen,
    physicalStockAdminOpen,
    stockLiftingRecordsOpen,
    isMobile,
    sidebarOpen,
  ]);

  useEffect(() => {
    if (!anyAdminDialogOpen || dialogBackHistoryRef.current || typeof window === "undefined") return;
    window.history.pushState({ cokeAdminDialog: true }, "", window.location.href);
    dialogBackHistoryRef.current = true;
  }, [anyAdminDialogOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (!dialogBackHistoryRef.current) return;
      dialogBackHistoryRef.current = false;
      closeTopAdminDialog();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeTopAdminDialog]);

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      <AppBar elevation={0} sx={{ ...saasAppBarSx(theme), zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={saasAppBarToolbarSx()}>
          <IconButton color="inherit" onClick={toggleSidebar} aria-label="toggle menu" sx={{ p: { xs: 0.75, sm: 1 } }}>
            <MenuIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />
          </IconButton>
          <SaasAppBarTitle
            title="Admin Dashboard"
            subtitle="Sales performance and distributor operations"
          />
          <WorkspaceSwitcher sx={{ display: { xs: "none", sm: "flex" } }} />
          <WorkspaceChip sx={{ display: { xs: "none", md: "flex" } }} />
          <DayNightThemeToggle />
          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              aria-label="notifications"
              onClick={() => {
                setNotificationsOpen(true);
                setUnreadNotifications(0);
              }}
            >
              <Badge badgeContent={unreadNotifications} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={requestLogout} aria-label="logout">
            <LogoutIcon />
          </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isMobile ? "temporary" : "persistent"}
        open={sidebarOpen}
        onClose={toggleSidebar}
        sx={{
          [`& .MuiDrawer-paper`]: navDrawerPaperSx(theme, { isMobile }),
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
          <IconButton onClick={toggleSidebar} sx={{ color: "text.primary" }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List sx={{ px: 0.75, pb: 1, flex: 1, overflowY: "auto" }}>
            {[
              {
                label: "Operations",
                items: [
                  { text: "Dashboard", icon: <DashboardIcon />, action: () => { setShowOrders(false); setAdminCurrentView("dashboard"); setSidebarOpen(isMobile); } },
                  {
                    text: "Orders",
                    icon: <AssignmentIcon />,
                    badgeCount: adminActionableOrdersCount,
                    action: () => { setShowOrders(true); setAdminCurrentView("orders"); setSidebarOpen(isMobile); },
                  },
                  { text: "Calculator", icon: <CalculateIcon />, action: () => { setShowCalculator(true); setAdminCurrentView("calculator"); setSidebarOpen(isMobile); } },
                  { text: "Targets", icon: <TrackChangesIcon />, action: () => { setTargetsOpen(true); setAdminCurrentView("targets"); setSidebarOpen(isMobile); } },
                  { text: "Scheme & Discount", icon: <LocalOfferIcon />, action: () => { setSchemeDiscountOpen(true); setAdminCurrentView("scheme_discount"); setSidebarOpen(isMobile); } },
                  {
                    text: "Product & Rate Master",
                    icon: (
                      <NuProductRateIcon
                        sx={{
                          minWidth: 24,
                          height: 24,
                          fontSize: "0.75rem",
                          borderRadius: "6px",
                          bgcolor: "rgba(228, 5, 33, 0.14)",
                          color: "#0d47a1",
                        }}
                      />
                    ),
                    action: () => {
                      setRateMasterOpen(true);
                      setAdminCurrentView("rate_master");
                      setSidebarOpen(isMobile);
                    },
                  },
                  {
                    text: "Physical Stock",
                    icon: <WarehouseIcon />,
                    badgeCount: pendingPhysicalStockUpdatesCount,
                    action: () => {
                      setPhysicalStockAdminOpen(true);
                      setAdminCurrentView("physical_stock");
                      setSidebarOpen(isMobile);
                    },
                  },
                  {
                    text: "Stock lifting records",
                    icon: <TableChartIcon />,
                    action: () => {
                      setStockLiftingRecordsOpen(true);
                      setAdminCurrentView("stock_lifting_records");
                      setSidebarOpen(isMobile);
                    },
                  },
                  { text: "Distributors", icon: <PeopleIcon />, action: () => { setDistributorsOpen(true); setAdminCurrentView("distributors"); setSidebarOpen(isMobile); } },
                  { text: "Reports", icon: <BarChartIcon />, action: () => { setReportsOpen(true); setAdminCurrentView("reports"); setSidebarOpen(isMobile); } },
                  { text: "Activity", icon: <HistoryIcon />, action: () => { setActivityOpen(true); setAdminCurrentView("activity"); setSidebarOpen(isMobile); } },
                  { text: "Gmail Settings", icon: <SettingsIcon />, action: () => { setGmailSettingsOpen(true); setAdminCurrentView("gmail_settings"); setSidebarOpen(isMobile); } },
                  { text: "GST Settings", icon: <LocalOfferIcon />, action: () => { setGstSettingsOpen(true); setAdminCurrentView("gst_settings"); setSidebarOpen(isMobile); } },
                ],
              },
              {
                label: "Workspace",
                items: [
                  { text: "Workspace", icon: <BusinessOutlinedIcon />, action: () => { setWorkspaceSettingsOpen(true); setAdminCurrentView("workspace"); setSidebarOpen(isMobile); } },
                  { text: "Team & invites", icon: <GroupAddOutlinedIcon />, action: () => { setTeamOpen(true); setAdminCurrentView("team"); setSidebarOpen(isMobile); } },
                  { text: "User & Permissions", icon: <AdminPanelSettingsIcon />, action: () => { setUserManagementOpen(true); setAdminCurrentView("user_permissions"); setSidebarOpen(isMobile); } },
                ],
              },
            ].map((section) => (
              <React.Fragment key={section.label}>
                <Typography component="div" sx={navDrawerSectionLabelSx()}>
                  {section.label}
                </Typography>
                {section.items.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton 
                onClick={item.action}
                sx={{
                  ...navDrawerItemSx(theme),
                  py: { xs: 1, sm: 0.85 },
                  px: { xs: 1, sm: 1.25 },
                  cursor: "pointer",
                }}
              >
                <Box sx={{ mr: 1.25, display: "flex", alignItems: "center", color: "inherit" }}>
                  <Badge
                    overlap="circular"
                    color="error"
                    invisible={!item.badgeCount || item.badgeCount < 1}
                    badgeContent={item.badgeCount > 99 ? "99+" : item.badgeCount}
                    sx={{
                      color: "inherit",
                      "& .MuiBadge-badge": {
                        fontWeight: 800,
                        fontSize: "0.65rem",
                        minWidth: 18,
                        height: 18,
                        border: "2px solid",
                        borderColor: "background.paper",
                        right: 4,
                        top: 4,
                      },
                    }}
                  >
                    {React.cloneElement(item.icon, {
                      sx: {
                        ...(item.icon?.props?.sx || {}),
                        fontSize: { xs: 18, sm: 20 },
                        ...(!item.icon?.props?.sx?.color ? { color: "inherit" } : {}),
                      },
                    })}
                  </Badge>
                </Box>
                <ListItemText
                  primary={item.text}
                  secondary={
                    item.text === "Orders" && item.badgeCount > 0
                      ? "Needs review"
                      : item.text === "Physical Stock" && item.badgeCount > 0
                        ? "Distributor update(s)"
                        : undefined
                  }
                  primaryTypographyProps={{
                    sx: {
                      color: "text.primary",
                      fontWeight: 600,
                      fontSize: { xs: "0.85rem", sm: "0.9rem" },
                      lineHeight: 1.35,
                    },
                  }}
                  secondaryTypographyProps={
                    (item.text === "Orders" && item.badgeCount > 0) ||
                    (item.text === "Physical Stock" && item.badgeCount > 0)
                      ? {
                          sx: {
                            color: theme.palette.error.dark,
                            fontWeight: 700,
                            fontSize: "0.65rem",
                            mt: 0.25,
                          },
                        }
                      : undefined
                  }
                />
              </ListItemButton>
            </ListItem>
                ))}
              </React.Fragment>
            ))}
        </List>
        <Box
          sx={{
            mt: "auto",
            mx: 0.75,
            mb: 1,
            p: 1,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.text.primary, 0.04),
            border: 1,
            borderColor: "divider",
          }}
        >
          <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: "text.secondary", mb: 0.25 }}>
            Logged In
          </Typography>
          <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "text.primary", wordBreak: "break-word" }}>
            {localStorage.getItem("admin_email") || "Unknown user"}
          </Typography>
          <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", fontWeight: 600, mt: 0.25 }}>
            Role: {(userRole || localStorage.getItem("userRole") || "admin").toString().toUpperCase()}
          </Typography>
        </Box>
      </Drawer>

        <Box
        component="main" 
          sx={{
          ...saasDashboardMainSx(theme),
          overflowX: "hidden",
          ml: { xs: 0, md: sidebarOpen ? "220px" : 0 },
          transition: "margin-left 0.3s ease",
          width: { xs: "100%", md: sidebarOpen ? "calc(100% - 220px)" : "100%" },
          maxWidth: "100%",
          boxSizing: "border-box",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <Toolbar />

        {/* Centered content container */}
        <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto" }}>
          <AdminSummaryStrip
            showOrders={showOrders}
            onShowPerformance={() => {
              setShowOrders(false);
              setAdminCurrentView("dashboard");
            }}
            onShowOrders={() => {
              setShowOrders(true);
              setAdminCurrentView("orders");
            }}
            pendingReviewCount={adminActionableOrdersCount}
            selectedRegion={selectedRegion}
          />

          {!showOrders ? (
            <InfoCards
              balance={calculateBalanceFromDistributors}
              targetPeriod={targetPeriod}
              allOrders={allOrders}
              getOrderStatus={getOrderStatus}
            />
          ) : null}

          {showOrders ? (
            <OrdersSection
              allOrders={allOrders}
              isMobile={isMobile}
              sendingEmail={sendingEmail}
              onRefresh={refreshOrders}
              onSendEmail={handleSendOrderEmail}
              onApprove={handleApproveOrder}
              onReject={handleRejectOrder}
              onDelete={deleteOrderFromAllSources}
              onPreviewOrder={(order) => {
                setPreviewOrder(order);
                setPreviewOpen(true);
              }}
              getOrderStatus={getOrderStatus}
              getOrderId={getOrderId}
            />
          ) : null}

          {/* Distributor Performance Table Section */}
          {!showOrders && (
          <Paper
            ref={performancePaperRef}
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
              mt: { xs: 0.5, sm: 1 },
              width: "100%",
              minHeight: { xs: 280, sm: 320 },
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            <PerformanceToolbar
              isMobile={isMobile}
              onDownloadExcel={handleDownloadExcel}
              onDownloadPDF={handleDownloadPDF}
              onDeleteAll={handleDeleteAllData}
              deleting={deletingAll}
              canDelete={!!userPermissions?.delete}
              selectedRegion={selectedRegion}
              onRegionChange={handleRegionChange}
            />

            {/* Distributor Performance Table */}
            <PerformanceTable
              distributors={performanceDistributors}
              selectedRegion={selectedRegion}
              isMobile={isMobile}
              tableRef={tableRef}
              salesDataLoaded={allSalesData.length > 0}
              onDistributorClick={(d) =>
                setPerformanceSkuDialog({
                  code: d.code,
                  name: d.name,
                  region: d.region,
                })
              }
            />
          </Paper>
          )}
        </Box>

        <Dialog
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          fullWidth
          maxWidth="sm"
          PaperProps={{ sx: { borderRadius: 2, overflow: "hidden" } }}
        >
          <DialogTitle
            sx={{
              bgcolor: "primary.main",
              color: "primary.contrastText",
              fontWeight: 800,
              py: 1.5,
            }}
          >
            Notifications
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {notifications.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                No new updates.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
                {notifications.map((note) => (
                  <Box
                    key={note.id}
                    sx={{
                      py: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          note.type === "success"
                            ? "success.dark"
                            : note.type === "error"
                            ? "error.dark"
                            : "text.primary",
                        fontWeight: 500,
                      }}
                    >
                      {note.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {note.timestamp}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNotifications([])} color="inherit">
              Clear
            </Button>
            <Button onClick={() => setNotificationsOpen(false)} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Targets and Distributors dialogs */}
        <TargetsDialog 
          open={targetsOpen} 
          onClose={() => {
            setTargetsOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          initialStart={targetPeriod.start}
          initialEnd={targetPeriod.end}
          onApplyTargets={handleApplyTargets}
          onDeleteTargets={handleDeleteTargets}
          canWrite={true}
          onUpdatePeriod={handleUpdatePeriod}
        />
        <DistributorsDialog
          open={distributorsOpen}
          onClose={() => {
            setDistributorsOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          onAdd={handleAddDistributor}
          onUpdate={handleUpdateDistributor}
          onDelete={handleDeleteDistributor}
          canWrite={true}
          canDelete={userPermissions?.delete || false}
        />

        <ReportsDialog
          open={reportsOpen}
          onClose={() => {
            setReportsOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          salesData={allSalesData}
          productRates={productRates}
        />

        <OrderEmailDialog
          open={emailDialogOpen}
          onClose={() => {
            setEmailDialogOpen(false);
            setEmailOrder(null);
          }}
          order={emailOrder}
          onSend={handleSendEmailWithDetails}
          onManageRecipients={() => {
            setEmailDialogOpen(false);
            setEmailRecipientsOpen(true);
          }}
        />

        <EmailRecipientsDialog
          open={emailRecipientsOpen}
          onClose={() => setEmailRecipientsOpen(false)}
        />

        <UserPermissionManagementDialog
          open={userManagementOpen}
          onClose={() => {
            setUserManagementOpen(false);
            setAdminCurrentView("dashboard");
          }}
        />

        <ActivityDialog
          open={activityOpen}
          onClose={() => {
            setActivityOpen(false);
            setAdminCurrentView("dashboard");
          }}
        />

        <GmailSettingsDialog
          open={gmailSettingsOpen}
          onClose={() => {
            setGmailSettingsOpen(false);
            setAdminCurrentView("dashboard");
          }}
        />

        <WorkspaceSettingsDialog
          open={workspaceSettingsOpen}
          onClose={() => setWorkspaceSettingsOpen(false)}
        />

        <TeamManagementDialog
          open={teamOpen}
          onClose={() => {
            setTeamOpen(false);
            setAdminCurrentView("dashboard");
          }}
        />

        <OnboardingWizardDialog
          open={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onOpenWorkspaceSettings={() => {
            setOnboardingOpen(false);
            setWorkspaceSettingsOpen(true);
          }}
          onOpenDistributors={() => {
            setOnboardingOpen(false);
            setDistributorsOpen(true);
          }}
          onOpenRateMaster={() => {
            setOnboardingOpen(false);
            setRateMasterOpen(true);
          }}
        />

        <GstSettingsDialog
          open={gstSettingsOpen}
          policy={globalGstPolicy}
          regions={gstRegions}
          distributors={distributors}
          saving={savingGlobalGst}
          onClose={() => {
            setGstSettingsOpen(false);
            setAdminCurrentView("dashboard");
          }}
          onSave={(policy) => {
            void handleSaveGlobalGstPolicy(policy);
          }}
        />

        <SchemeDiscountDialog
          open={schemeDiscountOpen}
          onClose={() => {
            setSchemeDiscountOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          schemes={schemes}
          onSaveScheme={handleSaveScheme}
          onDeleteScheme={handleDeleteScheme}
          productRates={productRates}
          onOpenRateMaster={() => {
            setSchemeDiscountOpen(false);
            setRateMasterOpen(true);
            setAdminCurrentView("rate_master");
          }}
        />

        <RateMasterDialog
          open={rateMasterOpen}
          onClose={() => {
            setRateMasterOpen(false);
            setAdminCurrentView("dashboard");
          }}
          productRates={productRates}
          onRatesUpdated={(newRates) => setProductRates(newRates)}
        />

        <PhysicalStockAdminDialog
          open={physicalStockAdminOpen}
          onClose={() => {
            setPhysicalStockAdminOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          onOpened={handlePhysicalStockAdminDialogOpened}
          productRates={productRates}
        />

        <AdminStockLiftingRecordsDialog
          open={stockLiftingRecordsOpen}
          onClose={() => {
            setStockLiftingRecordsOpen(false);
            setAdminCurrentView("dashboard");
          }}
          distributors={distributors}
          allSalesData={allSalesData}
          targetPeriod={targetPeriod}
        />

        <DistributorPerformanceSkuDialog
          open={Boolean(performanceSkuDialog)}
          onClose={() => setPerformanceSkuDialog(null)}
          distributorCode={performanceSkuDialog?.code}
          distributorName={performanceSkuDialog?.name}
          distributorRegion={performanceSkuDialog?.region}
          allSalesData={allSalesData}
          distributors={distributors}
        />

        <OrderPreviewDialog
          open={previewOpen}
          order={previewOrder}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewOrder(null);
          }}
        />
        <AppSnackbar
          open={emailToast.open}
          title={emailToast.title}
          message={emailToast.message}
          severity={emailToast.severity}
          autoHideDuration={emailToast.duration}
          onClose={() => setEmailToast((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        />

        {/* Calculator Dialog */}
        <Dialog
          fullScreen
          open={showCalculator}
          onClose={() => {
            setShowCalculator(false);
            setAdminCurrentView("dashboard");
          }}
          disableEnforceFocus={false}
          disableAutoFocus={false}
        >
          <Box sx={{ p: 2 }}>
            <CokeCalculator
              productRates={productRates}
              gstEnabled={resolveGstEnabledForRegion(globalGstPolicy, null)}
            />
            <DialogActions>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  setShowCalculator(false);
                  setAdminCurrentView("dashboard");
                }}
              >
                Close
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>

      {logoutConfirmDialog}
    </Box>
  );
}

export default AdminDashboard;
