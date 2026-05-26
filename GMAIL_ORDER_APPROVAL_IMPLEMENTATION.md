# Gmail Order Approval Implementation Guide

This document outlines the implementation of Gmail integration for order approval workflows.

## Overview

The system allows:
1. **Order Status Tracking**: Orders have status (pending, approved, rejected)
2. **Email Sending**: Send order details as PNG via email to approval group
3. **Recipient Management**: Manage groups of email recipients for approvals
4. **Manual Approval**: Approve/reject orders directly in the UI

## Implementation Status

### ✅ Completed:
- Email service utility (`src/services/emailService.js`)
- Order status tracking structure
- Recipient group management functions

### 🔄 In Progress:
- Orders table UI updates (Status column, Actions column)
- Send Email button with PNG generation
- Approve/Reject buttons
- Email recipient management dialog

### 📋 Pending (Requires Backend):
- **Gmail API Integration**: Full Gmail API requires OAuth 2.0 and server-side handling
- **Email Reply Parsing**: To automatically detect approval/rejection from email replies

## Email Integration Options

### Option 1: EmailJS (Client-Side, Recommended for MVP)
- **Pros**: Easy setup, no backend needed, free tier available
- **Cons**: Limited attachment support, may have rate limits
- **Setup**: Requires EmailJS account and service configuration

### Option 2: Gmail API (Full Integration)
- **Pros**: Full Gmail integration, native email attachments, reliable
- **Cons**: Requires OAuth 2.0, server-side component (Firebase Cloud Functions)
- **Setup**: Complex, requires Google Cloud project and OAuth setup

### Option 3: Mailto Links (Fallback)
- **Pros**: Works immediately, no setup needed
- **Cons**: No attachments, requires manual email client interaction
- **Use**: Fallback when other options unavailable

## Current Implementation Strategy

Using a **hybrid approach**:
1. **Primary**: EmailJS for sending emails with order data
2. **Fallback**: Mailto links if EmailJS not configured
3. **Manual Approval**: UI buttons for approve/reject (immediate, no email parsing needed)
4. **Future**: Gmail API integration for automatic reply parsing (requires backend)

## Files Modified/Created

1. `src/services/emailService.js` - Email utility functions
2. `src/pages/AdminDashboard.jsx` - Orders table with status and email actions
3. `src/components/EmailRecipientsDialog.jsx` - Recipient management UI (to be created)

## Setup Instructions

### For EmailJS:
1. Sign up at https://www.emailjs.com/
2. Create an email service (Gmail, SendGrid, etc.)
3. Create an email template
4. Get Service ID, Template ID, and Public Key
5. Store in localStorage or environment variables:
   - `emailjs_service_id`
   - `emailjs_template_id`
   - `emailjs_public_key`

### For Gmail API (Future):
1. Enable Gmail API in Google Cloud Console
2. Set up OAuth 2.0 credentials
3. Create Firebase Cloud Function for email sending
4. Implement email reply parsing/webhook

## Usage Flow

1. **Order Created**: Order status defaults to "pending"
2. **Send for Approval**: Admin clicks "Send Email" button
   - Order data converted to PNG image
   - Email sent to configured recipient group
   - Order status remains "pending"
3. **Approval Decision**:
   - **Manual**: Admin clicks Approve/Reject button
   - **Automatic** (Future): System parses email reply (requires backend)
4. **Status Update**: Order status updated, saved to Firebase/localStorage

## Order Status Values

- `pending` - Order awaiting approval (default)
- `approved` - Order approved, can proceed
- `rejected` - Order rejected, needs revision
- `sent` - Email sent, awaiting response

## Next Steps

1. Complete UI updates to orders table
2. Add email recipient management dialog
3. Implement PNG generation for orders
4. Test email sending functionality
5. Document email template requirements
6. Plan Gmail API integration for production
