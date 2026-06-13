import { STATUS_LABELS } from "../services/platformAdminService";

export const SORT_OPTIONS = [
  { id: "created_desc", label: "Newest first" },
  { id: "created_asc", label: "Oldest first" },
  { id: "name_asc", label: "Name A–Z" },
];

export function formatPlatformDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function statusChipColor(status) {
  if (status === "active") return "success";
  if (status === "suspended") return "error";
  return "warning";
}

export function sortOrgs(rows, sortId) {
  const list = [...rows];
  switch (sortId) {
    case "created_asc":
      return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    case "name_asc":
      return list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    default:
      return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export function filterPlatformOrgs(orgs, { search, statusFilter, sortId }) {
  let list = orgs;
  if (statusFilter !== "all") {
    list = list.filter((o) => o.status === statusFilter);
  }
  const q = String(search || "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (o) =>
        String(o.name || "").toLowerCase().includes(q) ||
        String(o.slug || "").toLowerCase().includes(q) ||
        String(o.id || "").toLowerCase().includes(q)
    );
  }
  return sortOrgs(list, sortId);
}

export function computePlatformStats(orgs) {
  const total = orgs.length;
  const active = orgs.filter((o) => o.status === "active").length;
  const suspended = orgs.filter((o) => o.status === "suspended").length;
  return { total, active, suspended };
}

export function orgNeedsAttention(org) {
  return org.status === "suspended" || (org.admin_count || 0) === 0;
}

export { STATUS_LABELS };
