# Email Order Approval - Usage Guide

## Overview

The email order approval feature allows you to:
1. **Send order details via email** to senior managers for approval
2. **Track order status** (pending, sent, approved, rejected)
3. **Manage email recipient groups** (e.g., Senior General Manager, Managers)
4. **Manually approve/reject orders** directly in the dashboard

## Quick Start

### 1. Set Up Email Recipients

1. Go to **Admin Dashboard** → **Orders** tab
2. Click **"Email Recipients"** button (top right)
3. Create recipient groups:
   - Click **"Add Group"** (e.g., "Senior General Manager", "Managers")
   - Select a group
   - Add email addresses to that group
   - Click **"Save"**

**Example:**
- Group: "Senior General Manager"
  - Email: `senior.manager@company.com`
- Group: "Managers"
  - Email: `manager1@company.com`
  - Email: `manager2@company.com`

### 2. Send Order for Approval

1. In the **Orders** table, find the order you want to send
2. Click the **Email icon** (📧) in the Actions column
3. The system will:
   - Convert order details to PNG image
   - Send email to all configured recipients
   - Update order status to "sent"

### 3. Approve/Reject Orders

**Manual Approval:**
- Click **✓ (green checkmark)** to approve
- Click **✗ (red X)** to reject
- Order status updates immediately

**Note:** Automatic approval from email replies requires backend setup (see Gmail API section below).

## Order Status

- **Pending** (gray) - New order, not yet sent
- **Sent** (blue) - Email sent, awaiting response
- **Approved** (green) - Order approved
- **Rejected** (red) - Order rejected

## Email Integration Options

### Option 1: EmailJS (Recommended for MVP)

**Setup:**
1. Sign up at https://www.emailjs.com/ (free tier available)
2. Create an email service (Gmail, SendGrid, etc.)
3. Create an email template
4. Get your credentials:
   - Service ID
   - Template ID
   - Public Key

**Configure in Browser Console:**
```javascript
localStorage.setItem('emailjs_service_id', 'YOUR_SERVICE_ID');
localStorage.setItem('emailjs_template_id', 'YOUR_TEMPLATE_ID');
localStorage.setItem('emailjs_public_key', 'YOUR_PUBLIC_KEY');
```

**Email Template Variables:**
- `{{to_email}}` - Recipient email addresses
- `{{subject}}` - Email subject
- `{{message}}` - HTML email body
- `{{order_id}}` - Order ID

### Option 2: Mailto Fallback

If EmailJS is not configured, the system will:
- Open your default email client
- Pre-fill recipient, subject, and body
- You need to manually attach the order PNG image

### Option 3: Gmail API (Full Integration - Requires Backend)

For automatic email reply parsing and full Gmail integration:
- Requires Firebase Cloud Functions
- OAuth 2.0 setup
- See `GMAIL_ORDER_APPROVAL_IMPLEMENTATION.md` for details

## Features

### ✅ Implemented

- Order status tracking (pending, sent, approved, rejected)
- Email recipient group management
- Order to PNG conversion
- Send email button with status display
- Manual approve/reject buttons
- EmailJS integration support
- Mailto fallback

### 🔄 Future Enhancements

- Automatic email reply parsing (requires backend)
- Gmail API full integration
- Email templates customization
- Approval workflow notifications
- Bulk order approval

## Troubleshooting

### Email Not Sending

1. **Check EmailJS Configuration:**
   - Verify credentials in browser console
   - Check EmailJS dashboard for errors
   - Ensure email service is active

2. **Check Recipients:**
   - Ensure at least one recipient group has emails
   - Verify email addresses are valid

3. **Browser Console:**
   - Check for error messages
   - Verify network requests

### Order Status Not Saving

- Order statuses are saved in `localStorage`
- Check browser storage permissions
- Status persists across sessions

### PNG Generation Issues

- Ensure `html2canvas` is installed
- Check browser console for errors
- Try refreshing the page

## Technical Details

### File Structure

- `src/services/emailService.js` - Email utility functions
- `src/components/EmailRecipientsDialog.jsx` - Recipient management UI
- `src/pages/AdminDashboard.jsx` - Orders table with email actions

### Data Storage

- **Order Statuses:** `localStorage.getItem('order_statuses')`
- **Recipients:** `localStorage.getItem('order_approval_recipients')`
- **EmailJS Config:** `localStorage.getItem('emailjs_*')`

### Order ID Generation

Orders are identified by:
1. Firebase document ID (if available)
2. `timestamp_distributorCode` (fallback)
3. `timestamp` (last resort)

## Support

For issues or questions:
1. Check browser console for errors
2. Verify EmailJS configuration
3. Review implementation guide: `GMAIL_ORDER_APPROVAL_IMPLEMENTATION.md`
