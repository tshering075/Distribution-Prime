# QUICK FIX: Redirect URI Mismatch

## Your Error Message Shows:
```
redirect_uri=http://localhost:3000/admin
```

This means your app is using the `/admin` route, so you need to add this specific redirect URI.

## Quick Fix (2 Minutes):

### Step 1: Go to Google Cloud Console
1. https://console.cloud.google.com/
2. Project: **coke-sales-management-system**
3. **APIs & Services** → **Credentials**

### Step 2: Edit OAuth Client
1. Click your OAuth 2.0 Client ID (the one you're using)
2. Click **Edit** (pencil icon)

### Step 3: Add These Redirect URIs
In **"Authorized redirect URIs"**, click **"+ ADD URI"** and add:

```
http://localhost:3000/admin
http://localhost:3000/admin/
http://localhost:3000
http://localhost:3000/
```

### Step 4: Save and Wait
1. Click **SAVE**
2. Wait 2-3 minutes
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try "Connect Gmail" again

## That's It!

The key is adding `http://localhost:3000/admin` because that's the exact redirect URI your app is using.
