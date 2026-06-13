import React, { useState, useMemo } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Checkbox,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { tableStripeAt } from "../theme/contrastSurfaces";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import EventIcon from "@mui/icons-material/Event";
import DeleteIcon from "@mui/icons-material/Delete";
import { getTargetPeriod, saveTargetPeriod, markTargetPeriodSet } from "../utils/targetPeriod";
import { supabase, saveGlobalTargetPeriod } from "../services/supabaseService";
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const DENSE_CELL = { py: 0.35, px: 0.5, fontSize: "0.7rem", lineHeight: 1.2, fontWeight: 700 };
const GRID_BORDER = {
  borderRight: 1,
  borderBottom: 1,
  borderColor: "divider",
};
const DIST_COL_WIDTH = 220;
const COMPACT_INPUT = {
  "& .MuiInputBase-root": { fontSize: "0.75rem", height: 28, fontWeight: 700 },
  "& .MuiInputBase-input": { py: 0.25, px: 0.5, textAlign: "center", fontWeight: 700 },
};

/** Achieved PC/UC from sales can be floating-point; show whole units with grouping. */
function formatAchievedMetric(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

/**
 * Props:
 * - open, onClose
 * - distributors: full list
 * - initialStart, initialEnd (ISO dates)
 * - onApplyTargets(updatesByName)  // updatesByName: { "Distributor A": {CSD_PC, CSD_UC, Water_PC, Water_UC}, ... }
 * - onUpdateAchieved(aggregatedMap) // used by upload
 * - onUpdatePeriod(startIso, endIso)
 */
export default function TargetsDialog({
  open, onClose, distributors = [], initialStart, initialEnd, targetPeriodIsSet = false,
  onApplyTargets, onUpdateAchieved, onUpdatePeriod, onDeleteTargets, canWrite = true
}) {
  const theme = useTheme();
  const [tabRegion, setTabRegion] = useState("All");
  const defaultPeriod = getTargetPeriod();
  const [start, setStart] = useState(
    targetPeriodIsSet ? (initialStart || defaultPeriod.start || "") : (initialStart || "")
  );
  const [end, setEnd] = useState(
    targetPeriodIsSet ? (initialEnd || defaultPeriod.end || "") : (initialEnd || "")
  );
  const [editing, setEditing] = useState(() => {
    const map = {};
    distributors.forEach(d => {
      map[d.name] = { ...(d.target || {}) };
    });
    return map;
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const [bulkUploadResults, setBulkUploadResults] = useState({ success: [], failed: [], skipped: [] });
  const [loadingFile, setLoadingFile] = useState(false);
  const hiddenFileRef = React.useRef(null);
  const [selectedDistributorKeys, setSelectedDistributorKeys] = useState([]);
  const getDistributorKey = React.useCallback((d) => d?.code || d?.name || "", []);

  React.useEffect(() => {
    if (open) {
      setSelectedDistributorKeys([]);
    }
  }, [open]);

  // keep editing state in sync when distributors prop changes (e.g. after import)
  // Use useMemo to create a stable key for distributors to avoid unnecessary updates
  const distributorsKey = React.useMemo(() => {
    if (!distributors || !Array.isArray(distributors)) {
      return '';
    }
    try {
      return distributors
        .filter(d => d && d.name) // Filter out invalid entries
        .map(d => `${d.name}:${JSON.stringify(d.target || {})}`)
        .join('|');
    } catch (error) {
      console.error('Error creating distributors key:', error);
      return '';
    }
  }, [distributors]);
  
  const prevDistributorsKeyRef = React.useRef(distributorsKey);
  const isInitialMountRef = React.useRef(true);
  
  React.useEffect(() => {
    // Only update editing state if:
    // 1. Dialog just opened (initial mount)
    // 2. Distributors actually changed (key changed)
    const shouldUpdate = isInitialMountRef.current || distributorsKey !== prevDistributorsKeyRef.current;
    
    if (shouldUpdate && open && distributors && Array.isArray(distributors)) {
      try {
        setEditing(prev => {
          const map = {};
          distributors.forEach(d => {
            // Skip invalid distributors
            if (!d || !d.name) return;
            // Preserve existing edits if they exist, otherwise use distributor target
            map[d.name] = prev[d.name] || { ...(d.target || {}) };
          });
          return map;
        });
        prevDistributorsKeyRef.current = distributorsKey;
        isInitialMountRef.current = false;
      } catch (error) {
        console.error('Error updating editing state:', error);
      }
    }
  }, [distributorsKey, open, distributors]);

  const filtered = useMemo(() => {
    if (!distributors || !Array.isArray(distributors)) {
      return [];
    }
    
    try {
      const key = { All: "All", South: "Southern", West: "Western", East: "Eastern" }[tabRegion] || tabRegion;
      let result = key === "All" ? distributors : distributors.filter(d => d && d.region === key);
      
      // Apply search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        result = result.filter(d => 
          d && (
            (d.name || "").toLowerCase().includes(search) ||
            (d.code || "").toLowerCase().includes(search)
          )
        );
      }
      
      return result;
    } catch (error) {
      console.error('Error filtering distributors:', error);
      return [];
    }
  }, [distributors, tabRegion, searchTerm]);

  const visibleKeys = useMemo(
    () => filtered.map((d) => getDistributorKey(d)).filter(Boolean),
    [filtered, getDistributorKey]
  );

  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedDistributorKeys.includes(key));

  const someVisibleSelected =
    visibleKeys.some((key) => selectedDistributorKeys.includes(key)) && !allVisibleSelected;

  const toggleSelectAllVisible = () => {
    setSelectedDistributorKeys((prev) => {
      if (allVisibleSelected) {
        return prev.filter((key) => !visibleKeys.includes(key));
      }
      return Array.from(new Set([...prev, ...visibleKeys]));
    });
  };

  const toggleSelectOne = (distributor) => {
    const key = getDistributorKey(distributor);
    if (!key) return;
    setSelectedDistributorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleField = (name, field) => (e) => {
    let v = e.target.value === "" ? "" : Number(e.target.value);
    // Validate: must be non-negative number
    if (v !== "" && (isNaN(v) || v < 0)) {
      v = 0;
    }
    // Round to whole number
    if (v !== "" && !isNaN(v)) {
      v = Math.round(v);
    }
    setEditing(prev => ({ ...prev, [name]: { ...(prev[name]||{}), [field]: v === "" ? 0 : v } }));
  };

  const apply = () => {
    // Validate date range
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (startDate > endDate) {
        alert("Start date must be before end date");
        return;
      }
      if (startDate < new Date("2000-01-01") || endDate > new Date("2100-12-31")) {
        alert("Please enter valid dates between 2000 and 2100");
        return;
      }
    }
    
    // Validate all target values are non-negative
    const hasNegative = Object.values(editing).some(target => 
      Object.values(target).some(val => val < 0 || !isFinite(val))
    );
    if (hasNegative) {
      alert("Target values must be non-negative numbers");
      return;
    }
    
    // Save target period to storage
    if (start && end) {
      markTargetPeriodSet(true);
      saveTargetPeriod(start, end);
      if (supabase) {
        saveGlobalTargetPeriod(start, end).catch((err) => {
          console.warn("Could not save target period to Supabase:", err);
        });
      }
    }

    // send only changed targets (pass full entries is fine)
    if (onApplyTargets) onApplyTargets(editing);
    if (onUpdatePeriod) onUpdatePeriod(start, end);
    
    alert("Targets updated successfully!");
  };

  const requestDeleteSelectedTargets = () => {
    if (!canWrite) {
      alert("You don't have permission to delete targets.");
      return;
    }
    if (selectedDistributorKeys.length === 0) {
      alert("Please select at least one distributor target to delete.");
      return;
    }
    if (
      !window.confirm(
        `Delete targets for ${selectedDistributorKeys.length} selected distributor(s)? This removes targets from the workspace.`
      )
    ) {
      return;
    }
    confirmDeleteSelectedTargets();
  };

  const confirmDeleteSelectedTargets = async () => {
    const selected = distributors.filter((d) => selectedDistributorKeys.includes(getDistributorKey(d)));
    if (selected.length === 0) {
      alert("No selected distributors found to delete.");
      return;
    }

    try {
      if (onDeleteTargets) {
        await onDeleteTargets(selected.map((d) => ({ code: d.code, name: d.name })));
      }

      setEditing((prev) => {
        const next = { ...prev };
        selected.forEach((d) => {
          if (d?.name) {
            next[d.name] = { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 };
          }
        });
        return next;
      });
      setSelectedDistributorKeys([]);
    } catch (error) {
      alert(`Failed to delete selected targets: ${error.message || error}`);
    }
  };

  // Parse target Excel file
  const parseTargetExcel = async (file) => {
    const XLSX = await import("xlsx");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array", cellDates: true });
          
          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON (array of arrays, first row is headers)
          const rows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: "",
            raw: false
          });
          
          if (rows.length < 2) {
            reject(new Error("Excel file must contain at least a header row and one data row"));
            return;
          }
          
          // Expected columns: Distributor, Target CSD PC, Target CSD UC, Target Water PC, Target Water UC
          const headerRow = rows[0].map(h => (h || "").toString().toLowerCase().trim());
          
          // Find column indices (flexible header matching)
          const findCol = (keywords) => {
            for (const keyword of keywords) {
              const idx = headerRow.findIndex(h => h.includes(keyword));
              if (idx !== -1) return idx;
            }
            return -1;
          };
          
          const distributorIdx = findCol(["distributor", "name"]);
          const targetCSD_PC_Idx = findCol(["target csd pc", "target csd_pc", "csd pc target", "target csd pc", "csd_pc"]);
          const targetCSD_UC_Idx = findCol(["target csd uc", "target csd_uc", "csd uc target", "target csd uc", "csd_uc"]);
          const targetWater_PC_Idx = findCol(["target water pc", "target water_pc", "water pc target", "target water pc", "water_pc"]);
          const targetWater_UC_Idx = findCol(["target water uc", "target water_uc", "water uc target", "target water uc", "water_uc"]);
          
          // If exact match not found, try position-based (assuming standard order)
          let nameIdx = distributorIdx >= 0 ? distributorIdx : 0;
          let csdPCIdx = targetCSD_PC_Idx >= 0 ? targetCSD_PC_Idx : 1;
          let csdUCIdx = targetCSD_UC_Idx >= 0 ? targetCSD_UC_Idx : 2;
          let waterPCIdx = targetWater_PC_Idx >= 0 ? targetWater_PC_Idx : 3;
          let waterUCIdx = targetWater_UC_Idx >= 0 ? targetWater_UC_Idx : 4;
          
          // Check if first row is headers or data
          const firstRowValues = rows[0].filter(v => v !== "" && v !== null && v !== undefined);
          const hasHeaders = firstRowValues.length > 0 && 
            (headerRow.some(h => h.includes("distributor") || h.includes("target") || h.includes("name")) ||
             !firstRowValues.some(v => !isNaN(parseFloat(v))));
          
          const dataStartRow = hasHeaders ? 1 : 0;
          
          const targets = [];
          const errors = [];
          
          for (let i = dataStartRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue; // Skip empty rows
            
            const name = (row[nameIdx] || "").toString().trim();
            const csdPC = parseFloat(row[csdPCIdx]) || 0;
            const csdUC = parseFloat(row[csdUCIdx]) || 0;
            const waterPC = parseFloat(row[waterPCIdx]) || 0;
            const waterUC = parseFloat(row[waterUCIdx]) || 0;
            
            // Validate required fields
            if (!name || name.length < 2) {
              errors.push(`Row ${i + 1}: Distributor name is required`);
              continue;
            }
            
            // Validate non-negative numbers
            if (csdPC < 0 || csdUC < 0 || waterPC < 0 || waterUC < 0) {
              errors.push(`Row ${i + 1}: Target values must be non-negative`);
              continue;
            }
            
            targets.push({
              name,
              target: {
                CSD_PC: Math.round(csdPC),
                CSD_UC: Math.round(csdUC),
                Water_PC: Math.round(waterPC),
                Water_UC: Math.round(waterUC),
              },
              rowNumber: i + 1
            });
          }
          
          if (targets.length === 0 && errors.length === 0) {
            reject(new Error("No valid target data found in Excel file"));
            return;
          }
          
          resolve({ targets, errors });
        } catch (error) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Download target template
  const downloadTargetTemplate = async () => {
    const [XLSX, { saveAs }] = await Promise.all([
      import("xlsx"),
      import("file-saver"),
    ]);
    // Create template data
    const templateData = [
      ["Distributor", "Target CSD PC", "Target CSD UC", "Target Water PC", "Target Water UC"],
      ["Distributor A", 1000, 500, 800, 400],
      ["Distributor B", 1200, 600, 900, 450],
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 25 }, // Distributor
      { wch: 15 }, // Target CSD PC
      { wch: 15 }, // Target CSD UC
      { wch: 18 }, // Target Water PC
      { wch: 18 }, // Target Water UC
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Targets");

    // Generate Excel file and download
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "target_template.xlsx");
  };

  // Handle bulk target upload
  const handleBulkTargetUpload = async (file) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv"
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Please upload a valid Excel file (.xlsx, .xls, or .csv)");
      return;
    }
    
    setLoadingFile(true);
    setBulkUploadOpen(true);
    setBulkUploadProgress({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
    setBulkUploadResults({ success: [], failed: [], skipped: [] });
    
    try {
      const { targets: parsedTargets, errors: parseErrors } = await parseTargetExcel(file);
      
      if (parseErrors.length > 0) {
        console.warn("Excel parsing warnings:", parseErrors);
      }
      
      if (parsedTargets.length === 0) {
        alert("No valid target data found in Excel file. Please check the file format.");
        setBulkUploadOpen(false);
        setLoadingFile(false);
        return;
      }
      
      setBulkUploadProgress(prev => ({ ...prev, total: parsedTargets.length }));
      
      const normalize = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
      const success = [];
      const failed = [];
      const skipped = [];
      
      // Helper function for fuzzy matching
      const fuzzyMatch = (name1, name2) => {
        const n1 = normalize(name1);
        const n2 = normalize(name2);
        if (n1 === n2) return true;
        if (n1.includes(n2) || n2.includes(n1)) return true;
        const removeCommon = (s) => s.replace(/\b(ltd|limited|inc|incorporated|pvt|private|co|company|distributor|dealer)\b/gi, "").trim();
        const n1Clean = removeCommon(n1);
        const n2Clean = removeCommon(n2);
        if (n1Clean && n2Clean && (n1Clean === n2Clean || n1Clean.includes(n2Clean) || n2Clean.includes(n1Clean))) {
          return true;
        }
        return false;
      };
      
      // Process each target
      for (let i = 0; i < parsedTargets.length; i++) {
        const targetData = parsedTargets[i];
        
        // Find matching distributor
        const matchingDistributor = distributors.find(d => 
          normalize(d.name) === normalize(targetData.name) || 
          fuzzyMatch(d.name, targetData.name)
        );
        
        if (!matchingDistributor) {
          skipped.push({
            name: targetData.name,
            reason: "Distributor not found in app",
            rowNumber: targetData.rowNumber
          });
          setBulkUploadProgress(prev => ({ 
            ...prev, 
            processed: prev.processed + 1, 
            skipped: prev.skipped + 1 
          }));
          continue;
        }
        
        // Update editing state with target data
        setEditing(prev => ({
          ...prev,
          [matchingDistributor.name]: {
            ...(prev[matchingDistributor.name] || {}),
            ...targetData.target
          }
        }));
        
        success.push({
          name: targetData.name,
          matched: matchingDistributor.name,
          rowNumber: targetData.rowNumber
        });
        
        setBulkUploadProgress(prev => ({ 
          ...prev, 
          processed: prev.processed + 1, 
          success: prev.success + 1 
        }));
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      setBulkUploadResults({ success, failed, skipped });
      
      if (success.length > 0) {
        alert(`Successfully loaded targets for ${success.length} distributor(s)! ${skipped.length > 0 ? `\n${skipped.length} distributor(s) were skipped (not found in app).` : ''}`);
      }
      
    } catch (error) {
      console.error("Bulk upload error:", error);
      alert(`Failed to process Excel file: ${error.message}`);
      setBulkUploadOpen(false);
    } finally {
      setLoadingFile(false);
    }
  };

  const triggerBulkUpload = () => {
    if (hiddenFileRef.current) hiddenFileRef.current.click();
  };

  const onBulkUploadFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleBulkTargetUpload(file);
    }
    e.target.value = null;
  };

  const summaryTotals = useMemo(() => {
    let targetUc = 0;
    let achievedUc = 0;
    filtered.forEach((d) => {
      const target = editing[d.name] || d.target || {};
      targetUc += (target.CSD_UC || 0) + (target.Water_UC || 0);
      achievedUc += (Number(d.achieved?.CSD_UC) || 0) + (Number(d.achieved?.Water_UC) || 0);
    });
    return { count: filtered.length, targetUc, achievedUc };
  }, [filtered, editing]);

  const targetTablePastel = React.useMemo(
    () => ({
      headMain: {
        fontWeight: 700,
        bgcolor: "#1565c0",
        color: "#fff",
        textAlign: "center",
        ...DENSE_CELL,
        px: 0.5,
      },
      headSub: {
        fontWeight: 700,
        bgcolor: "#ffcdd2",
        color: theme.palette.getContrastText("#ffcdd2"),
        textAlign: "center",
        fontSize: "0.65rem",
        py: 0.25,
        px: 0.35,
        whiteSpace: "nowrap",
      },
      csdSub: {
        fontWeight: 700,
        bgcolor: "#fff3e0",
        color: theme.palette.getContrastText("#fff3e0"),
        textAlign: "center",
        fontSize: "0.65rem",
        py: 0.25,
        px: 0.35,
      },
      waterSub: {
        fontWeight: 700,
        bgcolor: "#e3f2fd",
        color: theme.palette.getContrastText("#e3f2fd"),
        textAlign: "center",
        fontSize: "0.65rem",
        py: 0.25,
        px: 0.35,
      },
      pinkCorner: {
        fontWeight: 700,
        bgcolor: "#ffcdd2",
        color: theme.palette.getContrastText("#ffcdd2"),
        position: "sticky",
        left: 0,
        zIndex: 10,
        fontSize: "0.7rem",
        py: 0.35,
        px: 0.75,
      },
    }),
    [theme]
  );

  return (
    <>
      <Dialog 
        fullScreen 
        open={open} 
        onClose={onClose}
        disableEnforceFocus={false}
        disableAutoFocus={false}
        PaperProps={{ sx: { bgcolor: "background.default", color: "text.primary" } }}
      >
        <AppBar sx={{ position: "relative", bgcolor: "#1565c0" }}>
          <Toolbar variant="dense" sx={{ minHeight: 48, gap: 0.5 }}>
            <TrackChangesIcon sx={{ fontSize: 22 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15, fontSize: "0.95rem" }}>
                Targets
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: "0.65rem" }}>
                {summaryTotals.count} dist · Tgt UC {summaryTotals.targetUc.toLocaleString()} · Ach UC{" "}
                {formatAchievedMetric(summaryTotals.achievedUc)}
              </Typography>
            </Box>
            <Button
              size="small"
              color="inherit"
              onClick={apply}
              startIcon={<SaveIcon sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: "0.75rem" }}
            >
              Save
            </Button>
            <IconButton size="small" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 1, sm: 1.5 }, bgcolor: "background.default", color: "text.primary" }}>
          <Stack spacing={1}>
            <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
              <Box
                sx={{
                  px: 1,
                  py: 0.5,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 0.75,
                  bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === "dark" ? 0.12 : 0.08),
                }}
              >
                <Tabs
                  value={tabRegion}
                  onChange={(e, v) => setTabRegion(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    minHeight: 32,
                    "& .MuiTab-root": {
                      minHeight: 32,
                      py: 0.25,
                      px: 1.25,
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "none",
                    },
                    "& .Mui-selected": { color: "warning.dark" },
                  }}
                >
                  {["All", "South", "West", "East"].map((t) => (
                    <Tab
                      key={t}
                      value={t}
                      label={`${t} (${
                        t === "All"
                          ? filtered.length
                          : filtered.filter((d) => {
                              const key = { South: "Southern", West: "Western", East: "Eastern" }[t];
                              return d.region === key;
                            }).length
                      })`}
                    />
                  ))}
                </Tabs>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={loadingFile ? <CircularProgress size={14} /> : <UploadFileIcon />}
                  onClick={triggerBulkUpload}
                  disabled={loadingFile}
                  sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                >
                  Upload
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={downloadTargetTemplate}
                  disabled={loadingFile}
                  sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                >
                  Template
                </Button>
                <input
                  ref={hiddenFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onBulkUploadFileChange}
                  style={{ display: "none" }}
                />
              </Box>
            </Paper>

            <Accordion
              disableGutters
              elevation={0}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1, "&:before": { display: "none" } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon fontSize="small" />} sx={{ minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <EventIcon sx={{ fontSize: 16, color: "warning.main" }} />
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Period {start && end ? `· ${start} → ${end}` : "· Target date not set yet"}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1, px: 1.5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                  <TextField
                    label="Start"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    sx={{ width: 150, ...COMPACT_INPUT }}
                  />
                  <TextField
                    label="End"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    size="small"
                    sx={{ width: 150, ...COMPACT_INPUT }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  Achieved counts invoices dated within this range (inclusive).
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <TextField
                size="small"
                placeholder="Search distributor…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: "text.secondary", fontSize: 18, mr: 0.5 }} />,
                }}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  "& .MuiInputBase-root": { fontSize: "0.8rem", height: 32 },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                onClick={requestDeleteSelectedTargets}
                disabled={!canWrite || selectedDistributorKeys.length === 0}
                sx={{ textTransform: "none", fontSize: "0.7rem", whiteSpace: "nowrap" }}
              >
                Delete ({selectedDistributorKeys.length})
              </Button>
            </Stack>
          </Stack>

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              mt: 1,
              borderRadius: 1,
              overflow: "auto",
              maxHeight: "calc(100vh - 220px)",
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                minWidth: 860,
                tableLayout: "fixed",
                borderCollapse: "collapse",
                "& .MuiTableCell-root": GRID_BORDER,
              }}
            >
            <TableHead>
              <TableRow>
                <TableCell
                  rowSpan={2}
                  sx={{
                    ...targetTablePastel.headMain,
                    ...GRID_BORDER,
                    position: "sticky",
                    left: 0,
                    zIndex: 11,
                    textAlign: "left",
                    width: DIST_COL_WIDTH,
                    minWidth: DIST_COL_WIDTH,
                    borderRight: 2,
                    borderColor: "divider",
                    boxShadow: (t) => `2px 0 4px ${alpha(t.palette.common.black, 0.08)}`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    <Checkbox
                      size="small"
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      sx={{ color: "#fff", "&.Mui-checked": { color: "#fff" }, p: 0 }}
                    />
                    Distributor
                  </Box>
                </TableCell>
                <TableCell colSpan={4} sx={targetTablePastel.headMain}>
                  Target
                </TableCell>
                <TableCell colSpan={4} sx={targetTablePastel.headMain}>
                  Achieved
                </TableCell>
                <TableCell colSpan={4} sx={targetTablePastel.headMain}>
                  Balance
                </TableCell>
              </TableRow>
              <TableRow>
                {[
                  ["C PC", "C UC", "W PC", "W UC"],
                  ["C PC", "C UC", "W PC", "W UC"],
                  ["C PC", "C UC", "W PC", "W UC"],
                ].map((group, gi) =>
                  group.map((label, i) => (
                    <TableCell
                      key={`${gi}-${label}-${i}`}
                      sx={i < 2 ? targetTablePastel.csdSub : targetTablePastel.waterSub}
                    >
                      {label}
                    </TableCell>
                  ))
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 2, color: "text.secondary", fontSize: "0.8rem" }}>
                    {searchTerm ? "No match" : "No distributors"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d, rowIdx) => {
                  const rowBg = tableStripeAt(theme, rowIdx);
                  const tgt = (f) => editing[d.name]?.[f] ?? d.target?.[f] ?? 0;
                  const ach = (f) => d.achieved?.[f] ?? 0;
                  const bal = (f) => Math.round(tgt(f) - ach(f));
                  const balSx = (f) => ({
                    ...DENSE_CELL,
                    color: bal(f) >= 0 ? "text.secondary" : "error.main",
                    fontWeight: 700,
                    textAlign: "center",
                  });
                  const targetField = (field) => (
                    <TableCell key={field} padding="none" align="center">
                      <TextField
                        size="small"
                        value={tgt(field)}
                        onChange={handleField(d.name, field)}
                        disabled={!canWrite}
                        sx={{ ...COMPACT_INPUT, width: "100%" }}
                      />
                    </TableCell>
                  );
                  return (
                  <TableRow key={d.name || d.code || `distributor-${d.id}`} sx={{ bgcolor: rowBg, "& td": { ...DENSE_CELL, ...GRID_BORDER } }}>
                    <TableCell
                      sx={{
                        ...DENSE_CELL,
                        ...GRID_BORDER,
                        fontWeight: 600,
                        position: "sticky",
                        left: 0,
                        bgcolor: rowBg,
                        zIndex: 9,
                        width: DIST_COL_WIDTH,
                        minWidth: DIST_COL_WIDTH,
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        verticalAlign: "middle",
                        borderRight: 2,
                        boxShadow: (t) => `2px 0 4px ${alpha(t.palette.common.black, 0.06)}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, py: 0.25 }}>
                        <Checkbox
                          size="small"
                          checked={selectedDistributorKeys.includes(getDistributorKey(d))}
                          onChange={() => toggleSelectOne(d)}
                          sx={{ p: 0, mt: 0.15, flexShrink: 0 }}
                        />
                        <Typography component="span" variant="caption" sx={{ fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.35 }}>
                          {d.name}
                          {d.code ? (
                            <Typography component="span" display="block" variant="caption" color="text.secondary" sx={{ fontSize: "0.65rem", fontWeight: 500 }}>
                              {d.code}
                            </Typography>
                          ) : null}
                        </Typography>
                      </Box>
                    </TableCell>
                    {targetField("CSD_PC")}
                    {targetField("CSD_UC")}
                    {targetField("Water_PC")}
                    {targetField("Water_UC")}
                    <TableCell align="center" sx={DENSE_CELL}>{formatAchievedMetric(ach("CSD_PC"))}</TableCell>
                    <TableCell align="center" sx={DENSE_CELL}>{formatAchievedMetric(ach("CSD_UC"))}</TableCell>
                    <TableCell align="center" sx={DENSE_CELL}>{formatAchievedMetric(ach("Water_PC"))}</TableCell>
                    <TableCell align="center" sx={DENSE_CELL}>{formatAchievedMetric(ach("Water_UC"))}</TableCell>
                    <TableCell align="center" sx={balSx("CSD_PC")}>{bal("CSD_PC")}</TableCell>
                    <TableCell align="center" sx={balSx("CSD_UC")}>{bal("CSD_UC")}</TableCell>
                    <TableCell align="center" sx={balSx("Water_PC")}>{bal("Water_PC")}</TableCell>
                    <TableCell align="center" sx={balSx("Water_UC")}>{bal("Water_UC")}</TableCell>
                  </TableRow>
                );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

          <Box sx={{ display: "flex", gap: 0.75, mt: 1, justifyContent: "flex-end" }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                const m = {};
                distributors.forEach((d) => {
                  m[d.name] = { ...(d.target || {}) };
                });
                setEditing(m);
                setSearchTerm("");
              }}
              sx={{ textTransform: "none" }}
            >
              Reset
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
              onClick={apply}
              disabled={!canWrite}
              sx={{ textTransform: "none", fontWeight: 700 }}
              title={!canWrite ? "Admin only" : ""}
            >
              Save
            </Button>
          </Box>
        </Box>

        {/* Bulk upload progress */}
        <Dialog
          open={bulkUploadOpen} 
          onClose={() => bulkUploadProgress.processed === bulkUploadProgress.total ? setBulkUploadOpen(false) : null}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { bgcolor: "background.paper", color: "text.primary" } }}
        >
          <DialogTitle sx={{ color: "text.primary" }}>
            Bulk Upload Targets Progress
          </DialogTitle>
          <DialogContent sx={{ color: "text.primary" }}>
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Processing targets...
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {bulkUploadProgress.processed} / {bulkUploadProgress.total}
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={bulkUploadProgress.total > 0 ? (bulkUploadProgress.processed / bulkUploadProgress.total) * 100 : 0}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
              <Chip 
                label={`Success: ${bulkUploadProgress.success}`} 
                color="success" 
                sx={{ fontWeight: 600 }}
              />
              <Chip 
                label={`Skipped: ${bulkUploadProgress.skipped}`} 
                color="warning" 
                sx={{ fontWeight: 600 }}
              />
              <Chip 
                label={`Failed: ${bulkUploadProgress.failed}`} 
                color="error" 
                sx={{ fontWeight: 600 }}
              />
            </Box>

            {bulkUploadProgress.processed === bulkUploadProgress.total && bulkUploadProgress.total > 0 && (
              <Box>
                {bulkUploadResults.success.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "success.dark" }}>
                      Successfully Updated ({bulkUploadResults.success.length}):
                    </Typography>
                    <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "action.hover", borderRadius: 1 }}>
                      {bulkUploadResults.success.slice(0, 10).map((item, idx) => (
                        <ListItem key={idx}>
                          <ListItemText 
                            primary={item.name}
                            secondary={item.matched !== item.name ? `Matched: ${item.matched}` : `Row ${item.rowNumber}`}
                          />
                        </ListItem>
                      ))}
                      {bulkUploadResults.success.length > 10 && (
                        <ListItem>
                          <ListItemText 
                            primary={`... and ${bulkUploadResults.success.length - 10} more`}
                            sx={{ fontStyle: "italic", color: "text.secondary" }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}

                {bulkUploadResults.skipped.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "warning.dark" }}>
                      Skipped ({bulkUploadResults.skipped.length}):
                    </Typography>
                    <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: (t) => alpha(t.palette.warning.main, 0.12), borderRadius: 1 }}>
                      {bulkUploadResults.skipped.slice(0, 10).map((item, idx) => (
                        <ListItem key={idx}>
                          <ListItemText 
                            primary={item.name}
                            secondary={`${item.reason} (Row ${item.rowNumber})`}
                          />
                        </ListItem>
                      ))}
                      {bulkUploadResults.skipped.length > 10 && (
                        <ListItem>
                          <ListItemText 
                            primary={`... and ${bulkUploadResults.skipped.length - 10} more`}
                            sx={{ fontStyle: "italic", color: "text.secondary" }}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>
                )}

                {bulkUploadResults.failed.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "error.main" }}>
                      Failed ({bulkUploadResults.failed.length}):
                    </Typography>
                    <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: (t) => alpha(t.palette.error.main, 0.1), borderRadius: 1 }}>
                      {bulkUploadResults.failed.map((item, idx) => (
                        <ListItem key={idx}>
                          <ListItemText 
                            primary={item.name}
                            secondary={item.reason}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setBulkUploadOpen(false)}
              variant="contained"
              disabled={bulkUploadProgress.processed < bulkUploadProgress.total}
            >
              {bulkUploadProgress.processed === bulkUploadProgress.total ? "Close" : "Cancel"}
            </Button>
          </DialogActions>
        </Dialog>
      </Dialog>
    </>
  );
}