import React, { useState, useEffect, useRef } from "react";
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
  Tab,
  Tabs,
  Paper,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Card,
  CardContent,
  Grid,
  Fade,
  InputAdornment,
  Stack,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import SecurityIcon from "@mui/icons-material/Security";
import SearchIcon from "@mui/icons-material/Search";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import RemoveRedEyeOutlinedIcon from "@mui/icons-material/RemoveRedEyeOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ClearIcon from "@mui/icons-material/Clear";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { createAdminAccount, deleteUserDocument, getCurrentUser, getAdminByUid } from "../services/supabaseService";
import { supabase } from "../supabase";
import { logActivity, ACTIVITY_TYPES } from "../services/activityService";
import { ROLES } from "../utils/permissions";
import StatCard from "./StatCard";

const ROLE_ICONS = {
  admin: AdminPanelSettingsIcon,
  viewer: RemoveRedEyeOutlinedIcon,
  shipping: LocalShippingIcon,
};

function formatUserDate(raw) {
  if (!raw) return null;
  const d = raw?.toDate ? raw.toDate() : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PermissionPreview({ roleKey }) {
  const p = ROLES[roleKey]?.permissions || ROLES.viewer.permissions;
  const items = [
    { label: "View", key: "read" },
    { label: "Edit", key: "write" },
    { label: "Delete", key: "delete" },
    { label: "Manage users", key: "manageUsers" },
  ];
  return (
    <Grid container spacing={1}>
      {items.map((item) => (
        <Grid size={{ xs: 6 }} key={item.key}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.25,
              borderRadius: 2,
              textAlign: "center",
              bgcolor: p[item.key] ? "action.selected" : "action.hover",
              borderColor: p[item.key] ? "success.main" : "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block" }}>
              {item.label}
            </Typography>
            <Chip
              size="small"
              label={p[item.key] ? "Yes" : "No"}
              color={p[item.key] ? "success" : "default"}
              variant={p[item.key] ? "filled" : "outlined"}
              sx={{ mt: 0.5, fontWeight: 700, height: 22 }}
            />
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function RolePickerCards({ role, onRoleChange }) {
  const theme = useTheme();
  return (
    <Grid container spacing={1.5}>
      {Object.entries(ROLES).map(([key, info]) => {
        const Icon = ROLE_ICONS[key] || PersonIcon;
        const selected = role === key;
        return (
          <Grid size={{ xs: 12, sm: 4 }} key={key}>
            <Card
              variant="outlined"
              onClick={() => onRoleChange(key)}
              sx={{
                cursor: "pointer",
                borderWidth: 2,
                borderColor: selected ? `${info.color}.main` : "divider",
                bgcolor: selected ? alpha(theme.palette[info.color].main, 0.1) : "background.paper",
                transition: "border-color 0.15s, box-shadow 0.15s",
                "&:hover": {
                  borderColor: `${info.color}.light`,
                  boxShadow: 2,
                },
              }}
            >
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: alpha(theme.palette[info.color].main, 0.14),
                      color: `${info.color}.main`,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {info.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3, display: "block" }}>
                      {info.description}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

function UserPermissionManagementDialog({ open, onClose }) {
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser?.id) {
          setError("Access Denied: No active user session found.");
          setTimeout(() => {
            onClose();
            setError("");
          }, 3000);
          return;
        }

        // Prefer fresh role/permissions from Supabase to avoid stale localStorage denial.
        let adminDoc = await getAdminByUid(currentUser.id);

        // Fallback: some environments may store admin rows keyed by email only.
        if (!adminDoc && currentUser.email) {
          const { data: emailMatch, error: emailLookupError } = await supabase
            .from("admins")
            .select("*")
            .eq("email", currentUser.email)
            .limit(1);

          if (emailLookupError) {
            console.warn("Admin email fallback lookup failed:", emailLookupError);
          } else if (emailMatch && emailMatch.length > 0) {
            adminDoc = emailMatch[0];
          }
        }

        const dbRole = adminDoc?.role || null;
        const dbPermissions = adminDoc?.permissions || null;

        // Fall back to localStorage only if DB values are unavailable.
        const storedRole = localStorage.getItem('userRole') || localStorage.getItem('role');
        const storedPermissions = localStorage.getItem('userPermissions');
        let parsedStoredPermissions = null;
        if (storedPermissions) {
          try {
            parsedStoredPermissions = JSON.parse(storedPermissions);
          } catch (e) {
            console.warn('Error parsing permissions:', e);
          }
        }

        const effectiveRole = dbRole || storedRole;
        const effectivePermissions = dbPermissions || parsedStoredPermissions;
        const roleLower = (effectiveRole || "").toString().trim().toLowerCase();
        const isAdmin = roleLower === "admin" || roleLower === "administrator";
        const canManage = isAdmin || effectivePermissions?.manageUsers === true;

        // Keep cache aligned with authoritative DB values.
        if (dbRole) {
          localStorage.setItem("userRole", dbRole);
          localStorage.setItem("role", dbRole);
        }
        if (dbPermissions) {
          localStorage.setItem("userPermissions", JSON.stringify(dbPermissions));
        }
        
        console.log('Permission check:', {
          userId: currentUser.id,
          role: effectiveRole,
          isAdmin,
          permissions: effectivePermissions,
          canManage
        });
        
        // If no permission and not admin, close dialog and show error
        if (!canManage) {
          console.warn('Access denied: User does not have manageUsers permission and is not an admin');
          setError("Access Denied: You need 'Manage Users' permission or Admin role to access User & Permissions.");
          setTimeout(() => {
            onClose();
            setError("");
          }, 3000);
        } else {
          console.log('✅ User has access to User & Permissions');
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        // Don't close immediately on error - might be a temporary issue
        // Only close if it's a clear permission denial
        if (error.message?.includes('permission') || error.message?.includes('denied')) {
          setError("Error checking permissions. Please try again.");
          setTimeout(() => {
            onClose();
            setError("");
          }, 3000);
        } else {
          // For other errors, just log but don't close
          console.error('Non-permission error, keeping dialog open:', error);
        }
      }
    };
    if (open) {
      loadUser();
    }
  }, [open, onClose]);
  
  const [tabValue, setTabValue] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("viewer");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const loadingUsersRef = useRef(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const deletedUserIdsRef = useRef(new Set()); // Track deleted user IDs to prevent re-adding
  const [, setEditingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Load users when dialog opens
  useEffect(() => {
    let isMounted = true;

    if (open) {
      loadUsers(isMounted).catch(error => {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Error loading users:', error);
        }
      });
    } else {
      // Reset form when closing
      setEmail("");
      setPassword("");
      setName("");
      setRole("viewer");
      setShowPassword(false);
      setError("");
      setSuccess(false);
      setTabValue(0);
      setEditingUser(null);
      setSearchQuery("");
      setRoleFilter("all");
    }

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Filter users
  useEffect(() => {
    let filtered = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [searchQuery, roleFilter, users]);

  const loadUsers = async (isMounted = true) => {
    if (!supabase) {
      console.warn("⚠️ Supabase not initialized - User & Permissions requires Supabase to be configured");
      if (isMounted) {
        setError("Supabase database not initialized. Please configure Supabase in your environment variables (REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY) to use User & Permissions management.");
        setLoadingUsers(false);
        loadingUsersRef.current = false;
        // Don't return early - show empty state instead
        setUsers([]);
      }
      return;
    }

    if (!isMounted) {
      return;
    }

    // Prevent multiple simultaneous loads
    if (loadingUsersRef.current) {
      console.log('⚠️ Load users already in progress, skipping...');
      return;
    }

    loadingUsersRef.current = true;
    setLoadingUsers(true);
    setError("");
    try {
      console.log("🔄 Loading users from Supabase database...");
      
      // Load users from Supabase (admins table)
      const { data: adminsData, error: adminsError } = await supabase
        .from("admins")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Check if component unmounted during async operation
      if (!isMounted) {
        return;
      }
      
      if (adminsError) {
        throw adminsError;
      }
      
      console.log("✅ Loaded users from Supabase");
      
      const users = [];
      const userUids = new Set();
      const userEmails = new Set(); // Track emails to prevent duplicates
      
      // Process all records from Supabase and deduplicate
      (adminsData || []).forEach((data) => {
        const userId = data.id || data.uid;
        const userEmail = (data.email || "").toLowerCase().trim();
        
        // Skip if we've already seen this user (by uid or email)
        if (userUids.has(userId) || (userEmail && userEmails.has(userEmail))) {
          console.warn(`⚠️ Skipping duplicate user: ${data.email || userId}`);
          return; // Skip duplicate
        }
        
        userUids.add(userId);
        if (userEmail) {
          userEmails.add(userEmail);
        }
        
        // Check if user is active (lastActive within last 5 minutes)
        const lastActive = data.last_active || data.lastActive;
        let isActive = false;
        if (lastActive) {
          const lastActiveDate = lastActive instanceof Date ? lastActive : new Date(lastActive);
          if (lastActiveDate && !isNaN(lastActiveDate.getTime())) {
            const minutesSinceActive = (new Date() - lastActiveDate) / (1000 * 60);
            isActive = minutesSinceActive <= 5; // Active if last active within 5 minutes
          }
        }
        
        users.push({
          id: userId,
          uid: userId,
          email: data.email || "No email",
          name: data.name || "Unnamed User",
          role: data.role || "admin",
          createdAt: data.created_at || data.createdAt,
          permissions: data.permissions,
          lastActive: lastActive,
          isActive: isActive,
          collection: "admins"
        });
      });
      
      console.log(`📋 Found ${users.length} unique users in Supabase (${(adminsData || []).length} total records)`);
      
      // Check if component unmounted
      if (!isMounted) {
        return;
      }

      // Get currently logged-in user and add if not already in list
      const currentUser = await getCurrentUser();
      
      // Check if component unmounted after async operation
      if (!isMounted) {
        return;
      }
      
      if (currentUser && currentUser.id) {
        console.log("👤 Current logged-in user:", currentUser.id, currentUser.email);
        
        // Don't re-add current user if they were just deleted
        if (deletedUserIdsRef.current.has(currentUser.id)) {
          console.log("⚠️ Skipping current user - they were just deleted");
        } else if (!userUids.has(currentUser.id)) {
          // Current user is not in Supabase, add them to the list
          console.log("➕ Adding current user to list (not found in Supabase)");
          
          // Try to get their admin data from Supabase
          let currentUserData = null;
          try {
            currentUserData = await getAdminByUid(currentUser.id);
          } catch (e) {
            console.warn("Could not fetch current user data from Supabase:", e);
          }
          
          users.push({
            id: currentUser.id,
            uid: currentUser.id,
            email: currentUser.email || currentUserData?.email || "No email",
            name: currentUserData?.name || currentUser.email?.split('@')[0] || "Current User",
            role: currentUserData?.role || localStorage.getItem('userRole') || "admin",
            createdAt: currentUserData?.createdAt || null,
            permissions: currentUserData?.permissions || null,
            collection: "admins",
            isCurrentUser: true
          });
        } else {
          // Mark current user in the list
          const currentUserIndex = users.findIndex(u => u.uid === currentUser.id);
          if (currentUserIndex !== -1) {
            users[currentUserIndex].isCurrentUser = true;
          }
        }
      }
      
        // Sort by creation date (newest first), or by email if no date
        users.sort((a, b) => {
          // Current user always appears first
          if (a.isCurrentUser && !b.isCurrentUser) return -1;
          if (!a.isCurrentUser && b.isCurrentUser) return 1;
          
          const dateA = a.createdAt instanceof Date ? a.createdAt : 
                       (a.createdAt ? new Date(a.createdAt) : null);
        const dateB = b.createdAt instanceof Date ? b.createdAt : 
                     (b.createdAt ? new Date(b.createdAt) : null);
        
        if (dateA && dateB) {
          return dateB - dateA; // Newest first
        } else if (dateA) {
          return -1; // A has date, B doesn't - A comes first
        } else if (dateB) {
          return 1; // B has date, A doesn't - B comes first
        } else {
          // Neither has date, sort by email
          return (a.email || "").localeCompare(b.email || "");
        }
      });
      
      console.log(`✅ Loaded ${users.length} total users from Supabase database`);
      console.log("📊 Users breakdown:", {
        fromSupabase: (adminsData || []).length,
        currentUserAdded: currentUser && !userUids.has(currentUser.id) ? 1 : 0,
        total: users.length
      });
      
      if (users.length === 0) {
        console.warn("⚠️ No users found in Supabase. Make sure users are created in the 'admins' table.");
        setError("No users found. Create users using the 'Create User' tab.");
      }
      
      // Check if component unmounted before updating state
      if (!isMounted) {
        return;
      }

      // Update both users and filteredUsers lists
      setUsers(users);
      setFilteredUsers(users);
      console.log(`✅ Updated UI with ${users.length} users`);
    } catch (error) {
      // Don't show error if component unmounted or request was aborted
      if (error.name === 'AbortError') {
        console.log('Request aborted, ignoring error');
        return;
      }
      
      if (!isMounted) {
        return;
      }
      
      console.error("❌ Error loading users:", error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || 'Unknown error';
      setError("Failed to load users: " + errorMessage);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      loadingUsersRef.current = false;
      if (isMounted) {
        setLoadingUsers(false);
      }
    }
  };

  const handleCreateUser = async () => {
    setError("");
    setSuccess(false);
    
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
      if (!supabase) {
        throw new Error("Supabase database not initialized. Please configure Supabase to create users.");
      }

      await createAdminAccount({
        email: email.trim(),
        password: password,
        name: name.trim(),
        role,
        permissions: ROLES[role]?.permissions,
      });
      
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.USER_CREATED,
        `Created new user: ${name.trim()} (${email.trim()}) - Role: ${role}`,
        {
          newUserEmail: email.trim(),
          newUserName: name.trim(),
          newUserRole: role,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split('@')[0] || 'Admin',
        }
      );
      
      setSuccess(true);
      setEmail("");
      setPassword("");
      setName("");
      setRole("viewer");
      setShowPassword(false);
      
      await loadUsers();
      
      setTimeout(() => {
        setTabValue(1);
        setSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error creating user:", error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || 'Failed to create user';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    if (!supabase) {
      setError("Supabase database not initialized. Please configure Supabase to update user roles.");
      return;
    }

    try {
      const userToUpdate = users.find(u => (u.id || u.uid) === userId);
      
      const { error } = await supabase
        .from("admins")
        .update({
          role: newRole,
          permissions: ROLES[newRole].permissions,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);
      
      if (error) throw error;
      
      const currentUser = await getCurrentUser();
      await logActivity(
        ACTIVITY_TYPES.USER_UPDATED,
        `Updated user role: ${userToUpdate?.name || userToUpdate?.email} → ${newRole}`,
        {
          updatedUserEmail: userToUpdate?.email,
          updatedUserName: userToUpdate?.name,
          oldRole: userToUpdate?.role,
          newRole,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split('@')[0] || 'Admin',
        }
      );
      
      await loadUsers();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating user role:", error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || 'Unknown error';
      setError("Failed to update user role: " + errorMessage);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    const currentUser = await getCurrentUser();
    const isCurrentUser = currentUser && (currentUser.id === userId || currentUser.email === userEmail);
    
    if (isCurrentUser) {
      const confirmMessage = `⚠️ WARNING: You are about to delete your own account!\n\n` +
        `This will remove you from the database, but you will remain logged in until you log out.\n\n` +
        `To fully remove your account, you'll need to:\n` +
        `1. Delete it from Supabase Dashboard → Authentication → Users\n` +
        `2. Or have another admin delete it after you log out\n\n` +
        `Are you sure you want to continue?`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete user "${userEmail}"?\n\nThis will delete their account from Supabase database.`)) {
        return;
      }
    }

    if (!supabase) {
      setError("Supabase database not initialized. Please configure Supabase to delete users.");
      return;
    }

    setDeletingUser(userId);
    setError("");
    try {
      console.log(`🗑️ Starting deletion process for user: ${userEmail} (ID: ${userId})`);
      await logActivity(
        ACTIVITY_TYPES.USER_DELETED,
        `Deleted user: ${userEmail}`,
        {
          deletedUserEmail: userEmail,
          userEmail: currentUser?.email,
          userName: currentUser?.email?.split('@')[0] || 'Admin',
        }
      );
      
      // Delete from database (admins table)
      // Pass both userId and email to handle cases where ID might not match
      console.log(`💾 Attempting to delete from database: ${userId} (email: ${userEmail})`);
      const deleteResult = await deleteUserDocument(userId, userEmail);
      console.log('Delete result:', deleteResult);
      
      if (!deleteResult.success) {
        const errorMsg = deleteResult.error || 'Failed to delete user from database';
        console.error('Delete failed:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // Track deleted user ID to prevent re-adding them
      deletedUserIdsRef.current.add(userId);
      
      // Immediately remove user from UI state (optimistic update)
      setUsers(prevUsers => prevUsers.filter(user => (user.id || user.uid) !== userId));
      setFilteredUsers(prevFiltered => prevFiltered.filter(user => (user.id || user.uid) !== userId));
      
      if (!deleteResult.deleted) {
        console.warn(`⚠️ User ${userId} was not found in database. They may exist only in Supabase Auth or were already deleted.`);
        // Don't throw error - user might not exist in database, which is fine
        // The user will still be removed from the UI
      } else {
        console.log(`✅ User successfully deleted from database`);
      }
      
      // Reload users list from database to ensure sync
      // But skip reload if we deleted the current user (they'll be re-added anyway since they're still logged in)
      if (!isCurrentUser) {
        console.log(`✅ User deletion completed. Reloading users list from database...`);
        try {
          await loadUsers();
        } catch (reloadError) {
          // Ignore abort errors during reload
          if (reloadError.name !== 'AbortError') {
            console.warn('Error reloading users after deletion:', reloadError);
          }
        }
      } else {
        console.log(`⚠️ Skipping reload - deleted user was current user. They will remain in list until you log out.`);
        setError("User removed from database. However, since you're still logged in, you'll remain visible until you log out. To fully remove your account, delete it from Supabase Dashboard → Authentication → Users.");
      }
      
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error deleting user:", error);
      const errorMessage = error?.message || error?.error_description || error?.toString() || 'Unknown error';
      setError("Failed to delete user: " + errorMessage);
    } finally {
      setDeletingUser(null);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setError("");
    setSuccess(false);
    setEditingUser(null);
  };

  const getRoleChip = (userRole) => {
    const roleInfo = ROLES[userRole] || ROLES.viewer;
    return (
      <Chip
        label={roleInfo.label}
        color={roleInfo.color}
        size="small"
        sx={{ fontWeight: 600 }}
      />
    );
  };

  const adminCount = users.filter((u) => u.role === "admin").length;
  const viewerCount = users.filter((u) => u.role === "viewer").length;
  const shippingCount = users.filter((u) => u.role === "shipping").length;
  const theme = useTheme();
  const hasActiveFilters = Boolean(searchQuery.trim()) || roleFilter !== "all";

  const toggleRoleFilter = (roleKey) => {
    setRoleFilter((prev) => (prev === roleKey ? "all" : roleKey));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
  };

  const userInitial = (user) => {
    const n = (user?.name || user?.email || "?").trim();
    return n.charAt(0).toUpperCase();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      maxWidth={false}
      fullWidth
      disableEnforceFocus={false}
      disableAutoFocus={false}
    >
      <DialogTitle
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: "primary.contrastText",
          py: 2,
          px: { xs: 2, sm: 3 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ minWidth: 0 }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette.common.white, 0.2), width: 48, height: 48 }}>
              <SecurityIcon />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Users & permissions
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, display: { xs: "none", sm: "block" } }}>
                Create accounts, assign roles, and control who can access each dashboard
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} aria-label="Close" sx={{ color: "inherit" }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      {loadingUsers && tabValue === 1 ? (
        <LinearProgress color="secondary" sx={{ height: 3 }} />
      ) : null}

      <DialogContent sx={{ p: 0, bgcolor: "background.default" }}>
        <Stack spacing={0} sx={{ position: "sticky", top: 0, zIndex: 2, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
          {(error || success) && (
            <Stack spacing={1} sx={{ p: 2, pb: 0 }}>
              {error ? (
                <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
                  {error}
                </Alert>
              ) : null}
              {success ? (
                <Alert severity="success" icon={<CheckCircleOutlineIcon />} onClose={() => setSuccess(false)} sx={{ borderRadius: 2 }}>
                  {tabValue === 0
                    ? "User created. They can sign in with their email and password."
                    : "Changes saved."}
                </Alert>
              ) : null}
            </Stack>
          )}

          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              minHeight: 48,
              "& .MuiTab-root": {
                minHeight: 48,
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.875rem",
              },
            }}
          >
            <Tab label="Create user" icon={<AddIcon />} iconPosition="start" />
            <Tab label={`All users (${users.length})`} icon={<GroupOutlinedIcon />} iconPosition="start" />
          </Tabs>
        </Stack>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ maxWidth: 720, mx: "auto" }}>
            <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
              Accounts are saved to Supabase. Each person signs in with their <strong>email</strong> and the password
              you set here.
            </Alert>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                Account details
              </Typography>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Email (login)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label="Temporary password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  size="small"
                  helperText="At least 6 characters"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SecurityIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="Toggle password">
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, mb: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                Role
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Tap a role to see what this user can do after login.
              </Typography>
              <RolePickerCards role={role} onRoleChange={setRole} />
              {role === "shipping" ? (
                <Alert severity="info" icon={<LocalShippingIcon />} sx={{ mt: 2, borderRadius: 2 }}>
                  Opens the <strong>Shipping</strong> dashboard only (invoices and delivery). Email confirmation may
                  be required in Supabase Auth.
                </Alert>
              ) : null}
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>
                Access preview
              </Typography>
              <PermissionPreview roleKey={role} />
            </Paper>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ maxWidth: 960, mx: "auto" }}>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatCard
                  title="Total"
                  value={users.length}
                  hint="Tap to show all"
                  color="primary"
                  icon={GroupOutlinedIcon}
                  active={roleFilter === "all" && !searchQuery.trim()}
                  onClick={() => {
                    setRoleFilter("all");
                    setSearchQuery("");
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatCard
                  title="Admins"
                  value={adminCount}
                  hint="Full access"
                  color="error"
                  icon={AdminPanelSettingsIcon}
                  active={roleFilter === "admin"}
                  onClick={() => toggleRoleFilter("admin")}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatCard
                  title="Viewers"
                  value={viewerCount}
                  hint="Read only"
                  color="info"
                  icon={RemoveRedEyeOutlinedIcon}
                  active={roleFilter === "viewer"}
                  onClick={() => toggleRoleFilter("viewer")}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <StatCard
                  title="Shipping"
                  value={shippingCount}
                  hint="Dispatch"
                  color="secondary"
                  icon={LocalShippingIcon}
                  active={roleFilter === "shipping"}
                  onClick={() => toggleRoleFilter("shipping")}
                />
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
              >
                <TextField
                  placeholder="Search by name or email…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
                <ToggleButtonGroup
                  size="small"
                  value={roleFilter}
                  exclusive
                  onChange={(_, v) => v != null && setRoleFilter(v)}
                  sx={{ flexWrap: "wrap" }}
                >
                  <ToggleButton value="all" sx={{ textTransform: "none", fontWeight: 700 }}>
                    All
                  </ToggleButton>
                  <ToggleButton value="admin" sx={{ textTransform: "none", fontWeight: 700 }}>
                    Admin
                  </ToggleButton>
                  <ToggleButton value="viewer" sx={{ textTransform: "none", fontWeight: 700 }}>
                    Viewer
                  </ToggleButton>
                  <ToggleButton value="shipping" sx={{ textTransform: "none", fontWeight: 700 }}>
                    Shipping
                  </ToggleButton>
                </ToggleButtonGroup>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  {hasActiveFilters ? (
                    <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters} sx={{ fontWeight: 700 }}>
                      Clear
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => loadUsers()}
                    disabled={loadingUsers}
                    sx={{ fontWeight: 700 }}
                  >
                    Refresh
                  </Button>
                </Stack>
              </Stack>
            </Paper>

            {loadingUsers ? (
              <Box sx={{ py: 8, textAlign: "center" }}>
                <CircularProgress />
                <Typography color="text.secondary" sx={{ mt: 2 }}>
                  Loading users…
                </Typography>
              </Box>
            ) : filteredUsers.length === 0 ? (
              <Paper variant="outlined" sx={{ py: 6, px: 2, textAlign: "center", borderRadius: 2 }}>
                <GroupOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {hasActiveFilters ? "No users match" : "No users yet"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360, mx: "auto" }}>
                  {hasActiveFilters
                    ? "Try a different search or role filter."
                    : "Create your first admin, viewer, or shipping account."}
                </Typography>
                {hasActiveFilters ? (
                  <Button variant="outlined" onClick={clearFilters} startIcon={<ClearIcon />}>
                    Clear filters
                  </Button>
                ) : (
                  <Button variant="contained" onClick={() => setTabValue(0)} startIcon={<AddIcon />}>
                    Create user
                  </Button>
                )}
              </Paper>
            ) : (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block", fontWeight: 600 }}>
                  Showing {filteredUsers.length} of {users.length}
                </Typography>
                <Stack spacing={1.5}>
                  {filteredUsers.map((user) => {
                    const uid = user.id || user.uid;
                    const created = formatUserDate(user.createdAt);
                    const lastIn = formatUserDate(user.lastSignInTime);
                    return (
                      <Fade in key={uid} timeout={200}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            transition: "box-shadow 0.15s",
                            "&:hover": { boxShadow: 3 },
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            alignItems={{ sm: "center" }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                              <Avatar
                                sx={{
                                  width: 48,
                                  height: 48,
                                  bgcolor:
                                    user.role === "admin"
                                      ? "error.main"
                                      : user.role === "shipping"
                                        ? "primary.main"
                                        : "info.main",
                                  fontWeight: 800,
                                }}
                              >
                                {userInitial(user)}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                                    {user.name || "Unnamed"}
                                  </Typography>
                                  {user.isCurrentUser ? (
                                    <Chip label="You" size="small" color="primary" sx={{ height: 22, fontWeight: 700 }} />
                                  ) : null}
                                  {getRoleChip(user.role)}
                                  {user.emailVerified === false ? (
                                    <Chip label="Unverified email" size="small" color="warning" variant="outlined" sx={{ height: 22 }} />
                                  ) : null}
                                </Stack>
                                <Typography variant="body2" color="text.secondary" noWrap sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <EmailIcon sx={{ fontSize: 16 }} />
                                  {user.email}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="div">
                                  {[created && `Joined ${created}`, lastIn && `Last sign-in ${lastIn}`]
                                    .filter(Boolean)
                                    .join(" · ") || "No activity dates"}
                                </Typography>
                              </Box>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                              <FormControl size="small" sx={{ minWidth: 130 }}>
                                <InputLabel id={`role-${uid}`}>Role</InputLabel>
                                <Select
                                  labelId={`role-${uid}`}
                                  label="Role"
                                  value={user.role || "viewer"}
                                  onChange={(e) => handleUpdateUserRole(uid, e.target.value)}
                                >
                                  {Object.keys(ROLES).map((roleKey) => (
                                    <MenuItem key={roleKey} value={roleKey}>
                                      {ROLES[roleKey].label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <Tooltip title="Remove user from database">
                                <span>
                                  <IconButton
                                    color="error"
                                    onClick={() => handleDeleteUser(uid, user.email)}
                                    disabled={deletingUser === uid}
                                    aria-label="Delete user"
                                  >
                                    {deletingUser === uid ? (
                                      <CircularProgress size={22} />
                                    ) : (
                                      <DeleteIcon />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Fade>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          gap: 1,
        }}
      >
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} variant="outlined" sx={{ fontWeight: 700, textTransform: "none" }}>
          Close
        </Button>
        {tabValue === 0 ? (
          <Button
            onClick={handleCreateUser}
            variant="contained"
            disabled={loading || !email.trim() || !password || !name.trim()}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 800, textTransform: "none", minWidth: 140 }}
          >
            {loading ? "Creating…" : "Create user"}
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setTabValue(0)}
            sx={{ fontWeight: 800, textTransform: "none" }}
          >
            Add user
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default UserPermissionManagementDialog;
