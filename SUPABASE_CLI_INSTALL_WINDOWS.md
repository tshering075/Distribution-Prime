# Installing Supabase CLI on Windows

## ❌ Why `npm install -g supabase` Doesn't Work

Supabase CLI **does not support** global npm installation. If you try `npm install -g supabase`, you'll get this error:

```
Installing Supabase CLI as a global module is not supported.
Please use one of the supported package managers
```

## ✅ Correct Installation Methods for Windows

### Method 1: Using Scoop (Recommended)

Scoop is a command-line installer for Windows.

#### Step 1: Install Scoop

Open PowerShell and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

#### Step 2: Install Supabase CLI

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Step 3: Verify Installation

```powershell
supabase --version
```

---

### Method 2: Using Chocolatey

If you have Chocolatey installed:

```powershell
choco install supabase
```

---

### Method 3: Using npx (No Installation Required) ⭐ Easiest

You can use Supabase CLI **without installing it** by using `npx`:

```bash
# Login
npx supabase@latest login

# Link project
npx supabase@latest link --project-ref your-project-ref

# Deploy functions
npx supabase@latest functions deploy delete-user
```

**Advantages:**
- ✅ No installation needed
- ✅ Always uses the latest version
- ✅ Works immediately

**Disadvantages:**
- ⚠️ Slightly slower (downloads on first use)
- ⚠️ Need to type `npx supabase@latest` each time

---

### Method 4: Download Binary Directly

1. Go to [Supabase CLI Releases](https://github.com/supabase/cli/releases)
2. Download `supabase_windows_amd64.zip` (or `supabase_windows_arm64.zip` for ARM)
3. Extract the ZIP file
4. Add the extracted folder to your Windows PATH:
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Edit "Path" → Add the folder containing `supabase.exe`

---

## 🎯 Quick Start (Using npx - Recommended for Quick Setup)

If you just want to get started quickly without installing anything:

```bash
# 1. Login to Supabase
npx supabase@latest login

# 2. Link your project (get project-ref from Supabase Dashboard)
npx supabase@latest link --project-ref xxxxxxxxxxxxxx

# 3. Create Edge Function
npx supabase@latest functions new delete-user

# 4. Edit the function code (see SUPABASE_EDGE_FUNCTION_DELETE_USER.md)

# 5. Deploy
npx supabase@latest functions deploy delete-user
```

---

## 🔍 Finding Your Project Ref

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Project Settings** → **General**
4. Find **Reference ID** - this is your project ref

---

## ❓ Troubleshooting

### "Command not found" after installation

- Make sure the installation directory is in your PATH
- Restart your terminal/PowerShell after installation
- For Scoop/Chocolatey, restart your terminal

### Permission errors

- Run PowerShell/Command Prompt as Administrator
- Check if antivirus is blocking the installation

### Still having issues?

Use **Method 3 (npx)** - it works without any installation and is the easiest option!
