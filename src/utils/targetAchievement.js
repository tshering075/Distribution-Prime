/**
 * Combined UC target (CSD + Kinley water), policy:
 * - Achieved when both CSD UC and water UC meet their targets, OR
 * - CSD UC meets/exceeds its target and water UC does not, but CSD surplus UC
 *   (achieved − target) covers the water UC shortfall (target − achieved).
 * - Water surplus never offsets CSD shortfall.
 */
export function isCombinedTargetAchievedUC(csdTargetUC, csdAchievedUC, waterTargetUC, waterAchievedUC) {
  const Tc = Math.max(0, Number(csdTargetUC) || 0);
  const Ac = Math.max(0, Number(csdAchievedUC) || 0);
  const Tw = Math.max(0, Number(waterTargetUC) || 0);
  const Aw = Math.max(0, Number(waterAchievedUC) || 0);

  if (Tc === 0 && Tw === 0) return true;

  const csdMet = Ac >= Tc;
  const waterMet = Aw >= Tw;
  if (csdMet && waterMet) return true;
  if (!csdMet) return false;
  if (waterMet) return true;
  const waterGap = Tw - Aw;
  const csdSurplus = Ac - Tc;
  return csdSurplus >= waterGap;
}
