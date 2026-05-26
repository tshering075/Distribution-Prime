# Environment Variables Setup Guide

## 📝 What to Put in `.env` File

Create a `.env` file in the root of your project (same directory as `package.json`) with the following:

```env
REACT_APP_SUPABASE_URL=your-project-url-here
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

## 🔍 Where to Find These Values

### Step 1: Go to Supabase Dashboard
1. Visit [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your project (or create a new one)

### Step 2: Get Your Project URL
1. Go to **Project Settings** (gear icon in left sidebar)
2. Click on **API** in the settings menu
3. Find **Project URL** - it looks like: `https://xxxxx.supabase.co`
4. Copy this entire URL

### Step 3: Get Your Anon Key
1. In the same **API** settings page
2. Find **Project API keys** section
3. Look for the **`anon` `public`** key (NOT the `service_role` key)
4. Click the eye icon to reveal it, then copy it
5. It's a long string that starts with `eyJ...`

## 📄 Example `.env` File

```env
REACT_APP_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ⚠️ Important Notes

1. **Never commit `.env` to Git**
   - The `.env` file should already be in `.gitignore`
   - Never share your keys publicly

2. **Use the `anon` key, NOT `service_role`**
   - The `anon` key is safe for client-side use
   - The `service_role` key has admin access and should NEVER be used in frontend code

3. **Restart your dev server**
   - After creating/updating `.env`, restart your React app:
   ```bash
   npm start
   ```

4. **Environment variable naming**
   - React requires `REACT_APP_` prefix for environment variables
   - Without this prefix, the variables won't be accessible in your app

## 🔒 Security Best Practices

- ✅ Keep `.env` file local only
- ✅ Use `.env.example` (without real values) for sharing
- ✅ Use `anon` key for client-side
- ✅ Never commit `.env` to version control
- ✅ Rotate keys if accidentally exposed

## 🧪 Verify Setup

After adding the `.env` file, you can verify it's working by:

1. Check the browser console - you should see:
   ```
   ✅ Supabase initialized successfully
   ```

2. If you see:
   ```
   ⚠️ Supabase configuration missing...
   ```
   Then the environment variables are not being read correctly.

## 📝 Quick Checklist

- [ ] Created `.env` file in project root
- [ ] Added `REACT_APP_SUPABASE_URL` with your project URL
- [ ] Added `REACT_APP_SUPABASE_ANON_KEY` with your anon key
- [ ] Restarted the development server
- [ ] Verified Supabase initializes in console

## 🆘 Troubleshooting

### Variables not loading?
- Make sure file is named exactly `.env` (not `.env.txt` or `.env.local`)
- Make sure it's in the root directory (same level as `package.json`)
- Restart your dev server after creating/editing `.env`

### Still seeing "Supabase not initialized"?
- Check that values don't have extra spaces or quotes
- Verify the URL format: `https://xxxxx.supabase.co`
- Verify the key starts with `eyJ...`

### Need to use different values for production?
- Create `.env.production` for production builds
- Or set environment variables in your hosting platform (Vercel, Netlify, etc.)
