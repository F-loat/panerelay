export type ResolvedTheme = 'dark' | 'light';

export interface AccentPalette {
  color: string;
  contrast: string;
  hover: string;
  outline: string;
  soft: string;
}

export interface WebsiteAccentPalette {
  primary: string;
  soft: string;
  dark: string;
}

type Rgb = readonly [red: number, green: number, blue: number];

export const ACCENT_COLOR_KEY = 'panerelay.accentColor';
export const DEFAULT_ACCENT_COLOR = '#35d07f';

const THEME_SURFACES: Record<ResolvedTheme, { background: string; outline: string }> = {
  dark: { background: '#111313', outline: '#0b0c0c' },
  light: { background: '#ffffff', outline: '#ffffff' },
};
const MINIMUM_ACCENT_CONTRAST = 4.5;

export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^#[\da-f]{6}$/.test(normalized) ? normalized : null;
}

function hexToRgb(color: string): Rgb {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

function rgbToHex([red, green, blue]: Rgb): string {
  return `#${[red, green, blue]
    .map(channel => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixColors(color: string, target: string, amount: number): string {
  const source = hexToRgb(color);
  const destination = hexToRgb(target);
  return rgbToHex([
    source[0] + (destination[0] - source[0]) * amount,
    source[1] + (destination[1] - source[1]) * amount,
    source[2] + (destination[2] - source[2]) * amount,
  ]);
}

function relativeLuminance(color: string): number {
  const channels = hexToRgb(color).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

export function colorContrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureSurfaceContrast(color: string, theme: ResolvedTheme): string {
  const { background } = THEME_SURFACES[theme];
  if (colorContrastRatio(color, background) >= MINIMUM_ACCENT_CONTRAST) return color;

  const target = theme === 'light' ? '#000000' : '#ffffff';
  let insufficient = 0;
  let sufficient = 1;
  for (let index = 0; index < 12; index += 1) {
    const amount = (insufficient + sufficient) / 2;
    if (
      colorContrastRatio(mixColors(color, target, amount), background) >= MINIMUM_ACCENT_CONTRAST
    ) {
      sufficient = amount;
    } else {
      insufficient = amount;
    }
  }
  return mixColors(color, target, sufficient);
}

function readableForeground(background: string): string {
  const dark = '#06150d';
  const light = '#ffffff';
  return colorContrastRatio(background, dark) >= colorContrastRatio(background, light)
    ? dark
    : light;
}

export function accentPalette(value: unknown, theme: ResolvedTheme): AccentPalette {
  const base = normalizeAccentColor(value) ?? DEFAULT_ACCENT_COLOR;
  const color = ensureSurfaceContrast(base, theme);
  const [red, green, blue] = hexToRgb(color);
  return {
    color,
    contrast: readableForeground(color),
    hover: mixColors(color, theme === 'light' ? '#000000' : '#ffffff', 0.12),
    outline: THEME_SURFACES[theme].outline,
    soft: `rgb(${red} ${green} ${blue} / ${theme === 'light' ? '10%' : '14%'})`,
  };
}

export function websiteAccentPalette(value: unknown): WebsiteAccentPalette {
  const primary = accentPalette(value, 'dark').color;
  return {
    primary,
    soft: mixColors(primary, '#ffffff', 0.4),
    dark: mixColors(primary, '#000000', 0.74),
  };
}
