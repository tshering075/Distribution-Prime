import { getDistributors, saveDistributors } from "../utils/distributorAuth";

/**
 * updatesById: { docIdOrCode: { CSD_PC, CSD_UC, Water_PC, Water_UC }, ... }
 * Updates targets in localStorage-backed distributors list
 */
export async function updateTargetsBatch(updatesById) {
  const list = getDistributors();
  const updated = list.map(d => {
    const key = d.code || d.id;
    if (updatesById[key]) {
      const t = updatesById[key];
      return {
        ...d,
        target: {
          CSD_PC: Number(t.CSD_PC || 0),
          CSD_UC: Number(t.CSD_UC || 0),
          Water_PC: Number(t.Water_PC || 0),
          Water_UC: Number(t.Water_UC || 0),
        },
        targetUpdatedAt: new Date().toISOString(),
      };
    }
    return d;
  });
  saveDistributors(updated);
  return true;
}