import {
  readTenantJson,
  writeTenantJson,
} from "../utils/tenantLocalStorage";

/** Transporter / vehicle ownership options for shipping dispatch. */
export const SHIPPING_TRANSPORTER_OPTIONS = [
  "Company vehicle",
  "Distributor Vehicle",
  "Private vehicle",
  "Hired vehicle",
];

/** Built-in vehicle body types (users can add more per workspace). */
export const SHIPPING_VEHICLE_TYPE_OPTIONS = ["Jumbo", "DCM"];

export const SHIPPING_CUSTOM_VEHICLE_TYPES_KEY = "shipping_custom_vehicle_types";

/** Bhutan plate types: BP private, BT taxi, BG government, BHT heavy/commercial. */
const BHUTAN_PLATE_PREFIXES = ["BP", "BT", "BG", "BHT"];

function parseTransportAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Strip to alphanumeric uppercase for validation. */
export function compactBhutanVehicleNo(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Bhutan format: TYPE-REGION-[LETTER]NUMBER e.g. BP-1-A1234
 * REGION: 1 Western, 2 Central, 3 Southern, 4 Eastern
 */
export function isValidBhutanVehicleNo(raw) {
  const compact = compactBhutanVehicleNo(raw);
  if (!compact) return false;

  const withLetter = new RegExp(
    `^(${BHUTAN_PLATE_PREFIXES.join("|")})([1-4])([A-Z])(\\d{4})$`
  );
  const legacyNoLetter = new RegExp(
    `^(${BHUTAN_PLATE_PREFIXES.join("|")})([1-4])(\\d{4})$`
  );

  return withLetter.test(compact) || legacyNoLetter.test(compact);
}

/** Format compact or messy input to BP-1-A1234 style for display/storage. */
export function formatBhutanVehicleNo(raw) {
  const compact = compactBhutanVehicleNo(raw);
  if (!compact) return "";

  let m = compact.match(
    new RegExp(`^(${BHUTAN_PLATE_PREFIXES.join("|")})([1-4])([A-Z])(\\d{1,4})$`)
  );
  if (m) {
    const num = m[4].padStart(4, "0");
    return `${m[1]}-${m[2]}-${m[3]}${num}`;
  }

  m = compact.match(
    new RegExp(`^(${BHUTAN_PLATE_PREFIXES.join("|")})([1-4])(\\d{4})$`)
  );
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  return String(raw ?? "").trim().toUpperCase();
}

export function readCustomVehicleTypes(organizationId) {
  try {
    const list = readTenantJson(SHIPPING_CUSTOM_VEHICLE_TYPES_KEY, organizationId);
    if (!Array.isArray(list)) return [];
    return list
      .map((t) => String(t || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function writeCustomVehicleTypes(types, organizationId) {
  try {
    const unique = [];
    const seen = new Set();
    for (const raw of types || []) {
      const t = String(raw || "").trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
    }
    writeTenantJson(SHIPPING_CUSTOM_VEHICLE_TYPES_KEY, unique, organizationId);
    return unique;
  } catch {
    return [];
  }
}

export function buildVehicleTypeOptions(customTypes = []) {
  const merged = [...SHIPPING_VEHICLE_TYPE_OPTIONS];
  const seen = new Set(merged.map((t) => t.toLowerCase()));
  const custom = [];
  for (const t of customTypes) {
    const label = String(t || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    custom.push(label);
  }
  custom.sort((a, b) => a.localeCompare(b));
  return [...merged, ...custom];
}

export function getOrderTransport(order) {
  if (!order) {
    return {
      transporterVehicle: "",
      vehicleType: "",
      vehicleNo: "",
      transportationCharges: "",
    };
  }
  const charges = order.transportationCharges ?? order.transportation_charges;
  const vehicleNo = formatBhutanVehicleNo(
    order.vehicleNo ?? order.vehicle_no ?? ""
  );
  return {
    transporterVehicle: String(
      order.transporterVehicle ?? order.transporter_vehicle ?? ""
    ).trim(),
    vehicleType: String(order.vehicleType ?? order.vehicle_type ?? "").trim(),
    vehicleNo,
    transportationCharges:
      charges === "" || charges == null ? "" : String(parseTransportAmount(charges)),
  };
}

export function buildTransportPatch(transport) {
  const transporterVehicle = String(transport?.transporterVehicle ?? "").trim();
  const vehicleType = String(transport?.vehicleType ?? "").trim();
  const vehicleNo = formatBhutanVehicleNo(transport?.vehicleNo);
  const transportationCharges = parseTransportAmount(transport?.transportationCharges);
  return {
    transporterVehicle,
    transporter_vehicle: transporterVehicle,
    vehicleType,
    vehicle_type: vehicleType,
    vehicleNo,
    vehicle_no: vehicleNo,
    transportationCharges,
    transportation_charges: transportationCharges,
  };
}

export function isOrderTransportComplete(order) {
  const { transporterVehicle, vehicleType, vehicleNo } = getOrderTransport(order);
  return Boolean(
    transporterVehicle &&
      vehicleType &&
      vehicleNo &&
      isValidBhutanVehicleNo(vehicleNo)
  );
}

export function transportValidationMessage(order) {
  const { transporterVehicle, vehicleType, vehicleNo } = getOrderTransport(order);
  const missing = [];
  if (!transporterVehicle) missing.push("transporter vehicle");
  if (!vehicleType) missing.push("vehicle type");
  if (!vehicleNo) missing.push("vehicle number");
  if (missing.length > 0) {
    return `Enter ${missing.join(", ")} below the calculated table before marking dispatched.`;
  }
  if (!isValidBhutanVehicleNo(vehicleNo)) {
    return "Enter a valid Bhutan vehicle number (e.g. BP-1-A1234).";
  }
  return "";
}

export function vehicleNoHelperText(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return "Bhutan format · e.g. BP-1-A1234 (region 1–4)";
  }
  if (!isValidBhutanVehicleNo(value)) {
    return "Use Bhutan plate format: BP/BT/BG/BHT · region 1–4 · letter · 4 digits";
  }
  return `Formatted: ${formatBhutanVehicleNo(value)}`;
}
