import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tab,
  Tabs,
  Paper,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import { createAdminAccount, getAllAdmins, deleteUserDocument } from "../services/supabaseService";
import { supabase } from "../supabase";

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function AdminManagementDialog({ open, onClose }) {
  const [tabValue, setTabValue] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [deletingAdmin, setDeletingAdmin] = useState(null);

  // Load admins when dialog opens
  useEffect(() => {
    if (open) {
      loadAdmins();
    } else {
      // Reset form when closing
      setEmail("");
      setPassword("");
      setName("");
      setError("");
      setSuccess(false);
      setTabValue(0);
    }
  }, [open]);

  const loadAdmins = async () => {
    if (!supabase) {
      console.warn("Supabase not initialized");
      setError("Supabase not initialized");
      return;
    }

    setLoadingAdmins(true);
    setError("");
    try {
      // Use getAllAdmins if available, otherwise query directly
      const adminsList = await getAllAdmins();
      
      setAdmins(adminsList);
    } catch (error) {
      console.error("Error loading admins:", error);
      setError("Failed to load admins: " + error.message);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleCreateAdmin = async () => {
    setError("");
    setSuccess(false);
    
    // Validation
    if (!email || !password || !name) {
      setError("All fields are required");
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      const admin = await createAdminAccount({
        email: email.trim(),
        password: password,
        name: name.trim()
      });
      
      setSuccess(true);
      setEmail("");
      setPassword("");
      setName("");
      
      // Reload admins list
      await loadAdmins();
      
      // Switch to list tab to show new admin
      setTimeout(() => {
        setTabValue(1);
        setSuccess(false);
      }, 2000);
    } catch (error) {
      setError(error.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId, adminEmail) => {
    if (!window.confirm(`Are you sure you want to delete admin "${adminEmail}"?\n\nThis will delete their account from the app and Supabase database.`)) {
      return;
    }

    if (!supabase) {
      setError("Supabase not initialized");
      return;
    }

    setDeletingAdmin(adminId);
    setError("");
    try {
      // Delete from database (admins table)
      const deleteResult = await deleteUserDocument(adminId);
      console.log('Delete result:', deleteResult);
      
      if (!deleteResult.success) {
        const errorMsg = deleteResult.error || 'Failed to delete admin from database';
        throw new Error(errorMsg);
      }
      
      // Immediately remove from UI state (optimistic update)
      setAdmins(prevAdmins => prevAdmins.filter(admin => (admin.id || admin.uid) !== adminId));
      
      // Reload admins list from database to ensure sync
      await loadAdmins();
      
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError("Failed to delete admin: " + error.message);
    } finally {
      setDeletingAdmin(null);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError("");
    setSuccess(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      disableEnforceFocus={false}
      disableAutoFocus={false}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">Admin Management</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            {tabValue === 0 ? "Admin created successfully! They can now login." : "Admin deleted successfully!"}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: { xs: 40, sm: 48 },
              "& .MuiTab-root": {
                minHeight: { xs: 40, sm: 48 },
                textTransform: "none",
                fontSize: { xs: "0.7rem", sm: "0.875rem" },
                fontWeight: 500,
                px: { xs: 1.5, sm: 3 },
                py: { xs: 0.5, sm: 1 },
                "& .MuiTab-icon": {
                  fontSize: { xs: 16, sm: 20 },
                  marginRight: { xs: 0.5, sm: 1 }
                }
              },
              "& .MuiTabs-scrollButtons": {
                width: { xs: 32, sm: 40 }
              }
            }}
          >
            <Tab label="Create Admin" icon={<AddIcon />} iconPosition="start" />
            <Tab label="View Admins" icon={<PersonIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Create Admin Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Create a new admin account. The admin will be able to login with the email and password you provide.
            </Alert>
            
            <TextField
              fullWidth
              label="Admin Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              InputProps={{
                startAdornment: <PersonIcon sx={{ mr: 1, color: "#666" }} />,
              }}
            />
            
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              InputProps={{
                startAdornment: <EmailIcon sx={{ mr: 1, color: "#666" }} />,
              }}
              helperText="This will be used for login"
            />
            
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helperText="Minimum 6 characters. Admin should change this after first login."
            />
          </Box>
        </TabPanel>

        {/* View Admins Tab */}
        <TabPanel value={tabValue} index={1}>
          {loadingAdmins ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Loading admins...</Typography>
            </Box>
          ) : admins.length === 0 ? (
            <Alert severity="info">
              No admins found. Create your first admin using the "Create Admin" tab.
            </Alert>
          ) : (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 2, color: "#666" }}>
                Total Admins: {admins.length}
              </Typography>
              <Paper variant="outlined">
                <List>
                  {admins.map((admin, index) => (
                    <React.Fragment key={admin.id || admin.uid}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <PersonIcon fontSize="small" color="primary" />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {admin.name || "Unnamed Admin"}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="body2" color="text.secondary">
                                <EmailIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
                                {admin.email}
                              </Typography>
                              {admin.createdAt && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                  Created: {admin.createdAt.toDate ? 
                                    new Date(admin.createdAt.toDate()).toLocaleDateString() : 
                                    "Unknown"}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Delete Admin (removes admin access)">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleDeleteAdmin(admin.id || admin.uid, admin.email)}
                              disabled={deletingAdmin === (admin.id || admin.uid)}
                              color="error"
                            >
                              {deletingAdmin === (admin.id || admin.uid) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <DeleteIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < admins.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> Deleting an admin removes their admin access but does NOT delete their Firebase Authentication account. 
                  To fully remove a user, delete them from Firebase Console → Authentication → Users.
                </Typography>
              </Alert>
            </Box>
          )}
        </TabPanel>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {tabValue === 0 && (
          <Button
            onClick={handleCreateAdmin}
            variant="contained"
            disabled={loading || !email || !password || !name}
            startIcon={loading ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {loading ? "Creating..." : "Create Admin"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AdminManagementDialog;
