# Gmail OAuth "Invalid Request" Error - Fix Guide

## Error: "You can't sign in because this app sent an invalid request"

This error means your OAuth client configuration in Google Cloud Console doesn't match what the app is sending.

## Fix Steps:

### Step 1: Check Authorized JavaScript Origins

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **coke-sales-management-system**
3. Navigate to: **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (the one ending in `.apps.googleusercontent.com`)
5. Click the **pencil icon** (Edit) next to it
6. Check **"Authorized JavaScript origins"**:
   - Make sure `http://localhost:3000` is listed
   - Make sure there's NO trailing slash: `http://localhost:3000/` ❌ (wrong)
   - Should be: `http://localhost:3000` ✅ (correct)
7. Click **SAVE**

### Step 2: Check Authorized Redirect URIs (IMPORTANT!)

In the same OAuth client settings:

1. Check **"Authorized redirect URIs"**:
   - **For gapi.auth2 (Google API JavaScript library)**, you need to add:
     - `http://localhost:3000` (without trailing slash)
     - `http://localhost:3000/` (with trailing slash)
     - `http://localhost:3000/callback` (callback endpoint)
   - **CRITICAL**: Google's gapi.auth2 library uses a special redirect format. You might also need:
     - `http://localhost:3000/oauth2callback`
     - `http://localhost:3000/auth/callback`
   - **Most Important**: The redirect URI that gapi.auth2 uses is typically just your origin. Make sure `http://localhost:3000` is there.
   - **Important**: Make sure there are NO typos, extra spaces, or `https://` instead of `http://`
2. Click **SAVE**

**Note**: If you're still getting redirect URI mismatch, try adding ALL of these:
- `http://localhost:3000`
- `http://localhost:3000/`
- `http://localhost:3000/callback`
- `http://localhost:3000/oauth2callback`
- `http://localhost:3000/auth/callback`

### Step 3: Verify OAuth Consent Screen

1. Go to: **APIs & Services** → **OAuth consent screen**
2. Make sure:
   - **User Type**: External (for testing) or Internal (for Google Workspace)
   - **Scopes** include:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
3. Scroll to **"Test users"** section
4. Make sure your Gmail email is added as a test user
5. Click **SAVE**

### Step 4: Wait for Changes to Propagate

- Google's changes can take a few minutes to propagate
- Wait 2-3 minutes after saving changes
- Clear your browser cache or use incognito mode

### Step 5: Try Again

1. Refresh your app page
2. Clear browser cache (Ctrl+Shift+Delete → Clear cached images and files)
3. Try "Connect Gmail" again

## Common Issues:

### Issue 1: Missing `http://localhost:3000` in Authorized JavaScript Origins
**Fix**: Add `http://localhost:3000` (without trailing slash)

### Issue 2: Using `https://` instead of `http://`
**Fix**: Make sure you're using `http://localhost:3000` (not `https://`)

### Issue 3: Port Number Mismatch
**Fix**: If your app runs on a different port (like 3001), add that port too:
- `http://localhost:3001`

### Issue 4: OAuth Consent Screen Not Configured
**Fix**: Complete the OAuth consent screen setup first before creating OAuth client

## Quick Checklist:

- [ ] Authorized JavaScript origins includes `http://localhost:3000`
- [ ] Authorized redirect URIs includes `http://localhost:3000`
- [ ] OAuth consent screen is configured
- [ ] Gmail API scopes are added to consent screen
- [ ] Your email is added as a test user
- [ ] Changes are saved in Google Cloud Console
- [ ] Waited 2-3 minutes for changes to propagate
- [ ] Cleared browser cache

## Still Not Working?

If it still doesn't work after following these steps:

1. **Double-check the Client ID**: Make sure the Client ID in localStorage matches the one in Google Cloud Console
2. **Check Browser Console**: Look for more detailed error messages
3. **Try Incognito Mode**: This helps rule out browser extension issues
4. **Check if Gmail API is Enabled**: Go to APIs & Services → Library → Search "Gmail API" → Make sure it's enabled

## Alternative: Use EmailJS Instead

If Gmail API setup is too complex, you can continue using EmailJS (which you're already using). Gmail API is only needed for automatic reply monitoring. EmailJS will still work for sending emails, but you'll need to manually approve orders.
