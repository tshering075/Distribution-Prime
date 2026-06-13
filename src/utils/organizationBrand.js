import {
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_MARK_SRC,
  BRAND_PRIMARY,
  COMPANY_NAME,
} from '../constants/brand';

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Parse #rgb or #rrggbb to { r, g, b } or null */
export function parseHexColor(hex) {
  const raw = String(hex || '').trim();
  const m3 = /^#?([0-9a-f]{3})$/i.exec(raw);
  if (m3) {
    const [r, g, b] = m3[1].split('').map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  const m6 = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (m6) {
    const n = m6[1];
    return {
      r: parseInt(n.slice(0, 2), 16),
      g: parseInt(n.slice(2, 4), 16),
      b: parseInt(n.slice(4, 6), 16),
    };
  }
  return null;
}

export function isValidHexColor(hex) {
  return parseHexColor(hex) != null;
}

const LEGACY_MARK_ALIASES = {
  '/dms-icon.svg': '/distribution-prime-icon.svg',
  '/dms-icon-512.png': '/distribution-prime-icon-512.png',
  '/dms-icon-192.png': '/distribution-prime-icon-192.png',
  '/bevflow-icon.svg': '/distribution-prime-icon.svg',
  '/bevflow-icon-512.png': '/distribution-prime-icon-512.png',
  '/bevflow-icon-192.png': '/distribution-prime-icon-192.png',
  '/oauth-app-logo.png': '/distribution-prime-icon-512.png',
};

/** Map saved workspace logo paths to current Distribution Prime assets. */
export function normalizeBrandMarkSrc(markSrc) {
  const src = String(markSrc || '').trim();
  if (!src) return BRAND_MARK_SRC;
  return LEGACY_MARK_ALIASES[src] || src;
}

/** Mix hex toward white (amount 0–1) or black (negative amount). */
export function shadeHex(hex, amount) {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const t = amount >= 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const w = Math.abs(amount);
  const r = Math.round(rgb.r + (t.r - rgb.r) * w);
  const g = Math.round(rgb.g + (t.g - rgb.g) * w);
  const b = Math.round(rgb.b + (t.b - rgb.b) * w);
  return `#${[r, g, b].map((x) => clamp(x, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @param {unknown} settings organizations.settings JSON
 * @param {string} [organizationName]
 */
export function resolveOrganizationBrand(settings, organizationName) {
  const raw = settings && typeof settings === 'object' ? settings : {};
  const brand = raw.brand && typeof raw.brand === 'object' ? raw.brand : {};

  const appName = String(brand.appName || organizationName || APP_NAME).trim() || APP_NAME;
  const shortName = String(brand.shortName || APP_SHORT_NAME).trim() || APP_SHORT_NAME;
  const primary = String(brand.primary || BRAND_PRIMARY).trim() || BRAND_PRIMARY;

  return {
    appName,
    shortName,
    companyName: String(brand.companyName || appName).trim() || COMPANY_NAME,
    address: String(brand.address || '').trim(),
    postNo: String(brand.postNo ?? brand.post_no ?? brand.postalCode ?? '').trim(),
    gstNo: String(brand.gstNo ?? brand.gst_no ?? brand.gstin ?? '').trim(),
    markSrc: normalizeBrandMarkSrc(brand.markSrc || brand.logoUrl || BRAND_MARK_SRC) || BRAND_MARK_SRC,
    primary,
    primaryDark: String(brand.primaryDark || shadeHex(primary, -0.35)).trim(),
    primaryLight: String(brand.primaryLight || shadeHex(primary, 0.45)).trim(),
  };
}

/** @param {ReturnType<typeof resolveOrganizationBrand>} brand */
/** Invoice letterhead fields from brand hook + organization record (signup settings). */
export function resolveInvoiceLetterhead(brand, organization) {
  const orgName = String(organization?.name || "").trim();
  const fromOrg = resolveOrganizationBrand(organization?.settings, orgName);
  const b = brand && typeof brand === "object" ? brand : {};
  return {
    companyName: String(b.companyName || fromOrg.companyName || orgName).trim(),
    address: String(b.address || fromOrg.address || "").trim(),
    postNo: String(b.postNo || fromOrg.postNo || "").trim(),
    gstNo: String(b.gstNo || fromOrg.gstNo || "").trim(),
  };
}

export function brandSettingsFromForm(brand) {
  const primary = brand.primary || BRAND_PRIMARY;
  return {
    brand: {
      appName: brand.appName,
      shortName: brand.shortName,
      companyName: brand.companyName || brand.appName,
      address: brand.address || '',
      postNo: brand.postNo || '',
      gstNo: brand.gstNo || '',
      markSrc: brand.markSrc,
      primary,
      primaryDark: brand.primaryDark || shadeHex(primary, -0.35),
      primaryLight: brand.primaryLight || shadeHex(primary, 0.45),
    },
  };
}

export function logoSrcWithPublicUrl(markSrc, publicUrl = process.env.PUBLIC_URL || '') {
  const src = normalizeBrandMarkSrc(markSrc);
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  return `${publicUrl}${src.startsWith('/') ? src : `/${src}`}`;
}
