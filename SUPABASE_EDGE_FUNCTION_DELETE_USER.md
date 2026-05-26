# Supabase Edge Function for Deleting Users

This guide explains how to set up a Supabase Edge Function to delete users from Supabase Auth when they are deleted from the app.

## Why is this needed?

Supabase Auth doesn't allow client-side deletion of users for security reasons. To fully delete a user from Supabase Auth, you need to use the Admin API, which requires a server-side function (Edge Function).

## Setup Instructions

### 1. Install Supabase CLI

**⚠️ Important:** Supabase CLI cannot be installed globally via `npm install -g`. Use one of these methods instead:

#### Option A: Using Scoop (Recommended for Windows)

1. Install Scoop if you don't have it:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. Install Supabase CLI:
   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

#### Option B: Using Chocolatey

```powershell
choco install supabase
```

#### Option C: Using npx (No Installation Required)

You can use Supabase CLI without installing it globally by using `npx`:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref your-project-ref
npx supabase@latest functions deploy delete-user
```

#### Option D: Download Binary Directly

1. Go to [Supabase CLI Releases](https://github.com/supabase/cli/releases)
2. Download the Windows binary (`supabase_windows_amd64.zip`)
3. Extract and add to your PATH

**For this guide, we'll use Option C (npx) as it requires no installation.**

### 2. Login to Supabase

**If using npx (Option C):**
```bash
npx supabase@latest login
```

**If using installed CLI (Options A, B, or D):**
```bash
supabase login
```

### 3. Link your project

**If using npx:**
```bash
npx supabase@latest link --project-ref your-project-ref
```

**If using installed CLI:**
```bash
supabase link --project-ref your-project-ref
```

You can find your project ref in:
- Supabase Dashboard → Project Settings → General → Reference ID

You can find your project ref in the Supabase Dashboard → Project Settings → API.

### 4. Create the Edge Function

**If using npx:**
```bash
npx supabase@latest functions new delete-user
```

**If using installed CLI:**
```bash
supabase functions new delete-user
```

### 5. Add the function code

Edit `supabase/functions/delete-user/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the user ID from the request body
    const { userId } = await req.json()

    if (!userId) {
      throw new Error('User ID is required')
    }

    // Delete the user from Supabase Auth using Admin API
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted from Supabase Auth successfully',
        data 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
```

### 6. Deploy the function

**If using npx:**
```bash
npx supabase@latest functions deploy delete-user
```

**If using installed CLI:**
```bash
supabase functions deploy delete-user
```

### 7. Set environment variables (if needed)

The function will automatically use the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your project. These are available by default in Edge Functions.

## Testing the Function

You can test the function using curl:

```bash
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/delete-user' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"userId": "USER_ID_TO_DELETE"}'
```

## How it works in the app

When you delete a user in the app:

1. The app calls `deleteUserFromAuth(userId)` which invokes the Edge Function
2. The Edge Function uses the Admin API to delete the user from Supabase Auth
3. The app then calls `deleteUserDocument(userId)` to delete the user from the database tables
4. The user is fully removed from both Auth and the database

## Alternative: Manual deletion

If you don't want to set up the Edge Function, you can manually delete users from Supabase Dashboard:

1. Go to Supabase Dashboard → Authentication → Users
2. Find the user and click "Delete"

The app will still delete the user from the database tables, but the Auth account will remain until manually deleted.

## Security Note

The Edge Function uses the service role key, which has admin privileges. Make sure:
- The function is properly secured (only callable by authenticated users with proper permissions)
- The service role key is never exposed in client-side code
- You have proper RLS policies in place
