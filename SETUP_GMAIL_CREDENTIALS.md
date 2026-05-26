# Quick Setup: Gmail API Credentials

## Step 1: Open Browser Console

1. Open your app in the browser
2. Press **F12** (or right-click → Inspect)
3. Click on the **Console** tab

## Step 2: Set Gmail Credentials

Copy and paste these commands into the console (one at a time, press Enter after each):

```javascript
localStorage.setItem('gmail_client_id', '57321801927-8qukhctsm78n0fv48idi0cdgq2aft91e.apps.googleusercontent.com');
```

```javascript
localStorage.setItem('gmail_api_key', 'AIzaSyCMXL_gYeaTVWyi0isqiD8brO8Y9sGNaKM');
```

## Step 3: Verify Setup

Run this command to verify the credentials are set:

```javascript
console.log('Client ID:', localStorage.getItem('gmail_client_id'));
console.log('API Key:', localStorage.getItem('gmail_api_key'));
```

You should see both values printed in the console.

## Step 4: Test Connection

1. Go to **Admin Dashboard** > **Orders**
2. Click **"Send Email"** on any order
3. In the email dialog, you should see the **"Gmail Connection"** section
4. Click **"Connect Gmail"** button
5. A Google sign-in popup should appear

## Alternative: Set via Code (Permanent)

If you want to set these permanently in your code, you can add them to your app initialization. However, **this is not recommended for production** as it exposes your API keys in the code.

For now, using localStorage via the console is the quickest way to test.

## Troubleshooting

- **"Gmail API not configured"** → Make sure you ran both `localStorage.setItem` commands
- **"Client ID not configured"** → Check that the client ID was set correctly
- **"API Key not configured"** → Check that the API key was set correctly
- **Credentials disappear after refresh** → This is normal for localStorage. You'll need to set them again, or we can add code to persist them.

## Next Steps

After setting the credentials:
1. Refresh the page
2. Try connecting Gmail again
3. The Google OAuth popup should appear
