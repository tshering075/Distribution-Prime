import React, { useState, useMemo, useRef } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import TableRowsOutlinedIcon from "@mui/icons-material/TableRowsOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { parseExcelFile } from "../utils/excelUtils";
import { parseFirestoreDate } from "../utils/dateUtils";
import { logger } from "../utils/logger";
import { DEFAULT_SKUS } from "../constants/productSkus";
import AppSnackbar from "./AppSnackbar";

/**
 * ReportsDialog - Rebuilt for sales data reporting
 * 
 * Features:
 * 1. Upload sales data (Excel format, headers at row 4)
 * 2. Date range filtering
 * 3. Distributor Performance Report (CSD/Water PC/UC per distributor)
 * 4. CSD & Water SKU-wise reports (highest selling SKUs for forecasting)
 * 
 * Props:
 * - open, onClose
 * - distributors: array of all distributors
 * - salesData: array of sales data from Firebase
 */
export default function ReportsDialog({ open, onClose, distributors = [], salesData = [], onSalesDataUploaded, canWrite = true }) {
  // Report type tabs
  const [reportType, setReportType] = useState("performance"); // "performance" or "sku"
  
  // Date filtering
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateError, setDateError] = useState("");
  
  // Region filtering (single select - only for "performance" report)
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [performanceSearch, setPerformanceSearch] = useState("");
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ total: 0, processed: 0, saved: 0 });
  const hiddenFileRef = useRef(null);
  
  // Local sales data - ONLY from uploads in this dialog (persisted in localStorage)
  const [localSalesData, setLocalSalesData] = useState(() => {
    // Load from localStorage on initialization
    try {
      const stored = localStorage.getItem("reports_sales_data");
      if (!stored) return [];
      const data = JSON.parse(stored);
      // Convert date strings back to Date objects
      return data.map(record => ({
        ...record,
        invoiceDate: record.invoiceDate ? new Date(record.invoiceDate) : new Date()
      }));
    } catch (e) {
      console.error("Error loading sales data from localStorage:", e);
      return [];
    }
  });
  
  // Track uploaded files with their data (persisted in localStorage)
  const [uploadedFiles, setUploadedFiles] = useState(() => {
    // Load from localStorage on initialization
    try {
      const stored = localStorage.getItem("reports_uploaded_files");
      if (!stored) return [];
      const files = JSON.parse(stored);
      // Convert date strings back to Date objects and fix data dates
      return files.map(file => ({
        ...file,
        uploadDate: file.uploadDate ? new Date(file.uploadDate) : new Date(),
        data: file.data ? file.data.map(record => ({
          ...record,
          invoiceDate: record.invoiceDate ? new Date(record.invoiceDate) : new Date()
        })) : []
      }));
    } catch (e) {
      console.error("Error loading uploaded files from localStorage:", e);
      return [];
    }
  });
  
  // Snackbar notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };
  
  // PDF export state
  const [exportingPDF, setExportingPDF] = useState(false);
  const tableRef = useRef(null);
  const theme = useTheme();
  
  // Save localSalesData to localStorage whenever it changes
  React.useEffect(() => {
    if (localSalesData && localSalesData.length > 0) {
      try {
        // Convert Date objects to ISO strings for localStorage
        const serializableData = localSalesData.map(record => ({
          ...record,
          invoiceDate: record.invoiceDate instanceof Date 
            ? record.invoiceDate.toISOString() 
            : record.invoiceDate
        }));
        localStorage.setItem("reports_sales_data", JSON.stringify(serializableData));
      } catch (e) {
        console.error("Error saving sales data to localStorage:", e);
      }
    } else if (localSalesData.length === 0) {
      // Only clear localStorage if explicitly empty (not on initial mount)
      try {
        localStorage.removeItem("reports_sales_data");
      } catch (e) {
        console.error("Error clearing sales data from localStorage:", e);
      }
    }
  }, [localSalesData]);
  
  // Save uploadedFiles to localStorage whenever it changes
  React.useEffect(() => {
    if (uploadedFiles && uploadedFiles.length > 0) {
      try {
        // Convert Date objects to ISO strings for localStorage
        const serializableFiles = uploadedFiles.map(file => ({
          ...file,
          uploadDate: file.uploadDate instanceof Date 
            ? file.uploadDate.toISOString() 
            : file.uploadDate,
          // Also serialize data dates
          data: file.data ? file.data.map(record => ({
            ...record,
            invoiceDate: record.invoiceDate instanceof Date 
              ? record.invoiceDate.toISOString() 
              : record.invoiceDate
          })) : []
        }));
        localStorage.setItem("reports_uploaded_files", JSON.stringify(serializableFiles));
      } catch (e) {
        console.error("Error saving uploaded files to localStorage:", e);
      }
    } else if (uploadedFiles.length === 0) {
      // Only clear localStorage if explicitly empty (not on initial mount)
      try {
        localStorage.removeItem("reports_uploaded_files");
      } catch (e) {
        console.error("Error clearing uploaded files from localStorage:", e);
      }
    }
  }, [uploadedFiles]);
  
  // Debug: Log distributors when they change or dialog opens
  React.useEffect(() => {
    if (open) {
      setPerformanceSearch("");
      logger.log("ReportsDialog opened - Distributors check:");
      logger.log("- distributors prop received:", distributors?.length || 0);
      logger.log("- distributor names:", distributors?.map(d => d.name) || []);
      logger.log("- distributor codes:", distributors?.map(d => d.code) || []);
      
      // Log region distribution
      const regionCounts = {};
      distributors?.forEach(d => {
        const region = d.region || "Unknown";
        regionCounts[region] = (regionCounts[region] || 0) + 1;
      });
      logger.log("- region distribution:", regionCounts);
      logger.log("- unique regions:", Object.keys(regionCounts));
    }
  }, [open, distributors]);
  
  // Date validation
  const validateDateRange = (start, end) => {
    if (!start || !end) {
      setDateError("");
      return true;
    }
    
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    
    if (endDateObj < startDateObj) {
      setDateError("End date must be after start date");
      return false;
    }
    
    setDateError("");
    return true;
  };
  
  // Filter sales data by date range and distributor selection
  // Note: Distributor filter only applies to "Distributor Performance" report
  const filteredSalesData = useMemo(() => {
    let filtered = localSalesData;
    
    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date
      
      filtered = filtered.filter(record => {
        const invoiceDate = parseFirestoreDate(record.invoiceDate);
        return invoiceDate >= start && invoiceDate <= end;
      });
    }
    
    // Filter by selected region (only for "performance" report type)
    if (reportType === "performance" && selectedRegion && selectedRegion !== "All") {
      // Helper function to normalize strings (same as upload matching)
      const normalize = (s) => {
        if (!s) return "";
        return s.toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ")
          .replace(/[.,\-_]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };
      
      const selectedRegionLower = String(selectedRegion).toLowerCase().trim();
      let matchedCount = 0;
      let unmatchedCount = 0;
      
      filtered = filtered.filter(record => {
        // Prefer matchedDistributorName (from upload matching) over original distributorName
        const distName = record.matchedDistributorName || record.distributorName || "";
        const distCode = record.distributorCode || "";
        
        // Find the distributor in the distributors list using multiple strategies
        let distributor = null;
        
        // Strategy 1: Try exact match by code (most reliable)
        if (distCode) {
          distributor = distributors.find(d => d.code === distCode);
        }
        
        // Strategy 2: Try exact match by matchedDistributorName
        if (!distributor && record.matchedDistributorName) {
          distributor = distributors.find(d => d.name === record.matchedDistributorName);
        }
        
        // Strategy 3: Try normalized name match
        if (!distributor && distName) {
          const normalizedDistName = normalize(distName);
          distributor = distributors.find(d => {
            const normalizedDName = normalize(d.name);
            return normalizedDName === normalizedDistName;
          });
        }
        
        // Strategy 4: Try partial match (one name contains the other)
        if (!distributor && distName) {
          const normalizedDistName = normalize(distName);
          distributor = distributors.find(d => {
            const normalizedDName = normalize(d.name);
            return normalizedDistName.includes(normalizedDName) || 
                   normalizedDName.includes(normalizedDistName);
          });
        }
        
        // If no distributor found, exclude this record
        if (!distributor || !distributor.region) {
          unmatchedCount++;
          logger.log(`Region filter: Could not find distributor for record: ${distName} (code: ${distCode})`);
          return false;
        }
        
        // Match region (case-insensitive, handle variations like "Southern" vs "South")
        const recordRegion = String(distributor.region).toLowerCase().trim();
        
        // Direct match
        if (recordRegion === selectedRegionLower) {
          matchedCount++;
          return true;
        }
        
        // Handle partial matches (e.g., "south" in "southern")
        if (selectedRegionLower === "southern" && recordRegion.includes("south")) {
          matchedCount++;
          return true;
        }
        if (selectedRegionLower === "western" && recordRegion.includes("west")) {
          matchedCount++;
          return true;
        }
        if (selectedRegionLower === "eastern" && recordRegion.includes("east")) {
          matchedCount++;
          return true;
        }
        
        // Region doesn't match
        logger.log(`Region filter: Record "${distName}" has region "${distributor.region}" (normalized: "${recordRegion}"), selected: "${selectedRegion}" (normalized: "${selectedRegionLower}") - NO MATCH`);
        return false;
      });
      
      logger.log(`Region filter applied: ${matchedCount} records matched, ${unmatchedCount} records excluded for region "${selectedRegion}"`);
    }
    
    return filtered;
  }, [localSalesData, startDate, endDate, selectedRegion, distributors, reportType]);
  
  // Helper: Convert PC to UC based on product SKU
  // Handles product names from Excel: "WATER 200 ML", "K WATER 500 ML", "K WATER R 1L", "COKE 300 ML", etc.
  const convertPCtoUC = (pc, sku) => {
    if (!pc || !sku) return 0;
    const pcNum = Number(pc) || 0;
    if (pcNum === 0) return 0;
    
    const skuLower = sku.toString().toLowerCase().trim().replace(/\s+/g, " ");
    
    // Exclude can products (they don't follow standard PC to UC conversion)
    if (skuLower.includes("can") || skuLower.includes("tin")) {
      return 0; // Cans are excluded from UC calculations
    }
    
    // Water Products - 200ml (e.g., "WATER 200 ML", "KINLEY 200ML")
    if ((skuLower.includes("200ml") || skuLower.includes("200 ml")) && 
        (skuLower.includes("water") || skuLower.includes("kinley"))) {
      return (pcNum * 4.8) / 5.678;
    }
    
    // CSD Products - 300ml (e.g., "COKE 300 ML", "FANTA 300 ML", "SPRITE 300 ML", "CHARGED 300 ML")
    if ((skuLower.includes("300ml") || skuLower.includes("300 ml")) && 
        !skuLower.includes("can")) {
      return (pcNum * 7.2) / 5.678;
    }
    
    // Water Products - 500ml (e.g., "K WATER 500 ML", "KINLEY 500ML")
    if ((skuLower.includes("500ml") || skuLower.includes("500 ml")) && 
        (skuLower.includes("water") || skuLower.includes("kinley"))) {
      return (pcNum * 12) / 5.678;
    }
    
    // CSD Products - 500ml (e.g., "COKE 500 ML", "FANTA A 500 ML", "SPRITE E 500 ML")
    if ((skuLower.includes("500ml") || skuLower.includes("500 ml")) && 
        !skuLower.includes("water") && !skuLower.includes("kinley")) {
      return (pcNum * 12) / 5.678;
    }
    
    // CSD Products - 1.25L (e.g., "COKE 1.25 L", "FANTA 1.25 L", "SPRITE E 1.25 L")
    if (skuLower.includes("1.25l") || skuLower.includes("1.25 l") || 
        skuLower.includes("1.25ltr") || skuLower.includes("1.25 ltr")) {
      return (pcNum * 15) / 5.678;
    }
    
    // Water Products - 1L (e.g., "K WATER R 1L", "K WATER 1L", "KINLEY 1L")
    if ((skuLower.includes("1l") || skuLower.includes("1 l") || skuLower.includes("1ltr") || skuLower.includes("1 ltr")) && 
        (skuLower.includes("water") || skuLower.includes("kinley"))) {
      return (pcNum * 12) / 5.678;
    }
    
    return 0; // Unknown SKU - no conversion
  };
  
  // 1. DISTRIBUTOR PERFORMANCE REPORT
  // Aggregates uploaded product lines into the spreadsheet-style distributor SKU layout.
  const performanceSkuReport = useMemo(() => {
    const normalizeSkuText = (value) =>
      (value || "")
        .toString()
        .toUpperCase()
        .replace(/[.\-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const categoryNameToKey = (category) => {
      const value = (category || "").toString().trim().toLowerCase();
      if (value === "csd") return "csd";
      if (value === "water") return "water";
      return null;
    };

    const canonicalizeSku = (category, sku) => {
      const raw = (sku || "").toString().trim();
      if (!raw) return "";

      const skuNorm = normalizeSkuText(raw);
      if (category === "water") {
        const waterLike = /\b(KINLEY|K\s*WATER|WATER|KWATER|K WATER R)\b/.test(skuNorm);
        if (waterLike && /\b200\s*ML\b/.test(skuNorm)) return "KINLEY WATER 200 ML";
        if (waterLike && /\b500\s*ML\b/.test(skuNorm)) return "KINLEY WATER 500 ML";
        if (waterLike && /\b1\s*(L|LTR)\b/.test(skuNorm)) return "KINLEY WATER 1 L";
      }

      return raw;
    };

    const getCsdSizeOrder = (sku) => {
      const s = normalizeSkuText(sku);
      if (/\b300\s*ML\b/.test(s)) return 0;
      if (/\b500\s*ML\b/.test(s)) return 1;
      if (/\b1\s*\.?\s*25\s*(L|LTR)\b/.test(s)) return 2;
      return 3;
    };

    const getCsdBrandOrder = (sku) => {
      const s = normalizeSkuText(sku);
      if (/\bCOKE\b|\bCOCA\s*COLA\b/.test(s)) return 0;
      if (/\bFANTA\b/.test(s)) return 1;
      if (/\bSPRITE\b/.test(s)) return 2;
      if (/\bCHARGE\b|\bCHARGED\b/.test(s)) return 3;
      return 4;
    };

    const getWaterSizeOrder = (sku) => {
      const s = normalizeSkuText(sku);
      if (/\b200\s*ML\b/.test(s)) return 0;
      if (/\b500\s*ML\b/.test(s)) return 1;
      if (/\b1\s*(L|LTR)\b/.test(s)) return 2;
      return 3;
    };

    const seededSkus = {
      csd: DEFAULT_SKUS.filter((sku) => categoryNameToKey(sku.category) === "csd")
        .map((sku) => ({ sku: sku.name, pc: 0, uc: 0 })),
      water: DEFAULT_SKUS.filter((sku) => categoryNameToKey(sku.category) === "water")
        .map((sku) => ({ sku: sku.name, pc: 0, uc: 0 })),
    };

    const distributorMap = new Map();

    const getGroup = (record) => {
      const name = record.matchedDistributorName || record.distributorName || "Unknown";
      const key = record.distributorCode || name;

      if (!distributorMap.has(key)) {
        distributorMap.set(key, {
          key,
          name,
          csd: new Map(),
          water: new Map(),
          totals: { csdPC: 0, csdUC: 0, waterPC: 0, waterUC: 0 },
        });

        // Seed every distributor with all master SKUs so missing lines render as 0.
        seededSkus.csd.forEach((item) => {
          distributorMap.get(key).csd.set(item.sku, { ...item });
        });
        seededSkus.water.forEach((item) => {
          distributorMap.get(key).water.set(item.sku, { ...item });
        });
      }

      return distributorMap.get(key);
    };

    const addSku = (skuMap, sku, pc, uc) => {
      if (!skuMap.has(sku)) {
        skuMap.set(sku, { sku, pc: 0, uc: 0 });
      }

      const current = skuMap.get(sku);
      current.pc += pc;
      current.uc += uc;
    };

    filteredSalesData.forEach((record) => {
      const group = getGroup(record);

      if (Array.isArray(record.products) && record.products.length > 0) {
        record.products.forEach((product) => {
          if (!product?.sku) return;

          const pc = Number(product.quantity) || 0;
          if (pc <= 0) return;

          const category = categoryNameToKey(product.category);
          const canonicalSku = canonicalizeSku(category, product.sku);
          if (!canonicalSku) return;
          const uc = Number(product.uc) || convertPCtoUC(pc, product.sku);

          if (category === "csd") {
            addSku(group.csd, canonicalSku, pc, uc);
            group.totals.csdPC += pc;
            group.totals.csdUC += uc;
          } else if (category === "water") {
            addSku(group.water, canonicalSku, pc, uc);
            group.totals.waterPC += pc;
            group.totals.waterUC += uc;
          }
        });
      } else {
        const csdPC = Number(record.csdPC) || 0;
        const csdUC = Number(record.csdUC) || 0;
        const waterPC = Number(record.waterPC) || 0;
        const waterUC = Number(record.waterUC) || 0;

        if (csdPC || csdUC) {
          addSku(group.csd, "CSD Total", csdPC, csdUC);
          group.totals.csdPC += csdPC;
          group.totals.csdUC += csdUC;
        }
        if (waterPC || waterUC) {
          addSku(group.water, "K WATER Total", waterPC, waterUC);
          group.totals.waterPC += waterPC;
          group.totals.waterUC += waterUC;
        }
      }
    });

    return Array.from(distributorMap.values())
      .map((group) => ({
        ...group,
        csd: Array.from(group.csd.values()).sort((a, b) => {
          const sizeDiff = getCsdSizeOrder(a.sku) - getCsdSizeOrder(b.sku);
          if (sizeDiff !== 0) return sizeDiff;
          const brandDiff = getCsdBrandOrder(a.sku) - getCsdBrandOrder(b.sku);
          if (brandDiff !== 0) return brandDiff;
          return a.sku.localeCompare(b.sku);
        }),
        water: Array.from(group.water.values()).sort((a, b) => {
          const sizeDiff = getWaterSizeOrder(a.sku) - getWaterSizeOrder(b.sku);
          if (sizeDiff !== 0) return sizeDiff;
          return a.sku.localeCompare(b.sku);
        }),
        totals: {
          csdPC: Math.round(group.totals.csdPC),
          csdUC: Math.round(group.totals.csdUC * 100) / 100,
          waterPC: Math.round(group.totals.waterPC),
          waterUC: Math.round(group.totals.waterUC * 100) / 100,
        },
      }))
      .sort((a, b) => (b.totals.csdUC + b.totals.waterUC) - (a.totals.csdUC + a.totals.waterUC));
  }, [filteredSalesData]);
  
  // 2. CSD & WATER SKU-WISE REPORTS (same aggregation, different product category)
  const { skuReport, waterSkuReport } = useMemo(() => {
    const aggregateByCategory = (categoryLower) => {
      const skuMap = new Map();

      filteredSalesData.forEach((record) => {
        if (!record.products || !Array.isArray(record.products)) return;
        record.products.forEach((product) => {
          if (!product || !product.sku) return;

          const cat = (product.category || "").toString().trim().toLowerCase();
          if (cat !== categoryLower) return;

          const sku = product.sku.toString().trim();
          const pc = Number(product.quantity) || 0;
          if (pc === 0) return;

          const uc = convertPCtoUC(pc, sku);

          if (!skuMap.has(sku)) {
            skuMap.set(sku, {
              sku,
              category: product.category || categoryLower,
              totalPC: 0,
              totalUC: 0,
            });
          }

          const skuData = skuMap.get(sku);
          skuData.totalPC += pc;
          skuData.totalUC += uc;
        });
      });

      return Array.from(skuMap.values())
        .map((item) => ({
          ...item,
          totalPC: Math.round(item.totalPC),
          totalUC: Math.round(item.totalUC * 100) / 100,
        }))
        .sort((a, b) => b.totalPC - a.totalPC);
    };

    return {
      skuReport: aggregateByCategory("csd"),
      waterSkuReport: aggregateByCategory("water"),
    };
  }, [filteredSalesData]);
  
  // Handle sales data upload
  const handleSalesDataUpload = async (file) => {
    if (!file) return;
    if (!canWrite) {
      alert("You don't have permission to upload data. Only admins can upload data.");
      return;
    }
    
    // Debug: Check distributors - detailed logging
    logger.log("=== Upload Sales Data - Distributors Check ===");
    logger.log("- distributors prop type:", typeof distributors);
    logger.log("- distributors is array:", Array.isArray(distributors));
    logger.log("- distributors.length:", distributors?.length || 0);
    logger.log("- distributors value:", distributors);
    
    if (distributors && distributors.length > 0) {
      logger.log("- ✅ Distributors found:", distributors.length);
      logger.log("- First 5 distributor names:", distributors.slice(0, 5).map(d => d.name || d.code));
      logger.log("- First 5 distributor codes:", distributors.slice(0, 5).map(d => d.code));
    } else {
      logger.error("❌ NO DISTRIBUTORS FOUND!");
      logger.error("- distributors is null/undefined:", distributors === null || distributors === undefined);
      logger.error("- distributors is empty array:", Array.isArray(distributors) && distributors.length === 0);
      logger.error("- Please check AdminDashboard is passing distributors prop correctly");
      logger.error("- Check browser console for 'ReportsDialog opened - Distributors check' message");
    }
    
    // Log distributor availability (no blocking warning if distributors exist)
    if (!distributors || distributors.length === 0) {
      logger.warn("⚠️ No distributors found in app! Upload will continue but all records will be skipped.");
      // Only show warning if truly no distributors exist
      showSnackbar("⚠️ No distributors found in app. Please add distributors in the Distributors section first, then upload again.", "warning");
      // Continue anyway - we can still save data, just with null distributor codes
    } else {
      logger.log("✅ Distributors available for matching:", distributors.length);
      // Don't show warning if distributors exist - only show it if some records fail to match later
    }
    
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/excel"
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      showSnackbar("Please upload a valid Excel file (.xlsx or .xls)", "error");
      return;
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showSnackbar("File size exceeds 10MB. Please upload a smaller file.", "error");
      return;
    }
    
    setUploading(true);
    setUploadProgress({ total: 0, processed: 0, saved: 0 });
    
    try {
      logger.log("Parsing Excel for sales data...");
      logger.log("File name:", file.name);
      logger.log("Available distributors:", distributors.length);
      
      // Parse Excel file (handles headers starting at row 4)
      const parseResult = await parseExcelFile(file);
      const salesDataFromFile = parseResult.salesData || [];
      const achievements = parseResult.achievements || {};
      
      logger.log(`Found ${salesDataFromFile.length} sales data records`);
      
      if (salesDataFromFile.length === 0 && Object.keys(achievements).length === 0) {
        showSnackbar("No sales data found in Excel file. Please check the file format.\n\nMake sure:\n- Headers are in row 4\n- 'Party Name / Address' column exists\n- Product columns contain quantities\n- Invoice Date column exists", "warning");
        setUploading(false);
        return;
      }
      
      setUploadProgress(prev => ({ ...prev, total: salesDataFromFile.length }));
      
      // Try to import Firebase functions
      let saveSalesDataBatchFn = null;
      let TimestampFn = null;
      
      try {
        const firebaseService = await import("../services/firebaseService");
        saveSalesDataBatchFn = firebaseService.saveSalesDataBatch;
        const firestore = await import("firebase/firestore");
        TimestampFn = firestore.Timestamp;
      } catch (e) {
        logger.warn("Firebase not available, saving to local state only");
      }
      
      // Enhanced distributor matching function
      const findDistributor = (saleName) => {
        if (!saleName) return null;
        if (!distributors || distributors.length === 0) return null; // No distributors available
        
        // Skip non-distributor rows (like "Total", "Grand Total", etc.)
        const normalizedForCheck = saleName.toString().trim().toLowerCase();
        if (normalizedForCheck === "total" || 
            normalizedForCheck.includes("total :") ||
            normalizedForCheck.includes("grand total") ||
            normalizedForCheck === "sum" ||
            normalizedForCheck.startsWith("si no") ||
            normalizedForCheck === "") {
          return null; // Not a distributor name
        }
        
        // Extract name part before comma (location suffix)
        let cleanSaleName = saleName.toString().trim();
        if (cleanSaleName.includes(",")) {
          cleanSaleName = cleanSaleName.split(",")[0].trim();
        }
        
        const normalize = (s) => {
          if (!s) return "";
          return s.toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/[.,\-_]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        };
        
        const normalizedSaleName = normalize(cleanSaleName);
        
        // Strategy 1: Try exact match
        let match = distributors.find(d => normalize(d.name) === normalizedSaleName);
        if (match) {
          logger.log(`Matched "${saleName}" -> "${match.name}" (exact match)`);
          return match;
        }
        
        // Strategy 2: Try partial match
        match = distributors.find(d => {
          const normalizedDistName = normalize(d.name);
          return normalizedSaleName.includes(normalizedDistName) || 
                 normalizedDistName.includes(normalizedSaleName);
        });
        if (match) {
          logger.log(`Matched "${saleName}" -> "${match.name}" (partial match)`);
          return match;
        }
        
        // Strategy 3: Try business terms removal
        const removeBusinessTerms = (name) => {
          return name
            .replace(/\b(private|limited|ltd|pvt|inc|corp|company|co)\b/gi, "")
            .replace(/\s+/g, " ")
            .trim();
        };
        
        const cleanedSaleName = normalize(removeBusinessTerms(cleanSaleName));
        match = distributors.find(d => {
          const cleanedDistName = normalize(removeBusinessTerms(d.name));
          return cleanedDistName === cleanedSaleName ||
                 cleanedSaleName.includes(cleanedDistName) ||
                 cleanedDistName.includes(cleanedSaleName);
        });
        if (match) {
          logger.log(`Matched "${saleName}" -> "${match.name}" (business terms removed)`);
          return match;
        }
        
        // Strategy 4: Try first words match
        const saleWords = normalizedSaleName.split(" ").filter(w => w.length > 2);
        if (saleWords.length > 0) {
          const firstWords = saleWords.slice(0, 2).join(" ");
          match = distributors.find(d => {
            const distWords = normalize(d.name).split(" ").filter(w => w.length > 2);
            const distFirstWords = distWords.slice(0, 2).join(" ");
            return distFirstWords === firstWords || 
                   distFirstWords.includes(firstWords) ||
                   firstWords.includes(distFirstWords);
          });
        }
        
        if (match) {
          logger.log(`Matched "${saleName}" -> "${match.name}" (first words match)`);
        } else {
          logger.warn(`Could not match "${saleName}" (cleaned: "${cleanSaleName}")`);
        }
        
        return match || null;
      };
      
      // Match distributors and prepare data for saving
      const salesDataToSave = salesDataFromFile.map(sale => {
        const distributor = findDistributor(sale.distributorName);
        
        return {
          distributorCode: distributor?.code || null,
          distributorName: sale.distributorName,
          matchedDistributorName: distributor?.name || null,
          invoiceDate: sale.invoiceDate,
          products: sale.products || [],
          csdPC: sale.csdPC || 0,
          csdUC: sale.csdUC || 0,
          waterPC: sale.waterPC || 0,
          waterUC: sale.waterUC || 0,
          totalUC: sale.totalUC || 0,
          source: "reports_upload",
        };
      });
      
      // Filter valid sales data (must have distributor match)
      // Note: We check for matchedDistributorName instead of distributorCode because
      // some distributors might not have codes assigned yet, but we still matched them
      const validSalesData = salesDataToSave.filter(sale => sale.matchedDistributorName);
      const unmatchedSalesData = salesDataToSave.filter(sale => !sale.matchedDistributorName);
      
      // Save to Firebase
      let savedToFirebase = 0;
      if (saveSalesDataBatchFn && validSalesData.length > 0) {
        try {
          const salesDataWithTimestamps = validSalesData.map(sale => ({
            ...sale,
            invoiceDate: TimestampFn.fromDate(sale.invoiceDate)
          }));
          
          await saveSalesDataBatchFn(salesDataWithTimestamps);
          savedToFirebase = validSalesData.length;
          logger.log(`✅ Saved ${savedToFirebase} sales data records to Firebase`);
        } catch (firebaseError) {
          logger.error("Error saving to Firebase:", firebaseError);
        }
      }
      
      // Keep every parsed upload row in the local report view. Cloud save still only uses matched rows.
      const localFormattedData = salesDataToSave.map(sale => ({
        ...sale,
        invoiceDate: sale.invoiceDate instanceof Date ? sale.invoiceDate : new Date(sale.invoiceDate),
        uploadedFileName: file.name, // Track which file this record came from
      }));
      
      // Add file to uploaded files list (keep history of all uploads)
      setUploadedFiles(prev => {
        // Check if file already exists (by name) - replace it
        const existingIndex = prev.findIndex(f => f.fileName === file.name);
        if (existingIndex >= 0) {
          // Replace existing file data
          const updated = [...prev];
          updated[existingIndex] = {
            fileName: file.name,
            uploadDate: new Date(),
            recordCount: localFormattedData.length,
            data: localFormattedData,
          };
          return updated;
        } else {
          // Add new file to history
          return [...prev, {
            fileName: file.name,
            uploadDate: new Date(),
            recordCount: localFormattedData.length,
            data: localFormattedData,
          }];
        }
      });
      
      // REPLACE all local sales data with new upload (as requested)
      setLocalSalesData(localFormattedData);
      setPerformanceSearch("");
      setUploadProgress(prev => ({ ...prev, processed: salesDataFromFile.length, saved: localFormattedData.length }));
      
      if (onSalesDataUploaded) {
        onSalesDataUploaded(validSalesData.map(sale => ({
          ...sale,
          invoiceDate: sale.invoiceDate instanceof Date ? sale.invoiceDate : new Date(sale.invoiceDate),
          uploadedFileName: file.name,
        })));
      }
      
      // Show success message
      let message = `Successfully uploaded ${localFormattedData.length} sales record(s) for reports.`;
      if (savedToFirebase > 0) {
        message += ` ${savedToFirebase} record(s) saved to Firebase.`;
      }
      // Filter out non-distributor names from unmatched list (like "Total", etc.)
      const actualUnmatchedDistributors = unmatchedSalesData
        .map(s => s.distributorName)
        .filter(name => {
          const normalized = name?.toString().trim().toLowerCase() || "";
          return normalized && 
                 !normalized.includes("total") && 
                 !normalized.includes("sum") &&
                 normalized !== "" &&
                 !normalized.startsWith("si no");
        });
      
      const actualSkippedCount = actualUnmatchedDistributors.length;
      
      if (actualSkippedCount > 0) {
        const unmatchedNames = [...new Set(actualUnmatchedDistributors)].slice(0, 5).join(", ");
        const moreCount = actualSkippedCount > 5 ? ` and ${actualSkippedCount - 5} more` : "";
        const availableDistCount = distributors?.length || 0;
        
        message += `\n\n⚠️ ${actualSkippedCount} record(s) were not matched to an app distributor: ${unmatchedNames}${moreCount}. They will still appear in this report, but region filtering may exclude them.`;
        if (availableDistCount > 0) {
          message += `\n\n💡 Tip: Add missing distributors in the Distributors section, then upload again.`;
        }
        
        logger.warn("Unmatched distributors (excluding totals):", [...new Set(actualUnmatchedDistributors)].slice(0, 10));
        
        showSnackbar(message, "warning");
      } else {
        message += ` You can now generate reports using the uploaded data.`;
        showSnackbar(message, "success");
      }
      
    } catch (error) {
      logger.error("Error uploading sales data:", error);
      showSnackbar(`Failed to upload sales data: ${error.message || "Unknown error"}`, "error");
    } finally {
      setUploading(false);
      setUploadProgress({ total: 0, processed: 0, saved: 0 });
    }
  };
  
  // Trigger file upload
  const triggerFileUpload = () => {
    hiddenFileRef.current?.click();
  };
  
  const onFileChange = (e) => {
    if (!canWrite) {
      alert("You don't have permission to upload data. Only admins can upload data.");
      e.target.value = ""; // Reset
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      handleSalesDataUpload(file);
    }
    e.target.value = ""; // Reset so same file can be selected again
  };
  
  // Excel Export
  const handleDownloadExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      
      if (reportType === "performance") {
        const wsData = [
          ["Distributor Performance Report"],
          [startDate && endDate ? `Date Range: ${startDate} to ${endDate}` : "All Data"],
          [],
        ];

        performanceSkuReport.forEach((group, groupIndex) => {
          const rowCount = Math.max(group.csd.length, group.water.length);
          if (groupIndex > 0) wsData.push([]);

          wsData.push([`Distributor: ${group.name}`, "CSD", "", "K WATER", "", ""]);
          wsData.push(["Product skus", "PC", "UC", "Product skus", "PC", "UC"]);

          for (let i = 0; i < rowCount; i += 1) {
            const csd = group.csd[i];
            const water = group.water[i];
            wsData.push([
              csd?.sku || "",
              csd ? Math.round(csd.pc) : "",
              csd ? Math.round(csd.uc * 100) / 100 : "",
              water?.sku || "",
              water ? Math.round(water.pc) : "",
              water ? Math.round(water.uc * 100) / 100 : "",
            ]);
          }

          wsData.push([
            "TOTAL",
            group.totals.csdPC,
            group.totals.csdUC,
            "TOTAL",
            group.totals.waterPC,
            group.totals.waterUC,
          ]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Distributor Performance");
      } else {
        const dateRow = [startDate && endDate ? `Date Range: ${startDate} to ${endDate}` : "All Data"];
        const csdSheet = [
          ["CSD SKU Sales Report"],
          dateRow,
          [],
          ["SKU", "Total PC", "Total UC"],
          ...skuReport.map((row) => [row.sku, row.totalPC, row.totalUC.toFixed(2)]),
        ];
        const waterSheet = [
          ["Water SKU Sales Report"],
          dateRow,
          [],
          ["SKU", "Total PC", "Total UC"],
          ...waterSkuReport.map((row) => [row.sku, row.totalPC, row.totalUC.toFixed(2)]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(csdSheet), "CSD SKU Sales");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(waterSheet), "Water SKU Sales");
      }
      
      XLSX.writeFile(wb, `Sales_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
      showSnackbar("Report exported to Excel successfully!", "success");
    } catch (error) {
      logger.error("Error exporting to Excel:", error);
      showSnackbar("Failed to export to Excel: " + (error.message || "Unknown error"), "error");
    }
  };
  
  // PDF Export
  const handleDownloadPDF = async () => {
    if (!tableRef.current) return;
    
    setExportingPDF(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const boxElement = tableRef.current;
      /** SKU tab has two scroll areas — capture the whole panel; performance uses the inner table. */
      const captureRoot = boxElement;

      const restoreStyles = [];
      const tableContainers = Array.from(boxElement.querySelectorAll(".MuiTableContainer-root"));
      const nodesToUnconstrain = tableContainers.length > 0 ? tableContainers : [captureRoot];

      nodesToUnconstrain.forEach((el) => {
        if (!el) return;
        restoreStyles.push({
          el,
          maxHeight: el.style.maxHeight,
          overflow: el.style.overflow,
          height: el.style.height,
        });
        el.style.maxHeight = "none";
        el.style.overflow = "visible";
        el.style.height = "auto";
      });

      captureRoot.scrollTop = 0;

      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(captureRoot, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: captureRoot.scrollWidth,
        height: captureRoot.scrollHeight,
        windowWidth: captureRoot.scrollWidth,
        windowHeight: captureRoot.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        allowTaint: true,
        removeContainer: false,
      });

      restoreStyles.forEach(({ el, maxHeight, overflow, height }) => {
        el.style.maxHeight = maxHeight;
        el.style.overflow = overflow;
        el.style.height = height;
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      
      // Force landscape using positional constructor (most reliable across jsPDF versions)
      const pdf = new jsPDF("l", "mm", "a4");
      
      const pdfWidth = pdf.internal.pageSize.getWidth();   // ~297 mm
      const pdfHeight = pdf.internal.pageSize.getHeight();  // ~210 mm
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const margin = 10; // 10mm margin on all sides
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2) - 15; // Extra space for title
      
      // Always scale to full landscape width, then paginate vertically.
      const widthRatio = availableWidth / imgWidth;
      const ratio = widthRatio;
      const imgScaledWidth = imgWidth * ratio;
      const imgScaledHeight = imgHeight * ratio;
      
      // Add title
      pdf.setFontSize(16);
      const reportTitle =
        reportType === "performance"
          ? "Distributor Performance Report"
          : "CSD & Water SKU Sales Report";
      pdf.text(reportTitle, pdfWidth / 2, 12, { align: "center" });
      
      // Add date and filter info
      pdf.setFontSize(10);
      const dateStr = new Date().toLocaleDateString();
      let filterStr = "";
      if (startDate && endDate) {
        filterStr += `Date: ${startDate} - ${endDate}`;
      }
      if (reportType === "performance" && selectedRegion && selectedRegion !== "All") {
        if (filterStr) filterStr += " | ";
        filterStr += `Region: ${selectedRegion}`;
      }
      if (filterStr) {
        pdf.text(`Generated: ${dateStr} | ${filterStr}`, pdfWidth / 2, 18, { align: "center" });
      } else {
        pdf.text(`Generated: ${dateStr}`, pdfWidth / 2, 18, { align: "center" });
      }
      
      // Add the table image (centered horizontally, with margins)
      const startX = (pdfWidth - imgScaledWidth) / 2;
      const startY = 25; // Start after title
      
      // If content fits on one page
      if (imgScaledHeight <= availableHeight) {
        pdf.addImage(imgData, "PNG", startX, startY, imgScaledWidth, imgScaledHeight);
      } else {
        // Split across multiple pages
        let yPosition = startY;
        let sourceY = 0;
        const pageHeight = pdfHeight - startY - margin;
        
        while (sourceY < imgHeight) {
          // Calculate how much of the image fits on this page
          const remainingHeight = imgHeight - sourceY;
          const scaledRemainingHeight = remainingHeight * ratio;
          const heightToShow = Math.min(scaledRemainingHeight, pageHeight);
          const sourceHeight = heightToShow / ratio;
          
          // Create a temporary canvas for this page
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');
          ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);
          
          const pageImgData = pageCanvas.toDataURL("image/png", 1.0);
          
          // Add image to PDF
          pdf.addImage(pageImgData, "PNG", startX, yPosition, imgScaledWidth, heightToShow);
          
          sourceY += sourceHeight;
          
          // If there's more content, add a new page
          if (sourceY < imgHeight) {
            // Use explicit signature for broader jsPDF compatibility.
            pdf.addPage("a4", "landscape");
            yPosition = margin;
          }
        }
      }
      
      const filename = `Sales_Report_${
        reportType === "performance" ? "Performance" : "SKU_CSD_Water"
      }_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);
      showSnackbar("Report exported to PDF successfully!", "success");
    } catch (error) {
      logger.error("Error exporting to PDF:", error);
      showSnackbar("Failed to export to PDF: " + (error.message || "Unknown error"), "error");
    } finally {
      setExportingPDF(false);
    }
  };
  
  const reportHasRows =
    reportType === "performance"
      ? performanceSkuReport.length > 0
      : skuReport.length > 0 || waterSkuReport.length > 0;

  const filteredPerformanceSkuReport = useMemo(() => {
    const needle = performanceSearch.trim().toLowerCase();
    if (!needle) return performanceSkuReport;
    return performanceSkuReport.filter((group) => (group.name || "").toLowerCase().includes(needle));
  }, [performanceSkuReport, performanceSearch]);

  const tableMaxH = { xs: "min(48vh, 360px)", sm: "min(56vh, 520px)" };
  const skuTableMaxH = { xs: "min(34vh, 300px)", sm: "min(38vh, 340px)" };
  const headSx = { fontWeight: 700, backgroundColor: "#c62828", color: "#fff", py: 1.25 };
  const renderMetric = (value) => {
    const num = Math.round(Number(value) || 0);
    return (
      <Box
        component="span"
        sx={{
          color: num === 0 ? "text.disabled" : "text.primary",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {num.toLocaleString()}
      </Box>
    );
  };
  const subHeadCsd = {
    fontWeight: 700,
    backgroundColor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? 0.22 : 0.12),
    color: "text.primary",
  };
  const subHeadWater = {
    fontWeight: 700,
    backgroundColor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.22 : 0.12),
    color: "text.primary",
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.default",
          color: "text.primary",
        },
      }}
    >
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: `linear-gradient(115deg, #b71c1c 0%, #d32f2f 45%, #c62828 100%)`,
          borderBottom: "1px solid",
          borderColor: alpha("#fff", 0.15),
        }}
      >
        <Toolbar sx={{ py: 1, gap: 2, minHeight: { xs: 56, sm: 64 } }}>
          <AssessmentOutlinedIcon sx={{ opacity: 0.95, fontSize: { xs: 26, sm: 30 } }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Reports & analytics
            </Typography>
            <Typography
              variant="caption"
              sx={{ opacity: 0.92, display: { xs: "none", sm: "block" }, mt: 0.25 }}
            >
              Excel row 4 headers · filter by dates and region · export Excel or PDF
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={onClose} aria-label="Close reports" size="large">
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3 }, pb: 10 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                bgcolor: "background.paper",
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                  color: "success.dark",
                }}
              >
                <PeopleOutlineIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Distributors (for matching)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {distributors?.length ?? 0}
                </Typography>
              </Box>
            </Paper>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                bgcolor: "background.paper",
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.info.main, 0.12),
                  color: "info.main",
                }}
              >
                <TableRowsOutlinedIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Records in use
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {localSalesData?.length ?? 0}
                </Typography>
              </Box>
            </Paper>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                flex: 1,
                p: 2,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                bgcolor: "background.paper",
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.warning.main, 0.15),
                  color: "warning.dark",
                }}
              >
                <FilterListIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  After filters
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {filteredSalesData.length}
                </Typography>
              </Box>
            </Paper>
          </Stack>

          <Paper
            elevation={0}
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              borderRadius: 2,
              borderStyle: "dashed",
              borderColor: alpha(theme.palette.error.main, 0.35),
              bgcolor: alpha(theme.palette.error.main, 0.02),
            }}
          >
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
              Report data source
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
              Upload an Excel workbook (.xlsx / .xls) with the same layout as main dashboard imports. Data here is
              stored for reports on this device and replaces the previous upload.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
              <Button
                variant="contained"
                size="large"
                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />}
                onClick={triggerFileUpload}
                disabled={uploading || !canWrite}
                sx={{
                  backgroundColor: "#c62828",
                  "&:hover": { backgroundColor: "#b71c1c" },
                  fontWeight: 700,
                  py: 1.25,
                }}
                title={!canWrite ? "You don't have permission to upload data." : ""}
              >
                {uploading
                  ? `Uploading… (${uploadProgress.processed}/${uploadProgress.total})`
                  : "Upload sales Excel"}
              </Button>
              <input
                ref={hiddenFileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
              {uploadProgress.total > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Processed {uploadProgress.saved} of {uploadProgress.total} rows
                </Typography>
              ) : null}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ ml: { sm: "auto" } }}>
                <Chip
                  label={`${distributors?.length || 0} distributor${distributors?.length !== 1 ? "s" : ""}`}
                  color={distributors && distributors.length > 0 ? "success" : "warning"}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${localSalesData?.length || 0} row${(localSalesData?.length || 0) !== 1 ? "s" : ""} loaded`}
                  color={localSalesData && localSalesData.length > 0 ? "primary" : "default"}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Stack>

            {uploadedFiles && uploadedFiles.length > 0 ? (
              <Accordion
                defaultExpanded
                disableGutters
                elevation={0}
                sx={{ mt: 2, borderRadius: "8px !important", border: "1px solid", borderColor: "divider", "&:before": { display: "none" } }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={700}>
                    Uploaded files ({uploadedFiles.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete all ${uploadedFiles.length} file(s) and clear report data?`
                          )
                        ) {
                          setUploadedFiles([]);
                          setLocalSalesData([]);
                          showSnackbar("All uploaded files removed", "info");
                        }
                      }}
                    >
                      Clear all
                    </Button>
                  </Stack>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ maxHeight: 280, borderRadius: 1 }}
                  >
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...headSx, width: 48 }}>#</TableCell>
                          <TableCell sx={headSx}>File</TableCell>
                          <TableCell sx={headSx}>Uploaded</TableCell>
                          <TableCell align="center" sx={headSx}>
                            Rows
                          </TableCell>
                          <TableCell align="center" sx={{ ...headSx, width: 72, fontSize: "0.7rem" }}>
                            Del
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {uploadedFiles.map((file, index) => (
                          <TableRow key={file.fileName} hover>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{file.fileName}</TableCell>
                            <TableCell sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
                              {file.uploadDate instanceof Date
                                ? file.uploadDate.toLocaleString()
                                : new Date(file.uploadDate).toLocaleString()}
                            </TableCell>
                            <TableCell align="center">{file.recordCount}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Remove ${file.fileName}`}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Remove "${file.fileName}" (${file.recordCount} rows)?`
                                    )
                                  ) {
                                    setUploadedFiles((prev) => prev.filter((f) => f.fileName !== file.fileName));
                                    setLocalSalesData((prev) =>
                                      prev.filter((record) => record.uploadedFileName !== file.fileName)
                                    );
                                    showSnackbar(`Removed ${file.fileName}`, "info");
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            ) : null}
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: 0, mb: 2, borderRadius: 2, overflow: "hidden" }}>
            <Tabs
              value={reportType}
              onChange={(e, val) => setReportType(val)}
              variant="fullWidth"
              sx={{
                bgcolor: alpha(theme.palette.grey[500], 0.08),
                minHeight: 52,
                "& .MuiTab-root": {
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  minHeight: 52,
                },
                "& .Mui-selected": { color: "error.dark" },
                "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0", bgcolor: "#c62828" },
              }}
            >
              <Tab label="Distributor performance" value="performance" />
              <Tab label="CSD & Water SKU sales" value="sku" />
            </Tabs>
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FilterListIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={800}>
                Filters
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", md: "flex-start" }}
              flexWrap="wrap"
              useFlexGap
            >
              <TextField
                label="Start date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  validateDateRange(e.target.value, endDate);
                }}
                InputLabelProps={{ shrink: true }}
                error={!!dateError}
                size="small"
                sx={{ minWidth: { md: 160 } }}
              />
              <TextField
                label="End date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  validateDateRange(startDate, e.target.value);
                }}
                InputLabelProps={{ shrink: true }}
                error={!!dateError}
                helperText={
                  dateError ||
                  (startDate && endDate ? `${filteredSalesData.length} records in range` : undefined)
                }
                size="small"
                sx={{ minWidth: { md: 160 } }}
              />
              {reportType === "performance" ? (
                <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 200 } }}>
                  <InputLabel id="region-filter-label">Region</InputLabel>
                  <Select
                    labelId="region-filter-label"
                    id="region-filter"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    label="Region"
                  >
                    <MenuItem value="All">All regions</MenuItem>
                    <MenuItem value="Southern">Southern</MenuItem>
                    <MenuItem value="Western">Western</MenuItem>
                    <MenuItem value="Eastern">Eastern</MenuItem>
                  </Select>
                </FormControl>
              ) : null}
              {(startDate ||
                endDate ||
                (reportType === "performance" && selectedRegion && selectedRegion !== "All")) && (
                <Button
                  variant="text"
                  color="inherit"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setSelectedRegion("All");
                  }}
                  sx={{ alignSelf: { md: "center" }, fontWeight: 700 }}
                >
                  Reset filters
                </Button>
              )}
            </Stack>
            {reportType === "performance" && selectedRegion && selectedRegion !== "All" ? (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                <Typography variant="body2" color="text.secondary">
                  Region
                </Typography>
                <Chip
                  label={selectedRegion}
                  onDelete={() => setSelectedRegion("All")}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Stack>
            ) : null}
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mb: 0 }}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <TableChartIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={800}>
                {reportType === "performance" ? "Distributor performance" : "CSD & Water SKU ranking"}
              </Typography>
              {reportType === "performance" ? (
                <Stack direction="row" spacing={0.75} sx={{ ml: "auto" }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`${filteredPerformanceSkuReport.length} shown`} />
                  {reportHasRows ? (
                    <Chip
                      label={`${performanceSkuReport.length} distributor${performanceSkuReport.length === 1 ? "" : "s"}`}
                      size="small"
                      variant="outlined"
                    />
                  ) : null}
                </Stack>
              ) : null}
              {reportType === "sku" && (skuReport.length > 0 || waterSkuReport.length > 0) ? (
                <Stack direction="row" spacing={0.75} sx={{ ml: "auto" }} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`CSD: ${skuReport.length} SKU`} />
                  <Chip
                    size="small"
                    label={`Water: ${waterSkuReport.length} SKU`}
                    color="info"
                    variant="outlined"
                  />
                </Stack>
              ) : null}
            </Box>

            <Box ref={tableRef} sx={{ bgcolor: "background.paper" }}>
              {reportType === "performance" ? (
                performanceSkuReport.length === 0 ? (
                  <Box sx={{ py: 6, px: 2, textAlign: "center" }}>
                    <AssessmentOutlinedIcon
                      sx={{ fontSize: 48, color: "action.disabled", mb: 1.5 }}
                    />
                    <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                      {localSalesData.length === 0
                        ? "No data yet"
                        : (startDate && endDate) || (selectedRegion && selectedRegion !== "All")
                          ? "Nothing matches these filters"
                          : "No rows to show"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: "auto" }}>
                      {localSalesData.length === 0
                        ? "Upload a sales Excel file above to build distributor performance."
                        : (startDate && endDate) || (selectedRegion && selectedRegion !== "All")
                          ? "Try widening the date range or setting region to All."
                          : "Adjust filters or upload a file with matched distributors."}
                    </Typography>
                  </Box>
                ) : filteredPerformanceSkuReport.length === 0 ? (
                  <Box sx={{ py: 5, px: 2, textAlign: "center" }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                      No distributors match your search
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Clear the search box to view all distributor performance rows.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      sx={{ px: 2, pt: 1.5, pb: 1 }}
                      alignItems={{ xs: "stretch", sm: "center" }}
                    >
                      <TextField
                        size="small"
                        placeholder="Search distributor..."
                        value={performanceSearch}
                        onChange={(e) => setPerformanceSearch(e.target.value)}
                        sx={{ minWidth: { sm: 280 } }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PeopleOutlineIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Stack>
                    <TableContainer sx={{ maxHeight: tableMaxH }}>
                    <Table stickyHeader size="small" sx={{ minWidth: 820 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...headSx, width: "32%" }}>CSD Product skus</TableCell>
                          <TableCell align="right" sx={{ ...headSx, width: 96 }}>PC</TableCell>
                          <TableCell align="right" sx={{ ...headSx, width: 96 }}>UC</TableCell>
                          <TableCell sx={{ ...headSx, width: "32%" }}>K WATER Product skus</TableCell>
                          <TableCell align="right" sx={{ ...headSx, width: 96 }}>PC</TableCell>
                          <TableCell align="right" sx={{ ...headSx, width: 96 }}>UC</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredPerformanceSkuReport.map((group) => {
                          const rowCount = Math.max(group.csd.length, group.water.length, 1);

                          return (
                            <React.Fragment key={group.key}>
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  sx={{
                                    bgcolor: alpha(theme.palette.grey[500], 0.08),
                                    color: "text.primary",
                                    fontWeight: 900,
                                    py: 1.25,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-start",
                                  }}
                                >
                                  Distributor: {group.name}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={subHeadCsd}>CSD</TableCell>
                                <TableCell align="right" sx={subHeadCsd}>PC</TableCell>
                                <TableCell align="right" sx={subHeadCsd}>UC</TableCell>
                                <TableCell sx={subHeadWater}>K WATER</TableCell>
                                <TableCell align="right" sx={subHeadWater}>PC</TableCell>
                                <TableCell align="right" sx={subHeadWater}>UC</TableCell>
                              </TableRow>
                              {Array.from({ length: rowCount }).map((_, index) => {
                                const csd = group.csd[index];
                                const water = group.water[index];

                                return (
                                  <TableRow
                                    key={`${group.key}-${index}`}
                                    hover
                                    sx={{ "&:nth-of-type(even)": { bgcolor: alpha(theme.palette.grey[500], 0.04) } }}
                                  >
                                    <TableCell sx={{ fontWeight: csd ? 600 : 400 }}>{csd?.sku || ""}</TableCell>
                                    <TableCell align="right">{csd ? renderMetric(csd.pc) : renderMetric(0)}</TableCell>
                                    <TableCell align="right">{csd ? renderMetric(csd.uc) : renderMetric(0)}</TableCell>
                                    <TableCell sx={{ fontWeight: water ? 600 : 400 }}>{water?.sku || ""}</TableCell>
                                    <TableCell align="right">{water ? renderMetric(water.pc) : renderMetric(0)}</TableCell>
                                    <TableCell align="right">{water ? renderMetric(water.uc) : renderMetric(0)}</TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow
                                sx={{
                                  bgcolor: alpha(theme.palette.grey[700], 0.06),
                                  "& .MuiTableCell-root": { fontWeight: 900, color: "text.primary" },
                                }}
                              >
                                <TableCell>Total</TableCell>
                                <TableCell align="right">{renderMetric(group.totals.csdPC)}</TableCell>
                                <TableCell align="right">{renderMetric(group.totals.csdUC)}</TableCell>
                                <TableCell>Total</TableCell>
                                <TableCell align="right">{renderMetric(group.totals.waterPC)}</TableCell>
                                <TableCell align="right">{renderMetric(group.totals.waterUC)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  sx={{
                                    py: 0.8,
                                    borderBottom: "none",
                                    bgcolor: "transparent",
                                  }}
                                />
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  </>
                )
              ) : (
                <Stack spacing={2.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      sx={{ mb: 1, px: 0.5, color: "error.dark" }}
                    >
                      CSD — SKU sales
                    </Typography>
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ maxHeight: skuTableMaxH, borderRadius: 1 }}
                    >
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...headSx, width: 56 }}>#</TableCell>
                            <TableCell sx={headSx}>SKU</TableCell>
                            <TableCell align="center" sx={subHeadCsd}>
                              Total PC
                            </TableCell>
                            <TableCell align="center" sx={subHeadCsd}>
                              Total UC
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {skuReport.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 4, border: "none" }}>
                                <Typography variant="body2" color="text.secondary">
                                  {localSalesData.length === 0
                                    ? "Upload sales data with CSD product lines."
                                    : startDate && endDate
                                      ? "No CSD SKUs in this date range."
                                      : "No CSD SKUs in the filtered data."}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            skuReport.map((row, index) => (
                              <TableRow
                                key={`csd-${row.sku}`}
                                hover
                                sx={{
                                  color: "text.primary",
                                  "&:nth-of-type(even)": {
                                    bgcolor: alpha(theme.palette.grey[500], 0.04),
                                  },
                                }}
                              >
                                <TableCell sx={{ fontWeight: 700, color: "text.primary" }}>{index + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: "text.primary" }}>{row.sku}</TableCell>
                                <TableCell align="center" sx={{ color: "text.primary" }}>{row.totalPC.toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ color: "text.primary" }}>{row.totalUC.toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={800}
                      sx={{ mb: 1, px: 0.5, color: "info.main" }}
                    >
                      Water (Kinley) — SKU sales
                    </Typography>
                    <TableContainer
                      component={Paper}
                      variant="outlined"
                      sx={{ maxHeight: skuTableMaxH, borderRadius: 1 }}
                    >
                      <Table stickyHeader size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ ...headSx, width: 56 }}>#</TableCell>
                            <TableCell sx={headSx}>SKU</TableCell>
                            <TableCell align="center" sx={subHeadWater}>
                              Total PC
                            </TableCell>
                            <TableCell align="center" sx={subHeadWater}>
                              Total UC
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {waterSkuReport.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} align="center" sx={{ py: 4, border: "none" }}>
                                <Typography variant="body2" color="text.secondary">
                                  {localSalesData.length === 0
                                    ? "Upload sales data with Water / Kinley product lines."
                                    : startDate && endDate
                                      ? "No water SKUs in this date range."
                                      : "No water SKUs in the filtered data."}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            waterSkuReport.map((row, index) => (
                              <TableRow
                                key={`water-${row.sku}`}
                                hover
                                sx={{
                                  color: "text.primary",
                                  "&:nth-of-type(even)": {
                                    bgcolor: alpha(theme.palette.grey[500], 0.04),
                                  },
                                }}
                              >
                                <TableCell sx={{ fontWeight: 700, color: "text.primary" }}>{index + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 600, color: "text.primary" }}>{row.sku}</TableCell>
                                <TableCell align="center" sx={{ color: "text.primary" }}>{row.totalPC.toLocaleString()}</TableCell>
                                <TableCell align="center" sx={{ color: "text.primary" }}>{row.totalUC.toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Stack>
              )}
            </Box>
          </Paper>
        </Container>
      </Box>

      <Paper
        elevation={8}
        square
        sx={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2,
          px: { xs: 2, sm: 3 },
          py: 1.75,
          borderTop: "1px solid",
          borderColor: "divider",
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xl" sx={{ px: { xs: 0, sm: 2 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
              {reportType === "sku"
                ? "Excel: two sheets (CSD + Water). PDF captures both tables below. Filters apply to both."
                : "Exports reflect the active tab and filters."}
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
              <Button
                variant="outlined"
                size="large"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadExcel}
                disabled={!reportHasRows}
                sx={{ fontWeight: 700 }}
              >
                Excel
              </Button>
              <Button
                variant="contained"
                size="large"
                startIcon={
                  exportingPDF ? <CircularProgress size={22} color="inherit" /> : <PictureAsPdfIcon />
                }
                onClick={handleDownloadPDF}
                disabled={exportingPDF || !reportHasRows}
                sx={{ bgcolor: "#c62828", "&:hover": { bgcolor: "#b71c1c" }, fontWeight: 700 }}
              >
                {exportingPDF ? "Building PDF…" : "PDF"}
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Paper>
      
      {/* Snackbar for notifications */}
      <AppSnackbar
        open={snackbar.open}
        severity={snackbar.severity}
        message={snackbar.message}
        autoHideDuration={4200}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      />
    </Dialog>
  );
}
