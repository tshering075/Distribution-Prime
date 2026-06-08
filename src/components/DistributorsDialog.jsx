import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  Grid,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Checkbox,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Tooltip,
  FormControl,
  InputLabel,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { tableStripeAt, tableHeadRowSx, tableHeaderBg } from "../theme/contrastSurfaces";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import PeopleIcon from "@mui/icons-material/People";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import Avatar from "@mui/material/Avatar";
import { hashPasswordForStorage, isUsernameTaken, getDistributors } from "../utils/distributorAuth";
import AddDistributorDialog from "./AddDistributorDialog";
import { getAllDistributors, supabase } from "../services/supabaseService";
import DistributorPhoneField from "./DistributorPhoneField";
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneForStorage,
  normalizeBulkPhone,
  parsePhoneFromStorage,
  validateLocalPhone,
} from "../utils/distributorPhone";

const REGION_TAB_MAP = {
  South: "Southern",
  West: "Western",
  East: "Eastern",
  North: "Northern",
};
const REGION_TABS = ["All", "South", "West", "East", "North"];
const REGION_CHIP_COLOR = {
  Southern: "warning",
  Western: "info",
  Eastern: "success",
  Northern: "secondary",
  PLING: "default",
  THIM: "default",
};

function matchesSearch(d, search) {
  if (!search) return true;
  const q = search.toLowerCase();
  return (
    (d.name || "").toLowerCase().includes(q) ||
    (d.code || "").toLowerCase().includes(q) ||
    (d.region || "").toLowerCase().includes(q) ||
    (d.credentials?.username || "").toLowerCase().includes(q)
  );
}

function regionTabCount(list, tab, searchTerm) {
  const targetRegion = tab === "All" ? "All" : (REGION_TAB_MAP[tab] || tab);
  if (!searchTerm) {
    return tab === "All" ? list.length : list.filter((d) => d.region === targetRegion).length;
  }
  return list.filter((d) => {
    if (tab !== "All" && d.region !== targetRegion) return false;
    return matchesSearch(d, searchTerm);
  }).length;
}

/**
 * Props:
 * - open, onClose
 * - distributors: array
 * - onAdd(payload), onUpdate(codeOrName, updates), onDelete(codeOrName)
 */
export default function DistributorsDialog({ open, onClose, distributors = [], onAdd, onUpdate, onDelete, canWrite = true, canDelete = true }) {
  const theme = useTheme();
  const [form, setForm] = useState({
    name: "",
    code: "",
    region: "Southern",
    phoneCountry: DEFAULT_PHONE_COUNTRY,
    phone: "",
    password: "",
    username: "",
    address: "",
    gstin: "",
    tpn: "",
  });
  const [editingCode, setEditingCode] = useState(null);
  const [list, setList] = useState(distributors);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [distributorToDelete, setDistributorToDelete] = useState(null);
  const [selectedDistributors, setSelectedDistributors] = useState([]); // For bulk delete
  const [searchTerm, setSearchTerm] = useState("");
  const [tabRegion, setTabRegion] = useState("All");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const [bulkUploadResults, setBulkUploadResults] = useState({ success: [], failed: [], skipped: [] });
  const [codeUniqueness, setCodeUniqueness] = useState({ isUnique: null, message: "" }); // Track code uniqueness
  const [addDistributorDialogOpen, setAddDistributorDialogOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  useEffect(() => {
    setList(distributors);
  }, [distributors]);

  const hasActiveFilters = tabRegion !== "All" || Boolean(searchTerm.trim());

  const filteredList = useMemo(() => list.filter((d) => {
    if (tabRegion !== "All") {
      const targetRegion = REGION_TAB_MAP[tabRegion] || tabRegion;
      if (d.region !== targetRegion) return false;
    }
    return matchesSearch(d, searchTerm.trim());
  }), [list, tabRegion, searchTerm]);

  const togglePasswordVisible = (code) => {
    setVisiblePasswords((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const distributorHeaderCellSx = {
    color: "text.primary",
    bgcolor: tableHeaderBg(theme),
    fontWeight: 700,
    fontSize: { xs: "0.75rem", sm: "0.82rem" },
    letterSpacing: 0.2,
    py: 0.9,
    px: 1,
    whiteSpace: "nowrap",
    borderBottom: `2px solid ${theme.palette.primary.main}`,
  };

  const distributorRowSx = (index) => {
    const isDark = theme.palette.mode === "dark";
    const rowBg = isDark
      ? index % 2 === 0
        ? alpha(theme.palette.common.white, 0.055)
        : alpha(theme.palette.common.white, 0.025)
      : tableStripeAt(theme, index);

    return {
      bgcolor: rowBg,
      color: "text.primary",
      transition: "background-color 0.2s, box-shadow 0.2s",
      "& > td": {
        bgcolor: "inherit",
        py: 0.55,
        px: 1,
        fontSize: { xs: "0.72rem", sm: "0.8rem" },
        lineHeight: 1.2,
        borderBottom: "1px solid",
        borderColor: isDark ? alpha(theme.palette.common.white, 0.08) : "divider",
      },
      "&.MuiTableRow-hover:hover": {
        bgcolor: isDark ? alpha(theme.palette.warning.light, 0.18) : alpha(theme.palette.warning.main, 0.12),
        boxShadow: isDark
          ? `inset 3px 0 0 ${theme.palette.warning.light}`
          : `inset 3px 0 0 ${theme.palette.warning.main}`,
        "& > td": {
          bgcolor: "inherit",
        },
      },
    };
  };

  const reset = () => {
    setCodeUniqueness({ isUnique: null, message: "" });
    setForm({ name: "", code: "", region: "Southern", phoneCountry: DEFAULT_PHONE_COUNTRY, phone: "", password: "", username: "", address: "", gstin: "", tpn: "" });
    setEditingCode(null);
  };

  const handleChange = (k) => (e) => {
    const value = e.target.value;
    setForm(prev => {
      const updated = { ...prev, [k]: value };
      return updated;
    });
    
    // Check code uniqueness when code changes
    if (k === "code") {
      checkCodeUniqueness(value);
    }
  };

  const validateCode = (code) => {
    // Code should be alphanumeric, 2-20 characters
    const codeRegex = /^[a-zA-Z0-9]{2,20}$/;
    return codeRegex.test(code);
  };

  const validateUsername = (username) => {
    // Username should be 3-30 characters, alphanumeric and underscores
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  };

  // Check code uniqueness
  const checkCodeUniqueness = (code) => {
    if (!code || code.trim() === "") {
      setCodeUniqueness({ isUnique: null, message: "" });
      return;
    }
    
    const codeUpper = code.trim().toUpperCase();
    
    // Check against existing distributors (excluding the one being edited)
    const existingDistributors = getDistributors();
    const isDuplicate = existingDistributors.some(d => {
      // Skip the distributor being edited
      if (editingCode && d.code === editingCode) {
        return false;
      }
      return d.code && d.code.toUpperCase() === codeUpper;
    });
    
    // Also check Supabase if available
    if (supabase) {
      getAllDistributors().then(supabaseDistributors => {
        const isDuplicateInSupabase = supabaseDistributors.some(d => {
          if (editingCode && d.code === editingCode) {
            return false;
          }
          return d.code && d.code.toUpperCase() === codeUpper;
        });
        
        if (isDuplicateInSupabase) {
          setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
        } else if (!isDuplicate) {
          setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
        }
      }).catch(() => {
        // If Firebase check fails, use local check
        if (!isDuplicate) {
          setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
        } else {
          setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
        }
      });
    } else {
      // No Firebase, use local check only
      if (!isDuplicate) {
        setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
      } else {
        setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
      }
    }
  };

  const handleAddOrUpdate = () => {
    // Trim all string inputs
    const trimmedName = (form.name || "").trim();
    const trimmedCode = (form.code || "").trim().toUpperCase();
    const trimmedUsername = (form.username || "").trim();
    const trimmedPhone = (form.phone || "").trim();
    const phoneDial = form.phoneCountry || DEFAULT_PHONE_COUNTRY;
    
    // Validation
    if (!trimmedName || trimmedName.length < 2) { 
      alert("Name is required and must be at least 2 characters"); 
      return; 
    }
    
    if (!trimmedCode) {
      alert("Code is required. Please enter a unique distributor code manually.");
      return;
    }
    
    // Check code uniqueness before saving
    if (codeUniqueness.isUnique === false) {
      alert("This code is already taken. Please enter a unique code.");
      return;
    }
    
    // Final uniqueness check (in case user didn't wait for async check)
    const existingDistributors = getDistributors();
    const isDuplicate = existingDistributors.some(d => {
      if (editingCode && d.code === editingCode) {
        return false; // Skip the distributor being edited
      }
      return d.code && d.code.toUpperCase() === trimmedCode;
    });
    
    if (isDuplicate) {
      alert("This code is already taken by another distributor. Please enter a unique code.");
      return;
    }
    
    if (!validateCode(trimmedCode)) {
      alert("Code must be 2-20 alphanumeric characters");
      return;
    }
    
    // Check for duplicate code (excluding current if editing)
    // Check both localStorage and the list prop (which may include Firebase data)
    const distributors = getDistributors();
    let duplicateCode = distributors.find(d => 
      d.code === trimmedCode && 
      (!editingCode || (d.code !== editingCode && d.name !== editingCode))
    );
    
    // Also check in the list prop (which may include Firebase data)
    if (!duplicateCode) {
      duplicateCode = list.find(d => 
        d.code === trimmedCode && 
        (!editingCode || (d.code !== editingCode && d.name !== editingCode))
      );
    }
    
    if (duplicateCode) {
      alert(`Code "${trimmedCode}" is already taken by another distributor`);
      return;
    }
    
    if (!trimmedUsername) {
      alert("Username is required for distributor login");
      return;
    }
    
    if (!validateUsername(trimmedUsername)) {
      alert("Username must be 3-30 characters (letters, numbers, and underscores only)");
      return;
    }
    
    // Check for duplicate username
    if (isUsernameTaken(trimmedUsername, editingCode)) {
      alert("Username is already taken. Please choose another.");
      return;
    }
    
    if (!editingCode && !form.password) {
      alert("Password is required for new distributor");
      return;
    }

    if (editingCode) {
      const existing = list.find(
        (d) => d.code === editingCode || d.name === editingCode
      );
      const hasSavedPassword = Boolean(existing?.credentials?.passwordHash);
      if (!hasSavedPassword && !form.password) {
        alert(
          "This distributor has no login password saved on the server. Enter a password below and save to enable sign-in."
        );
        return;
      }
    }
    
    if (form.password && form.password.length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }
    
    // Phone number is optional, but if provided, it must be valid
    const phoneCheck = validateLocalPhone(phoneDial, trimmedPhone);
    if (trimmedPhone && !phoneCheck.valid) {
      alert(phoneCheck.message || "Please enter a valid phone number or leave it empty");
      return;
    }

    const storedPhone = trimmedPhone ? formatPhoneForStorage(phoneDial, trimmedPhone) : "";
    
    const payload = {
      name: trimmedName,
      code: trimmedCode,
      region: form.region,
      address: (form.address || "").trim(),
      gstin: (form.gstin || "").trim(),
      tpn: (form.tpn || "").trim(),
      phone: storedPhone,
      credentials: { 
        username: trimmedUsername, 
        passwordHash: hashPasswordForStorage(form.password),
        password: form.password // Store plain password for display
      },
      target: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
      achieved: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
    };
    if (editingCode) {
      const updatePayload = { 
        name: form.name, 
        code: form.code, 
        region: form.region, 
        address: form.address,
        gstin: (form.gstin || "").trim(),
        tpn: (form.tpn || "").trim(),
        phone: storedPhone
      };
      // Only update password if a new one is provided
      if (form.password) {
        updatePayload.credentials = { 
          username: form.username.trim(),
          passwordHash: hashPasswordForStorage(form.password),
          password: form.password // Store plain password for display
        };
      } else {
        // Keep existing username and password, don't change
        updatePayload.credentials = {
          username: form.username.trim()
          // Keep existing password if available
        };
      }
      if (onUpdate) onUpdate(editingCode, updatePayload);
    } else {
      if (onAdd) {
        try {
          onAdd(payload);
        } catch (error) {
          console.error("Error calling onAdd:", error);
          alert("Failed to register distributor: " + (error?.message || error));
          return; // Don't reset form if there's an error
        }
      } else {
        alert("Error: Add function not available");
        return;
      }
    }
    reset();
  };

  const startEdit = (d) => {
    const parsedPhone = parsePhoneFromStorage(d.phone || "");
    setEditingCode(d.code || d.name);
    setForm({
      name: d.name || "",
      code: d.code || "",
      region: d.region || "Southern",
      username: d.credentials?.username || "",
      password: "", // Don't show existing password hash
      address: d.address || "",
      phoneCountry: parsedPhone.dial,
      phone: parsedPhone.local,
      gstin: d.gstin || d.gstinNo || d.gstin_no || "",
      tpn: d.tpn || d.tpnNo || d.tpn_no || "",
    });
  };

  const handleDelete = (d) => {
    if (!d) {
      alert("Error: No distributor information available");
      return;
    }
    setDistributorToDelete(d);
    setDeleteConfirmOpen(true);
  };

  // Toggle selection for bulk delete
  const toggleSelectDistributor = (code) => {
    setSelectedDistributors((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const isAllSelected =
    filteredList.length > 0 &&
    filteredList.every((d) => selectedDistributors.includes(d.code));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedDistributors([]);
    } else {
      setSelectedDistributors(filteredList.map((d) => d.code).filter(Boolean));
    }
  };

  const confirmDelete = () => {
    // Prefer bulk delete if multiple selected
    if (selectedDistributors.length > 0 && onDelete) {
      try {
        selectedDistributors.forEach((code) => {
          if (code) {
            onDelete(code, { suppressNotification: true });
          }
        });
        setSelectedDistributors([]);
        setDeleteConfirmOpen(false);
        setDistributorToDelete(null);
        alert(`Deleted ${selectedDistributors.length} distributor(s) successfully`);
      } catch (error) {
        console.error("Error bulk deleting distributors:", error);
        alert("Failed to delete selected distributors: " + (error?.message || error));
      }
      return;
    }

    // Fallback to single delete
    if (distributorToDelete && onDelete) {
      try {
        const codeOrName = distributorToDelete.code || distributorToDelete.name;
        if (!codeOrName) {
          alert("Error: Cannot delete distributor - missing code or name");
          return;
        }
        onDelete(codeOrName);
        setDeleteConfirmOpen(false);
        setDistributorToDelete(null);
      } catch (error) {
        console.error("Error deleting distributor:", error);
        alert("Failed to delete distributor: " + (error?.message || error));
      }
    } else {
      alert("Error: Cannot delete distributor - missing information");
      setDeleteConfirmOpen(false);
      setDistributorToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setDistributorToDelete(null);
  };

  // Parse Excel file for bulk distributor upload
  const parseDistributorExcel = async (file) => {
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
          
          // Convert to JSON (array of arrays first row is headers)
          const rows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: "",
            raw: false
          });
          
          if (rows.length < 2) {
            reject(new Error("Excel file must contain at least a header row and one data row"));
            return;
          }
          
          // Expected columns: name, code, region, phone, address, username, password
          // First row should be headers (optional, we'll use position if headers don't match)
          const headerRow = rows[0].map(h => (h || "").toString().toLowerCase().trim());
          
          // Find column indices (support both header-based and position-based)
          let nameIdx = headerRow.includes("name") ? headerRow.indexOf("name") : 0;
          let codeIdx = headerRow.includes("code") ? headerRow.indexOf("code") : 1;
          let regionIdx = headerRow.includes("region") ? headerRow.indexOf("region") : 2;
          let phoneIdx = headerRow.includes("phone") || headerRow.includes("phone no") || headerRow.includes("phone no.") 
            ? (headerRow.includes("phone") ? headerRow.indexOf("phone") : 
               headerRow.includes("phone no") ? headerRow.indexOf("phone no") : 
               headerRow.indexOf("phone no.")) 
            : 3;
          let addressIdx = headerRow.includes("address") ? headerRow.indexOf("address") : 4;
          let usernameIdx = headerRow.includes("username") ? headerRow.indexOf("username") : 5;
          let passwordIdx = headerRow.includes("password") ? headerRow.indexOf("password") : 6;
          
          // If first row doesn't look like headers (all empty or all numbers), assume position-based
          const firstRowValues = rows[0].filter(v => v !== "" && v !== null && v !== undefined);
          if (firstRowValues.length === 0 || (firstRowValues.length > 0 && !isNaN(parseFloat(firstRowValues[0])))) {
            // Use position-based (0-based index)
            nameIdx = 0;
            codeIdx = 1;
            regionIdx = 2;
            phoneIdx = 3;
            addressIdx = 4;
            usernameIdx = 5;
            passwordIdx = 6;
            // Start from first row if it doesn't have headers
            var dataStartRow = rows[0].some(v => v !== "" && v !== null && v !== undefined) ? 0 : 1;
          } else {
            // Has headers, start from second row
            dataStartRow = 1;
          }
          
          const distributors = [];
          const errors = [];
          
          for (let i = dataStartRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue; // Skip empty rows
            
            const name = (row[nameIdx] || "").toString().trim();
            // Extract code - try multiple column variations
            let code = "";
            if (codeIdx >= 0 && codeIdx < row.length) {
              code = (row[codeIdx] || "").toString().trim();
            }
            // Also check if code might be in a different column (case-insensitive header search)
            if (!code || code === "") {
              // Try to find code column by checking all headers
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const headerVal = headerRow[colIdx] || "";
                if (headerVal.includes("code") && colIdx < row.length) {
                  code = (row[colIdx] || "").toString().trim();
                  if (code) break;
                }
              }
            }
            code = code.toUpperCase();
            
            const region = (row[regionIdx] || "Southern").toString().trim();
            const phone = (row[phoneIdx] || "").toString().trim();
            const address = (row[addressIdx] || "").toString().trim();
            let username = (row[usernameIdx] || "").toString().trim();
            const password = (row[passwordIdx] || "").toString().trim();
            
            // Debug: Log extracted values
            console.log(`📋 Row ${i + 1} extracted:`, {
              name,
              code,
              username,
              codeIdx,
              rowLength: row.length,
              headerRow
            });
            
            // Validate required fields
            if (!name || name.length < 2) {
              errors.push(`Row ${i + 1}: Name is required and must be at least 2 characters`);
              continue;
            }
            
            // Username and code should be the same - if one is missing, use the other
            if (!code && username) {
              code = username.toUpperCase();
            } else if (!username && code) {
              username = code.toUpperCase();
            } else if (code && username && code.toUpperCase() !== username.toUpperCase()) {
              // If both are provided but different, use code for username (as per user requirement)
              username = code.toUpperCase();
            }
            
            // Validate username/code after syncing
            if (!username || username.length < 2) {
              errors.push(`Row ${i + 1}: Code/Username is required and must be at least 2 characters`);
              continue;
            }
            
            if (!password || password.length < 4) {
              errors.push(`Row ${i + 1}: Password is required and must be at least 4 characters`);
              continue;
            }
            
            // Ensure code and username are uppercase and match
            code = code.toUpperCase();
            username = username.toUpperCase();
            
            // Ensure code is not empty - it's required
            if (!code || code === "") {
              errors.push(`Row ${i + 1}: Code is required. Please ensure the Excel file has a 'code' column with values.`);
              continue;
            }
            
            distributors.push({
              name,
              code: code, // Preserve code from Excel (now synced with username)
              region: region || "Southern",
              phone: normalizeBulkPhone(phone) || "",
              address: address || "",
              username: username, // Username matches code
              password,
              rowNumber: i + 1
            });
            
            // Debug: Log what was added
            console.log(`✅ Added distributor to parse list:`, {
              name,
              code,
              username,
              rowNumber: i + 1
            });
          }
          
          if (distributors.length === 0 && errors.length === 0) {
            reject(new Error("No valid distributor data found in Excel file"));
            return;
          }
          
          resolve({ distributors, errors });
        } catch (error) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  // Download distributor template
  const downloadDistributorTemplate = async () => {
    const [XLSX, { saveAs }] = await Promise.all([
      import("xlsx"),
      import("file-saver"),
    ]);
    // Create template data
    const templateData = [
      ["name", "code", "region", "phone", "address", "username", "password"],
      ["Distributor A", "DIST001", "Southern", "1234567890", "123 Main St", "DIST001", "password123"],
      ["Distributor B", "DIST002", "Western", "0987654321", "456 Oak Ave", "DIST002", "password123"],
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    ws["!cols"] = [
      { wch: 20 }, // name
      { wch: 15 }, // code
      { wch: 15 }, // region
      { wch: 15 }, // phone
      { wch: 30 }, // address
      { wch: 15 }, // username
      { wch: 20 }, // password
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Distributors");

    // Generate Excel file and download
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "distributor_template.xlsx");
  };

  // Handle bulk upload
  const handleBulkUpload = async (file) => {
    if (!file) return;
    
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/excel"
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      alert("Invalid file type. Please upload an Excel file (.xlsx or .xls).");
      return;
    }
    
    setBulkUploadOpen(true);
    setBulkUploadProgress({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
    setBulkUploadResults({ success: [], failed: [], skipped: [] });
    
    try {
      // Parse Excel file
      const { distributors: parsedDistributors, errors: parseErrors } = await parseDistributorExcel(file);
      
      if (parseErrors.length > 0) {
        console.warn("Excel parsing warnings:", parseErrors);
      }
      
      if (parsedDistributors.length === 0) {
        setBulkUploadOpen(false);
        alert("No valid distributors found in Excel file. Please check the format.\n\nExpected columns: name, code, region, phone no., address, username, password");
        return;
      }
      
      setBulkUploadProgress(prev => ({ ...prev, total: parsedDistributors.length }));
      
      const successList = [];
      const failedList = [];
      const skippedList = [];
      
      // Get ALL existing distributors from both localStorage AND Firebase (if available)
      // This ensures we check against the complete database to prevent duplicates
      let existingDistributors = getDistributors(); // From localStorage
      
      // Also fetch from Firebase if available to get the complete list
      if (supabase) {
        try {
          const firebaseDistributors = await getAllDistributors();
          // Merge Firebase distributors with localStorage, avoiding duplicates by code
          const existingCodes = new Set(existingDistributors.map(d => d.code?.toUpperCase()).filter(Boolean));
          firebaseDistributors.forEach(fbDist => {
            if (fbDist.code && !existingCodes.has(fbDist.code.toUpperCase())) {
              existingDistributors.push(fbDist);
              existingCodes.add(fbDist.code.toUpperCase());
            }
          });
          console.log(`Merged distributors: ${existingDistributors.length} total (${firebaseDistributors.length} from Firebase, ${getDistributors().length} from localStorage)`);
        } catch (error) {
          console.warn("Could not fetch from Firebase, using localStorage only:", error);
        }
      }
      
      // Create lookup maps for fast duplicate checking
      const existingCodesMap = new Map();
      const existingNamesMap = new Map();
      const existingUsernamesMap = new Map();
      
      existingDistributors.forEach(d => {
        if (d.code) existingCodesMap.set(d.code.toUpperCase(), d);
        if (d.name) existingNamesMap.set(d.name.trim().toLowerCase(), d);
        if (d.credentials?.username) existingUsernamesMap.set(d.credentials.username.trim().toLowerCase(), d);
      });
      
      
      // Process each distributor
      for (const distData of parsedDistributors) {
        try {
          // Use code from Excel (already synced with username in parseDistributorExcel)
          let finalCode = (distData.code || "").toString().trim().toUpperCase();
          let finalUsername = (distData.username || "").toString().trim().toUpperCase();
          
          // Ensure code and username match (username = code as per user requirement)
          if (!finalCode && finalUsername) {
            finalCode = finalUsername;
          } else if (!finalUsername && finalCode) {
            finalUsername = finalCode;
          } else if (finalCode && finalUsername && finalCode !== finalUsername) {
            // If both provided but different, use code for username
            finalUsername = finalCode;
          }
          
          // Code is required - fail if still missing
          if (!finalCode || finalCode === "") {
            failedList.push({
              name: distData.name,
              code: "N/A",
              error: "Code is required. Please ensure the Excel file has a 'code' column with values."
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
          // Validate code format
          if (!validateCode(finalCode)) {
            failedList.push({
              name: distData.name,
              code: finalCode,
              error: "Code must be 2-20 alphanumeric characters"
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
          // Check for duplicates using lookup maps (faster and more comprehensive)
          // Check by code first (most reliable identifier)
          const duplicateByCode = existingCodesMap.get(finalCode);
          if (duplicateByCode) {
            skippedList.push({
              name: distData.name,
              code: finalCode,
              reason: `Already exists in database (Code: ${finalCode})`
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
            continue;
          }
          
          // Check by name (case-insensitive)
          const nameKey = distData.name.trim().toLowerCase();
          const duplicateByName = existingNamesMap.get(nameKey);
          if (duplicateByName) {
            skippedList.push({
              name: distData.name,
              code: finalCode,
              reason: `Already exists in database (Name: ${distData.name})`
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
            continue;
          }
          
          // Check by username (case-insensitive)
          const usernameKey = distData.username.trim().toLowerCase();
          const duplicateByUsername = existingUsernamesMap.get(usernameKey);
          if (duplicateByUsername) {
            skippedList.push({
              name: distData.name,
              code: finalCode,
              reason: `Already exists in database (Username: ${distData.username})`
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
            continue;
          }
          
          // Also check using isUsernameTaken function (for compatibility)
          if (isUsernameTaken(distData.username)) {
            skippedList.push({
              name: distData.name,
              code: finalCode,
              reason: `Username "${distData.username}" already taken`
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
            continue;
          }
          
          // Validate region
          const validRegions = ["Southern", "Western", "Eastern", "Northern"];
          const region = validRegions.includes(distData.region) ? distData.region : "Southern";
          
          // Create payload - ensure username matches code
          const payload = {
            name: distData.name,
            code: finalCode, // CRITICAL: Code from Excel must be preserved
            region: region,
            address: distData.address || "",
            phone: distData.phone || "",
            credentials: {
              username: finalUsername, // Username = code
              passwordHash: hashPasswordForStorage(distData.password),
              password: distData.password // Store plain password for display (from Excel)
            },
            target: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
            achieved: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
          };
          
          // Debug: Log the payload to verify code is included
          console.log(`📝 Payload created for ${distData.name}:`, {
            name: payload.name,
            code: payload.code,
            username: payload.credentials.username,
            hasCode: !!payload.code,
            codeLength: payload.code?.length
          });
          
          // Final validation: Ensure code is in payload
          if (!payload.code || payload.code === "") {
            console.error(`❌ CRITICAL: Payload missing code for ${distData.name}!`, payload);
            failedList.push({
              name: distData.name,
              code: "N/A",
              error: "Internal error: Code was lost during processing. Please check the Excel file format."
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
          // Call onAdd (this will handle Firebase/localStorage)
          // Pass suppressAlert=true to prevent individual alerts during bulk upload
          if (onAdd) {
            await onAdd(payload, true); // Suppress individual alerts
            successList.push({ name: distData.name, code: finalCode });
            
            // Update lookup maps to prevent duplicates in same batch
            existingCodesMap.set(finalCode, payload);
            existingNamesMap.set(nameKey, payload);
            existingUsernamesMap.set(usernameKey, payload);
            existingDistributors.push(payload);
            
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, success: prev.success + 1 }));
          } else {
            throw new Error("Add function not available");
          }
        } catch (error) {
          console.error(`Error processing distributor ${distData.name}:`, error);
          failedList.push({
            name: distData.name,
            code: distData.code || "N/A",
            error: error.message || "Unknown error"
          });
          setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
        }
      }
      
      setBulkUploadResults({ success: successList, failed: failedList, skipped: skippedList });
      
      // Show completion message
      const totalProcessed = successList.length + skippedList.length + failedList.length;
      if (totalProcessed === parsedDistributors.length) {
        if (successList.length > 0 || skippedList.length > 0) {
          setTimeout(() => {
            if (failedList.length === 0) {
              // Only auto-close if no failures
              // User can manually close to see skipped list
              // setBulkUploadOpen(false);
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error("Error during bulk upload:", error);
      alert(`Failed to process Excel file: ${error.message}`);
      setBulkUploadOpen(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleBulkUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <>
      <AddDistributorDialog
        open={addDistributorDialogOpen}
        onClose={() => setAddDistributorDialogOpen(false)}
        onAdd={onAdd}
        canWrite={canWrite}
      />
      <Dialog fullScreen open={open} onClose={() => { reset(); onClose && onClose(); }} PaperProps={{ sx: { bgcolor: "background.default", color: "text.primary" } }}>
        <AppBar elevation={0} sx={{ position: "relative", bgcolor: "#1565c0" }}>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexGrow: 1, minWidth: 0 }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.common.white, 0.18), width: 40, height: 40 }}>
                <PeopleIcon />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: "white", lineHeight: 1.2 }}>
                  Manage Distributors
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: alpha(theme.palette.common.white, 0.82), display: "block" }}>
                  {editingCode ? `Editing ${form.name || form.code}` : `${list.length} registered · ${filteredList.length} shown`}
                </Typography>
              </Box>
            </Box>
            <Button
              color="inherit"
              startIcon={<AddIcon />}
              onClick={() => setAddDistributorDialogOpen(true)}
              disabled={!canWrite}
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                mr: 0.5,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 600,
                bgcolor: alpha(theme.palette.common.white, 0.14),
                "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.24) },
              }}
              title={!canWrite ? "You don't have permission to add distributors. Only admins can add distributors." : ""}
            >
              Add Distributor
            </Button>
            <Tooltip title="Add distributor">
              <span>
                <IconButton
                  color="inherit"
                  onClick={() => setAddDistributorDialogOpen(true)}
                  disabled={!canWrite}
                  sx={{ display: { xs: "inline-flex", sm: "none" } }}
                >
                  <AddIcon />
                </IconButton>
              </span>
            </Tooltip>
            {editingCode && (
              <Button
                color="inherit"
                onClick={() => { reset(); }}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.common.white, 0.14),
                  "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.24) },
                }}
              >
                Cancel Edit
              </Button>
            )}
            <IconButton edge="end" color="inherit" onClick={() => { reset(); onClose && onClose(); }} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxHeight: "100vh", overflow: "auto", bgcolor: "background.default", color: "text.primary" }}>
          {/* Edit Form Section - Only show when editing */}
          {editingCode && (
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 2,
              borderRadius: 2.5,
              bgcolor: "background.paper",
              borderColor: "divider",
              boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, t.palette.mode === "dark" ? 0.28 : 0.06)}`,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5, pb: 1.5, borderBottom: 2, borderColor: "primary.main" }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", width: 40, height: 40 }}>
                <EditIcon fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Edit Distributor
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Update details and login credentials
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                  Personal Information
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name *"
                  value={form.name} 
                  onChange={handleChange("name")}
                  required
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 2 },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Code *"
                  value={form.code} 
                  onChange={handleChange("code")}
                  required
                  disabled={editingCode ? true : false}
                  error={codeUniqueness.isUnique === false}
                  helperText={
                    editingCode 
                      ? "Code cannot be changed when editing" 
                      : codeUniqueness.message || "Enter a unique distributor code (2-20 alphanumeric characters)"
                  }
                  FormHelperTextProps={{
                    sx: {
                      color: codeUniqueness.isUnique === true ? "success.main" : 
                             codeUniqueness.isUnique === false ? "error.main" : "inherit"
                    }
                  }}
                  sx={{ 
                    bgcolor: "background.paper",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: codeUniqueness.isUnique === true ? "success.main" : 
                                     codeUniqueness.isUnique === false ? "error.main" : undefined,
                        borderWidth: 2
                      }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-region-label">Region</InputLabel>
                  <Select
                    labelId="edit-region-label"
                    label="Region"
                    value={form.region}
                    onChange={handleChange("region")}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="Southern">Southern</MenuItem>
                    <MenuItem value="Western">Western</MenuItem>
                    <MenuItem value="Eastern">Eastern</MenuItem>
                    <MenuItem value="Northern">Northern</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                <DistributorPhoneField
                  countryDial={form.phoneCountry || DEFAULT_PHONE_COUNTRY}
                  localValue={form.phone}
                  onCountryChange={(dial) => setForm((prev) => ({ ...prev, phoneCountry: dial, phone: "" }))}
                  onLocalChange={(local) => setForm((prev) => ({ ...prev, phone: local }))}
                  fieldSx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Address"
                  value={form.address}
                  onChange={handleChange("address")}
                  multiline
                  minRows={2}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="GSTIN No."
                  value={form.gstin}
                  onChange={handleChange("gstin")}
                  placeholder="e.g. 11AAAAA0000A1Z5"
                  helperText="Optional"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="TPN No."
                  value={form.tpn}
                  onChange={handleChange("tpn")}
                  placeholder="Tax payer number"
                  helperText="Optional · used on invoices"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 0.5 }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                  Login Credentials
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Username *"
                  value={form.username}
                  onChange={handleChange("username")}
                  required
                  helperText="Used for distributor login"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label={editingCode ? "New Password (optional)" : "Password *"}
                  value={form.password}
                  onChange={handleChange("password")}
                  required={!editingCode}
                  helperText={editingCode ? "Leave blank to keep current password" : "Minimum 4 characters"}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
              </Grid>

              <Grid size={{ xs: 12 }} sx={{ mt: 1, pt: 2, borderTop: 1, borderColor: "divider" }}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => { handleDelete({ code: editingCode, name: form.name }); reset(); }}
                    disabled={!canDelete}
                    title={!canDelete ? "You don't have permission to delete distributors. Only admins can delete distributors." : ""}
                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={handleAddOrUpdate}
                    disabled={!canWrite}
                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700, minWidth: 120, boxShadow: 2 }}
                    title={!canWrite ? "You don't have permission to edit distributors. Only admins can edit distributors." : ""}
                  >
                    Save Changes
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
          )}

          {/* Search + region filters + bulk tools */}
          <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2.5, overflow: "hidden", bgcolor: "background.paper" }}>
            <Box sx={{ p: { xs: 1.25, sm: 1.5 } }}>
              <Stack
                direction={{ xs: "column", lg: "row" }}
                spacing={1.5}
                alignItems={{ lg: "center" }}
              >
                <TextField
                  placeholder="Search name, code, region, username…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                  sx={{
                    flex: { lg: "0 1 300px" },
                    minWidth: { xs: "100%", lg: 220 },
                    maxWidth: { lg: 340 },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label="Clear search" onClick={() => setSearchTerm("")} edge="end">
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />

                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={tabRegion}
                  onChange={(_, v) => v != null && setTabRegion(v)}
                  sx={{
                    flex: 1,
                    flexWrap: "wrap",
                    "& .MuiToggleButton-root": {
                      textTransform: "none",
                      fontWeight: 700,
                      px: { xs: 1.25, sm: 1.75 },
                      borderRadius: "8px !important",
                      mx: 0.25,
                      my: 0.25,
                    },
                  }}
                >
                  {REGION_TABS.map((t) => (
                    <ToggleButton key={t} value={t}>
                      {t} ({regionTabCount(list, t, searchTerm.trim())})
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {!editingCode && (
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: "wrap" }}>
                    <input
                      accept=".xlsx,.xls"
                      style={{ display: "none" }}
                      id="bulk-upload-input"
                      type="file"
                      onChange={handleFileInputChange}
                    />
                    <label htmlFor="bulk-upload-input">
                      <Button
                        variant="outlined"
                        component="span"
                        size="small"
                        startIcon={<UploadFileIcon />}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                      >
                        Bulk Upload
                      </Button>
                    </label>
                    <Button
                      variant="outlined"
                      color="secondary"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={downloadDistributorTemplate}
                      sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                    >
                      Template
                    </Button>
                  </Stack>
                )}
              </Stack>

              {hasActiveFilters && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, flexWrap: "wrap" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Active filters:
                  </Typography>
                  {tabRegion !== "All" && (
                    <Chip
                      size="small"
                      label={`Region: ${tabRegion}`}
                      onDelete={() => setTabRegion("All")}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {searchTerm.trim() && (
                    <Chip
                      size="small"
                      label={`Search: "${searchTerm.trim()}"`}
                      onDelete={() => setSearchTerm("")}
                      variant="outlined"
                    />
                  )}
                  <Button
                    size="small"
                    onClick={() => { setTabRegion("All"); setSearchTerm(""); }}
                    sx={{ textTransform: "none", fontWeight: 600, minWidth: "auto" }}
                  >
                    Clear all
                  </Button>
                </Stack>
              )}
            </Box>
          </Paper>

          {/* Bulk selection bar */}
          {!editingCode && selectedDistributors.length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                mb: 2,
                p: 1.25,
                borderRadius: 2,
                bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.12 : 0.06),
                borderColor: "error.light",
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {selectedDistributors.length} selected
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => setSelectedDistributors([])} sx={{ textTransform: "none", fontWeight: 600 }}>
                    Clear selection
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                      setDistributorToDelete(null);
                      setDeleteConfirmOpen(true);
                    }}
                    disabled={!canDelete}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                  >
                    Delete selected
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* Distributors List */}
          <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden", bgcolor: "background.paper" }}>
            <Box sx={{
              px: 1.5,
              py: 1.25,
              bgcolor: tableHeaderBg(theme),
              borderBottom: `2px solid ${theme.palette.primary.main}`,
            }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} flexWrap="wrap">
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), width: 32, height: 32 }}>
                    <PeopleIcon sx={{ color: "primary.main", fontSize: 18 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Distributors
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {filteredList.length} of {list.length} shown
                    </Typography>
                  </Box>
                </Stack>
                {selectedDistributors.length > 0 && (
                  <Chip size="small" color="primary" label={`${selectedDistributors.length} selected`} sx={{ fontWeight: 700 }} />
                )}
              </Stack>
            </Box>
            <TableContainer sx={{ maxHeight: { xs: "52vh", sm: "62vh" }, bgcolor: "background.paper" }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={tableHeadRowSx(theme)}>
                    <TableCell padding="checkbox" sx={distributorHeaderCellSx}>
                      <Checkbox
                        sx={{ color: "primary.main", "&.Mui-checked": { color: "primary.main" } }}
                        indeterminate={
                          selectedDistributors.length > 0 &&
                          selectedDistributors.length < filteredList.length
                        }
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        inputProps={{ "aria-label": "select all distributors" }}
                      />
                    </TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Name</TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Code</TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Region</TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Address</TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Username</TableCell>
                    <TableCell sx={distributorHeaderCellSx}>Password</TableCell>
                    <TableCell sx={distributorHeaderCellSx} align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <Stack alignItems="center" spacing={1.5}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.text.secondary, 0.1), width: 56, height: 56 }}>
                            <PersonOffIcon color="action" />
                          </Avatar>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {searchTerm || tabRegion !== "All"
                              ? "No distributors match your filters"
                              : "No distributors yet"}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                            {searchTerm || tabRegion !== "All"
                              ? "Try clearing filters or adjusting your search."
                              : "Add your first distributor or import from Excel."}
                          </Typography>
                          {!searchTerm && tabRegion === "All" && canWrite && (
                            <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={() => setAddDistributorDialogOpen(true)}
                                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                              >
                                Add Distributor
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredList.map((d, i) => {
                      const rowKey = d.code || d.name || i;
                      const password = d.credentials?.password || d.password || "";
                      const showPassword = visiblePasswords[rowKey];
                      return (
                      <TableRow
                        key={rowKey}
                        hover
                        selected={selectedDistributors.includes(d.code)}
                        sx={distributorRowSx(i)}
                      >
                        <TableCell padding="checkbox" sx={{ color: "text.primary" }}>
                          <Checkbox
                            color="primary"
                            checked={selectedDistributors.includes(d.code)}
                            onChange={() => toggleSelectDistributor(d.code)}
                            inputProps={{ "aria-label": `select distributor ${d.code}` }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: "text.primary" }}>{d.name}</TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          <Box sx={{ 
                            display: "inline-block", 
                            px: 1.1, 
                            py: 0.35, 
                            borderRadius: 1.3, 
                            background: (t) =>
                              t.palette.mode === "dark"
                                ? alpha(t.palette.info.main, 0.2)
                                : "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                            color: "info.main",
                            fontWeight: 700,
                            fontSize: "0.74rem",
                            border: "1px solid",
                            borderColor: "info.light",
                            boxShadow: (t) => `0 1px 2px ${alpha(t.palette.info.main, 0.22)}`,
                          }}>
                            {d.code}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          {d.region ? (
                            <Chip
                              size="small"
                              label={d.region}
                              color={REGION_CHIP_COLOR[d.region] || "default"}
                              variant="outlined"
                              sx={{ fontWeight: 700, fontSize: "0.7rem", height: 24 }}
                            />
                          ) : "—"}
                        </TableCell>
                        <TableCell
                          sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "text.primary" }}
                          title={d.address || undefined}
                        >
                          {d.address || "—"}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary", fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {d.credentials?.username || d.username || "—"}
                        </TableCell>
                        <TableCell sx={{ color: "text.primary" }}>
                          <Stack direction="row" alignItems="center" spacing={0.25}>
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ fontFamily: "monospace", minWidth: 56 }}
                            >
                              {password ? (showPassword ? password : "••••••••") : "—"}
                            </Typography>
                            {password ? (
                              <Tooltip title={showPassword ? "Hide password" : "Show password"}>
                                <IconButton size="small" onClick={() => togglePasswordVisible(rowKey)} aria-label="toggle password visibility">
                                  {showPassword ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
                                </IconButton>
                              </Tooltip>
                            ) : null}
                          </Stack>
                        </TableCell>
                        <TableCell align="center" sx={{ color: "text.primary" }}>
                          <Stack direction="row" spacing={0.25} justifyContent="center">
                            <Tooltip title={canWrite ? "Edit distributor" : "No permission to edit"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => startEdit(d)}
                                  disabled={!canWrite}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={canDelete ? "Delete distributor" : "No permission to delete"}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(d)}
                                  disabled={!canDelete}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete distributor "{distributorToDelete?.name}"? 
            This action cannot be undone and will remove all associated data including targets and achievements.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Upload Progress Dialog */}
      <Dialog 
        open={bulkUploadOpen} 
        onClose={() => bulkUploadProgress.processed === bulkUploadProgress.total ? setBulkUploadOpen(false) : null}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Bulk Upload Progress
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Processing distributors...
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

          {bulkUploadProgress.processed === bulkUploadProgress.total && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <Chip 
                  label={`✅ Success: ${bulkUploadResults.success.length}`} 
                  color="success" 
                  size="small"
                />
                <Chip 
                  label={`⏭️ Skipped: ${bulkUploadResults.skipped.length}`} 
                  color="default" 
                  size="small"
                />
                <Chip 
                  label={`❌ Failed: ${bulkUploadResults.failed.length}`} 
                  color="error" 
                  size="small"
                />
              </Box>

              {bulkUploadResults.success.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Successfully Registered ({bulkUploadResults.success.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "#f5f5f5", borderRadius: 1, p: 1 }}>
                    {bulkUploadResults.success.map((item, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5, px: 1 }}>
                        <ListItemText 
                          primary={`${item.name} (${item.code})`}
                          primaryTypographyProps={{ variant: "body2" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {bulkUploadResults.skipped.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "text.secondary" }}>
                    Skipped - Already Exists ({bulkUploadResults.skipped.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "#f5f5f5", borderRadius: 1, p: 1 }}>
                    {bulkUploadResults.skipped.map((item, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5, px: 1 }}>
                        <ListItemText 
                          primary={`${item.name} (${item.code})`}
                          secondary={item.reason}
                          primaryTypographyProps={{ variant: "body2" }}
                          secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {bulkUploadResults.failed.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: "error.main" }}>
                    Failed ({bulkUploadResults.failed.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 200, overflow: "auto", bgcolor: "#ffebee", borderRadius: 1, p: 1 }}>
                    {bulkUploadResults.failed.map((item, idx) => (
                      <ListItem key={idx} sx={{ py: 0.5, px: 1 }}>
                        <ListItemText 
                          primary={`${item.name} (${item.code})`}
                          secondary={item.error}
                          primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: "caption", color: "error.main" }}
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
          {bulkUploadProgress.processed === bulkUploadProgress.total && (
            <Button onClick={() => setBulkUploadOpen(false)} variant="contained" color="primary">
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}