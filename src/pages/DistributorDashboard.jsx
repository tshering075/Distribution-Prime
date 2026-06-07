import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import "./DistributorDashboard.css";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Badge,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  Stack,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { tableHeaderBg, tableSubHeaderBandBg } from "../theme/contrastSurfaces";
import { saasAppBarSx, saasAppBarToolbarSx, saasDashboardMainSx } from "../theme/saasChrome";
import SaasAppBarTitle from "../components/saas/SaasAppBarTitle";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LogoutIcon from "@mui/icons-material/Logout";
import {
  BarChart as BarChartIcon,
  Calculate as CalculateIcon,
  CalendarMonth,
  Close as CloseIcon,
  ListAlt as ListAltIcon,
  Dashboard as DashboardIcon,
  Warehouse as WarehouseIcon,
  OpenInFull as OpenInFullIcon,
  WavingHand as WavingHandIcon,
} from "@mui/icons-material";
import NuProductRateIcon from "../components/NuProductRateIcon";
import WorkspaceChip from "../components/WorkspaceChip";
import CokeCalculator from "../cokecalculator";
import OrdersDialog from "../components/OrdersDialog";
import StockLiftingRecordsTable from "../components/StockLiftingRecordsTable";
import StockLiftingSkuDialog, {
  formatStockLiftSkuDialogDate,
  stockLiftRowToSalesRecord,
} from "../components/StockLiftingSkuDialog";
import OrderCalculatedTableDialog from "../components/OrderCalculatedTableDialog";
import ShippingInvoiceDialog from "../components/ShippingInvoiceDialog";
import DistributorHomeTip from "../components/DistributorHomeTip";
import {
  DashboardSectionHeading,
  DashboardPanelIcon,
  DistributorBottomNavItem,
} from "../components/DistributorDashboardChrome";
import DistributorPhysicalStockDialog from "../components/DistributorPhysicalStockDialog";
import AppSnackbar from "../components/AppSnackbar";
import { useLogoutConfirmation } from "../components/LogoutConfirmDialog";
import DayNightThemeToggle from "../components/DayNightThemeToggle";
import SalesDataRefreshNoticeDialog from "../components/SalesDataRefreshNoticeDialog";
import { getTargetPeriod, saveTargetPeriod, getDaysRemaining } from "../utils/targetPeriod";
import TargetPeriodCalendarPreview from "../components/TargetPeriodCalendarPreview";
import TargetAchievementBalanceSummary from "../components/TargetAchievementBalanceSummary";
import {
  tryClaimDailyStockLiftReminder,
  buildTargetBalanceReminderMessage,
  getTargetReminderNotificationIconUrl,
} from "../utils/targetReminder";
import { playSalesDataRefreshChime } from "../utils/newOrderAlertSound";
import {
  playDistributorNotificationSound,
  unlockNotificationAudio,
} from "../utils/distributorNotificationSound";
import { isCombinedTargetAchievedUC } from "../utils/targetAchievement";
import { getDistributors } from "../utils/distributorAuth";
import { 
  getDistributorByCode, 
  subscribeToDistributor,
  getOrdersByDistributor,
  fetchAllOrderNumbers,
  fetchOrderShippingInvoice,
  subscribeToOrders,
  getTarget,
  subscribeToTarget,
  getActiveSchemesForDistributor,
  saveOrder,
  patchOrderFields,
  updateOrderStatus as updateOrderStatusInSupabase,
  deleteOrder as deleteOrderFromSupabase,
  getStockLiftingRecords,
  subscribeToSalesData,
  supabase,
  getProductRates,
  getGlobalTargetPeriod,
  getGlobalGstPolicy,
} from "../services/supabaseService";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import {
  ensureDashboardBaselineIfMissing,
  markDashboardTargetSeen,
  markPhysicalStockRevisionSeen,
  shouldShowDashboardBadge,
  shouldShowPhysicalStockBadge,
} from "../utils/distributorSidebarSignals";
import { getRawPhysicalStockFromDistributor } from "../utils/physicalStockTemplate";
import { readProductRatesFromLocalStorage, writeProductRatesToLocalStorage } from "../utils/productRatesStorage";
import {
  readGlobalGstPolicyFromLocalStorage,
  writeGlobalGstPolicyToLocalStorage,
  resolveGstEnabledForRegion,
} from "../utils/globalGstSetting";
import { ensureProductCatalog, getCatalogSkusGrouped } from "../utils/productCatalog";
import { readOrdersCache, writeOrdersCache, ordersCacheStorageKey } from "../utils/ordersLocalStorage";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  mergeOrdersPreservingInvoices,
  orderHasShippingInvoice,
  getOrderShippingInvoices,
  removeOrderFromCokeOrdersLocalStorage,
} from "../utils/orderStatus";
import {
  filterLocallyDeletedOrders,
  markOrderLocallyDeleted,
  unmarkOrderLocallyDeleted,
} from "../utils/orderArchive";
import { downloadAllShippingInvoices } from "../utils/shippingInvoiceActions";
import {
  normalizeOrderNumber,
  allocateUniqueOrderNumber,
  supabaseOrderNumberOptions,
  isOrderNumberUniqueViolation,
  peekNextUniqueOrderNumber,
  loadUsedOrderNumbersFromLocalStorage,
} from "../utils/orderNumber";

const PRODUCT_RATE_CATEGORY_COLORS = {
  CSD: "#1565c0",
  CAN: "#FF6F00",
  Water: "#0288D1",
};

function formatDistributorOrderRow(order) {
  return {
    ...order,
    timestamp:
      order.createdAt?.toDate
        ? order.createdAt.toDate().toLocaleString()
        : order.timestamp || new Date().toLocaleString(),
  };
}

function fingerprintStockLiftingRecords(records) {
  if (!Array.isArray(records) || records.length === 0) return "0";
  return records
    .map((r) =>
      `${r.id ?? "noid"}:${Number(r.csdPC) || 0}:${Number(r.csdUC) || 0}:${Number(r.waterPC) || 0}:${Number(r.waterUC) || 0}:${r.date ?? ""}`
    )
    .sort()
    .join("|");
}

function DistributorDashboard({ distributorName = "Distributor", distributorCode, onLogout }) {
  const { requestLogout, logoutConfirmDialog } = useLogoutConfirmation(onLogout);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [showCalculator, setShowCalculator] = useState(false);
  const [orders, setOrders] = useState([]);
  const [cancelingOrderId, setCancelingOrderId] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [calculatorInitialInputs, setCalculatorInitialInputs] = useState(null);
  const [openOrderCalculatedDialog, setOpenOrderCalculatedDialog] = useState(false);
  const [orderForCalculatedTable, setOrderForCalculatedTable] = useState(null);
  const [openOrdersListDialog, setOpenOrdersListDialog] = useState(false);
  const [openShippingInvoiceDialog, setOpenShippingInvoiceDialog] = useState(false);
  const [shippingInvoiceOrder, setShippingInvoiceOrder] = useState(null);
  const [loadingInvoiceOrderId, setLoadingInvoiceOrderId] = useState(null);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [openProductRateDialog, setOpenProductRateDialog] = useState(false);
  const [productRates, setProductRates] = useState(null);
  const [globalGstPolicy, setGlobalGstPolicy] = useState(() => readGlobalGstPolicyFromLocalStorage());
  const [openStockLiftingDialog, setOpenStockLiftingDialog] = useState(false);
  const [openPhysicalStockDialog, setOpenPhysicalStockDialog] = useState(false);
  const DISTRIBUTOR_VIEW_STORAGE_KEY = `distributor_current_view_${distributorCode || "default"}`;
  const [stockLiftingRecords, setStockLiftingRecords] = useState([]);
  const [stockLiftingSkuDialog, setStockLiftingSkuDialog] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toast, setToast] = useState({
    open: false,
    message: "",
    title: "",
    severity: "info",
    duration: 4000,
  });
  const [sidebarBadgeTick, setSidebarBadgeTick] = useState(0);
  
  // Check if Supabase is configured
  const isSupabaseConfigured = supabase !== null;
  
  // Get distributor data from Supabase or localStorage
  const [distributor, setDistributor] = useState(null);
  const [, setDistributorLoading] = useState(isSupabaseConfigured);
  const [activeSchemes, setActiveSchemes] = useState([]); // Active schemes for this distributor
  const notificationsInitializedRef = useRef(false);
  const previousOrderStatusesRef = useRef({});
  const previousTargetAchievedRef = useRef(null);
  const distributorUcAchievementNotifyRef = useRef({ scope: "", prevAchieved: false });
  const [targetPeriodRev, setTargetPeriodRev] = useState(0);
  const stockLiftingFingerprintRef = useRef(null);
  const [salesRefreshNoticeOpen, setSalesRefreshNoticeOpen] = useState(false);
  const dialogBackHistoryRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await getGlobalTargetPeriod();
        if (cancelled || !remote?.start || !remote?.end) return;
        saveTargetPeriod(remote.start, remote.end);
        setTargetPeriodRev((n) => n + 1);
      } catch (e) {
        console.warn("Could not load global target period from Supabase:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured]);

  // Load distributor data
  useEffect(() => {
    let isMounted = true;
    
    const loadDistributor = async () => {
      try {
        if (isSupabaseConfigured && distributorCode) {
          // Load distributor and target in parallel for faster loading
          console.log(`🔄 Loading distributor ${distributorCode} and target in parallel...`);
          const [supabaseDistributor, targetFromCollection] = await Promise.allSettled([
            getDistributorByCode(distributorCode).catch(err => {
              if (err.name === 'AbortError') {
                console.log('Request aborted, ignoring error');
                return null;
              }
              throw err;
            }),
            getTarget(distributorCode).catch(err => {
              if (err.name === 'AbortError') {
                console.log('Request aborted, ignoring error');
                return null;
              }
              throw err;
            })
          ]).then(results => [
            results[0].status === 'fulfilled' ? results[0].value : null,
            results[1].status === 'fulfilled' ? results[1].value : null
          ]);
          
          if (!isMounted) return;
          
          if (supabaseDistributor) {
            if (targetFromCollection) {
              // Merge target from targets collection with distributor data
              const distributorWithTarget = {
                ...supabaseDistributor,
                target: {
                  CSD_PC: targetFromCollection.CSD_PC || 0,
                  CSD_UC: targetFromCollection.CSD_UC || 0,
                  Water_PC: targetFromCollection.Water_PC || 0,
                  Water_UC: targetFromCollection.Water_UC || 0,
                }
              };
              console.log(`✅ Loaded distributor and target for ${distributorCode}`);
              setDistributor(distributorWithTarget);
            } else {
              // No target in targets collection, use target from distributor document (backward compatibility)
              console.log(`⚠️ No target found in targets collection for ${distributorCode}, using target from distributor document`);
              setDistributor(supabaseDistributor);
            }
          } else {
            // Fallback to localStorage
            const distributors = getDistributors();
            const localDistributor = distributors.find(d => d.code === distributorCode || d.name === distributorName);
            setDistributor(localDistributor || null);
          }
        } else {
          // Use localStorage
          const distributors = getDistributors();
          const localDistributor = distributorCode 
            ? distributors.find(d => d.code === distributorCode || d.name === distributorName)
            : distributors.find(d => d.name === distributorName);
          setDistributor(localDistributor || null);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Request aborted, ignoring error');
          return;
        }
        if (!isMounted) return;
        console.error("Error loading distributor:", error);
        // Fallback to localStorage
        const distributors = getDistributors();
        const localDistributor = distributorCode 
          ? distributors.find(d => d.code === distributorCode || d.name === distributorName)
          : distributors.find(d => d.name === distributorName);
        setDistributor(localDistributor || null);
      } finally {
        if (isMounted) {
          setDistributorLoading(false);
        }
      }
    };
    loadDistributor();
    
    return () => {
      isMounted = false;
    };
  }, [distributorCode, distributorName, isSupabaseConfigured]);

  const loadProductRates = useCallback(async () => {
    try {
      if (isSupabaseConfigured) {
        const ratesDoc = await getProductRates();
        if (ratesDoc) {
          const catalog = ensureProductCatalog(ratesDoc);
          setProductRates(catalog);
          writeProductRatesToLocalStorage(catalog);
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
  }, [isSupabaseConfigured]);

  useEffect(() => {
    loadProductRates();
  }, [loadProductRates]);

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
  const distributorGstEnabled = useMemo(
    () => resolveGstEnabledForRegion(globalGstPolicy, distributor?.region, distributor?.code || distributorCode),
    [globalGstPolicy, distributor, distributorCode]
  );


  useEffect(() => {
    if (!showCalculator) return;
    loadProductRates();
  }, [showCalculator, loadProductRates]);

  // Subscribe to real-time distributor updates
  // Only subscribe if we have a distributor loaded to avoid unnecessary subscriptions
  useEffect(() => {
    if (isSupabaseConfigured && distributorCode && distributor) {
      let isSubscribed = true;
      
      const unsubscribe = subscribeToDistributor(distributorCode, (updatedDistributor) => {
        if (!isSubscribed) return; // Prevent state updates after unmount
        
        if (updatedDistributor) {
          // Update distributor data (target will be updated separately by target subscription)
          // Keep existing target if available, otherwise use target from distributor document
          setDistributor(prev => {
            if (prev && prev.target) {
              // Preserve existing target from targets collection subscription
              return {
                ...updatedDistributor,
                target: prev.target
              };
            }
            // Use target from distributor document if no target subscription data exists
            return updatedDistributor;
          });
        }
      });
      
      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    }
  }, [distributorCode, isSupabaseConfigured, distributor]);

  // Subscribe to real-time target updates from targets collection
  // Only subscribe if we have a distributor loaded to avoid unnecessary subscriptions
  useEffect(() => {
    if (isSupabaseConfigured && distributorCode && distributor) {
      console.log(`🔄 Subscribing to target updates for distributor ${distributorCode}...`);
      let isSubscribed = true;
      
      const unsubscribeTarget = subscribeToTarget(distributorCode, (targetData) => {
        if (!isSubscribed) return; // Prevent state updates after unmount
        
        if (targetData) {
          // Update distributor state with new target data
          setDistributor(prev => {
            if (prev) {
              const updated = {
                ...prev,
                target: {
                  CSD_PC: targetData.CSD_PC || 0,
                  CSD_UC: targetData.CSD_UC || 0,
                  Water_PC: targetData.Water_PC || 0,
                  Water_UC: targetData.Water_UC || 0,
                }
              };
              console.log(`✅ Target updated in real-time for distributor ${distributorCode}:`, updated.target);
              return updated;
            }
            return prev;
          });
        } else {
          // Target was deleted or doesn't exist, keep existing target or set to defaults
          console.log(`⚠️ Target not found for distributor ${distributorCode}, keeping existing target`);
        }
      });
      
      return () => {
        isSubscribed = false;
        unsubscribeTarget();
      };
    }
  }, [distributorCode, isSupabaseConfigured, distributor]);

  // Load active schemes for this distributor
  useEffect(() => {
    const loadSchemes = async () => {
      try {
        if (isSupabaseConfigured && distributorCode) {
          console.log(`🔄 Loading active schemes for distributor ${distributorCode}...`);
          const schemes = await getActiveSchemesForDistributor(distributorCode);
          setActiveSchemes(schemes);
          console.log(`✅ Loaded ${schemes.length} active schemes for distributor ${distributorCode}`);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem("schemes");
          if (stored) {
            const allSchemes = JSON.parse(stored);
            const now = new Date();
            const active = allSchemes.filter(scheme => {
              const startDate = new Date(scheme.startDate);
              const endDate = new Date(scheme.endDate);
              return startDate <= now && endDate >= now && scheme.distributors?.includes(distributorCode);
            });
            setActiveSchemes(active);
          }
        }
      } catch (error) {
        console.error("Error loading schemes:", error);
        setActiveSchemes([]);
      }
    };
    if (distributorCode) {
      loadSchemes();
      // Reload schemes every hour to check for expired/new schemes
      const interval = setInterval(loadSchemes, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [distributorCode, isSupabaseConfigured]);
  
  // Get target and achieved data from distributor
  const targetData = useMemo(
    () => distributor?.target || { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
    [distributor?.target]
  );
  const achievedData = useMemo(
    () => distributor?.achieved || { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
    [distributor?.achieved]
  );

  /** Dashboard / progress: match stock lifting totals from sales_data when loaded; else stored achieved (e.g. orders-only). */
  const progressAchievedData = useMemo(() => {
    const stored = achievedData;
    if (!isSupabaseConfigured || !Array.isArray(stockLiftingRecords) || stockLiftingRecords.length === 0) {
      return stored;
    }
    const fromSalesDb = stockLiftingRecords.some(
      (r) => r?.id != null && String(r.id).trim() !== ""
    );
    if (!fromSalesDb) {
      return stored;
    }
    let CSD_PC = 0;
    let CSD_UC = 0;
    let Water_PC = 0;
    let Water_UC = 0;
    for (const r of stockLiftingRecords) {
      CSD_PC += Number(r.csdPC) || 0;
      CSD_UC += Number(r.csdUC) || 0;
      Water_PC += Number(r.waterPC) || 0;
      Water_UC += Number(r.waterUC) || 0;
    }
    return { CSD_PC, CSD_UC, Water_PC, Water_UC };
  }, [isSupabaseConfigured, stockLiftingRecords, achievedData]);

  const targetUcAchieved = useMemo(
    () =>
      isCombinedTargetAchievedUC(
        targetData.CSD_UC,
        progressAchievedData.CSD_UC,
        targetData.Water_UC,
        progressAchievedData.Water_UC
      ),
    [targetData, progressAchievedData]
  );

  const deliveredWithInvoiceCount = useMemo(
    () =>
      orders.filter((o) => {
        const s = normalizeOrderStatus(o?.status || "");
        return (
          (s === ORDER_STATUS.DELIVERED || s === "dispatched") && orderHasShippingInvoice(o)
        );
      }).length,
    [orders]
  );

  const pendingOrdersCount = useMemo(
    () =>
      orders.filter((o) => {
        const s = normalizeOrderStatus(o?.status || ORDER_STATUS.PENDING);
        return (
          s === ORDER_STATUS.PENDING ||
          s === ORDER_STATUS.SENT ||
          s === ORDER_STATUS.PENDING_EMAIL_FAILED
        );
      }).length,
    [orders]
  );

  const productRateRows = useMemo(() => {
    const grouped = getCatalogSkusGrouped(productRates);
    return grouped.all.map((p) => ({
      name: p.name,
      category: p.category,
      rate: Number.isFinite(Number(p.rate)) ? Number(p.rate) : null,
      source: "Catalogue",
    }));
  }, [productRates]);

  const physicalStockPayload = useMemo(
    () => getRawPhysicalStockFromDistributor(distributor),
    [distributor]
  );

  const sidebarBadges = useMemo(() => {
    void sidebarBadgeTick; // bumpSidebarBadges() increments tick to re-read localStorage-driven badges
    if (!distributorCode) {
      return { dashboard: false, physicalStock: false, pendingOrders: 0 };
    }
    return {
      dashboard: shouldShowDashboardBadge(distributorCode, targetData, progressAchievedData),
      physicalStock: shouldShowPhysicalStockBadge(distributorCode, physicalStockPayload),
      pendingOrders: pendingOrdersCount,
      shippingInvoices: deliveredWithInvoiceCount,
    };
  }, [
    distributorCode,
    targetData,
    progressAchievedData,
    physicalStockPayload,
    pendingOrdersCount,
    deliveredWithInvoiceCount,
    sidebarBadgeTick,
  ]);

  useEffect(() => {
    if (!distributorCode) return;
    ensureDashboardBaselineIfMissing(distributorCode, targetData, progressAchievedData);
  }, [distributorCode, targetData, progressAchievedData]);

  const bumpSidebarBadges = useCallback(() => {
    setSidebarBadgeTick((n) => n + 1);
  }, []);

  const handlePhysicalStockDialogOpened = useCallback(() => {
    if (!distributorCode) return;
    const raw = getRawPhysicalStockFromDistributor(distributor);
    markPhysicalStockRevisionSeen(distributorCode, raw?.updatedAt || "");
    bumpSidebarBadges();
  }, [distributorCode, distributor, bumpSidebarBadges]);

  const handlePhysicalStockAcknowledged = useCallback(
    (iso) => {
      if (!distributorCode) return;
      markPhysicalStockRevisionSeen(distributorCode, iso || "");
      bumpSidebarBadges();
    },
    [distributorCode, bumpSidebarBadges]
  );

  const getOrderStatus = useCallback((order) => {
    const s = order?.status;
    if (s == null || String(s).trim() === "") return ORDER_STATUS.PENDING;
    return normalizeOrderStatus(s);
  }, []);
  const getOrderKey = useCallback((order) => {
    const on = normalizeOrderNumber(order?.orderNumber);
    if (on) return `ORD-${on}`;
    if (order?.id) return String(order.id);
    return `${order?.timestamp || ""}_${order?.distributorCode || distributorCode || ""}`;
  }, [distributorCode]);

  /** Orders just placed — kept visible until server list catches up (realtime / poll). */
  const pendingPlacedOrdersRef = useRef(new Map());

  const orderBelongsToDistributor = useCallback(
    (o) => {
      const dc = String(distributorCode || "").trim();
      const oc = String(o?.distributorCode || "").trim();
      if (dc && oc && oc.toUpperCase() === dc.toUpperCase()) return true;
      if (dc && oc === dc) return true;
      if (distributorName && o?.distributorName === distributorName) return true;
      return false;
    },
    [distributorCode, distributorName]
  );

  const readLocalOrdersForDistributor = useCallback(() => {
    try {
      const allOrders = readOrdersCache();
      if (!Array.isArray(allOrders)) return [];
      return allOrders.filter(orderBelongsToDistributor);
    } catch {
      return [];
    }
  }, [orderBelongsToDistributor]);

  const applyDistributorOrderList = useCallback(
    (prev, incoming) => {
      const merged = mergeOrdersPreservingInvoices(prev, incoming, getOrderKey);
      let list = filterLocallyDeletedOrders(merged, distributorCode, getOrderKey);

      const now = Date.now();
      const pinned = [];
      for (const [key, entry] of pendingPlacedOrdersRef.current) {
        if (now - entry.placedAt > 120000) {
          pendingPlacedOrdersRef.current.delete(key);
          continue;
        }
        if (!list.some((o) => getOrderKey(o) === key)) {
          pinned.push(entry.order);
        } else {
          pendingPlacedOrdersRef.current.delete(key);
        }
      }
      if (pinned.length > 0) {
        const pinnedKeys = new Set(pinned.map((o) => getOrderKey(o)));
        list = [...pinned, ...list.filter((o) => !pinnedKeys.has(getOrderKey(o)))];
      }
      return list;
    },
    [distributorCode, getOrderKey]
  );

  const refreshDistributorOrders = useCallback(async () => {
    try {
      if (isSupabaseConfigured && distributorCode) {
        const remoteOrders = await getOrdersByDistributor(distributorCode);
        const formatted = remoteOrders.map(formatDistributorOrderRow);
        const localOrders = readLocalOrdersForDistributor();
        const remoteKeys = new Set(formatted.map((o) => getOrderKey(o)));
        const localOnly = localOrders.filter((o) => !remoteKeys.has(getOrderKey(o)));
        const incoming = [...formatted, ...localOnly];
        setOrders((prev) => applyDistributorOrderList(prev, incoming));
        return;
      }
      const myOrders = readLocalOrdersForDistributor();
      if (myOrders.length > 0) {
        setOrders((prev) => applyDistributorOrderList(prev, myOrders));
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      const myOrders = readLocalOrdersForDistributor();
      if (myOrders.length > 0) {
        setOrders((prev) => applyDistributorOrderList(prev, myOrders));
      }
    }
  }, [
    isSupabaseConfigured,
    distributorCode,
    applyDistributorOrderList,
    readLocalOrdersForDistributor,
    getOrderKey,
  ]);

  const mergeInvoiceIntoOrdersState = useCallback(
    (orderKey, invoiceRow) => {
      if (!invoiceRow) return null;
      const patch = {
        shipping_invoice_data: invoiceRow.shipping_invoice_data,
        shipping_invoice_file_name: invoiceRow.shipping_invoice_file_name,
        shipping_invoice_mime_type: invoiceRow.shipping_invoice_mime_type,
        shippingInvoiceData: invoiceRow.shipping_invoice_data,
        shippingInvoiceFileName: invoiceRow.shipping_invoice_file_name,
        shippingInvoiceMimeType: invoiceRow.shipping_invoice_mime_type,
      };
      let merged = null;
      setOrders((prev) =>
        prev.map((o) => {
          if (getOrderKey(o) !== orderKey) return o;
          merged = { ...o, ...patch };
          return merged;
        })
      );
      return merged;
    },
    [getOrderKey]
  );

  const resolveOrderWithShippingInvoice = useCallback(
    async (order) => {
      const key = getOrderKey(order);
      if (orderHasShippingInvoice(order)) return order;

      if (isSupabaseConfigured && (order?.id || order?.orderNumber)) {
        setLoadingInvoiceOrderId(key);
        try {
          const row = await fetchOrderShippingInvoice(order.id, {
            distributorCode: order.distributorCode || distributorCode,
            orderNumber: order.orderNumber,
          });
          if (row?.shipping_invoice_data) {
            return mergeInvoiceIntoOrdersState(key, row) || { ...order, ...row };
          }
        } finally {
          setLoadingInvoiceOrderId(null);
        }
      }

      const all = readOrdersCache();
      if (all.length > 0) {
        try {
          const found = all.find(
            (o) =>
              (order.id && o?.id === order.id) ||
              getOrderKey(o) === key ||
              (o.orderNumber && o.orderNumber === order.orderNumber)
          );
          if (found && orderHasShippingInvoice(found)) {
            mergeInvoiceIntoOrdersState(key, found);
            return found;
          }
        } catch {
          /* ignore */
        }
      }

      return order;
    },
    [distributorCode, getOrderKey, isSupabaseConfigured, mergeInvoiceIntoOrdersState]
  );

  const pushNotification = useCallback((message, type = "info", headline = "", soundVariant = null) => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message,
      headline: headline || (type === "success" ? "Update" : type === "error" ? "Something went wrong" : "Notice"),
      type,
      timestamp: new Date().toLocaleString(),
    };
    setNotifications((prev) => [entry, ...prev].slice(0, 50));
    setUnreadNotifications((prev) => prev + 1);
    playDistributorNotificationSound(type, soundVariant);
  }, []);

  /** @param {string} title Short headline shown above the message */
  const showToast = useCallback((message, severity = "info", duration = 4000, title = "") => {
    setToast({ open: true, message, severity, duration, title });
  }, []);

  const handleViewShippingInvoice = useCallback(
    async (order) => {
      const resolved = await resolveOrderWithShippingInvoice(order);
      if (!orderHasShippingInvoice(resolved)) {
        showToast(
          "No shipping invoice is available for this order yet. Ask shipping to upload the file when dispatching.",
          "info",
          5000,
          "No invoice"
        );
        return;
      }
      setShippingInvoiceOrder(resolved);
      setOpenShippingInvoiceDialog(true);
    },
    [resolveOrderWithShippingInvoice, showToast]
  );

  const handleDownloadShippingInvoice = useCallback(
    async (order) => {
      const resolved = await resolveOrderWithShippingInvoice(order);
      const files = getOrderShippingInvoices(resolved);
      if (files.length === 0) {
        showToast("No invoice file to download.", "warning", 4000, "No invoice");
        return;
      }
      const count = downloadAllShippingInvoices(files);
      showToast(
        count === 1 ? "Invoice download started." : `Downloading ${count} invoice files…`,
        "success",
        4000,
        "Download"
      );
    },
    [resolveOrderWithShippingInvoice, showToast]
  );

  const handleRefreshOrdersList = useCallback(async () => {
    setOrdersRefreshing(true);
    try {
      await refreshDistributorOrders();
      showToast("Orders list updated.", "success", 2800, "Refreshed");
    } catch {
      showToast("Could not refresh orders.", "error", 4000, "Refresh");
    } finally {
      setOrdersRefreshing(false);
    }
  }, [refreshDistributorOrders, showToast]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    notificationsInitializedRef.current = false;
    previousOrderStatusesRef.current = {};
  }, [distributorCode]);

  useEffect(() => {
    if (!notificationsInitializedRef.current) {
      const initialStatuses = {};
      orders.forEach((order) => {
        initialStatuses[getOrderKey(order)] = getOrderStatus(order);
      });
      previousOrderStatusesRef.current = initialStatuses;
      notificationsInitializedRef.current = true;
      return;
    }

    const previous = previousOrderStatusesRef.current || {};
    const nextStatuses = {};
    orders.forEach((order) => {
      const key = getOrderKey(order);
      const status = getOrderStatus(order);
      nextStatuses[key] = status;

      const prevStatus = previous[key];
      if (prevStatus !== undefined && prevStatus !== status) {
        if (status === ORDER_STATUS.DELIVERED) {
          const invCount = getOrderShippingInvoices(order).length;
          const hasInv = invCount > 0 || orderHasShippingInvoice(order);
          const msg = hasInv
            ? invCount > 1
              ? `Order ${key} dispatched with ${invCount} invoice files. Orders → invoice column → View or Download all.`
              : `Order ${key} dispatched. Orders (bottom menu) → invoice column → View or Download.`
            : `Order ${key} has been dispatched. Your goods are on the way. Check Orders later for shipping documents.`;
          pushNotification(msg, "success", "Order dispatched", "delivered");
          showToast(msg, "success", 6500, "Order dispatched");
          (async () => {
            if (typeof window === "undefined" || !("Notification" in window)) return;
            try {
              const iconUrl = getTargetReminderNotificationIconUrl();
              if (Notification.permission === "granted") {
                new Notification("Order dispatched", { body: msg, icon: iconUrl });
              } else if (Notification.permission === "default") {
                const p = await Notification.requestPermission();
                if (p === "granted") {
                  new Notification("Order dispatched", { body: msg, icon: iconUrl });
                }
              }
            } catch (e) {
              console.warn("Browser notification failed:", e);
            }
          })();
        } else if (status === ORDER_STATUS.APPROVED) {
          const msg = `Order ${key} was approved. You can review details under Orders.`;
          pushNotification(msg, "success", "Order approved", "approved");
          showToast(msg, "success", 6000, "Order approved");
          (async () => {
            if (typeof window === "undefined" || !("Notification" in window)) return;
            try {
              const iconUrl = getTargetReminderNotificationIconUrl();
              if (Notification.permission === "granted") {
                new Notification("Order approved", { body: msg, icon: iconUrl });
              } else if (Notification.permission === "default") {
                const p = await Notification.requestPermission();
                if (p === "granted") {
                  new Notification("Order approved", { body: msg, icon: iconUrl });
                }
              }
            } catch (e) {
              console.warn("Browser notification failed:", e);
            }
          })();
        } else if (status === "rejected") {
          const msg = `Order ${key} was rejected. Open Orders for details or place a new order if needed.`;
          pushNotification(msg, "error", "Order rejected");
          showToast(msg, "error", 6500, "Order rejected");
          (async () => {
            if (typeof window === "undefined" || !("Notification" in window)) return;
            try {
              const iconUrl = getTargetReminderNotificationIconUrl();
              if (Notification.permission === "granted") {
                new Notification("Order rejected", { body: msg, icon: iconUrl });
              } else if (Notification.permission === "default") {
                const p = await Notification.requestPermission();
                if (p === "granted") {
                  new Notification("Order rejected", { body: msg, icon: iconUrl });
                }
              }
            } catch (e) {
              console.warn("Browser notification failed:", e);
            }
          })();
        } else {
          pushNotification(`Order ${key} is now: ${status}.`, "info", "Order status");
        }
      }
    });
    previousOrderStatusesRef.current = nextStatuses;
  }, [orders, getOrderKey, getOrderStatus, pushNotification, showToast]);

  useEffect(() => {
    const snapshot = {
      target: targetData,
      achieved: achievedData,
    };

    if (!previousTargetAchievedRef.current) {
      previousTargetAchievedRef.current = snapshot;
      return;
    }

    const prev = previousTargetAchievedRef.current;
    const changed =
      JSON.stringify(prev.target) !== JSON.stringify(targetData) ||
      JSON.stringify(prev.achieved) !== JSON.stringify(achievedData);

    if (changed) {
      pushNotification(
        "Your monthly target or achieved figures were updated by the admin. Check the dashboard cards for the latest numbers.",
        "info",
        "Target or performance updated"
      );
      previousTargetAchievedRef.current = snapshot;
    }
  }, [targetData, achievedData, pushNotification]);

  /** Once per local day: reminder to record stock lifts and review target balance */
  useEffect(() => {
    if (!distributorCode || !distributor) return;
    const claimed = tryClaimDailyStockLiftReminder(distributorCode);
    if (!claimed) return;

    const period = getTargetPeriod();
    const rem = getDaysRemaining(period.end);

    const rows = [
      {
        category: "CSD",
        targetPC: targetData.CSD_PC || 0,
        targetUC: targetData.CSD_UC || 0,
        achievedPC: progressAchievedData.CSD_PC || 0,
        achievedUC: progressAchievedData.CSD_UC || 0,
      },
      {
        category: "Kinley Water",
        targetPC: targetData.Water_PC || 0,
        targetUC: targetData.Water_UC || 0,
        achievedPC: progressAchievedData.Water_PC || 0,
        achievedUC: progressAchievedData.Water_UC || 0,
      },
    ];

    const message = buildTargetBalanceReminderMessage({
      remainingDays: rem,
      periodEndYmd: period.end,
      rows,
    });

    pushNotification(message, "info", "Daily stock-lift reminder");

    (async () => {
      if (typeof window === "undefined" || !("Notification" in window)) return;
      try {
        const iconUrl = getTargetReminderNotificationIconUrl();
        const title = "Daily stock-lift reminder";
        if (Notification.permission === "granted") {
          new Notification(title, {
            body: message,
            icon: iconUrl,
            tag: "coke-daily-stock-lift",
          });
        } else if (Notification.permission === "default") {
          const p = await Notification.requestPermission();
          if (p === "granted") {
            new Notification(title, {
              body: message,
              icon: iconUrl,
              tag: "coke-daily-stock-lift",
            });
          }
        }
      } catch (e) {
        console.warn("Browser notification failed:", e);
      }
    })();
  }, [distributorCode, distributor, targetData, progressAchievedData, targetPeriodRev, pushNotification]);

  /** UC combined target crossed to achieved: bell + toast + in-app + browser (once per period after baseline) */
  useEffect(() => {
    if (!distributorCode) return;
    const period = getTargetPeriod();
    const scope = `${distributorCode}|${period?.end || ""}`;
    const r = distributorUcAchievementNotifyRef.current;
    if (r.scope !== scope) {
      r.scope = scope;
      r.prevAchieved = targetUcAchieved;
      return;
    }
    if (r.prevAchieved === false && targetUcAchieved === true) {
      const body =
        "Your CSD and Kinley water UC targets are met for this period (or your CSD UC above target covers the Kinley water UC shortfall per policy).";
      pushNotification(body, "success", "Target achieved", "target");
      showToast(body, "success", 9500, "Target achieved");
      (async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        try {
          const iconUrl = getTargetReminderNotificationIconUrl();
          if (Notification.permission === "granted") {
            new Notification("Target achieved", { body, icon: iconUrl, tag: "coke-target-achieved-dist" });
          } else if (Notification.permission === "default") {
            const p = await Notification.requestPermission();
            if (p === "granted") {
              new Notification("Target achieved", { body, icon: iconUrl, tag: "coke-target-achieved-dist" });
            }
          }
        } catch (e) {
          console.warn("Target achieved browser notification failed:", e);
        }
      })();
    }
    r.prevAchieved = targetUcAchieved;
  }, [distributorCode, targetUcAchieved, targetPeriodRev, pushNotification, showToast]);

  // Load orders from Supabase or localStorage
  useEffect(() => {
    refreshDistributorOrders();
  }, [refreshDistributorOrders]);

  // All order numbers known on this device + Supabase (calculator preview + allocation)
  const globalUsedOrderNumbersRef = useRef(loadUsedOrderNumbersFromLocalStorage());

  const peekGlobalOrderNumber = useCallback(() => {
    const used =
      globalUsedOrderNumbersRef.current || loadUsedOrderNumbersFromLocalStorage();
    return peekNextUniqueOrderNumber(used);
  }, []);

  const allocateGlobalOrderNumber = useCallback(async () => {
    return allocateUniqueOrderNumber(
      isSupabaseConfigured
        ? supabaseOrderNumberOptions(() => fetchAllOrderNumbers(distributorCode))
        : {}
    );
  }, [isSupabaseConfigured, distributorCode]);

  // Keep local order counter above all numbers in Supabase (calculator preview + new orders)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const { syncOrderNumberCounterFromUsed } = await import("../utils/orderNumber");
        const remote = await fetchAllOrderNumbers(distributorCode);
        if (cancelled) return;
        const used = loadUsedOrderNumbersFromLocalStorage();
        for (const n of remote) {
          const key = normalizeOrderNumber(n);
          if (key) used.add(key);
        }
        globalUsedOrderNumbersRef.current = used;
        syncOrderNumberCounterFromUsed(used);
      } catch (e) {
        console.warn("Could not sync order number counter from Supabase:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured, distributorCode]);

  // Poll Supabase so approve/reject shows even if Realtime is off or flaky (admin dashboard uses the same interval)
  useEffect(() => {
    if (!isSupabaseConfigured || !distributorCode) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refreshDistributorOrders();
    }, 5000);
    return () => clearInterval(id);
  }, [isSupabaseConfigured, distributorCode, refreshDistributorOrders]);

  // Other tabs / admin session on same browser: localStorage-only deployments
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const onStorage = (e) => {
      if (e.key !== ordersCacheStorageKey()) return;
      refreshDistributorOrders();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isSupabaseConfigured, refreshDistributorOrders]);

  // Subscribe to real-time order updates (do not depend on `orders` — that re-subscribed on every status change and broke sync)
  useEffect(() => {
    if (!isSupabaseConfigured || !distributorCode) return;
    const unsubscribe = subscribeToOrders(distributorCode, (firebaseOrders) => {
      const formatted = firebaseOrders.map(formatDistributorOrderRow);
      setOrders((prev) => applyDistributorOrderList(prev, formatted));
    });
    return () => unsubscribe();
  }, [distributorCode, isSupabaseConfigured, applyDistributorOrderList]);

  useEffect(() => {
    stockLiftingFingerprintRef.current = null;
  }, [distributorCode]);

  // Load stock lifting records from sales_data
  useEffect(() => {
    const loadStockLiftingRecords = async () => {
      try {
        if (isSupabaseConfigured && distributorCode) {
          const records = await getStockLiftingRecords(distributorCode);
          setStockLiftingRecords(records);
          stockLiftingFingerprintRef.current = fingerprintStockLiftingRecords(records);
        } else {
          // Fallback: use orders as stock lifting records if no sales data
          setStockLiftingRecords(orders.map(order => ({
            date: order.timestamp ? new Date(order.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            timestamp: order.timestamp || order.created_at || new Date().toLocaleString(),
            created_at: order.created_at || order.timestamp,
            csdPC: order.csdPC || 0,
            csdUC: order.csdUC || 0,
            waterPC: order.waterPC || 0,
            waterUC: order.waterUC || 0,
          })));
        }
      } catch (error) {
        console.error("Error loading stock lifting records:", error);
        // Fallback to orders
        setStockLiftingRecords(orders.map(order => ({
          date: order.timestamp ? new Date(order.timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          timestamp: order.timestamp || order.created_at || new Date().toLocaleString(),
          created_at: order.created_at || order.timestamp,
          csdPC: order.csdPC || 0,
          csdUC: order.csdUC || 0,
          waterPC: order.waterPC || 0,
          waterUC: order.waterUC || 0,
        })));
      }
    };
    loadStockLiftingRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributorCode, isSupabaseConfigured]);

  // Subscribe to sales_data changes to refresh stock lifting records
  useEffect(() => {
    if (isSupabaseConfigured && distributorCode) {
      const unsubscribe = subscribeToSalesData(async () => {
        try {
          const records = await getStockLiftingRecords(distributorCode);
          const nextFp = fingerprintStockLiftingRecords(records);
          const prevFp = stockLiftingFingerprintRef.current;
          setStockLiftingRecords(records);
          if (prevFp !== null && prevFp !== nextFp) {
            setSalesRefreshNoticeOpen(true);
            try {
              playSalesDataRefreshChime();
            } catch {
              /* ignore */
            }
          }
          stockLiftingFingerprintRef.current = nextFp;
        } catch (error) {
          console.error("Error refreshing stock lifting records:", error);
        }
      });
      return () => unsubscribe();
    }
  }, [distributorCode, isSupabaseConfigured]);

  const handleStockLiftRowClick = useCallback(
    (record) => {
      const salesRecord = stockLiftRowToSalesRecord(record);
      if (!salesRecord) return;
      setStockLiftingSkuDialog({
        title: "SKU liftings · one lift",
        subtitle: distributorName,
        salesRecords: [salesRecord],
        liftDateLabel: formatStockLiftSkuDialogDate(record),
      });
    },
    [distributorName]
  );

  const handleStockLiftTotalsClick = useCallback(
    (records) => {
      const salesRecords = (records || []).map(stockLiftRowToSalesRecord).filter(Boolean);
      if (!salesRecords.length) return;
      setStockLiftingSkuDialog({
        title: "SKU liftings · all lifts",
        subtitle: distributorName,
        salesRecords,
        liftDateLabel: `${salesRecords.length} lifting row(s)`,
      });
    },
    [distributorName]
  );

  const stockLiftSkuHandlers =
    stockLiftingRecords.length > 0
      ? { onLiftRowClick: handleStockLiftRowClick, onTotalsClick: handleStockLiftTotalsClick }
      : {};

  const setDistributorCurrentView = useCallback((view) => {
    try {
      localStorage.setItem(DISTRIBUTOR_VIEW_STORAGE_KEY, view);
    } catch (error) {
      console.warn("Could not persist distributor current view:", error);
    }
  }, [DISTRIBUTOR_VIEW_STORAGE_KEY]);

  const openDashboard = () => {
    if (distributorCode) {
      markDashboardTargetSeen(distributorCode, targetData, progressAchievedData);
      bumpSidebarBadges();
    }
    setShowCalculator(false);
    setOpenOrdersListDialog(false);
    setOpenProductRateDialog(false);
    setOpenStockLiftingDialog(false);
    setOpenPhysicalStockDialog(false);
    setEditingOrder(null);
    setCalculatorInitialInputs(null);
    setDistributorCurrentView("dashboard");
  };

  const openStockLiftingFullscreen = () => {
    setOpenStockLiftingDialog(true);
    setDistributorCurrentView("stock_lifting");
  };

  const isHomeActive =
    !showCalculator &&
    !openOrdersListDialog &&
    !openProductRateDialog &&
    !openPhysicalStockDialog &&
    !openStockLiftingDialog;

  const openNewOrder = async () => {
    await loadProductRates();
    setEditingOrder(null);
    setCalculatorInitialInputs(null);
    setShowCalculator(true);
    setDistributorCurrentView("calculator");
  };

  const openOrdersList = () => {
    setOpenOrdersListDialog(true);
    setDistributorCurrentView("orders");
  };

  const openRateList = async () => {
    setOpenProductRateDialog(true);
    setDistributorCurrentView("product_rates");
    await loadProductRates();
  };

  const openPhysicalStock = async () => {
    await loadProductRates();
    setOpenPhysicalStockDialog(true);
    setDistributorCurrentView("physical_stock");
  };

  useEffect(() => {
    try {
      const savedView = localStorage.getItem(DISTRIBUTOR_VIEW_STORAGE_KEY);
      if (!savedView) return;

      if (savedView === "orders") setOpenOrdersListDialog(true);
      if (savedView === "product_rates") setOpenProductRateDialog(true);
      if (savedView === "stock_lifting") setOpenStockLiftingDialog(true);
      if (savedView === "physical_stock") {
        loadProductRates().finally(() => setOpenPhysicalStockDialog(true));
      }
      if (savedView === "calculator") setShowCalculator(true);
    } catch (error) {
      console.warn("Could not restore distributor current view:", error);
    }
  }, [DISTRIBUTOR_VIEW_STORAGE_KEY, loadProductRates]);

  // Target period: localStorage, refreshed when Supabase global period is loaded (targetPeriodRev)
  const targetPeriod = useMemo(() => {
    void targetPeriodRev;
    return getTargetPeriod();
  }, [targetPeriodRev]);
  const targetStart = targetPeriod.start;
  const targetEnd = targetPeriod.end;
  
  // Use actual distributor data from localStorage
  const progressData = [
    { 
      category: "CSD", 
      targetPC: targetData.CSD_PC || 0, 
      targetUC: targetData.CSD_UC || 0, 
      achievedPC: progressAchievedData.CSD_PC || 0, 
      achievedUC: progressAchievedData.CSD_UC || 0 
    },
    { 
      category: "Kinley Water", 
      targetPC: targetData.Water_PC || 0, 
      targetUC: targetData.Water_UC || 0, 
      achievedPC: progressAchievedData.Water_PC || 0, 
      achievedUC: progressAchievedData.Water_UC || 0 
    },
  ];
  
  const remainingDays = getDaysRemaining(targetEnd);

  const today = new Date();

  const attachOrderTableImage = useCallback(
    async (orderNumber, tableImageData, orderId = null) => {
      const on = normalizeOrderNumber(orderNumber);
      if (!on || !tableImageData) return;

      const identityFallback =
        distributorCode && on ? { distributorCode, orderNumber: on } : null;

      setOrders((prev) =>
        prev.map((o) =>
          normalizeOrderNumber(o.orderNumber) === on ? { ...o, tableImageData } : o
        )
      );

      try {
        const allOrders = readOrdersCache();
        if (Array.isArray(allOrders) && allOrders.length > 0) {
          const updated = allOrders.map((o) =>
            normalizeOrderNumber(o.orderNumber) === on ? { ...o, tableImageData } : o
          );
          writeOrdersCache(updated);
        }
      } catch (storageError) {
        console.warn("Could not save order table image to localStorage:", storageError);
      }

      if (isSupabaseConfigured && (orderId || identityFallback)) {
        try {
          await patchOrderFields(orderId, { tableImageData }, identityFallback);
        } catch (patchError) {
          console.warn("Could not save order table image to Supabase:", patchError);
        }
      }
    },
    [distributorCode, isSupabaseConfigured]
  );

  // Handle order placement / re-submission from calculator
  const handlePlaceOrder = async (orderData, orderNumber, tableImageData = null, editContext = null, orderCaption = "") => {
    try {
      const timestamp = new Date().toLocaleString();
      const normalizedCaption =
        (typeof orderCaption === "string" && orderCaption.trim()) ||
        (Array.isArray(orderData) && typeof orderData[0]?.orderCaption === "string" && orderData[0].orderCaption.trim()) ||
        "";
      
      // Calculate CSD and Water UC/PC from order
      let csdUC = 0, waterUC = 0, csdPC = 0, waterPC = 0;
      
      orderData.forEach(item => {
        const category = item.category || "CSD"; // Use category from order data
        
        if (category === "CSD") {
          csdUC += (item.totalUC || 0);
          csdPC += (item.cases || 0);
        } else if (category === "Water") {
          waterUC += (item.totalUC || 0);
          waterPC += (item.cases || 0);
        }
      });
      
      // Edit order flow: update existing order instead of creating a new one
      if (editContext?.isEdit && editContext?.orderKey) {
        const existingOrder = orders.find((o) => getOrderKey(o) === editContext.orderKey) || editingOrder;
        const currentEditedCount = Number(existingOrder?.editedCount || 0);
        const updatedOrder = {
          ...existingOrder,
          data: orderData,
          timestamp,
          totalUC: csdUC + waterUC,
          csdUC,
          waterUC,
          csdPC,
          waterPC,
          orderNumber: existingOrder?.orderNumber || orderNumber,
          tableImageData: existingOrder?.tableImageData || null,
          status: "pending",
          isEdited: true,
          editedAt: new Date().toISOString(),
          editedCount: currentEditedCount + 1,
          caption: normalizedCaption
        };

        let supabaseUpdatedOrder = null;

        if (isSupabaseConfigured) {
          try {
            let targetOrderId = editContext.orderId || updatedOrder.id || null;

            // Fallback lookup when id is missing in local state.
            if (!targetOrderId && updatedOrder.orderNumber && updatedOrder.distributorCode) {
              const { data: foundOrders, error: findError } = await supabase
                .from("orders")
                .select("id")
                .eq("distributorCode", updatedOrder.distributorCode)
                .eq("orderNumber", updatedOrder.orderNumber)
                .order("created_at", { ascending: false })
                .limit(1);
              if (findError) {
                console.warn("Could not resolve order id for edit sync:", findError);
              } else if (foundOrders && foundOrders.length > 0) {
                targetOrderId = foundOrders[0].id;
              }
            }

            const editFallback =
              updatedOrder.distributorCode &&
              updatedOrder.orderNumber != null &&
              String(updatedOrder.orderNumber).trim() !== ""
                ? {
                    distributorCode: updatedOrder.distributorCode,
                    orderNumber: updatedOrder.orderNumber,
                  }
                : null;

            if (targetOrderId || editFallback) {
              supabaseUpdatedOrder = await updateOrderStatusInSupabase(
                targetOrderId,
                "pending",
                {
                  data: orderData,
                  timestamp,
                  totalUC: csdUC + waterUC,
                  csdUC,
                  waterUC,
                  csdPC,
                  waterPC,
                  orderNumber: updatedOrder.orderNumber,
                  tableImageData: existingOrder?.tableImageData || null,
                  caption: updatedOrder.caption,
                },
                editFallback
              );
            } else {
              showToast(
                "We could not find this order on the server. Try refreshing the page, then edit again.",
                "error",
                5000,
                "Order not updated"
              );
              return;
            }
          } catch (supabaseError) {
            console.error("Failed to sync edited order to Supabase:", supabaseError);
            showToast(
              supabaseError?.message || "Check your connection and try again.",
              "error",
              5000,
              "Could not update order"
            );
            return;
          }
        }

        // Update UI state after successful server sync (or local-only mode)
        const finalUpdatedOrder = supabaseUpdatedOrder
          ? { ...updatedOrder, ...supabaseUpdatedOrder }
          : updatedOrder;
        setOrders((prev) =>
          prev.map((o) => (getOrderKey(o) === editContext.orderKey ? finalUpdatedOrder : o))
        );

        try {
          const allOrders = readOrdersCache();
          if (allOrders.length > 0) {
            const updatedOrders = allOrders.map((o) =>
              getOrderKey(o) === editContext.orderKey ? finalUpdatedOrder : o
            );
            writeOrdersCache(updatedOrders);
          }
        } catch (storageError) {
          console.warn("Error updating localStorage edited order:", storageError);
        }

        setEditingOrder(null);
        setCalculatorInitialInputs(null);
        setShowCalculator(false);
        setDistributorCurrentView("dashboard");
        const updatedMsg = `Order ${updatedOrder.orderNumber || editContext.orderKey} was updated and sent back as pending for review.`;
        pushNotification(updatedMsg, "success", "Order updated");
        showToast(updatedMsg, "success", 4200, "Order updated");
        return {
          orderNumber: updatedOrder.orderNumber,
          orderId: finalUpdatedOrder.id || editContext.orderId || null,
        };
      }

      const totalUC = csdUC + waterUC;
      let finalOrderNumber = await allocateGlobalOrderNumber();

      const canonicalCode = String(distributorCode || distributor?.code || "").trim();
      const order = {
        distributorCode: canonicalCode,
        distributorName: distributorName,
        data: orderData,
        timestamp,
        totalUC,
        csdUC,
        waterUC,
        csdPC,
        waterPC,
        orderNumber: finalOrderNumber,
        tableImageData: null,
        status: "pending",
        caption: normalizedCaption,
      };

      if (isSupabaseConfigured) {
        const maxSaveAttempts = 5;
        let savedOrder = null;
        for (let attempt = 0; attempt < maxSaveAttempts; attempt++) {
          try {
            savedOrder = await saveOrder(order);
            break;
          } catch (saveError) {
            if (isOrderNumberUniqueViolation(saveError) && attempt < maxSaveAttempts - 1) {
              finalOrderNumber = await allocateGlobalOrderNumber();
              order.orderNumber = finalOrderNumber;
              continue;
            }
            throw saveError;
          }
        }
        if (!savedOrder) {
          throw new Error("Could not save order with a unique order number");
        }
        order.id = savedOrder.id;
        if (savedOrder.distributorCode) {
          order.distributorCode = String(savedOrder.distributorCode).trim();
        }
        if (savedOrder.orderNumber != null) {
          order.orderNumber = savedOrder.orderNumber;
          finalOrderNumber = savedOrder.orderNumber;
        }
        if (savedOrder.status) {
          order.status = savedOrder.status;
        }
        const usedKey = normalizeOrderNumber(finalOrderNumber);
        if (usedKey) {
          const used = globalUsedOrderNumbersRef.current || new Set();
          used.add(usedKey);
          globalUsedOrderNumbersRef.current = used;
        }
      }

      const allOrders = readOrdersCache();
      allOrders.push(order);
      writeOrdersCache(allOrders);

      const placedKey = getOrderKey(order);
      unmarkOrderLocallyDeleted(distributorCode, placedKey);
      pendingPlacedOrdersRef.current.set(placedKey, { order, placedAt: Date.now() });

      setOrders((prev) => {
        const rest = filterLocallyDeletedOrders(
          prev.filter((o) => getOrderKey(o) !== placedKey),
          distributorCode,
          getOrderKey
        );
        return [order, ...rest];
      });

      void logActivity(
        ACTIVITY_TYPES.ORDER_CREATED,
        `Order placed: ${distributorName} - Total UC: ${totalUC.toFixed(2)}`,
        {
          distributorName,
          distributorCode: distributorCode || distributor?.code,
          orderId: order.id || `ORD-${Date.now()}`,
          totalUC,
          itemCount: orderData.length,
          userEmail: distributorName,
          userName: distributorName,
        }
      );

      if (tableImageData) {
        void attachOrderTableImage(finalOrderNumber, tableImageData, order.id);
      }
      
      const orderPlacedMessage = `Order #${finalOrderNumber} is submitted. CSD UC: ${csdUC.toFixed(2)}, Water UC: ${waterUC.toFixed(2)}. You’ll get a notification when it’s approved or rejected.`;
      pushNotification(orderPlacedMessage, "success", "Order placed", "submitted");
      showToast(orderPlacedMessage, "success", 5200, "Order placed");
      (async () => {
        if (typeof window === "undefined" || !("Notification" in window)) return;
        try {
          const iconUrl = getTargetReminderNotificationIconUrl();
          const title = "Order placed";
          const body = `Order #${finalOrderNumber} submitted — pending admin review.`;
          if (Notification.permission === "granted") {
            new Notification(title, { body, icon: iconUrl, tag: `coke-order-placed-${finalOrderNumber}` });
          } else if (Notification.permission === "default") {
            const p = await Notification.requestPermission();
            if (p === "granted") {
              new Notification(title, { body, icon: iconUrl, tag: `coke-order-placed-${finalOrderNumber}` });
            }
          }
        } catch (e) {
          console.warn("Order placed notification failed:", e);
        }
      })();

      setOpenOrdersListDialog(true);
      setDistributorCurrentView("orders");

      return { orderNumber: finalOrderNumber, orderId: order.id || null };
    } catch (error) {
      console.error("Error placing order:", error);
      const errBody =
        error?.message && String(error.message).length < 200
          ? error.message
          : "Check your connection and try again. If this continues, contact support.";
      pushNotification(`Could not place order: ${errBody}`, "error", "Order failed");
      showToast(errBody, "error", 5000, "Could not place order");
    }
  };

  const handleCancelOrder = async (order) => {
    try {
      const currentStatus = getOrderStatus(order);
      if (
        currentStatus !== ORDER_STATUS.PENDING &&
        currentStatus !== ORDER_STATUS.SENT &&
        currentStatus !== ORDER_STATUS.PENDING_EMAIL_FAILED
      ) {
        showToast(
          "Only orders that are still pending, sent, or email-failed can be canceled. Approved or rejected orders can’t be canceled here.",
          "warning",
          5000,
          "Can’t cancel this order"
        );
        return;
      }

      const confirmed = window.confirm(
        "Cancel and remove this order? It will be deleted from the app, local storage, and the server (if connected)."
      );
      if (!confirmed) return;

      const orderKey = getOrderKey(order);
      const cancelMarker = order?.id || order?.orderNumber || orderKey;
      setCancelingOrderId(cancelMarker);

      const previousOrdersSnapshot = orders;

      const codeForDelete = String(order?.distributorCode || distributorCode || "").trim();
      const normalizedOrderNumber = normalizeOrderNumber(order?.orderNumber);
      const deleteFallback =
        codeForDelete && normalizedOrderNumber
          ? { distributorCode: codeForDelete, orderNumber: normalizedOrderNumber }
          : null;

      // Remove from UI immediately
      setOrders((prev) => prev.filter((o) => getOrderKey(o) !== orderKey));

      if (previousOrderStatusesRef.current && orderKey in previousOrderStatusesRef.current) {
        const nextPrev = { ...previousOrderStatusesRef.current };
        delete nextPrev[orderKey];
        previousOrderStatusesRef.current = nextPrev;
      }

      removeOrderFromCokeOrdersLocalStorage(order, { distributorCode: codeForDelete, getOrderKey });
      markOrderLocallyDeleted(distributorCode, orderKey);

      if (isSupabaseConfigured && (order?.id || deleteFallback)) {
        try {
          await deleteOrderFromSupabase(order?.id, deleteFallback);
        } catch (supabaseError) {
          const msg = String(supabaseError?.message || supabaseError);
          const notInDb = /no matching order found/i.test(msg);
          if (notInDb) {
            console.warn("Order removed locally; no Supabase row matched:", deleteFallback || order?.id);
          } else {
            console.error("Failed to delete order from Supabase:", supabaseError);
            setOrders(previousOrdersSnapshot);
            try {
              const restored = [...readOrdersCache()];
              const stillMissing = !restored.some((o) => getOrderKey(o) === orderKey);
              if (stillMissing) restored.push(order);
              writeOrdersCache(restored);
            } catch (rollbackStorageError) {
              console.warn("Error rolling back localStorage after failed delete:", rollbackStorageError);
            }
            unmarkOrderLocallyDeleted(distributorCode, orderKey);
            throw new Error(msg);
          }
        }
      }

      if (
        orderForCalculatedTable &&
        getOrderKey(orderForCalculatedTable) === orderKey
      ) {
        setOrderForCalculatedTable(null);
        setOpenOrderCalculatedDialog(false);
      }

      void logActivity(
        ACTIVITY_TYPES.ORDER_CANCELED,
        `Order canceled by distributor: ${order.orderNumber || orderKey} (${distributorName || distributorCode})`,
        {
          orderId: orderKey,
          orderNumber: order.orderNumber,
          distributorCode: codeForDelete || distributorCode,
          distributorName,
          userName: distributorName,
          userEmail: distributorCode,
        }
      );

      pushNotification(
        `Order ${order.orderNumber || orderKey} was removed.`,
        "warning",
        "Order canceled"
      );
    } catch (error) {
      console.error("Error canceling order:", error);
      showToast(
        error?.message || "Try again in a moment. If the order still shows, refresh the page.",
        "error",
        5000,
        "Could not cancel order"
      );
    } finally {
      setCancelingOrderId(null);
    }
  };

  /** Row click: saved calculated table; loads shipping invoice from server when needed. */
  const handleViewOrderCalculatedTable = async (order) => {
    const resolved = await resolveOrderWithShippingInvoice(order);
    setOrderForCalculatedTable(resolved);
    setOpenOrderCalculatedDialog(true);
  };

  /** Edit icon: full calculator to change and resubmit (not available for approved). */
  const handleEditOrderInCalculator = async (order) => {
    await loadProductRates();
    const initial = {};
    (order?.data || []).forEach((row) => {
      if (row?.sku) initial[row.sku] = Number(row.cases || 0);
    });
    setEditingOrder(order);
    setCalculatorInitialInputs(initial);
    setOpenOrdersListDialog(false);
    setShowCalculator(true);
    setDistributorCurrentView("calculator");
  };

  const anyDashboardDialogOpen =
    notificationsOpen ||
    salesRefreshNoticeOpen ||
    showCalculator ||
    openOrdersListDialog ||
    openShippingInvoiceDialog ||
    openOrderCalculatedDialog ||
    openProductRateDialog ||
    openStockLiftingDialog ||
    openPhysicalStockDialog;

  const closeTopDashboardDialog = useCallback(() => {
    if (salesRefreshNoticeOpen) {
      setSalesRefreshNoticeOpen(false);
      return;
    }
    if (notificationsOpen) {
      setNotificationsOpen(false);
      return;
    }
    if (openShippingInvoiceDialog) {
      setOpenShippingInvoiceDialog(false);
      setShippingInvoiceOrder(null);
      return;
    }
    if (openOrderCalculatedDialog) {
      setOpenOrderCalculatedDialog(false);
      setOrderForCalculatedTable(null);
      return;
    }
    if (showCalculator) {
      setShowCalculator(false);
      setEditingOrder(null);
      setCalculatorInitialInputs(null);
      setDistributorCurrentView("dashboard");
      return;
    }
    if (openOrdersListDialog) {
      setOpenOrdersListDialog(false);
      setDistributorCurrentView("dashboard");
      return;
    }
    if (openProductRateDialog) {
      setOpenProductRateDialog(false);
      setDistributorCurrentView("dashboard");
      return;
    }
    if (openStockLiftingDialog) {
      setOpenStockLiftingDialog(false);
      setDistributorCurrentView("dashboard");
      return;
    }
    if (openPhysicalStockDialog) {
      setOpenPhysicalStockDialog(false);
      setDistributorCurrentView("dashboard");
    }
  }, [
    salesRefreshNoticeOpen,
    notificationsOpen,
    openShippingInvoiceDialog,
    openOrderCalculatedDialog,
    showCalculator,
    openOrdersListDialog,
    openProductRateDialog,
    openStockLiftingDialog,
    openPhysicalStockDialog,
    setDistributorCurrentView,
  ]);

  useEffect(() => {
    if (!anyDashboardDialogOpen || dialogBackHistoryRef.current || typeof window === "undefined") return;
    window.history.pushState({ cokeDashboardDialog: true }, "", window.location.href);
    dialogBackHistoryRef.current = true;
  }, [anyDashboardDialogOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (!dialogBackHistoryRef.current) return;
      dialogBackHistoryRef.current = false;
      closeTopDashboardDialog();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeTopDashboardDialog]);

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      <AppBar elevation={0} sx={{ ...saasAppBarSx(theme), zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={saasAppBarToolbarSx()}>
          <SaasAppBarTitle
            title={distributorName}
            subtitle={`Distributor workspace · ${today.toLocaleDateString()}`}
          />
          <WorkspaceChip sx={{ display: { xs: "none", sm: "flex" } }} />
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

      {/* Main Content */}
      <Box
        component="main"
        className="distributor-dashboard-main"
        sx={saasDashboardMainSx(theme, { withBottomNav: true })}
      >
        <Toolbar />

        <Box sx={{ width: "100%", maxWidth: 1180, mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            mb: 2.5,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: (t) => alpha(t.palette.background.paper, t.palette.mode === "dark" ? 0.55 : 0.92),
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: "primary.main",
            }}
          >
            <WavingHandIcon />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
              Welcome back
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.45 }}>
              Track targets and stock lifts, then place orders from the center button below.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.25 }}>
              {sidebarBadges.pendingOrders > 0 ? (
                <Chip
                  size="small"
                  color="warning"
                  label={`${sidebarBadges.pendingOrders} pending order${sidebarBadges.pendingOrders === 1 ? "" : "s"}`}
                  onClick={openOrdersList}
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                />
              ) : null}
              {sidebarBadges.shippingInvoices > 0 ? (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  label={`${sidebarBadges.shippingInvoices} invoice${sidebarBadges.shippingInvoices === 1 ? "" : "s"} ready`}
                  onClick={openOrdersList}
                  sx={{ fontWeight: 700, cursor: "pointer" }}
                />
              ) : null}
              <Chip
                size="small"
                variant="outlined"
                label={`${remainingDays} day${remainingDays === 1 ? "" : "s"} left in period`}
                sx={{ fontWeight: 600 }}
              />
            </Stack>
          </Box>
        </Paper>

        <DistributorHomeTip
          distributorCode={distributorCode}
          onPlaceOrder={openNewOrder}
          onOpenOrders={openOrdersList}
        />
        <Card
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            mb: 2.5,
            borderRadius: 3,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.35 : 0.22),
            boxShadow: `0 16px 44px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.08)}`,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: { xs: 1.5, md: 2.25 },
              alignItems: "stretch",
            }}
          >
            <Box>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.1, mb: 1, flexWrap: "wrap" }}>
                <DashboardPanelIcon paletteColor="info">
                  <BarChartIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
                </DashboardPanelIcon>
                <Box sx={{ flex: "1 1 140px", minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 600, fontSize: { xs: "0.84rem", sm: "0.95rem" } }}>
                    Target balance
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25, lineHeight: 1.35 }}>
                    Achievement vs remaining balance — UC sets achievement.
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={targetUcAchieved ? "Achieved" : "Not achieved"}
                  color={targetUcAchieved ? "success" : "warning"}
                  sx={{ fontWeight: 700, flexShrink: 0, ml: { xs: "auto", sm: 0 } }}
                />
              </Box>
              <TargetAchievementBalanceSummary
                csdAchievedPC={progressAchievedData.CSD_PC || 0}
                csdAchievedUC={progressAchievedData.CSD_UC || 0}
                csdBalancePC={(targetData.CSD_PC || 0) - (progressAchievedData.CSD_PC || 0)}
                csdBalanceUC={Math.round((targetData.CSD_UC || 0) - (progressAchievedData.CSD_UC || 0))}
                waterAchievedPC={progressAchievedData.Water_PC || 0}
                waterAchievedUC={progressAchievedData.Water_UC || 0}
                waterBalancePC={(targetData.Water_PC || 0) - (progressAchievedData.Water_PC || 0)}
                waterBalanceUC={Math.round((targetData.Water_UC || 0) - (progressAchievedData.Water_UC || 0))}
              />
            </Box>

            <Box
              sx={{
                borderLeft: { xs: 0, md: "1px solid" },
                borderTop: { xs: "1px solid", md: 0 },
                borderColor: "divider",
                pl: { xs: 0, md: 2.5 },
                pt: { xs: 1.35, md: 0 },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 1,
                  mb: 1.1,
                  flexWrap: "wrap",
                }}
              >
                <DashboardPanelIcon paletteColor="success">
                  <CalendarMonth sx={{ fontSize: { xs: 22, sm: 26 } }} />
                </DashboardPanelIcon>
                <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "text.secondary", fontWeight: 600, fontSize: { xs: "0.84rem", sm: "0.95rem" } }}
                  >
                    Target Period
                  </Typography>
                </Box>
                <Box
                  sx={{
                    flexShrink: 0,
                    ml: { xs: "auto", sm: 0 },
                    alignSelf: "center",
                    textAlign: "right",
                    lineHeight: 1.15,
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{
                      display: "block",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      fontSize: "0.55rem",
                      color: "text.secondary",
                      lineHeight: 1.2,
                    }}
                  >
                    Days Remaining
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                      color: "success.main",
                      lineHeight: 1,
                      fontSize: { xs: "1.25rem", sm: "1.4rem" },
                    }}
                  >
                    {remainingDays}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ width: "100%", minWidth: 0 }}>
                <TargetPeriodCalendarPreview startYmd={targetStart} endYmd={targetEnd} compact fillWidth minPanels={2} />
              </Box>
            </Box>
          </Box>
        </Card>

        <DashboardSectionHeading
          id="distributor-target-progress-heading"
          title="Target progress tracker"
          subtitle="Target, achieved, and balance by category (PC and UC)"
        />

        <TableContainer
          component={Paper}
          elevation={theme.palette.mode === "dark" ? 4 : 2}
          sx={{
            borderRadius: 3,
            width: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            mb: 3,
            border: 1,
            borderColor: "divider",
            boxShadow: `0 12px 34px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.26 : 0.07)}`,
          }}
        >
          <Table
            size="medium"
            aria-labelledby="distributor-target-progress-heading"
            sx={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              minWidth: { xs: 300, sm: 520 },
            }}
          >
            <caption style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}>
              Target, achieved, and balance by category in PC and UC
            </caption>
            <TableHead>
              <TableRow>
                <TableCell
                  rowSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    bgcolor: tableHeaderBg(theme),
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    p: { xs: 0.85, sm: 1.25 },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    width: { xs: "18%", sm: "auto" },
                    verticalAlign: "middle",
                  }}
                >
                  Category
                </TableCell>
                <TableCell
                  colSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    bgcolor: tableHeaderBg(theme),
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    p: { xs: 0.85, sm: 1.25 },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    width: { xs: "27%", sm: "auto" },
                  }}
                >
                  Target
                </TableCell>
                <TableCell
                  colSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    bgcolor: tableHeaderBg(theme),
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    p: { xs: 0.85, sm: 1.25 },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    width: { xs: "27%", sm: "auto" },
                  }}
                >
                  Achieved
                </TableCell>
                <TableCell
                  colSpan={2}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: "text.primary",
                    bgcolor: tableHeaderBg(theme),
                    borderBottom: `2px solid ${theme.palette.primary.main}`,
                    p: { xs: 0.85, sm: 1.25 },
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    width: { xs: "28%", sm: "auto" },
                  }}
                >
                  Balance
                </TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: tableSubHeaderBandBg(theme) }}>
                {Array(3)
                  .fill()
                  .map((_, i) => (
                    <React.Fragment key={i}>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 700,
                          color: "text.secondary",
                          p: { xs: 0.65, sm: 1.15 },
                          fontSize: { xs: "0.7rem", sm: "0.8rem" },
                          lineHeight: { xs: 1.35, sm: 1.5 },
                          borderTop: 1,
                          borderColor: "divider",
                        }}
                      >
                        PC
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          fontWeight: 700,
                          color: "text.secondary",
                          p: { xs: 0.65, sm: 1.15 },
                          fontSize: { xs: "0.7rem", sm: "0.8rem" },
                          lineHeight: { xs: 1.35, sm: 1.5 },
                          borderTop: 1,
                          borderColor: alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.08),
                        }}
                      >
                        UC
                      </TableCell>
                    </React.Fragment>
                  ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {progressData.map((row, idx) => (
                <TableRow
                  key={idx}
                  hover
                  sx={{
                    transition: "background-color 0.15s ease",
                    "&:nth-of-type(odd)": {
                      bgcolor: theme.palette.mode === "dark" ? alpha(theme.palette.common.white, 0.05) : theme.palette.grey[50],
                    },
                    "&:nth-of-type(even)": {
                      bgcolor: "background.paper",
                    },
                    "&:hover": {
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06),
                    },
                  }}
                >
                  <TableCell
                    align="center"
                    scope="row"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {row.category}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {row.targetPC.toLocaleString()}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {Math.round(row.targetUC).toLocaleString()}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {row.achievedPC.toLocaleString()}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {Math.round(row.achievedUC).toLocaleString()}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {(row.targetPC - row.achievedPC).toLocaleString()}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      p: { xs: 0.85, sm: 1.25 },
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: 700,
                      lineHeight: { xs: 1.45, sm: 1.6 },
                      fontVariantNumeric: "tabular-nums",
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    {Math.round(row.targetUC - row.achievedUC).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <DashboardSectionHeading
          title="Stock lifting record"
          subtitle="Sales lifts synced from admin uploads — tap a row for SKU detail"
          sx={{ mt: 3 }}
          action={
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInFullIcon />}
              onClick={openStockLiftingFullscreen}
              sx={{ textTransform: "none", fontWeight: 700, flexShrink: 0 }}
            >
              Expand
            </Button>
          }
        />
        <Box sx={{ mb: 3 }}>
          <StockLiftingRecordsTable records={stockLiftingRecords} showTotalsRow {...stockLiftSkuHandlers} />
        </Box>

        </Box>
      </Box>

      <Dialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: "1.15rem", pb: 0.5, color: "text.primary" }}>
          Notifications
        </DialogTitle>
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1.5 }}>
          Order status, target changes, a daily stock-lift reminder when you open the app, and other updates.
        </Typography>
        <DialogContent
          dividers
          sx={{
            bgcolor: "action.hover",
            maxHeight: { xs: "55vh", sm: 400 },
            py: 2,
          }}
        >
          {notifications.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
              <InfoOutlinedIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                You’re all caught up. New activity will appear here.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {notifications.map((note) => {
                const isOk = note.type === "success";
                const isErr = note.type === "error";
                const isWarn = note.type === "warning";
                const main = isOk
                  ? theme.palette.success.main
                  : isErr
                    ? theme.palette.error.main
                    : isWarn
                      ? theme.palette.warning.dark
                      : theme.palette.info.main;
                const bg = alpha(main, 0.1);
                const border = alpha(main, 0.35);
                const IconCmp = isOk ? CheckCircleOutlineIcon : isErr ? ErrorOutlineIcon : InfoOutlinedIcon;
                return (
                  <Paper
                    key={note.id}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: border,
                      bgcolor: bg,
                    }}
                  >
                    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                      <IconCmp sx={{ fontSize: 22, color: main, mt: 0.15, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.primary", mb: 0.35 }}>
                          {note.headline || "Update"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.45, fontWeight: 500 }}>
                          {note.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                          {note.timestamp}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, bgcolor: "background.paper" }}>
          <Button onClick={() => setNotifications([])} color="inherit" size="medium">
            Clear all
          </Button>
          <Button onClick={() => setNotificationsOpen(false)} variant="contained" size="medium" sx={{ fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <SalesDataRefreshNoticeDialog
        open={salesRefreshNoticeOpen}
        onClose={() => setSalesRefreshNoticeOpen(false)}
        liftingLineCount={stockLiftingRecords.length}
      />

      <AppSnackbar
        open={toast.open}
        title={toast.title}
        message={toast.message}
        severity={toast.severity}
        autoHideDuration={toast.duration}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      />

      {logoutConfirmDialog}

      {/* Fullscreen Calculator Dialog */}
      <Dialog 
        fullScreen 
        open={showCalculator} 
        onClose={() => {
          setShowCalculator(false);
          setEditingOrder(null);
          setCalculatorInitialInputs(null);
          setDistributorCurrentView("dashboard");
        }}
        disableEnforceFocus={false}
        disableAutoFocus={false}
      >
        <Box sx={{ bgcolor: "background.default", minHeight: "100%", color: "text.primary" }}>
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              color: "text.primary",
            }}
          >
            <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {editingOrder ? "Update order" : "Place order"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {distributorName}
                  {productRates?.products?.length
                    ? ` · ${getCatalogSkusGrouped(productRates).all.length} products from catalogue`
                    : ""}
                </Typography>
              </Box>
              <IconButton
                onClick={() => {
                  setShowCalculator(false);
                  setEditingOrder(null);
                  setCalculatorInitialInputs(null);
                  setDistributorCurrentView("dashboard");
                }}
                aria-label="close calculator"
                edge="end"
              >
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
          <CokeCalculator
            distributorName={distributorName}
            schemes={activeSchemes}
            onPlaceOrder={handlePlaceOrder}
            onAttachOrderTableImage={attachOrderTableImage}
            productRates={productRates}
            gstEnabled={distributorGstEnabled}
            initialInputs={calculatorInitialInputs}
            getPreviewOrderNumber={isSupabaseConfigured ? peekGlobalOrderNumber : undefined}
            fixedOrderNumber={editingOrder?.orderNumber || null}
            placeOrderButtonText={editingOrder ? "Update Order" : "Place Order"}
            submitOrderButtonText={editingOrder ? "Submit Updated Order" : "Submit Order"}
            editContext={
              editingOrder
                ? {
                    isEdit: true,
                    orderKey: getOrderKey(editingOrder),
                    orderId: editingOrder.id || null,
                  }
                : null
            }
          />
        </Box>
        </Dialog>
        
        {/* Orders List Dialog */}
        <OrdersDialog
          open={openOrdersListDialog}
          hideHelpText
          onClose={() => {
            setOpenOrdersListDialog(false);
            setDistributorCurrentView("dashboard");
          }}
          orders={orders}
          distributorName={distributorName}
          onCancelOrder={handleCancelOrder}
          cancelingOrderId={cancelingOrderId}
          getOrderStatus={getOrderStatus}
          getOrderKey={getOrderKey}
          onEditOrder={handleEditOrderInCalculator}
          onOrderRowClick={handleViewOrderCalculatedTable}
          onViewShippingInvoice={handleViewShippingInvoice}
          onDownloadShippingInvoice={handleDownloadShippingInvoice}
          loadingInvoiceOrderId={loadingInvoiceOrderId}
          onRefreshOrders={handleRefreshOrdersList}
          ordersRefreshing={ordersRefreshing}
        />

        <ShippingInvoiceDialog
          open={openShippingInvoiceDialog}
          onClose={() => {
            setOpenShippingInvoiceDialog(false);
            setShippingInvoiceOrder(null);
          }}
          order={shippingInvoiceOrder}
          orderLabel={shippingInvoiceOrder?.orderNumber}
        />

        <OrderCalculatedTableDialog
          open={openOrderCalculatedDialog}
          onClose={() => {
            setOpenOrderCalculatedDialog(false);
            setOrderForCalculatedTable(null);
          }}
          order={orderForCalculatedTable}
          distributorName={distributorName}
          getOrderStatus={getOrderStatus}
        />

        {/* Product Rate List Dialog */}
        <Dialog
          open={openProductRateDialog}
          onClose={() => {
            setOpenProductRateDialog(false);
            setDistributorCurrentView("dashboard");
          }}
          fullWidth
          maxWidth="md"
          fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, overflow: "hidden" } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              gap: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <NuProductRateIcon sx={{ width: 34, height: 34, bgcolor: alpha("#fff", 0.16), color: "#fff" }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                    Product Prices
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.9 }}>
                    Current rates used in the order calculator
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <IconButton
              onClick={() => {
                setOpenProductRateDialog(false);
                setDistributorCurrentView("dashboard");
              }}
              sx={{ color: "primary.contrastText" }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: "background.default" }}>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                p: { xs: 1.5, sm: 2 },
                mb: 2,
                borderRadius: 2.5,
                bgcolor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.1 : 0.06),
                borderColor: alpha(theme.palette.info.main, 0.2),
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                These are read-only product prices published by the admin. If a price looks incorrect, contact the
                admin before placing your order.
              </Typography>
            </Paper>

            <TableContainer
              component={Paper}
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: 2.5,
                maxHeight: { xs: "calc(100vh - 230px)", sm: "62vh" },
                overflow: "auto",
              }}
            >
              <Table stickyHeader size="small" aria-label="Product price list">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, bgcolor: "background.paper" }}>Product</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, bgcolor: "background.paper" }}>Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, bgcolor: "background.paper" }}>Price / case</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productRateRows.map((row) => {
                    const accent = PRODUCT_RATE_CATEGORY_COLORS[row.category] || theme.palette.primary.main;
                    return (
                      <TableRow key={row.name} hover>
                        <TableCell sx={{ py: 1.25 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                            {row.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={row.category}
                            size="small"
                            sx={{ bgcolor: accent, color: "#fff", fontWeight: 800, minWidth: 58 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {row.rate == null
                            ? "Not set"
                            : `Nu. ${Number(row.rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: "background.paper", borderTop: 1, borderColor: "divider" }}>
            <Button
              onClick={() => {
                setOpenProductRateDialog(false);
                setDistributorCurrentView("dashboard");
              }}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openStockLiftingDialog}
          onClose={() => {
            setOpenStockLiftingDialog(false);
            setDistributorCurrentView("dashboard");
          }}
          fullWidth
          maxWidth="lg"
          fullScreen={isMobile}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              py: 2,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Stock lifting record
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.92, display: "block", mt: 0.5 }}>
                {distributorName}
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                setOpenStockLiftingDialog(false);
                setDistributorCurrentView("dashboard");
              }}
              sx={{ color: "primary.contrastText" }}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: { xs: 1.5, sm: 2.5 }, pt: 2 }}>
            <StockLiftingRecordsTable
              records={stockLiftingRecords}
              stickyHeader
              headerLayout="flat"
              showTotalsRow
              maxHeight={{ xs: "calc(100vh - 220px)", sm: "60vh" }}
              emptyMessage="When shipping marks your orders dispatched, stock lifts will appear here."
              {...stockLiftSkuHandlers}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => {
                setOpenStockLiftingDialog(false);
                setDistributorCurrentView("dashboard");
              }}
              variant="contained"
              sx={{ bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <StockLiftingSkuDialog
          open={Boolean(stockLiftingSkuDialog)}
          onClose={() => setStockLiftingSkuDialog(null)}
          title={stockLiftingSkuDialog?.title}
          subtitle={stockLiftingSkuDialog?.subtitle}
          salesRecords={stockLiftingSkuDialog?.salesRecords || []}
          liftDateLabel={stockLiftingSkuDialog?.liftDateLabel}
        />

        <DistributorPhysicalStockDialog
          open={openPhysicalStockDialog}
          onClose={() => {
            setOpenPhysicalStockDialog(false);
            setDistributorCurrentView("dashboard");
          }}
          distributorCode={distributorCode}
          distributorName={distributorName}
          distributor={distributor}
          isSupabaseConfigured={isSupabaseConfigured}
          setDistributor={setDistributor}
          showToast={showToast}
          onDialogOpened={handlePhysicalStockDialogOpened}
          onPhysicalStockAcknowledged={handlePhysicalStockAcknowledged}
          productRates={productRates}
        />

        <Paper
          component="nav"
          aria-label="Distributor navigation"
          elevation={10}
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
            px: { xs: 0.75, sm: 2 },
            pt: 0.75,
            pb: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
            borderRadius: "18px 18px 0 0",
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Box
            sx={{
              maxWidth: 720,
              mx: "auto",
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              alignItems: "end",
              gap: { xs: 0.25, sm: 0.75 },
            }}
          >
            <DistributorBottomNavItem
              label="Home"
              active={isHomeActive}
              onClick={openDashboard}
              badgeInvisible={!sidebarBadges.dashboard}
              badgeVariant="dot"
              badgeColor="primary"
              icon={<DashboardIcon fontSize="small" />}
            />
            <DistributorBottomNavItem
              label="Orders"
              active={openOrdersListDialog}
              onClick={openOrdersList}
              badgeInvisible={sidebarBadges.pendingOrders === 0 && sidebarBadges.shippingInvoices === 0}
              badgeContent={
                sidebarBadges.pendingOrders > 0
                  ? sidebarBadges.pendingOrders
                  : sidebarBadges.shippingInvoices
              }
              badgeColor={sidebarBadges.pendingOrders > 0 ? "error" : "success"}
              icon={<ListAltIcon fontSize="small" />}
            />
            <DistributorBottomNavItem
              label="Place Order"
              elevate
              active={showCalculator}
              onClick={openNewOrder}
              icon={<CalculateIcon fontSize="small" />}
            />
            <DistributorBottomNavItem
              label="Prices"
              active={openProductRateDialog}
              onClick={openRateList}
              icon={
                <NuProductRateIcon
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: "0.65rem",
                    borderRadius: "6px",
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: "primary.main",
                  }}
                />
              }
            />
            <DistributorBottomNavItem
              label="Stock"
              active={openPhysicalStockDialog}
              onClick={openPhysicalStock}
              badgeInvisible={!sidebarBadges.physicalStock}
              badgeVariant="dot"
              badgeColor="secondary"
              icon={<WarehouseIcon fontSize="small" />}
            />
          </Box>
        </Paper>
    </Box>
  );
}

export default DistributorDashboard;
