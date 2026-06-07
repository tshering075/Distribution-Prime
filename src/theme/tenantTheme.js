import { createTheme } from '@mui/material/styles';
import { BRAND_PRIMARY, BRAND_PRIMARY_DARK, BRAND_PRIMARY_LIGHT } from '../constants/brand';

function isHexColor(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || '').trim());
}

/**
 * @param {{ primary?: string, primaryDark?: string, primaryLight?: string }|null|undefined} brand
 */
export function resolveThemePrimaryPalette(brand) {
  const main = isHexColor(brand?.primary) ? brand.primary.trim() : BRAND_PRIMARY;
  const dark = isHexColor(brand?.primaryDark) ? brand.primaryDark.trim() : BRAND_PRIMARY_DARK;
  const light = isHexColor(brand?.primaryLight) ? brand.primaryLight.trim() : BRAND_PRIMARY_LIGHT;
  return { main, dark, light, contrastText: '#ffffff' };
}

/**
 * @param {import('@mui/material/styles').Theme} baseTheme
 * @param {{ primary?: string, primaryDark?: string, primaryLight?: string }|null|undefined} brand
 */
export function applyBrandToTheme(baseTheme, brand) {
  if (!brand?.primary || !isHexColor(brand.primary)) {
    return baseTheme;
  }

  const primary = resolveThemePrimaryPalette(brand);
  const mainRgb = hexToRgb(primary.main);

  return createTheme(baseTheme, {
    palette: { primary },
    components: {
      MuiButton: {
        styleOverrides: {
          containedPrimary: mainRgb
            ? { boxShadow: `0 4px 14px rgba(${mainRgb.r}, ${mainRgb.g}, ${mainRgb.b}, 0.28)` }
            : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          colorPrimary: mainRgb
            ? { backgroundColor: `rgba(${mainRgb.r}, ${mainRgb.g}, ${mainRgb.b}, 0.12)` }
            : {},
        },
      },
    },
  });
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
