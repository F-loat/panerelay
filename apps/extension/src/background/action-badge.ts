import { accentPalette } from '../shared/appearance.js';

export function controlBadgeText(controlledTabCount: number): string {
  if (controlledTabCount <= 0) return '';
  if (controlledTabCount > 99) return '99+';
  return String(controlledTabCount);
}

export function controlBadgeColors(accentColor: unknown): {
  background: string;
  text: string;
} {
  const palette = accentPalette(accentColor, 'dark');
  return { background: palette.color, text: palette.contrast };
}
