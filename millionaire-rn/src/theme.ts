/**
 * Millionaire game theme — deep stage-blue + gold, matching the web client.
 */
export const colors = {
  background: '#0a0e27',
  backgroundAlt: '#10163a',
  card: '#151c47',
  cardBorder: '#2a3370',
  gold: '#ffd700',
  goldDark: '#b8860b',
  goldPale: '#fff3b0',
  text: '#ffffff',
  textMuted: '#9aa3c7',
  green: '#2ecc71',
  greenDark: '#1e8449',
  red: '#e74c3c',
  redDark: '#c0392b',
  blue: '#3d6bf2',
  disabled: '#3a4168',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

/** Prize ladder: $100 → $1,000,000 (index 0..14). */
export const PRIZE_LEVELS = [
  100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000,
  250000, 500000, 1000000,
];

/** The 1-based question position of each safety net. */
export const SAFETY_NETS = [5, 10];

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}
