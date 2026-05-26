# Supabase Email Confirmation Guide

## Problem
When trying to log in, you may see the error: **"Email not confirmed"** or **"AuthApiError: Email not confirmed"**.

This happens because Supabase requires users to confirm their email address before they can sign in.

## Solution: Disable Email Confirmation (Recommended for Internal Apps)

For internal applications where you trust your users, you can disable email confirmation:

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Authentication Settings**
   - Click on **"Authentication"** in the left sidebar
   - Click on **"Settings"** (or the gear icon)

3. **Disable Email Confirmation**
   - Scroll down to **"Email Auth"** section
   - Find **"Enable email confirmations"** toggle
   - **Turn it OFF** (disable it)

4. **Save Changes**
   - Click **"Save"** or the changes will auto-save

5. **For Existing Users**
   - If you have existing users who haven't confirmed their email:
     - Go to **Authentication** → **Users**
     - Find the user
     - Click on the user
     - Click **"Confirm email"** button (or manually set `email_confirmed_at` to current timestamp)

## Alternative: Confirm Email Manually

If you prefer to keep email confirmation enabled but want to manually confirm users:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open Users List**
   - Click on **"Authentication"** → **"Users"**

3. **Find and Confirm User**
   - Find the user by email
   - Click on the user to open details
   - Click **"Confirm email"** button
   - Or manually set `email_confirmed_at` field to current timestamp

## Alternative: Resend Confirmation Email

If you want users to confirm via email:

1. **In Supabase Dashboard**
   - Go to **Authentication** → **Users**
   - Find the user
   - Click **"Resend confirmation email"**

2. **Or via Code** (if you want to add this feature):
   ```javascript
   await supabase.auth.resend({
     type: 'signup',
     email: 'user@example.com'
   });
   ```

## Recommended Approach

For internal business applications like this Coke Calculator:
- **Disable email confirmation** - This is the simplest and most user-friendly approach
- Users can log in immediately after account creation
- No need to check emails or manually confirm users

## After Disabling Email Confirmation

1. **Existing unconfirmed users** will still need to be confirmed manually (one time)
2. **New users** created after disabling will automatically be confirmed
3. **Login will work immediately** for all users

## Need Help?

If you still see "Email not confirmed" errors after disabling:
1. Check that you saved the settings in Supabase Dashboard
2. Manually confirm existing users (see "For Existing Users" above)
3. Try logging in again
