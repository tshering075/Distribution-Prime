const STORAGE_PREFIX = "login_remember_v1_";

function storageKey(workspaceSlug) {
  const slug = String(workspaceSlug || "default").trim().toLowerCase() || "default";
  return `${STORAGE_PREFIX}${slug}`;
}

/** @returns {{ userId: string, password: string, rememberMe: boolean } | null} */
export function readRememberedLogin(workspaceSlug) {
  try {
    const raw = localStorage.getItem(storageKey(workspaceSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.rememberMe) return null;
    return {
      userId: String(parsed.userId || ""),
      password: String(parsed.password || ""),
      rememberMe: true,
    };
  } catch {
    return null;
  }
}

export function writeRememberedLogin(workspaceSlug, { userId, password, rememberMe }) {
  const key = storageKey(workspaceSlug);
  if (!rememberMe) {
    localStorage.removeItem(key);
    return;
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        userId: String(userId || ""),
        password: String(password || ""),
        rememberMe: true,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearRememberedLogin(workspaceSlug) {
  try {
    localStorage.removeItem(storageKey(workspaceSlug));
  } catch {
    /* ignore */
  }
}
