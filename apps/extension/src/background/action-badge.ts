import { accentPalette } from '../shared/appearance.js';

export function controlBadgeText(controlledTabCount: number): string {
  if (controlledTabCount <= 0) return '';
  if (controlledTabCount > 99) return '99+';
  return String(controlledTabCount);
}

export function controlBadgeBackground(accentColor: unknown): string {
  return accentPalette(accentColor, 'dark').color;
}
