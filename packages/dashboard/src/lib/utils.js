/**
 * Shared utility functions across dashboard scripts.
 */

export function formatCurrency(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) {
    return '$0';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Parse date string (M/D/YYYY) to { year, month }.
 * @param {string} str
 * @returns {{ year: number, month: number } | null}
 */
export function parseDatePart(str) {
  if (!str) {
    return null;
  }
  const parts = str.split('/');
  if (parts.length < 3) {
    return null;
  }
  const month = parseInt(parts[0], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(year)) {
    return null;
  }
  return { year, month };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a daterange for display (e.g. "Jan 2025").
 * Uses parseDatePart for consistent M/D/YYYY parsing.
 * @param {{ from: string }} daterange
 * @returns {string}
 */
export function formatPeriod({ from }) {
  const parsed = parseDatePart(from);
  if (!parsed) {
    return from || '—';
  }
  return `${MONTH_NAMES[parsed.month - 1] ?? ''} ${parsed.year}`;
}

/**
 * Format a year range for display (e.g. "2018–2024").
 * @param {number[]} years - Sorted array of years
 * @returns {string}
 */
export function formatYearRange(years) {
  if (!years?.length) {
    return '—';
  }
  return `${years[0]}–${years[years.length - 1]}`;
}
