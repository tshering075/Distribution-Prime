/**
 * Activity Logging Service
 * Tracks all user activities in the app (localStorage on this browser/device).
 */

import { getCurrentUser } from './supabaseService';

/** Activities younger than this stay in "Recent"; older move to "History". */
export const ACTIVITY_RECENT_MS = 24 * 60 * 60 * 1000;

const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  ORDER_CREATED: 'order_created',
  ORDER_SENT_FOR_APPROVAL: 'order_sent_for_approval',
  ORDER_APPROVED: 'order_approved',
  ORDER_REJECTED: 'order_rejected',
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELED: 'order_canceled',
  SHIPPING_INVOICE_UPLOADED: 'shipping_invoice_uploaded',
  SHIPPING_INVOICE_UPDATED: 'shipping_invoice_updated',
  SHIPPING_INVOICE_CLEARED: 'shipping_invoice_cleared',
  SALES_DATA_UPDATED: 'sales_data_updated',
  TARGET_UPDATED: 'target_updated',
  DISTRIBUTOR_ADDED: 'distributor_added',
  DISTRIBUTOR_UPDATED: 'distributor_updated',
  DISTRIBUTOR_DELETED: 'distributor_deleted',
  PHYSICAL_STOCK_UPDATED: 'physical_stock_updated',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
};

const ACTIVITY_ICONS = {
  [ACTIVITY_TYPES.LOGIN]: '🔐',
  [ACTIVITY_TYPES.LOGOUT]: '🚪',
  [ACTIVITY_TYPES.ORDER_CREATED]: '📦',
  [ACTIVITY_TYPES.ORDER_SENT_FOR_APPROVAL]: '📧',
  [ACTIVITY_TYPES.ORDER_APPROVED]: '✅',
  [ACTIVITY_TYPES.ORDER_REJECTED]: '❌',
  [ACTIVITY_TYPES.ORDER_DELIVERED]: '🚚',
  [ACTIVITY_TYPES.ORDER_CANCELED]: '🚫',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_UPLOADED]: '📎',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_UPDATED]: '📝',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_CLEARED]: '🗑️',
  [ACTIVITY_TYPES.SALES_DATA_UPDATED]: '📊',
  [ACTIVITY_TYPES.TARGET_UPDATED]: '🎯',
  [ACTIVITY_TYPES.DISTRIBUTOR_ADDED]: '➕',
  [ACTIVITY_TYPES.DISTRIBUTOR_UPDATED]: '✏️',
  [ACTIVITY_TYPES.DISTRIBUTOR_DELETED]: '🗑️',
  [ACTIVITY_TYPES.PHYSICAL_STOCK_UPDATED]: '📦',
  [ACTIVITY_TYPES.USER_CREATED]: '👤',
  [ACTIVITY_TYPES.USER_UPDATED]: '👥',
  [ACTIVITY_TYPES.USER_DELETED]: '❌',
};

const ACTIVITY_COLORS = {
  [ACTIVITY_TYPES.LOGIN]: 'success',
  [ACTIVITY_TYPES.LOGOUT]: 'default',
  [ACTIVITY_TYPES.ORDER_CREATED]: 'info',
  [ACTIVITY_TYPES.ORDER_SENT_FOR_APPROVAL]: 'info',
  [ACTIVITY_TYPES.ORDER_APPROVED]: 'success',
  [ACTIVITY_TYPES.ORDER_REJECTED]: 'error',
  [ACTIVITY_TYPES.ORDER_DELIVERED]: 'success',
  [ACTIVITY_TYPES.ORDER_CANCELED]: 'warning',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_UPLOADED]: 'primary',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_UPDATED]: 'info',
  [ACTIVITY_TYPES.SHIPPING_INVOICE_CLEARED]: 'default',
  [ACTIVITY_TYPES.SALES_DATA_UPDATED]: 'primary',
  [ACTIVITY_TYPES.TARGET_UPDATED]: 'warning',
  [ACTIVITY_TYPES.DISTRIBUTOR_ADDED]: 'success',
  [ACTIVITY_TYPES.DISTRIBUTOR_UPDATED]: 'info',
  [ACTIVITY_TYPES.DISTRIBUTOR_DELETED]: 'error',
  [ACTIVITY_TYPES.PHYSICAL_STOCK_UPDATED]: 'info',
  [ACTIVITY_TYPES.USER_CREATED]: 'success',
  [ACTIVITY_TYPES.USER_UPDATED]: 'info',
  [ACTIVITY_TYPES.USER_DELETED]: 'error',
};

function parseActivityTimestamp(timestamp) {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Split activities into recent (last 24h) and history (older).
 */
export function partitionActivitiesByAge(activities, recentMs = ACTIVITY_RECENT_MS) {
  const now = Date.now();
  const recent = [];
  const history = [];

  for (const activity of activities) {
    const date = parseActivityTimestamp(activity.timestamp);
    if (!date) {
      history.push(activity);
      continue;
    }
    if (now - date.getTime() < recentMs) {
      recent.push(activity);
    } else {
      history.push(activity);
    }
  }

  return { recent, history };
}

/**
 * Filter activities by inclusive local-date range (YYYY-MM-DD).
 */
export function filterActivitiesByDateRange(activities, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return activities;

  return activities.filter((activity) => {
    const date = parseActivityTimestamp(activity.timestamp);
    if (!date) return false;
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    if (dateFrom && key < dateFrom) return false;
    if (dateTo && key > dateTo) return false;
    return true;
  });
}

/**
 * Log an activity
 * @param {string} type - Activity type="type" (from ACTIVITY_TYPES)
 * @param {string} description - Human-readable description
 * @param {Object} metadata - Additional data (user, distributor, etc.)
 */
export async function logActivity(type, description, metadata = {}) {
  try {
    let userEmail = metadata.userEmail;
    let userId = metadata.userId;
    let userName = metadata.userName;
    if (!userEmail) {
      const currentUser = await getCurrentUser();
      userEmail = currentUser?.email || 'Unknown';
      userId = currentUser?.id || metadata.userId || 'Unknown';
      userName = metadata.userName || userEmail;
    } else {
      userId = userId || 'Unknown';
      userName = userName || userEmail;
    }

    const cleanMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && key !== 'userId' && key !== 'userEmail' && key !== 'userName') {
        cleanMetadata[key] = value;
      }
    }

    const activity = {
      type,
      description,
      userId,
      userEmail,
      userName,
      timestamp: new Date().toISOString(),
      metadata: cleanMetadata,
    };

    try {
      const stored = localStorage.getItem('activities') || '[]';
      const activities = JSON.parse(stored);

      const localActivity = {
        ...activity,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      };

      activities.unshift(localActivity);

      if (activities.length > 2000) {
        activities.splice(2000);
      }

      localStorage.setItem('activities', JSON.stringify(activities));
      console.log('✅ Activity saved to localStorage:', description);
    } catch (localStorageError) {
      console.error('Error saving activity to localStorage:', localStorageError);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

/**
 * Get activities from localStorage
 * @param {number} maxResults - Maximum number of activities to return (0 = all stored)
 */
export async function getActivities(maxResults = 500) {
  try {
    const stored = localStorage.getItem('activities') || '[]';
    const activities = JSON.parse(stored);

    const parsed = activities.map((activity) => ({
      ...activity,
      timestamp: parseActivityTimestamp(activity.timestamp) || new Date(0),
    }));

    if (maxResults <= 0) return parsed;
    return parsed.slice(0, maxResults);
  } catch (localStorageError) {
    console.error('Error loading activities from localStorage:', localStorageError);
    return [];
  }
}

/**
 * Format activity for display
 * @param {Object} activity - Activity object
 */
export function formatActivity(activity) {
  const {
    type = 'unknown',
    description = 'No description',
    userName = 'Unknown',
    userEmail = 'Unknown',
    timestamp,
    metadata = {},
  } = activity || {};

  return {
    ...activity,
    type,
    description,
    userName,
    userEmail,
    metadata,
    icon: ACTIVITY_ICONS[type] || '📝',
    color: ACTIVITY_COLORS[type] || 'default',
    formattedTime: formatTimestamp(timestamp),
  };
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown time';

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleString();
}

export { ACTIVITY_TYPES };
