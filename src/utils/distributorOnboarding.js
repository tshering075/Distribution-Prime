const HOME_TIP_KEY = "distributor_home_tip_dismissed_v1";

function storageKey(distributorCode) {
  return `${HOME_TIP_KEY}_${String(distributorCode || "default").trim()}`;
}

export function isDistributorHomeTipDismissed(distributorCode) {
  try {
    return localStorage.getItem(storageKey(distributorCode)) === "1";
  } catch {
    return false;
  }
}

export function dismissDistributorHomeTip(distributorCode) {
  try {
    localStorage.setItem(storageKey(distributorCode), "1");
  } catch {
    /* ignore */
  }
}
