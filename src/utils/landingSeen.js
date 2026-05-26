/** One-time intro on this browser; distributors/admins who use /login first never see /. */
export const LANDING_SEEN_STORAGE_KEY = "coke_landing_seen";

export function hasLandingBeenSeen() {
  try {
    return localStorage.getItem(LANDING_SEEN_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markLandingSeen() {
  try {
    localStorage.setItem(LANDING_SEEN_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}
