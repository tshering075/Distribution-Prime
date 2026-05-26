import React, { useState, useEffect } from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  Select,
  MenuItem,
  Grid,
  Avatar,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import PeopleIcon from "@mui/icons-material/People";
import LockIcon from "@mui/icons-material/Lock";
import { hashPasswordForStorage, isUsernameTaken, getDistributors } from "../utils/distributorAuth";
import { getAllDistributors, supabase } from "../services/supabaseService";

/**
 * Props:
 * - open, onClose
 * - onAdd(payload) - callback when distributor is added
 * - canWrite - permission check
 */
export default function AddDistributorDialog({ open, onClose, onAdd, canWrite = true }) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    region: "Southern",
    phone: "",
    password: "",
    username: "",
    address: "",
  });
  const [codeUniqueness, setCodeUniqueness] = useState({ isUnique: null, message: "" });
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
  const [bulkUploadResults, setBulkUploadResults] = useState({ success: [], failed: [], skipped: [] });
  const [loadingFile, setLoadingFile] = useState(false);
  const hiddenFileRef = React.useRef(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open]);

  const reset = () => {
    setCodeUniqueness({ isUnique: null, message: "" });
    setForm({ name: "", code: "", region: "Southern", phone: "", password: "", username: "", address: "" });
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

  const validatePhone = (phone) => {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone) && digitsOnly.length >= 10 && digitsOnly.length <= 15;
  };

  const validateCode = (code) => {
    return /^[A-Za-z0-9]{2,20}$/.test(code);
  };

  const validateUsername = (username) => {
    return /^[A-Za-z0-9_]{3,30}$/.test(username);
  };

  const checkCodeUniqueness = async (code) => {
    if (!code || code.trim() === "") {
      setCodeUniqueness({ isUnique: null, message: "" });
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!validateCode(trimmedCode)) {
      setCodeUniqueness({ isUnique: false, message: "Code must be 2-20 alphanumeric characters" });
      return;
    }

    const existingDistributors = getDistributors();
    const isDuplicate = existingDistributors.some(d => d.code && d.code.toUpperCase() === trimmedCode);

    if (supabase) {
      try {
        const firebaseDistributors = await getAllDistributors();
        const firebaseDuplicate = firebaseDistributors.some(d => d.code && d.code.toUpperCase() === trimmedCode);
        if (!isDuplicate && !firebaseDuplicate) {
          setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
        } else {
          setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
        }
      } catch (error) {
        if (!isDuplicate) {
          setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
        } else {
          setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
        }
      }
    } else {
      if (!isDuplicate) {
        setCodeUniqueness({ isUnique: true, message: "✓ Code is unique" });
      } else {
        setCodeUniqueness({ isUnique: false, message: "This code is already taken by another distributor" });
      }
    }
  };

  const handleAdd = () => {
    // Trim all string inputs
    const trimmedName = (form.name || "").trim();
    const trimmedCode = (form.code || "").trim().toUpperCase();
    const trimmedUsername = (form.username || "").trim();
    const trimmedPhone = (form.phone || "").trim();
    
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
    
    // Final uniqueness check
    const existingDistributors = getDistributors();
    const isDuplicate = existingDistributors.some(d => 
      d.code && d.code.toUpperCase() === trimmedCode
    );
    
    if (isDuplicate) {
      alert("This code is already taken by another distributor. Please enter a unique code.");
      return;
    }
    
    if (!validateCode(trimmedCode)) {
      alert("Code must be 2-20 alphanumeric characters");
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
    if (isUsernameTaken(trimmedUsername)) {
      alert("Username is already taken. Please choose another.");
      return;
    }
    
    if (!form.password) {
      alert("Password is required for new distributor");
      return;
    }
    
    if (form.password.length < 4) {
      alert("Password must be at least 4 characters");
      return;
    }

    // Validate phone if provided
    if (trimmedPhone && !validatePhone(trimmedPhone)) {
      alert("Please enter a valid phone number (10-15 digits)");
      return;
    }
    
    // Create payload
    const payload = {
      name: trimmedName,
      code: trimmedCode,
      region: form.region,
      phone: trimmedPhone || "",
      address: form.address || "",
      credentials: {
        username: trimmedUsername,
        passwordHash: hashPasswordForStorage(form.password),
        password: form.password
      },
      target: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
      achieved: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
    };
    
    // Call onAdd callback
    if (onAdd) {
      try {
        onAdd(payload);
        alert("Distributor registered successfully!");
        reset();
        onClose && onClose();
      } catch (error) {
        alert("Failed to register distributor: " + (error?.message || error));
      }
    }
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
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          const rows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: "",
            raw: false
          });
          
          if (rows.length < 2) {
            reject(new Error("Excel file must contain at least a header row and one data row"));
            return;
          }
          
          const headerRow = rows[0].map(h => (h || "").toString().toLowerCase().trim());
          
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
          
          const firstRowValues = rows[0].filter(v => v !== "" && v !== null && v !== undefined);
          if (firstRowValues.length === 0 || (firstRowValues.length > 0 && !isNaN(parseFloat(firstRowValues[0])))) {
            nameIdx = 0;
            codeIdx = 1;
            regionIdx = 2;
            phoneIdx = 3;
            addressIdx = 4;
            usernameIdx = 5;
            passwordIdx = 6;
            var dataStartRow = rows[0].some(v => v !== "" && v !== null && v !== undefined) ? 0 : 1;
          } else {
            dataStartRow = 1;
          }
          
          const distributors = [];
          const errors = [];
          
          for (let i = dataStartRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            
            const name = (row[nameIdx] || "").toString().trim();
            let code = "";
            if (codeIdx >= 0 && codeIdx < row.length) {
              code = (row[codeIdx] || "").toString().trim();
            }
            if (!code || code === "") {
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
            
            if (!name || name.length < 2) {
              errors.push(`Row ${i + 1}: Name is required and must be at least 2 characters`);
              continue;
            }
            
            if (!code && username) {
              code = username.toUpperCase();
            } else if (!username && code) {
              username = code.toUpperCase();
            } else if (code && username && code.toUpperCase() !== username.toUpperCase()) {
              username = code.toUpperCase();
            }
            
            if (!username || username.length < 2) {
              errors.push(`Row ${i + 1}: Code/Username is required and must be at least 2 characters`);
              continue;
            }
            
            if (!password || password.length < 4) {
              errors.push(`Row ${i + 1}: Password is required and must be at least 4 characters`);
              continue;
            }
            
            code = code.toUpperCase();
            username = username.toUpperCase();
            
            if (!code || code === "") {
              errors.push(`Row ${i + 1}: Code is required. Please ensure the Excel file has a 'code' column with values.`);
              continue;
            }
            
            distributors.push({
              name,
              code: code,
              region: region || "Southern",
              phone: phone || "",
              address: address || "",
              username: username,
              password,
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
    const templateData = [
      ["name", "code", "region", "phone", "address", "username", "password"],
      ["Distributor A", "DIST001", "Southern", "1234567890", "123 Main St", "DIST001", "password123"],
      ["Distributor B", "DIST002", "Western", "0987654321", "456 Oak Ave", "DIST002", "password123"],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    ws["!cols"] = [
      { wch: 20 }, // name
      { wch: 15 }, // code
      { wch: 15 }, // region
      { wch: 15 }, // phone
      { wch: 30 }, // address
      { wch: 15 }, // username
      { wch: 20 }, // password
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Distributors");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "distributor_template.xlsx");
  };

  // Handle bulk upload
  const handleBulkUpload = async (file) => {
    if (!file) return;
    
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/excel"
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
      alert("Invalid file type. Please upload an Excel file (.xlsx or .xls).");
      return;
    }
    
    setLoadingFile(true);
    setBulkUploadOpen(true);
    setBulkUploadProgress({ total: 0, processed: 0, success: 0, failed: 0, skipped: 0 });
    setBulkUploadResults({ success: [], failed: [], skipped: [] });
    
    try {
      const { distributors: parsedDistributors, errors: parseErrors } = await parseDistributorExcel(file);
      
      if (parseErrors.length > 0) {
        console.warn("Excel parsing warnings:", parseErrors);
      }
      
      if (parsedDistributors.length === 0) {
        setBulkUploadOpen(false);
        setLoadingFile(false);
        alert("No valid distributors found in Excel file. Please check the format.\n\nExpected columns: name, code, region, phone no., address, username, password");
        return;
      }
      
      setBulkUploadProgress(prev => ({ ...prev, total: parsedDistributors.length }));
      
      const successList = [];
      const failedList = [];
      const skippedList = [];
      
      let existingDistributors = getDistributors();
      
      if (supabase) {
        try {
          const firebaseDistributors = await getAllDistributors();
          const existingCodes = new Set(existingDistributors.map(d => d.code?.toUpperCase()).filter(Boolean));
          firebaseDistributors.forEach(fbDist => {
            if (fbDist.code && !existingCodes.has(fbDist.code.toUpperCase())) {
              existingDistributors.push(fbDist);
              existingCodes.add(fbDist.code.toUpperCase());
            }
          });
        } catch (error) {
          console.warn("Could not fetch from Firebase, using localStorage only:", error);
        }
      }
      
      const existingCodesMap = new Map();
      const existingNamesMap = new Map();
      const existingUsernamesMap = new Map();
      
      existingDistributors.forEach(d => {
        if (d.code) existingCodesMap.set(d.code.toUpperCase(), d);
        if (d.name) existingNamesMap.set(d.name.trim().toLowerCase(), d);
        if (d.credentials?.username) existingUsernamesMap.set(d.credentials.username.trim().toLowerCase(), d);
      });
      
      const validateCode = (code) => {
        return /^[A-Za-z0-9]{2,20}$/.test(code);
      };
      
      // Process each distributor
      for (const distData of parsedDistributors) {
        try {
          let finalCode = (distData.code || "").toString().trim().toUpperCase();
          let finalUsername = (distData.username || "").toString().trim().toUpperCase();
          
          if (!finalCode && finalUsername) {
            finalCode = finalUsername;
          } else if (!finalUsername && finalCode) {
            finalUsername = finalCode;
          } else if (finalCode && finalUsername && finalCode !== finalUsername) {
            finalUsername = finalCode;
          }
          
          if (!finalCode || finalCode === "") {
            failedList.push({
              name: distData.name,
              code: "N/A",
              error: "Code is required. Please ensure the Excel file has a 'code' column with values."
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
          if (!validateCode(finalCode)) {
            failedList.push({
              name: distData.name,
              code: finalCode,
              error: "Code must be 2-20 alphanumeric characters"
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
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
          
          if (isUsernameTaken(distData.username)) {
            skippedList.push({
              name: distData.name,
              code: finalCode,
              reason: `Username "${distData.username}" already taken`
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
            continue;
          }
          
          const validRegions = ["Southern", "Western", "Eastern", "PLING", "THIM"];
          const region = validRegions.includes(distData.region) ? distData.region : "Southern";
          
          const payload = {
            name: distData.name,
            code: finalCode,
            region: region,
            address: distData.address || "",
            phone: distData.phone || "",
            credentials: {
              username: finalUsername,
              passwordHash: hashPasswordForStorage(distData.password),
              password: distData.password
            },
            target: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
            achieved: { CSD_PC: 0, CSD_UC: 0, Water_PC: 0, Water_UC: 0 },
          };
          
          if (!payload.code || payload.code === "") {
            failedList.push({
              name: distData.name,
              code: "N/A",
              error: "Internal error: Code was lost during processing. Please check the Excel file format."
            });
            setBulkUploadProgress(prev => ({ ...prev, processed: prev.processed + 1, failed: prev.failed + 1 }));
            continue;
          }
          
          if (onAdd) {
            await onAdd(payload, true);
            successList.push({ name: distData.name, code: finalCode });
            
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
      
      const totalProcessed = successList.length + skippedList.length + failedList.length;
      if (totalProcessed === parsedDistributors.length) {
      }
    } catch (error) {
      console.error("Error during bulk upload:", error);
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
      handleBulkUpload(file);
    }
    e.target.value = null;
  };

  return (
    <>
      <Dialog 
        fullScreen 
        open={open} 
        onClose={() => { reset(); onClose && onClose(); }}
        disableEnforceFocus={false}
        disableAutoFocus={false}
      >
        <AppBar sx={{ position: "relative", bgcolor: "#d61916" }}>
          <Toolbar>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1 }}>
              <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 40, height: 40 }}>
                <AddIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: "white" }}>
                  Add New Distributor
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                  Register a new distributor to the system
                </Typography>
              </Box>
            </Box>
            <Button
              color="inherit"
              onClick={() => { reset(); }}
              sx={{ mr: 1, bgcolor: "rgba(255,255,255,0.2)", "&:hover": { bgcolor: "rgba(255,255,255,0.3)" } }}
            >
              Clear Form
            </Button>
            <IconButton edge="end" color="inherit" onClick={() => { reset(); onClose && onClose(); }} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: { xs: 2, sm: 3 }, maxHeight: "100vh", overflow: "auto" }}>
          {/* Form Section */}
          <Paper 
            elevation={4} 
            sx={{ 
              p: { xs: 2.5, sm: 3.5 }, 
              mb: 3, 
              borderRadius: 4,
              background: "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
              border: "1px solid #e0e0e0"
            }}
          >
            <Box sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 2, 
              mb: 3,
              pb: 2,
              borderBottom: "3px solid #d61916"
            }}>
              <Avatar sx={{ bgcolor: "#d61916", width: 48, height: 48 }}>
                <AddIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#333", mb: 0.5 }}>
                  Add New Distributor
                </Typography>
                <Typography variant="body2" sx={{ color: "#666" }}>
                  Register a new distributor to the system
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={3}>
              {/* Personal Information Section */}
              <Grid size={{ xs: 12 }}>
                <Box sx={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 1.5, 
                  mb: 2,
                  pb: 1.5,
                  borderBottom: "2px solid #e0e0e0"
                }}>
                  <PeopleIcon sx={{ color: "#d61916", fontSize: 24 }} />
                  <Typography variant="h6" sx={{ color: "#333", fontWeight: 700, fontSize: "1.1rem" }}>
                    Personal Information
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <TextField 
                  fullWidth 
                  label="Name *" 
                  value={form.name} 
                  onChange={handleChange("name")}
                  required
                  sx={{ 
                    bgcolor: "#fff",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                <TextField 
                  fullWidth 
                  label="Code *" 
                  value={form.code} 
                  onChange={handleChange("code")}
                  required
                  error={codeUniqueness.isUnique === false}
                  helperText={
                    codeUniqueness.message || "Enter a unique distributor code (2-20 alphanumeric characters)"
                  }
                  FormHelperTextProps={{
                    sx: {
                      color: codeUniqueness.isUnique === true ? "success.main" : 
                             codeUniqueness.isUnique === false ? "error.main" : "inherit"
                    }
                  }}
                  sx={{ 
                    bgcolor: "#fff",
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
                <Select 
                  fullWidth 
                  value={form.region} 
                  onChange={handleChange("region")}
                  sx={{ 
                    bgcolor: "#fff",
                    borderRadius: 2,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderRadius: 2
                    },
                    "&:hover": {
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#d61916"
                      }
                    }
                  }}
                >
                  <MenuItem value="Southern">Southern</MenuItem>
                  <MenuItem value="Western">Western</MenuItem>
                  <MenuItem value="Eastern">Eastern</MenuItem>
                  <MenuItem value="PLING">PLING</MenuItem>
                  <MenuItem value="THIM">THIM</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={form.phone}
                  onChange={handleChange("phone")}
                  type="tel"
                  placeholder="+1234567890"
                  helperText="Optional: Enter phone number (10-15 digits)"
                  sx={{ 
                    bgcolor: "#fff",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Address"
                  value={form.address}
                  onChange={handleChange("address")}
                  multiline
                  minRows={2}
                  sx={{ 
                    bgcolor: "#fff",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      }
                    }
                  }}
                />
              </Grid>

              {/* Credentials Section */}
              <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
                <Box sx={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 1.5, 
                  mb: 2,
                  pb: 1.5,
                  borderBottom: "2px solid #e0e0e0"
                }}>
                  <LockIcon sx={{ color: "#d61916", fontSize: 24 }} />
                  <Typography variant="h6" sx={{ color: "#333", fontWeight: 700, fontSize: "1.1rem" }}>
                    Login Credentials
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth 
                  label="Username *" 
                  value={form.username} 
                  onChange={handleChange("username")}
                  required
                  helperText="Used for distributor login"
                  sx={{ 
                    bgcolor: "#fff",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      }
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  fullWidth 
                  type="password" 
                  label="Password *" 
                  value={form.password} 
                  onChange={handleChange("password")}
                  required
                  helperText="Minimum 4 characters"
                  sx={{ 
                    bgcolor: "#fff",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      transition: "all 0.2s",
                      "&:hover": {
                        transform: "translateY(-2px)",
                        boxShadow: 2
                      }
                    }
                  }}
                />
              </Grid>

              {/* Action Buttons */}
              <Grid size={{ xs: 12 }} sx={{ mt: 3, pt: 3, borderTop: "2px solid #e0e0e0" }}>
                <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={loadingFile ? <CircularProgress size={18} /> : <UploadFileIcon />}
                      onClick={triggerBulkUpload}
                      disabled={loadingFile}
                      sx={{
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                        fontWeight: 600,
                        textTransform: "none",
                        borderWidth: 2,
                        transition: "all 0.2s",
                        "&:hover": {
                          borderWidth: 2,
                          transform: "translateY(-2px)",
                          boxShadow: 3
                        }
                      }}
                    >
                      {loadingFile ? "Uploading..." : "Bulk Upload"}
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<DownloadIcon />}
                      onClick={downloadDistributorTemplate}
                      disabled={loadingFile}
                      sx={{
                        borderRadius: 2,
                        px: 3,
                        py: 1,
                        fontWeight: 600,
                        textTransform: "none",
                        borderWidth: 2,
                        transition: "all 0.2s",
                        "&:hover": {
                          borderWidth: 2,
                          transform: "translateY(-2px)",
                          boxShadow: 3
                        }
                      }}
                    >
                      Download Template
                    </Button>
                    <input
                      ref={hiddenFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={onBulkUploadFileChange}
                      style={{ display: "none" }}
                    />
                    <Typography variant="caption" sx={{ color: "#666", fontStyle: "italic", ml: 1 }}>
                      Excel columns: name, code, region, phone, address, username, password
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Button 
                      variant="contained" 
                      startIcon={<AddIcon />}
                      onClick={handleAdd}
                      disabled={!canWrite}
                      sx={{ 
                        minWidth: 140,
                        borderRadius: 2,
                        px: 4,
                        py: 1,
                        fontWeight: 700,
                        textTransform: "none",
                        background: "linear-gradient(135deg, #d61916 0%, #b71c1c 100%)",
                        boxShadow: 3,
                        transition: "all 0.2s",
                        "&:hover": {
                          background: "linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)",
                          transform: "translateY(-2px)",
                          boxShadow: 5
                        }
                      }}
                      title={!canWrite ? "You don't have permission to add distributors. Only admins can add distributors." : ""}
                    >
                      Register
                    </Button>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Box>
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

          {bulkUploadProgress.processed === bulkUploadProgress.total && bulkUploadProgress.total > 0 && (
            <Box>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
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

              {bulkUploadResults.success.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "#2e7d32" }}>
                    Successfully Registered ({bulkUploadResults.success.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "#f5f5f5", borderRadius: 1 }}>
                    {bulkUploadResults.success.slice(0, 10).map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.name}
                          secondary={`Code: ${item.code}`}
                        />
                      </ListItem>
                    ))}
                    {bulkUploadResults.success.length > 10 && (
                      <ListItem>
                        <ListItemText 
                          primary={`... and ${bulkUploadResults.success.length - 10} more`}
                          sx={{ fontStyle: "italic", color: "#666" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {bulkUploadResults.skipped.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "#f57c00" }}>
                    Skipped ({bulkUploadResults.skipped.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "#fff3e0", borderRadius: 1 }}>
                    {bulkUploadResults.skipped.slice(0, 10).map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.name}
                          secondary={`${item.reason} (Code: ${item.code})`}
                        />
                      </ListItem>
                    ))}
                    {bulkUploadResults.skipped.length > 10 && (
                      <ListItem>
                        <ListItemText 
                          primary={`... and ${bulkUploadResults.skipped.length - 10} more`}
                          sx={{ fontStyle: "italic", color: "#666" }}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              )}

              {bulkUploadResults.failed.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: "#d32f2f" }}>
                    Failed ({bulkUploadResults.failed.length}):
                  </Typography>
                  <List dense sx={{ maxHeight: 150, overflow: "auto", bgcolor: "#ffebee", borderRadius: 1 }}>
                    {bulkUploadResults.failed.map((item, idx) => (
                      <ListItem key={idx}>
                        <ListItemText 
                          primary={item.name}
                          secondary={item.error}
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
            onClick={() => {
              setBulkUploadOpen(false);
              if (bulkUploadProgress.success > 0) {
                reset();
                onClose && onClose();
              }
            }}
            variant="contained"
            disabled={bulkUploadProgress.processed < bulkUploadProgress.total}
          >
            {bulkUploadProgress.processed === bulkUploadProgress.total ? "Close" : "Cancel"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
