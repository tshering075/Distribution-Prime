/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize Firebase Admin
admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

/**
 * Cloud Function to delete a user from Firebase Authentication
 * This is a callable function that requires the caller to be authenticated
 * and have admin permissions
 */
exports.deleteUser = onCall(async (request) => {
  // Verify the user is authenticated
  if (!request.auth) {
    throw new Error(
        "unauthenticated: User must be authenticated to delete users");
  }

  // Verify the user has admin permissions
  // Check if the user is an admin in Firestore
  const adminDoc = await admin.firestore()
      .collection("admins")
      .doc(request.auth.uid)
      .get();

  if (!adminDoc.exists) {
    throw new Error("permission-denied: Only admins can delete users");
  }

  const adminData = adminDoc.data();
  if (!adminData.permissions?.manageUsers) {
    throw new Error(
        "permission-denied: User does not have permission to manage users");
  }

  // Get the UID of the user to delete
  const uidToDelete = request.data.uid;
  if (!uidToDelete) {
    throw new Error("invalid-argument: UID is required");
  }

  // Prevent self-deletion
  if (uidToDelete === request.auth.uid) {
    throw new Error("invalid-argument: Cannot delete your own account");
  }

  try {
    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(uidToDelete);

    logger.info(
        `User ${uidToDelete} deleted successfully from Firebase Auth`,
        {
          deletedBy: request.auth.uid,
          deletedUser: uidToDelete,
        });

    return {
      success: true,
      message: `User ${uidToDelete} deleted successfully from Firebase Auth`,
    };
  } catch (error) {
    logger.error("Error deleting user:", error);
    throw new Error(`internal: Failed to delete user: ${error.message}`);
  }
});

/**
 * Cloud Function to list all users from Firebase Authentication
 * This is a callable function that requires the caller to be authenticated
 * and have admin permissions
 */
exports.listUsers = onCall(async (request) => {
  // Verify the user is authenticated
  if (!request.auth) {
    throw new Error(
        "unauthenticated: User must be authenticated to list users");
  }

  // Verify the user has admin permissions
  // Check if the user is an admin in Firestore
  const adminDoc = await admin.firestore()
      .collection("admins")
      .doc(request.auth.uid)
      .get();

  if (!adminDoc.exists) {
    throw new Error("permission-denied: Only admins can list users");
  }

  const adminData = adminDoc.data();
  if (!adminData.permissions?.manageUsers) {
    throw new Error(
        "permission-denied: User does not have permission to manage users");
  }

  try {
    // List all users from Firebase Authentication
    const listUsersResult = await admin.auth().listUsers();
    const authUsers = listUsersResult.users.map((userRecord) => ({
      uid: userRecord.uid,
      email: userRecord.email || "",
      emailVerified: userRecord.emailVerified || false,
      displayName: userRecord.displayName || "",
      photoURL: userRecord.photoURL || null,
      disabled: userRecord.disabled || false,
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
      },
      providerData: userRecord.providerData,
    }));

    logger.info(`Listed ${authUsers.length} users from Firebase Auth`, {
      requestedBy: request.auth.uid,
      userCount: authUsers.length,
    });

    return {
      success: true,
      users: authUsers,
      count: authUsers.length,
    };
  } catch (error) {
    logger.error("Error listing users:", error);
    throw new Error(`internal: Failed to list users: ${error.message}`);
  }
});
