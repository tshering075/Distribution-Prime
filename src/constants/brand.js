/** Default product name when no workspace branding is set (see constants/saas.js). */
export const APP_NAME = "Distribution Prime";
export const APP_SHORT_NAME = "Dist Prime";
/** Legal / invoice letterhead operator name */
export const COMPANY_NAME = APP_NAME;
/** App mark (SVG scales cleanly in UI) */
export const BRAND_MARK_SRC = "/distribution-prime-icon.svg";
/** 512px PNG for splash / high-DPI raster contexts */
export const BRAND_LOGO_SRC = "/distribution-prime-icon-512.png";
/** Full wordmark SVG for marketing headers */
export const BRAND_WORDMARK_SRC = "/distribution-prime-wordmark.svg";
/** OAuth / store listing logo */
export const OAUTH_LOGO_SRC = "/oauth-app-logo.svg";
/**
 * Legal page paths (in-app + static HTML). Must differ from homepage `/` for Google OAuth.
 * Google Cloud Console: https://distribution-prime.pages.dev/legal/privacy-policy
 */
export const PRIVACY_POLICY_PATH = "/legal/privacy-policy";
export const TERMS_OF_SERVICE_PATH = "/legal/terms-of-service";
export const PRIVACY_POLICY_HTML = PRIVACY_POLICY_PATH;
export const TERMS_OF_SERVICE_HTML = TERMS_OF_SERVICE_PATH;
/** Production app URL for OAuth home page field. */
export const OAUTH_APP_HOME_URL = "https://distribution-prime.pages.dev/";

/** Theme accent (matches MUI primary) — for legacy const BRAND in dialogs */
export const BRAND_PRIMARY = "#1565c0";
export const BRAND_PRIMARY_DARK = "#0d47a1";
export const BRAND_PRIMARY_LIGHT = "#42a5f5";
