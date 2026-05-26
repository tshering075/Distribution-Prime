/**
 * Date Utility Functions
 * Handles parsing of various date formats from Firestore and regular dates
 */

/**
 * Parse Firestore date fields to JavaScript Date objects
 * Handles multiple date formats from Firestore and regular dates
 * 
 * @param {any} dateField - Date field from Firestore or regular date
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export const parseFirestoreDate = (dateField) => {
  if (!dateField) return null;
  
  // Handle Firestore timestamp with toDate method
  if (dateField.toDate && typeof dateField.toDate === 'function') {
    return dateField.toDate();
  }
  
  // Handle Firestore timestamp object (seconds/nanoseconds)
  if (dateField.seconds) {
    return new Date(dateField.seconds * 1000);
  }
  
  // Handle Date object
  if (dateField instanceof Date) {
    return dateField;
  }
  
  // Handle string or number
  const parsed = new Date(dateField);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Parse order date (for backward compatibility with orders)
 * Tries multiple date fields in order of preference
 * 
 * @param {Object} order - Order object with date fields
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
export const parseOrderDate = (order) => {
  if (!order) return null;
  
  // Try createdAt first
  if (order.createdAt) {
    const date = parseFirestoreDate(order.createdAt);
    if (date) return date;
  }
  
  // Try timestamp
  if (order.timestamp) {
    const date = parseFirestoreDate(order.timestamp);
    if (date) return date;
  }
  
  return null;
};

/**
 * Format date for display
 * 
 * @param {Date} date - Date object to format
 * @param {string} format - Format string (default: 'YYYY-MM-DD')
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  
  if (format === 'YYYY-MM-DD') {
    return d.toISOString().split('T')[0];
  }
  
  return d.toLocaleDateString();
};
