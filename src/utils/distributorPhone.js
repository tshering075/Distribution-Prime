export const DEFAULT_PHONE_COUNTRY = "975";

export const PHONE_COUNTRIES = [
  {
    dial: "975",
    label: "Bhutan (+975)",
    shortLabel: "+975",
    name: "Bhutan",
    localLength: 8,
    placeholder: "17123456",
  },
  {
    dial: "91",
    label: "India (+91)",
    shortLabel: "+91",
    name: "India",
    localLength: 10,
    placeholder: "9876543210",
  },
];

export function getPhoneCountryMeta(dial) {
  return PHONE_COUNTRIES.find((c) => c.dial === String(dial)) || PHONE_COUNTRIES[0];
}

export function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function validateLocalPhone(dial, localNumber) {
  const local = digitsOnly(localNumber);
  if (!local) return { valid: true, message: "" };

  const meta = getPhoneCountryMeta(dial);
  if (local.length !== meta.localLength) {
    return {
      valid: false,
      message: `${meta.name} number must be exactly ${meta.localLength} digits`,
    };
  }

  if (dial === "975" && !/^[1-9]\d{7}$/.test(local)) {
    return { valid: false, message: "Enter a valid 8-digit Bhutan number" };
  }

  if (dial === "91" && !/^[6-9]\d{9}$/.test(local)) {
    return { valid: false, message: "Enter a valid 10-digit Indian mobile number" };
  }

  return { valid: true, message: "" };
}

export function formatPhoneForStorage(dial, localNumber) {
  const local = digitsOnly(localNumber);
  if (!local) return "";
  return `+${dial}${local}`;
}

export function parsePhoneFromStorage(stored) {
  const raw = String(stored ?? "").trim();
  if (!raw) return { dial: DEFAULT_PHONE_COUNTRY, local: "" };

  let digits = digitsOnly(raw);
  if (digits.startsWith("975") && digits.length >= 11) {
    return { dial: "975", local: digits.slice(3, 11) };
  }
  if (digits.startsWith("91") && digits.length >= 12) {
    return { dial: "91", local: digits.slice(2, 12) };
  }
  if (digits.length === 8) return { dial: "975", local: digits };
  if (digits.length === 10) return { dial: "91", local: digits };
  if (digits.startsWith("975")) return { dial: "975", local: digits.slice(3).slice(0, 8) };
  if (digits.startsWith("91")) return { dial: "91", local: digits.slice(2).slice(0, 10) };

  return { dial: DEFAULT_PHONE_COUNTRY, local: digits.slice(0, 8) };
}

export function normalizeBulkPhone(raw) {
  const parsed = parsePhoneFromStorage(raw);
  if (!parsed.local) return "";
  return formatPhoneForStorage(parsed.dial, parsed.local);
}
