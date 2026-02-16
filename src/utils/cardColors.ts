export const CARD_COLORS = {
  red: '#ef4444',      // Tailwind red-500
  blue: '#3b82f6',     // Tailwind blue-500
  green: '#10b981',    // Tailwind green-500
  yellow: '#f59e0b',   // Tailwind yellow-500
  purple: '#a855f7',   // Tailwind purple-500
  gray: '#6b7280',     // Tailwind gray-500
} as const;

export type CardColor = keyof typeof CARD_COLORS;

export function getColorForLabel(color: string | null | undefined): string {
  if (!color || !(color in CARD_COLORS)) {
    return CARD_COLORS.gray;
  }
  return CARD_COLORS[color as CardColor];
}
