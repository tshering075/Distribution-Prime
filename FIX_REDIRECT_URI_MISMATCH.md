# Fix: Redirect URI Mismatch Error

## Error: "redirect_uri_mismatch" or "URL redirect mismatch"

This error means the redirect URI in your OAuth request doesn't match what's configured in Google Cloud Console.

## Quick Fix (Step-by-Step):

### Step 1: Open Google Cloud Console

1. Go to: https://console.cloud.google.com/
2. Select your project: **coke-sales-management-system**
3. Navigate to: **APIs & Services** → **Credentials**

### Step 2: Edit Your OAuth Client

1. Find your OAuth 2.0 Client ID (the one ending in `.apps.googleusercontent.com`)
2. Click the **pencil icon** (Edit) or click on the Client ID name

### Step 3: Add ALL These Redirect URIs

In the **"Authorized redirect URIs"** section, click **"+ ADD URI"** and add each of these (one by one):

**IMPORTANT**: Based on your error message, your app uses `/admin` route, so add:
```
http://localhost:3000/admin
http://localhost:3000/admin/
```

**Also add these common ones:**
```
http://localhost:3000
http://localhost:3000/
http://localhost:3000/callback
http://localhost:3000/oauth2callback
http://localhost:3000/auth/callback
```

**Important Notes:**
- Use `http://` (NOT `https://`) for localhost
- No trailing spaces
- If your app runs on a different port (like 3001), add those too

### Step 4: Verify Authorized JavaScript Origins

In the same edit screen, check **"Authorized JavaScript origins"**:

Make sure this is listed:
```
http://localhost:3000
```

(Again, `http://` not `https://`, and no trailing slash)

### Step 5: Save and Wait

1. Click **SAVE** at the bottom
2. **Wait 2-3 minutes** for Google's changes to propagate
3. Clear your browser cache (Ctrl+Shift+Delete → Clear cached images and files)

### Step 6: Try Again

1. Refresh your app page (F5)
2. Try "Connect Gmail" again

## If Still Not Working:

### Check Your App's Port

If your React app runs on a different port (check the terminal where you run `npm start`):

1. Look for: `Local: http://localhost:XXXX`
2. Replace `3000` with your actual port number in all the URIs above
3. For example, if it's port 3001:
   - `http://localhost:3001`
   - `http://localhost:3001/`
   - etc.

### Check for Typos

Common mistakes:
- ❌ `https://localhost:3000` (should be `http://`)
- ❌ `http://localhost:3000 ` (trailing space)
- ❌ `http://localhost:3000/ ` (trailing space after slash)
- ❌ `http://localhost:3000/callback/` (extra trailing slash)

### Alternative: Check What Redirect URI is Being Used

1. Open browser console (F12)
2. Look for the error message - it might show the exact redirect URI being used
3. Copy that exact URI and add it to Google Cloud Console

## Example Screenshot Guide:

**Authorized JavaScript origins should look like:**
```
http://localhost:3000
```

**Authorized redirect URIs should look like:**
```
http://localhost:3000
http://localhost:3000/
http://localhost:3000/callback
http://localhost:3000/oauth2callback
http://localhost:3000/auth/callback
```

## Still Having Issues?

If you've added all the URIs above and it still doesn't work:

1. **Double-check the exact error message** in the browser console - it might tell you the exact redirect URI that's being used
2. **Try in an incognito/private window** to rule out browser cache issues
3. **Check if your app is actually running on port 3000** - look at your terminal/command prompt where you started the app
