/**
 * Color palette generation utilities for creating coordinated color variations
 * Used to generate 3-4 colors per element with tonal variation
 */

/**
 * Converts hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, l };
}

/**
 * Converts HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generates a color palette with 3-4 coordinated colors from a base color
 * Returns: [base, light accent, dark shade, optional accent]
 */
export function generateColorPalette(baseColor: string): string[] {
  const hsl = hexToHsl(baseColor);
  const colors: string[] = [baseColor];

  // Light accent (lighter by 20-30%)
  const lightL = Math.min(1, hsl.l + 0.25);
  colors.push(hslToHex(hsl.h, Math.max(0.3, hsl.s * 0.8), lightL));

  // Dark shade (darker by 20-30%)
  const darkL = Math.max(0, hsl.l - 0.25);
  colors.push(hslToHex(hsl.h, Math.min(1, hsl.s * 1.1), darkL));

  // Optional accent (slightly shifted hue, more saturated)
  const accentH = (hsl.h + 15) % 360;
  const accentS = Math.min(1, hsl.s * 1.2);
  colors.push(hslToHex(accentH, accentS, hsl.l));

  return colors;
}

/**
 * Lightens a color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const hsl = hexToHsl(hex);
  const newL = Math.min(1, hsl.l + percent);
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Darkens a color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  const hsl = hexToHsl(hex);
  const newL = Math.max(0, hsl.l - percent);
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Adjusts saturation of a color
 */
export function adjustSaturation(hex: string, factor: number): string {
  const hsl = hexToHsl(hex);
  const newS = Math.max(0, Math.min(1, hsl.s * factor));
  return hslToHex(hsl.h, newS, hsl.l);
}


