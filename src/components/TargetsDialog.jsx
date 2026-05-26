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
import LockIcon from "@mui/icons-material/Lock";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import EventIcon from "@mui/icons-material/Event";
import DeleteIcon from "@mui/icons-material/Delete";
import { getTargetPeriod, saveTargetPeriod } from "../utils/targetPeriod";
import { supabase, saveGlobalTargetPeriod } from "../services/supabaseService";
import PasswordDialog from "./PasswordDialog";
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
  Avatar,
} from "@mui/material";

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
  open, onClose, distributors = [], initialStart, initialEnd,
  onApplyTargets, onUpdateAchieved, onUpdatePeriod, onDeleteTargets, canWrite = true
}) {
  const theme = useTheme();
  const [tabRegion, setTabRegion] = useState("All");
  // Use initial values or get from storage
  const defaultPeriod = getTargetPeriod();
  const [start, setStart] = useState(initialStart || defaultPeriod.start || "");
  const [end, setEnd] = useState(initialEnd || defaultPeriod.end || "");
  const [editing, setEditing] = useState(() => {
    const map = {};
    distributors.forEach(d => {
      map[d.name] = { ...(d.target || {}) };
    });
    return map;
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const [bulkUploadResults, setBulkUploadResults] = useState({ success: [], failed: [], skipped: [] });
  const [loadingFile, setLoadingFile] = useState(false);
  const hiddenFileRef = React.useRef(null);
  const [selectedDistributorKeys, setSelectedDistributorKeys] = useState([]);
  const [deletePasswordDialogOpen, setDeletePasswordDialogOpen] = useState(false);

  const getDistributorKey = React.useCallback((d) => d?.code || d?.name || "", []);

  // Reset authentication when dialog opens
  React.useEffect(() => {
    if (open) {
      setIsAuthenticated(false);
      setPasswordDialogOpen(true);
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

  const handlePasswordSuccess = () => {
    setIsAuthenticated(true);
    setPasswordDialogOpen(false);
  };

  const handlePasswordClose = () => {
    setPasswordDialogOpen(false);
    if (!isAuthenticated) {
      // If not authenticated, close the dialog
      onClose && onClose();
    }
  };

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

  const [applyPasswordDialogOpen, setApplyPasswordDialogOpen] = useState(false);

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
    
    // Require password confirmation for applying changes
    setApplyPasswordDialogOpen(true);
  };

  const confirmApply = () => {
    setApplyPasswordDialogOpen(false);
    
    // Save target period to storage
    if (start && end) {
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
    setDeletePasswordDialogOpen(true);
  };

  const confirmDeleteSelectedTargets = async () => {
    setDeletePasswordDialogOpen(false);
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

  const targetTablePastel = React.useMemo(
    () => ({
      csdBand: {
        fontWeight: "bold",
        bgcolor: "#fff3e0",
        color: theme.palette.getContrastText("#fff3e0"),
        textAlign: "center",
        fontSize: "0.85rem",
      },
      waterBand: {
        fontWeight: "bold",
        bgcolor: "#e3f2fd",
        color: theme.palette.getContrastText("#e3f2fd"),
        textAlign: "center",
        fontSize: "0.85rem",
      },
      pinkCorner: {
        fontWeight: "bold",
        bgcolor: "#ffcdd2",
        color: theme.palette.getContrastText("#ffcdd2"),
        position: "sticky",
        left: 0,
        zIndex: 10,
      },
      pinkCell75: {
        fontWeight: "bold",
        bgcolor: "#ffcdd2",
        color: theme.palette.getContrastText("#ffcdd2"),
        textAlign: "center",
        fontSize: "0.75rem",
      },
    }),
    [theme]
  );

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <PasswordDialog
          open={passwordDialogOpen}
          onClose={handlePasswordClose}
          onSuccess={handlePasswordSuccess}
          title="Access Restricted"
          message="This section is password protected. Please enter your admin password to manage targets."
        />
        <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { bgcolor: "background.default" } }}>
          <AppBar sx={{ position: 'relative', bgcolor: "#d61916" }}>
            <Toolbar>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1 }}>
                <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 40, height: 40 }}>
                  <TrackChangesIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 600, color: "white" }}>
                    Manage Targets
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                    Password protected
                  </Typography>
                </Box>
              </Box>
              <LockIcon sx={{ mr: 1 }} />
              <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
                <CloseIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", bgcolor: "background.default" }}>
            <Typography variant="h6" sx={{ color: "text.secondary" }}>
              Please enter password to continue
            </Typography>
          </Box>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <PasswordDialog
        open={passwordDialogOpen}
        onClose={handlePasswordClose}
        onSuccess={handlePasswordSuccess}
        title="Access Restricted"
        message="This section is password protected. Please enter your admin password to manage targets."
      />
      <Dialog 
        fullScreen 
        open={open} 
        onClose={onClose}
        disableEnforceFocus={false}
        disableAutoFocus={false}
        PaperProps={{ sx: { bgcolor: "background.default", color: "text.primary" } }}
      >
        <AppBar sx={{ position: 'relative', bgcolor: "#d61916" }}>
          <Toolbar>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1 }}>
              <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 40, height: 40 }}>
                <TrackChangesIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600, color: "white" }}>
                  Manage Targets
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                  Set and update distributor targets
                </Typography>
              </Box>
            </Box>
            <Button 
              color="inherit" 
              onClick={apply}
              startIcon={<SaveIcon />}
              sx={{ mr: 1, fontWeight: 600, bgcolor: "rgba(255,255,255,0.2)", "&:hover": { bgcolor: "rgba(255,255,255,0.3)" } }}
            >
              Save Changes
            </Button>
            <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, sm: 3 }, bgcolor: "background.default", color: "text.primary" }}>
          {/* Summary Cards - First Row */}
          {filtered.length > 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, mb: 3 }}>
              <Paper elevation={2} sx={{ p: 2, borderRadius: 2, bgcolor: (t) => alpha(t.palette.info.main, t.palette.mode === "dark" ? 0.2 : 0.12), color: "text.primary" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Total Distributors
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "info.main" }}>
                  {filtered.length}
                </Typography>
              </Paper>
              <Paper elevation={2} sx={{ p: 2, borderRadius: 2, bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === "dark" ? 0.2 : 0.12), color: "text.primary" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Total Target UC
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "warning.dark" }}>
                  {filtered.reduce((sum, d) => {
                    const target = editing[d.name] || d.target || {};
                    return sum + (target.CSD_UC || 0) + (target.Water_UC || 0);
                  }, 0).toLocaleString()}
                </Typography>
              </Paper>
              <Paper elevation={2} sx={{ p: 2, borderRadius: 2, bgcolor: (t) => alpha(t.palette.success.main, t.palette.mode === "dark" ? 0.2 : 0.12), color: "text.primary" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Total Achieved UC
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "success.dark" }}>
                  {formatAchievedMetric(
                    filtered.reduce((sum, d) => {
                      return sum + (Number(d.achieved?.CSD_UC) || 0) + (Number(d.achieved?.Water_UC) || 0);
                    }, 0)
                  )}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Target Period - Second Row */}
          <Paper elevation={4} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 3, background: (t) => (t.palette.mode === "dark" ? alpha(t.palette.warning.main, 0.14) : "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)"), border: "2px solid", borderColor: "warning.main", color: "text.primary" }}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 2, pb: 2, borderBottom: "2px solid", borderColor: "warning.main" }}>
              <Avatar sx={{ bgcolor: "#ff9800", width: 40, height: 40 }}>
                <EventIcon sx={{ color: "white" }} />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "warning.dark" }}>
                Target Period
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <TextField 
                label="Start Date" 
                type="date" 
                value={start} 
                onChange={(e) => setStart(e.target.value)} 
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ bgcolor: "background.paper", borderRadius: 1 }}
              />
              <TextField 
                label="End Date" 
                type="date" 
                value={end} 
                onChange={(e) => setEnd(e.target.value)} 
                InputLabelProps={{ shrink: true }}
                size="small"
                sx={{ bgcolor: "background.paper", borderRadius: 1 }}
              />
              <Box sx={{ flex: 1 }} />
            </Box>
            <Typography variant="body2" sx={{ color: "text.primary", mt: 1.5, lineHeight: 1.5, maxWidth: 720 }}>
              Start and end can be any dates you need—the range does not have to sit inside a single calendar month.
              Set them to match your commercial cycle. Sales are counted toward <strong>Achieved</strong> on the
              performance table only when the invoice date falls between start and end (inclusive).
            </Typography>
          </Paper>

          {/* Region tabs with colored selected tab and buttons - Third Row */}
          <Paper elevation={4} sx={{ mb: 3, borderRadius: 3, overflow: "visible", border: "1px solid", borderColor: "divider", color: "text.primary" }}>
            <Box sx={{ 
              p: { xs: 1.5, sm: 2 }, 
              background: (t) => (t.palette.mode === "dark" ? alpha(t.palette.warning.main, 0.12) : "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)"), 
              display: "flex", 
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between", 
              gap: 2, 
              flexWrap: "wrap" 
            }}>
              <Box sx={{ width: { xs: "100%", sm: "auto" }, overflowX: { xs: "auto", sm: "visible" }, flexGrow: 1 }}>
                <Tabs
                  value={tabRegion}
                  onChange={(e, v) => setTabRegion(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    minHeight: { xs: 36, sm: 56 },
                    "& .MuiTab-root": { 
                      fontWeight: 700, 
                      textTransform: "none", 
                      minHeight: { xs: 36, sm: 56 },
                      fontSize: { xs: "0.7rem", sm: "1rem" },
                      px: { xs: 1.25, sm: 3 },
                      py: { xs: 0.5, sm: 1 },
                      transition: "all 0.2s",
                      color: "text.primary",
                      "&:hover": {
                        bgcolor: (t) => alpha(t.palette.common.white, t.palette.mode === "dark" ? 0.08 : 0.35),
                      }
                    },
                    "& .Mui-selected": { 
                      bgcolor: "#ff9800", 
                      color: "#fff", 
                      borderRadius: 2,
                      fontWeight: 800,
                      boxShadow: "0 2px 8px rgba(255, 152, 0, 0.3)"
                    },
                    "& .MuiTabs-scrollButtons": {
                      color: "#ff9800",
                      width: { xs: 28, sm: 40 },
                      "&.Mui-disabled": {
                        opacity: 0.3
                      }
                    }
                  }}
                >
                  {["All","South","West","East"].map(t => (
                    <Tab 
                      key={t} 
                      value={t} 
                      label={`${t} (${t === "All" ? filtered.length : filtered.filter(d => {
                        const key = { South: "Southern", West: "Western", East: "Eastern" }[t];
                        return d.region === key;
                      }).length})`} 
                    />
                  ))}
                </Tabs>
              </Box>
              {/* Bulk Upload and Download buttons on the right */}
              <Box sx={{ 
                display: "flex", 
                gap: 1.5, 
                alignItems: "center", 
                flexWrap: "wrap",
                width: { xs: "100%", sm: "auto" },
                justifyContent: { xs: "center", sm: "flex-end" }
              }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={loadingFile ? <CircularProgress size={16} /> : <UploadFileIcon />}
                  onClick={triggerBulkUpload}
                  disabled={loadingFile}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    minWidth: { xs: 120, sm: 140 },
                    px: { xs: 1.5, sm: 2 },
                    py: 0.75,
                    borderWidth: 1.5,
                    transition: "all 0.2s",
                    bgcolor: "background.paper",
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    "&:hover": {
                      borderWidth: 1.5,
                      transform: "translateY(-1px)",
                      boxShadow: 2,
                      bgcolor: "background.paper",
                    }
                  }}
                >
                  {loadingFile ? "Uploading..." : "Bulk Upload"}
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadTargetTemplate}
                  disabled={loadingFile}
                  sx={{
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 600,
                    minWidth: { xs: 120, sm: 140 },
                    px: { xs: 1.5, sm: 2 },
                    py: 0.75,
                    borderWidth: 1.5,
                    transition: "all 0.2s",
                    bgcolor: "background.paper",
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    "&:hover": {
                      borderWidth: 1.5,
                      transform: "translateY(-1px)",
                      boxShadow: 2,
                      bgcolor: "background.paper",
                    }
                  }}
                >
                  Download Template
                </Button>
                <input
                  ref={hiddenFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onBulkUploadFileChange}
                  style={{ display: "none" }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Search bar just above the table */}
          <Box sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center" }}>
            <TextField
              placeholder="Search distributors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
                ),
              }}
              sx={{
                flexGrow: 1,
                minWidth: 200,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 3,
                  bgcolor: "background.paper",
                  boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.35 : 0.1)}`,
                  transition: "all 0.2s",
                  "&:hover": {
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.45 : 0.15)}`,
                  },
                  "&.Mui-focused": {
                    boxShadow: (t) => `0 4px 12px ${alpha(t.palette.error.main, 0.25)}`,
                  }
                }
              }}
            />
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={requestDeleteSelectedTargets}
              disabled={!canWrite || selectedDistributorKeys.length === 0}
              sx={{ borderRadius: 2, minWidth: 170, textTransform: "none", fontWeight: 600 }}
            >
              Delete Selected
            </Button>
          </Box>

          {/* Editable targets table (two-rows per distributor) */}
          <TableContainer 
            component={Paper} 
            sx={{ 
              borderRadius: 2, 
              overflow: "auto",
              maxHeight: { xs: "calc(100vh - 400px)", sm: "calc(100vh - 350px)", md: "70vh" },
              "&::-webkit-scrollbar": {
                height: "8px",
                width: "8px",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: alpha(theme.palette.text.primary, 0.26),
                borderRadius: "4px",
              },
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: { xs: 800, sm: 1000 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: "bold", bgcolor: "#d61916", color: "#fff", position: "sticky", left: 0, zIndex: 10, minWidth: 200 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Checkbox
                      size="small"
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      sx={{ color: "#fff", "&.Mui-checked": { color: "#fff" }, p: 0.25 }}
                    />
                    Distributor
                  </Box>
                </TableCell>
                <TableCell colSpan={4} sx={{ fontWeight: "bold", bgcolor: "#d61916", color: "#fff", textAlign: "center" }}>
                  Target
                </TableCell>
                <TableCell colSpan={4} sx={{ fontWeight: "bold", bgcolor: "#d61916", color: "#fff", textAlign: "center" }}>
                  Achieved
                </TableCell>
                <TableCell colSpan={4} sx={{ fontWeight: "bold", bgcolor: "#d61916", color: "#fff", textAlign: "center" }}>
                  Balance
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={targetTablePastel.pinkCorner} />
                <TableCell colSpan={2} sx={targetTablePastel.csdBand}>
                  CSD
                </TableCell>
                <TableCell colSpan={2} sx={targetTablePastel.waterBand}>
                  Water
                </TableCell>
                <TableCell colSpan={2} sx={targetTablePastel.csdBand}>
                  CSD
                </TableCell>
                <TableCell colSpan={2} sx={targetTablePastel.waterBand}>
                  Water
                </TableCell>
                <TableCell colSpan={2} sx={targetTablePastel.csdBand}>
                  CSD
                </TableCell>
                <TableCell colSpan={2} sx={targetTablePastel.waterBand}>
                  Water
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={targetTablePastel.pinkCorner} />
                {/* Target Headers */}
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
                {/* Achieved Headers */}
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
                {/* Balance Headers */}
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>PC</TableCell>
                <TableCell sx={targetTablePastel.pinkCell75}>UC</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    {searchTerm ? "No distributors found matching your search" : "No distributors available"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((d, rowIdx) => {
                  const rowBg = tableStripeAt(theme, rowIdx);
                  return (
                  <TableRow key={d.name || d.code || `distributor-${d.id}`} sx={{ bgcolor: rowBg, color: "text.primary" }}>
                    <TableCell sx={{ fontWeight: "bold", position: "sticky", left: 0, bgcolor: rowBg, color: "text.primary", zIndex: 9 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Checkbox
                          size="small"
                          checked={selectedDistributorKeys.includes(getDistributorKey(d))}
                          onChange={() => toggleSelectOne(d)}
                          sx={{ p: 0.25 }}
                        />
                        <span>{d.name}</span>
                      </Box>
                    </TableCell>

                    {/* Target - CSD PC, CSD UC, Water PC, Water UC */}
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      <TextField size="small" value={editing[d.name]?.CSD_PC ?? d.target?.CSD_PC ?? 0} onChange={handleField(d.name, "CSD_PC")} disabled={!canWrite} inputProps={{ style: { textAlign: "center", width: 80 } }} />
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      <TextField size="small" value={editing[d.name]?.CSD_UC ?? d.target?.CSD_UC ?? 0} onChange={handleField(d.name, "CSD_UC")} disabled={!canWrite} inputProps={{ style: { textAlign: "center", width: 80 } }} />
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      <TextField size="small" value={editing[d.name]?.Water_PC ?? d.target?.Water_PC ?? 0} onChange={handleField(d.name, "Water_PC")} disabled={!canWrite} inputProps={{ style: { textAlign: "center", width: 80 } }} />
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      <TextField size="small" value={editing[d.name]?.Water_UC ?? d.target?.Water_UC ?? 0} onChange={handleField(d.name, "Water_UC")} disabled={!canWrite} inputProps={{ style: { textAlign: "center", width: 80 } }} />
                    </TableCell>

                    {/* Achieved - CSD PC, CSD UC, Water PC, Water UC */}
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      {formatAchievedMetric(d.achieved?.CSD_PC)}
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      {formatAchievedMetric(d.achieved?.CSD_UC)}
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      {formatAchievedMetric(d.achieved?.Water_PC)}
                    </TableCell>
                    <TableCell align="center" sx={{ color: "text.primary" }}>
                      {formatAchievedMetric(d.achieved?.Water_UC)}
                    </TableCell>

                    {/* Balance - CSD PC, CSD UC, Water PC, Water UC */}
                    <TableCell align="center" sx={{ 
                      color: ((editing[d.name]?.CSD_PC ?? d.target?.CSD_PC ?? 0) - (d.achieved?.CSD_PC ?? 0)) >= 0 ? "text.secondary" : "error.main",
                      fontWeight: ((editing[d.name]?.CSD_PC ?? d.target?.CSD_PC ?? 0) - (d.achieved?.CSD_PC ?? 0)) < 0 ? 600 : "normal"
                    }}>
                      {Math.round((editing[d.name]?.CSD_PC ?? d.target?.CSD_PC ?? 0) - (d.achieved?.CSD_PC ?? 0))}
                    </TableCell>
                    <TableCell align="center" sx={{ 
                      color: ((editing[d.name]?.CSD_UC ?? d.target?.CSD_UC ?? 0) - (d.achieved?.CSD_UC ?? 0)) >= 0 ? "text.secondary" : "error.main",
                      fontWeight: 600
                    }}>
                      {Math.round((editing[d.name]?.CSD_UC ?? d.target?.CSD_UC ?? 0) - (d.achieved?.CSD_UC ?? 0))}
                    </TableCell>
                    <TableCell align="center" sx={{ 
                      color: ((editing[d.name]?.Water_PC ?? d.target?.Water_PC ?? 0) - (d.achieved?.Water_PC ?? 0)) >= 0 ? "text.secondary" : "error.main",
                      fontWeight: ((editing[d.name]?.Water_PC ?? d.target?.Water_PC ?? 0) - (d.achieved?.Water_PC ?? 0)) < 0 ? 600 : "normal"
                    }}>
                      {Math.round((editing[d.name]?.Water_PC ?? d.target?.Water_PC ?? 0) - (d.achieved?.Water_PC ?? 0))}
                    </TableCell>
                    <TableCell align="center" sx={{ 
                      color: ((editing[d.name]?.Water_UC ?? d.target?.Water_UC ?? 0) - (d.achieved?.Water_UC ?? 0)) >= 0 ? "text.secondary" : "error.main",
                      fontWeight: 600
                    }}>
                      {Math.round((editing[d.name]?.Water_UC ?? d.target?.Water_UC ?? 0) - (d.achieved?.Water_UC ?? 0))}
                    </TableCell>
                  </TableRow>
                );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

          {/* actions below table: Apply & Reset */}
          <Box sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "flex-end" }}>
            <Button 
              variant="outlined" 
              startIcon={<RefreshIcon />}
              onClick={() => {
                // reset edits to current distributor targets
                const m = {};
                distributors.forEach(d => m[d.name] = { ...(d.target || {}) });
                setEditing(m);
                setSearchTerm("");
              }}
              sx={{ borderRadius: 2 }}
            >
              Reset Changes
            </Button>
            <Button 
              variant="contained" 
              color="error"
              startIcon={<SaveIcon />}
              onClick={apply}
              disabled={!canWrite}
              sx={{ 
                borderRadius: 2,
                minWidth: 150,
              }}
              title={!canWrite ? "You don't have permission to update targets. Only admins can update targets." : ""}
            >
              Save All Changes
            </Button>
          </Box>
        </Box>

        {/* Password Dialog for Apply */}
        <PasswordDialog
          open={applyPasswordDialogOpen}
          onClose={() => setApplyPasswordDialogOpen(false)}
          onSuccess={confirmApply}
          title="Confirm Save Changes"
          message="Saving target changes will update all distributor targets. Please enter your admin password to confirm."
        />

        <PasswordDialog
          open={deletePasswordDialogOpen}
          onClose={() => setDeletePasswordDialogOpen(false)}
          onSuccess={confirmDeleteSelectedTargets}
          title="Confirm Target Deletion"
          message={`Delete targets for ${selectedDistributorKeys.length} selected distributor(s)? This will remove targets from Supabase and local storage.`}
        />

        {/* Bulk Upload Progress Dialog */}
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