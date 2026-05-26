# Gmail API Setup Guide for Order Approval Workflow

This guide explains how to set up Gmail API integration for automatic order approval detection from email replies.

## Overview

The Gmail API integration allows the app to:
1. **Send emails** with order attachments via Gmail API (instead of EmailJS)
2. **Monitor email replies** from the Senior General Manager
3. **Auto-detect approval keywords** in replies (approved, proceed, go ahead, etc.)
4. **Auto-update order status** when approval is detected

## Prerequisites

1. **Google Cloud Project** with Gmail API enabled
2. **OAuth 2.0 credentials** (Client ID and API Key)
3. **Gmail account** for sending/receiving emails

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Gmail API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for testing) or **Internal** (for Google Workspace)
   - App name: "Coke Calculator Order Management"
   - User support email: Your email
   - Developer contact: Your email
   - Scopes: Add `https://www.googleapis.com/auth/gmail.readonly` and `https://www.googleapis.com/auth/gmail.send`
   - Save and continue
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: "Coke Calculator Web Client"
   - Authorized JavaScript origins: 
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Click "Create"
5. **Copy the Client ID** (you'll need this)

## Step 3: Create API Key

1. In "Credentials", click "Create Credentials" > "API key"
2. Copy the API key
3. (Optional) Restrict the API key to Gmail API only for security

## Step 4: Configure in App

1. Open the app's admin dashboard
2. Navigate to "Settings" or "Email Configuration" (if available)
3. Enter the following in browser console or create a settings page:

```javascript
localStorage.setItem('gmail_client_id', 'YOUR_CLIENT_ID_HERE');
localStorage.setItem('gmail_api_key', 'YOUR_API_KEY_HERE');
```

Or add these to your app's configuration:

```javascript
// In src/config/gmail.js or similar
export const GMAIL_CONFIG = {
  clientId: '57321801927-8qukhctsm78n0fv48idi0cdgq2aft91e.apps.googleusercontent.com',
  apiKey: 'AIzaSyCMXL_gYeaTVWyi0isqiD8brO8Y9sGNaKM'
};
```

## Step 5: First-Time Gmail Sign-In

**Where to Sign In:**

The Gmail sign-in happens automatically when you try to send your first email. Here's where it happens:

1. **In the Admin Dashboard:**
   - Go to **Admin Dashboard** > **Orders** section
   - Click the **"Send Email"** button (📧 icon) on any order
   - The **Order Email Dialog** will open

2. **When Sending Email:**
   - Fill in the email composition form:
     - Senior General Manager email (TO)
     - Other managers (CC)
     - Custom message
   - Click **"Send Email"** button
   - **If you're not signed in to Gmail yet**, a Google OAuth popup window will appear automatically
   - Click **"Sign in with Google"** in the popup
   - Select your Gmail account
   - Grant permissions:
     - ✅ Read Gmail messages
     - ✅ Send Gmail messages
   - Click **"Allow"** or **"Continue"**
   - The popup will close and your email will be sent

3. **Alternative: Connect Gmail Before Sending**
   - You can also connect Gmail in advance by opening the browser console (F12) and running:
   ```javascript
   // This will trigger the sign-in popup
   const { signInGmail } = await import('./src/services/gmailService');
   await signInGmail();
   ```

**Note:** The authentication token is stored in your browser, so you only need to sign in once per browser. The app will remember your connection for future emails.

## Step 6: Test Email Sending

1. Go to Admin Dashboard > Orders
2. Click "Send Email" on an order
3. Fill in the email composition dialog:
   - Senior General Manager email (TO)
   - Other managers (CC)
   - Custom message
4. Click "Send Email"
5. The email should be sent via Gmail API with the order PNG attached

## Step 7: Test Reply Monitoring

1. After sending an order email, the app will start monitoring for replies
2. Reply to the email from the Senior General Manager's account with:
   - "Approved"
   - "Go ahead"
   - "Proceed"
   - Or any other approval keyword
3. The app should detect the approval and update the order status automatically

## Approval Keywords

The app recognizes these approval keywords (case-insensitive):
- approved, approve
- go ahead, go on
- proceed, proceeded
- accepted, accept
- yes, ok, okay
- confirm, confirmed
- agreed, agree
- authorized, authorize
- permission granted, granted

## Rejection Keywords

The app recognizes these rejection keywords:
- rejected, reject
- denied, deny
- no, not approved
- disapproved
- refused, refuse
- declined, decline

## Troubleshooting

### "Gmail API not configured"
- Make sure you've set `gmail_client_id` and `gmail_api_key` in localStorage
- Check browser console for errors

### "Sign in required"
- Click "Sign in with Google" when prompted
- Grant all required permissions

### "Email not sending"
- Check that Gmail API is enabled in Google Cloud Console
- Verify OAuth credentials are correct
- Check browser console for API errors

### "Replies not detected"
- Make sure the reply subject includes the original subject (Re: prefix)
- Check that you're signed in to Gmail API
- Verify the monitoring service is running (checks every 30 seconds)

### "Approval not detected"
- Make sure the reply contains one of the approval keywords
- Check that the email body is being parsed correctly
- Review the reply content in the app's logs

## Security Notes

1. **API Key**: Keep your API key secure. Don't commit it to version control.
2. **OAuth Tokens**: The app stores OAuth tokens in browser storage. For production, consider server-side token management.
3. **Scopes**: Only request the minimum required scopes (readonly and send).
4. **HTTPS**: Use HTTPS in production for secure OAuth flow.

## Alternative: EmailJS (Current Implementation)

If Gmail API setup is too complex, you can continue using EmailJS:
- No OAuth required
- Simpler setup
- But no automatic reply monitoring
- Manual approval required

## Next Steps

1. Set up Gmail API credentials
2. Test email sending
3. Test reply monitoring
4. Configure automatic status updates
5. Set up production OAuth credentials
