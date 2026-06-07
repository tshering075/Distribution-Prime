const KEY_PREFIX = "workspace_onboarding_done_";

export function isOnboardingDone(organizationId) {
  if (!organizationId) return true;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${organizationId}`) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingDone(organizationId) {
  if (!organizationId) return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${organizationId}`, "true");
  } catch {
    /* ignore */
  }
}

export function clearOnboardingDone(organizationId) {
  if (!organizationId) return;
  try {
    localStorage.removeItem(`${KEY_PREFIX}${organizationId}`);
  } catch {
    /* ignore */
  }
}
