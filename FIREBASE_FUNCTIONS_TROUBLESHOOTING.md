# Firebase Functions Setup Troubleshooting

## Error: "Failed to get Firebase project"

If you see this error when running `firebase init functions`:

```
Error: Failed to get Firebase project coke-sales-management-system. 
Please make sure the project exists and your account has permission to access it.
```

### Solution 1: Verify Project Exists

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Check if the project `coke-sales-management-system` exists
3. If it doesn't exist, you have two options:
   - **Option A:** Create a new project with that name
   - **Option B:** Use a different existing project

### Solution 2: Check Your Login

```bash
# Check if you're logged in
firebase login:list

# If not logged in, login
firebase login

# List your projects
firebase projects:list
```

### Solution 3: Use a Different Project

If you want to use a different project:

1. **List available projects:**
   ```bash
   firebase projects:list
   ```

2. **Set the project manually:**
   ```bash
   firebase use your-project-id
   ```

3. **Or add a new project:**
   ```bash
   firebase use --add
   ```
   Then enter your project ID when prompted.

### Solution 4: Create New Project (If Needed)

If you don't have a Firebase project yet:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create a project"**
3. Enter project name: `coke-sales-management-system` (or any name you prefer)
4. Follow the setup wizard
5. After creation, run:
   ```bash
   firebase use --add
   ```
   Select your new project from the list.

### Solution 5: Get Project Access

If the project exists but you don't have access:

1. Contact the project owner
2. Ask them to add you as a collaborator:
   - Firebase Console → Project Settings → Users and permissions
   - Click "Add member"
   - Enter your email and assign a role (Editor or Owner)

### Solution 6: Skip Functions Setup (Temporary)

If you can't set up Functions right now, the app will still work. User deletion will:
- ✅ Delete from Firestore (works immediately)
- ⚠️ Show a warning that Firebase Auth account still exists
- ✅ You can manually delete from Firebase Console → Authentication → Users

You can set up Functions later when you have project access.

## Verify Setup

After fixing the issue, verify:

```bash
# Check current project
firebase use

# Should show: Using project coke-sales-management-system (or your project)

# List projects again
firebase projects:list

# Should show your project
```

## Next Steps

Once you can access the project:

1. Continue with `firebase init functions`
2. Follow the setup guide in `SETUP_DELETE_USER_CLOUD_FUNCTION.md`
3. Deploy the function: `firebase deploy --only functions:deleteUser`
