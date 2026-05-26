import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Paper,
  TextField,
  InputAdornment,
  Fade,
  Avatar,
  Card,
  CardContent,
  useMediaQuery,
  Tabs,
  Tab,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ScheduleIcon from "@mui/icons-material/Schedule";
import {
  getActivities,
  formatActivity,
  partitionActivitiesByAge,
  filterActivitiesByDateRange,
  ACTIVITY_RECENT_MS,
} from "../services/activityService";

const ACTIVITY_TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "login", label: "Logins" },
  { value: "logout", label: "Logouts" },
  { value: "order_created", label: "Orders placed" },
  { value: "order_sent_for_approval", label: "Sent for approval" },
  { value: "order_approved", label: "Approved" },
  { value: "order_rejected", label: "Rejected" },
  { value: "order_delivered", label: "Delivered" },
  { value: "order_canceled", label: "Canceled" },
  { value: "shipping_invoice_uploaded", label: "Invoices" },
  { value: "sales_data_updated", label: "Sales data" },
  { value: "target_updated", label: "Targets" },
  { value: "distributor_added", label: "Distributors" },
  { value: "distributor_updated", label: "Distributor edits" },
  { value: "user_created", label: "Users" },
];

function ActivityDialog({ open, onClose }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [viewTab, setViewTab] = useState("recent");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadActivities = async () => {
    setLoading(true);
    setError("");
    try {
      const loadedActivities = await getActivities(0);
      const formatted = loadedActivities.map(formatActivity);
      setActivities(formatted);
    } catch (err) {
      setError("Failed to load activities: " + err.message);
      console.error("Error loading activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadActivities();
    }
  }, [open]);

  const { recent, history } = useMemo(
    () => partitionActivitiesByAge(activities, ACTIVITY_RECENT_MS),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    let base = viewTab === "recent" ? recent : history;

    base = filterActivitiesByDateRange(base, dateFrom, dateTo);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      base = base.filter(
        (activity) =>
          (activity.description || "").toLowerCase().includes(query) ||
          (activity.userName || "").toLowerCase().includes(query) ||
          (activity.userEmail || "").toLowerCase().includes(query) ||
          (activity.metadata?.distributorName &&
            activity.metadata.distributorName.toLowerCase().includes(query)) ||
          (activity.metadata?.distributorCode &&
            String(activity.metadata.distributorCode).toLowerCase().includes(query)) ||
          (activity.metadata?.orderId &&
            String(activity.metadata.orderId).toLowerCase().includes(query))
      );
    }

    if (selectedType !== "all") {
      base = base.filter((activity) => (activity.type || "unknown") === selectedType);
    }

    return base;
  }, [recent, history, viewTab, dateFrom, dateTo, searchQuery, selectedType]);

  const getActivityTypeCount = (type) => {
    const pool = viewTab === "recent" ? recent : history;
    if (type === "all") return pool.length;
    return pool.filter((a) => a.type === type).length;
  };

  const clearDateFilters = () => {
    setDateFrom("");
    setDateTo("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} maxWidth={false} fullWidth>
      <DialogTitle
        sx={{
          bgcolor: "primary.main",
          color: "white",
          py: 2,
          px: 3,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)", width: 48, height: 48 }}>
              <HistoryIcon />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: "white" }}>
                Activity Log
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)" }}>
                Recent actions (last 24 hours) · older entries in History
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              onClick={loadActivities}
              size="small"
              disabled={loading}
              sx={{ color: "white" }}
            >
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose} size="small" sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: "action.hover", color: "text.primary" }}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <Tabs
            value={viewTab}
            onChange={(_, v) => v && setViewTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab
              value="recent"
              icon={<ScheduleIcon fontSize="small" />}
              iconPosition="start"
              label={`Recent (${recent.length})`}
              sx={{ textTransform: "none", fontWeight: 700 }}
            />
            <Tab
              value="history"
              icon={<HistoryIcon fontSize="small" />}
              iconPosition="start"
              label={`History (${history.length})`}
              sx={{ textTransform: "none", fontWeight: 700 }}
            />
          </Tabs>

          <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                label="From date"
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
              <TextField
                label="To date"
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
              {(dateFrom || dateTo) && (
                <Button size="small" onClick={clearDateFilters}>
                  Clear dates
                </Button>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {ACTIVITY_TYPE_FILTERS.map((type) => (
                <Chip
                  key={type.value}
                  label={`${type.label} (${getActivityTypeCount(type.value)})`}
                  onClick={() => setSelectedType(type.value)}
                  color={selectedType === type.value ? "primary" : "default"}
                  size="small"
                  icon={selectedType === type.value ? <FilterListIcon /> : undefined}
                />
              ))}
            </Box>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
            <Box sx={{ textAlign: "center" }}>
              <CircularProgress size={48} />
              <Typography sx={{ mt: 2, color: "text.secondary" }}>
                Loading activities...
              </Typography>
            </Box>
          </Box>
        ) : filteredActivities.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <HistoryIcon sx={{ fontSize: 64, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {searchQuery || selectedType !== "all" || dateFrom || dateTo
                ? "No activities match your filters"
                : viewTab === "recent"
                  ? "No activities in the last 24 hours"
                  : "No activity history yet"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {viewTab === "recent"
                ? "Activities from the last 24 hours appear here. Older entries move to History automatically."
                : "Activities older than 24 hours are kept here for review."}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: "block" }}>
              Showing {filteredActivities.length} of{" "}
              {viewTab === "recent" ? recent.length : history.length}{" "}
              {viewTab === "recent" ? "recent" : "historical"} activities
            </Typography>
            <List sx={{ p: 0 }}>
              {filteredActivities.map((activity, index) => (
                <Fade in={true} timeout={300} key={activity.id || index}>
                  <Card
                    sx={{
                      mb: 2,
                      boxShadow: 2,
                      borderRadius: 2,
                      transition: "all 0.2s ease-in-out",
                      "&:hover": {
                        boxShadow: 4,
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                        <Avatar
                          sx={{
                            bgcolor: `${activity.color}.main`,
                            width: 48,
                            height: 48,
                            fontSize: "1.5rem",
                          }}
                        >
                          {activity.icon}
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 1,
                              mb: 1,
                              flexWrap: "wrap",
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                              {activity.description || "No description"}
                            </Typography>
                            <Chip
                              label={(activity.type || "unknown").replace(/_/g, " ").toUpperCase()}
                              size="small"
                              color={activity.color || "default"}
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>User:</strong> {activity.userName || "Unknown"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Email:</strong> {activity.userEmail || "Unknown"}
                            </Typography>
                            {activity.metadata?.role && (
                              <Typography variant="body2" color="text.secondary">
                                <strong>Role:</strong> {activity.metadata.role}
                              </Typography>
                            )}
                          </Box>
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <Paper
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                mt: 1,
                                mb: 1,
                                bgcolor: "action.hover",
                                borderRadius: 1,
                              }}
                            >
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                {activity.metadata.distributorName && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    <strong>Distributor:</strong> {activity.metadata.distributorName}
                                  </Typography>
                                )}
                                {activity.metadata.distributorCode && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    <strong>Code:</strong> {activity.metadata.distributorCode}
                                  </Typography>
                                )}
                                {activity.metadata.orderId && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    <strong>Order:</strong> {activity.metadata.orderId}
                                  </Typography>
                                )}
                                {activity.metadata.recordCount != null && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    <strong>Records:</strong> {activity.metadata.recordCount}
                                  </Typography>
                                )}
                                {activity.metadata.fileCount != null && (
                                  <Typography variant="caption" sx={{ display: "block" }}>
                                    <strong>Files:</strong> {activity.metadata.fileCount}
                                  </Typography>
                                )}
                              </Box>
                            </Paper>
                          )}
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              {activity.formattedTime}
                            </Typography>
                            {activity.timestamp && (
                              <>
                                <Typography variant="caption" color="text.disabled">
                                  •
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </Typography>
                              </>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Fade>
              ))}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{ bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider", px: 3, py: 2 }}
      >
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button
          onClick={loadActivities}
          disabled={loading}
          variant="contained"
          startIcon={<RefreshIcon />}
        >
          Refresh
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ActivityDialog;
