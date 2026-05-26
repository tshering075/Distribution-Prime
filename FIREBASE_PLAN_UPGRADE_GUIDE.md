# Firebase Blaze Plan Upgrade Guide

## Why You Need Blaze Plan

Cloud Functions require the **Blaze (pay-as-you-go) plan** because they use:
- Cloud Build API
- Artifact Registry API
- Cloud Functions API

These APIs are only available on the paid plan.

## Good News: Blaze Plan Has a Generous Free Tier! 🎉

The Blaze plan includes a **free tier** that covers most small-to-medium applications:

### Free Tier Limits (per month):
- ✅ **2 million function invocations** (free)
- ✅ **400,000 GB-seconds** of compute time (free)
- ✅ **200,000 CPU-seconds** (free)
- ✅ **5 GB** of egress traffic (free)

### What This Means:
- For a typical app with moderate usage, you'll likely **stay within the free tier**
- You only pay if you exceed these limits
- Most small apps never exceed the free tier

### Example Costs (if you exceed free tier):
- Function invocations: $0.40 per million (after free tier)
- Compute time: $0.0000025 per GB-second (after free tier)
- Network egress: $0.12 per GB (after free tier)

**For most apps, the cost is $0/month** because you stay within the free tier!

## How to Upgrade

1. **Click the upgrade link** from the error message:
   ```
   https://console.firebase.google.com/project/coke-sales-management-system/usage/details
   ```

2. **Or manually:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `coke-sales-management-system`
   - Click on **"Usage and billing"** in the left sidebar
   - Click **"Modify plan"** or **"Upgrade"**
   - Select **Blaze plan**
   - Add a payment method (credit card required, but you won't be charged unless you exceed free tier)

3. **After upgrading:**
   - Wait a few minutes for the upgrade to complete
   - Then run: `firebase deploy --only functions:deleteUser`

## Alternative: Skip Cloud Function (Temporary)

If you don't want to upgrade right now, the app will still work:

✅ **What works:**
- User deletion from Firestore (works immediately)
- All other app features work normally

⚠️ **What doesn't work:**
- Automatic deletion from Firebase Authentication
- You'll need to manually delete users from Firebase Console → Authentication → Users

**You can always upgrade later** and deploy the function then.

## Recommendation

For a production app, I recommend upgrading to Blaze because:
1. It's essentially free for most apps (stays within free tier)
2. Enables Cloud Functions and other advanced features
3. Gives you more flexibility for future features
4. Required for many Firebase features (Cloud Functions, Cloud Storage, etc.)

## After Upgrading

Once upgraded, deploy the function:

```bash
firebase deploy --only functions:deleteUser
```

The function will then automatically delete users from both Firestore and Firebase Authentication when you delete them from the app.
