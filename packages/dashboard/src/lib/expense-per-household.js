/**
 * Shared logic for Expense per Household & Individual report.
 * Aggregates service and financial data, filtering to years with full 12 months of service data.
 */

import { parseDatePart } from './utils.js';

const FULL_MONTHS = 12;

/**
 * Build service aggregations by year.
 * @param {object[]} serviceData
 * @returns {{ serviceByYear: Record<number, { households: number, individuals: number }>, monthsPerYear: Record<number, Set<number>>, yearsWithFullServiceData: number[] }}
 */
export function buildServiceByYear(serviceData) {
  const serviceByYear = {};
  const monthsPerYear = {};
  for (const row of serviceData) {
    const parsed = parseDatePart(row.daterange?.from);
    if (!parsed) {
      continue;
    }
    const { year, month } = parsed;
    if (!serviceByYear[year]) {
      serviceByYear[year] = { households: 0, individuals: 0 };
    }
    serviceByYear[year].households += row.client_types?.households ?? 0;
    serviceByYear[year].individuals += row.client_types?.total ?? 0;
    if (!monthsPerYear[year]) monthsPerYear[year] = new Set();
    monthsPerYear[year].add(month);
  }
  const yearsWithFullServiceData = Object.keys(monthsPerYear)
    .map(Number)
    .filter((y) => (monthsPerYear[y]?.size ?? 0) >= FULL_MONTHS);
  return { serviceByYear, monthsPerYear, yearsWithFullServiceData };
}

/**
 * Build expense totals by year.
 * @param {object[]} expenses
 * @param {'all' | 'direct' | 'other'} [type='all'] - Filter by category
 * @returns {Record<number, number>}
 */
export function buildExpensesByYear(expenses, type = 'all') {
  const result = {};
  for (const row of expenses ?? []) {
    const y = row.year;
    const amt = Number(row.amount) || 0;
    if (type === 'direct' && row.category !== 'Direct Help Expense') {
      continue;
    }
    if (type === 'other' && row.category !== 'Other Expense') {
      continue;
    }
    if (!result[y]) result[y] = 0;
    result[y] += amt;
  }
  return result;
}

/**
 * Get years that have both expense data and full 12 months of service data.
 * @param {Record<number, number>} expensesByYear
 * @param {number[]} yearsWithFullServiceData
 * @returns {number[]}
 */
export function getExpensePerHouseholdYears(expensesByYear, yearsWithFullServiceData) {
  return [
    ...new Set([
      ...Object.keys(expensesByYear).map(Number),
      ...yearsWithFullServiceData,
    ]),
  ]
    .filter((y) => y > 0)
    .filter((y) => expensesByYear[y] != null && yearsWithFullServiceData.includes(y))
    .sort((a, b) => a - b);
}
