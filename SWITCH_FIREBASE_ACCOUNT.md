# Switch Firebase Account

## Steps to Login with Correct Account

1. **You're already logged out** ✅

2. **Login with your correct account:**
   ```bash
   firebase login
   ```
   This will open a browser window for you to authenticate with the correct Google account.

3. **Verify you're logged in:**
   ```bash
   firebase login:list
   ```
   Should show your correct email address.

4. **Check your projects:**
   ```bash
   firebase projects:list
   ```
   Should now show your projects including `coke-sales-management-system` (if you have access).

5. **If the project appears, continue with Functions setup:**
   ```bash
   firebase init functions
   ```
   Select "Use an existing project" and choose `coke-sales-management-system`.

## If Project Still Doesn't Appear

If `coke-sales-management-system` still doesn't appear in the list:

1. **Check Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Make sure you're logged in with the correct account
   - Check if the project `coke-sales-management-system` exists

2. **If project exists but not in list:**
   - You may need to be added as a collaborator
   - Or the project might be under a different account

3. **If project doesn't exist:**
   - Create a new project with that name
   - Or use a different existing project

## After Login

Once you're logged in with the correct account and can see your project:

1. Continue with the setup in `SETUP_DELETE_USER_CLOUD_FUNCTION.md`
2. Run `firebase init functions`
3. Deploy the function when ready
