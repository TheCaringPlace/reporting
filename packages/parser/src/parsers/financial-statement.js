import { toLines } from "./report-text.js";

/** Regex to match currency amounts (e.g. 1,234.56 or 0.00) */
const AMOUNT_REGEX = /[\d,]+\.\d{2}/g;

/**
 * Parse a currency amount string to a number.
 * @param {string} value
 * @returns {number}
 */
function parseAmount(value) {
  if (value == null || String(value).trim() === "") return 0;
  const cleaned = String(value).replace(/,/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Extract all dollar amounts from a line (in order).
 * @param {string} line
 * @returns {string[]}
 */
function extractAmounts(line) {
  const matches = line.match(AMOUNT_REGEX);
  return matches ? [...matches] : [];
}

/**
 * Extract the label (text before the first amount) from a line.
 * @param {string} line
 * @returns {string}
 */
function extractLabel(line) {
  const firstAmount = line.match(AMOUNT_REGEX);
  if (!firstAmount) return line.trim();
  const idx = line.indexOf(firstAmount[0]);
  return line.substring(0, idx).replace(/:\s*$/, "").trim();
}

/**
 * Parse a data line into label and amounts (actual, budget, prior_year) for the first year column.
 * @param {string} line
 * @returns {{ label: string, actual: number, budget: number, prior_year: number } | null}
 */
function parseDataLine(line) {
  const amounts = extractAmounts(line);
  const label = extractLabel(line);
  if (!label || amounts.length < 3) return null;

  return {
    label,
    actual: parseAmount(amounts[0]),
    budget: parseAmount(amounts[1]),
    prior_year: parseAmount(amounts[2]),
  };
}

/**
 * Check if a line is a separator (dashes only) or empty after cleaning.
 * @param {string} line
 * @returns {boolean}
 */
function isSeparator(line) {
  return /^-+\s*$/.test(line.trim()) || /^=+\s*$/.test(line.trim());
}

/**
 * Extract the primary reporting year from the document.
 * Tries: report period (e.g. "February, 2026"), then "YEARS ENDING" footer, then header row.
 * @param {string[]} lines - Document lines
 * @returns {number} Year (e.g. 2026)
 */
function extractReportYear(lines) {
  for (const line of lines) {
    const periodMatch = line.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December),\s*(\d{4})/i
    );
    if (periodMatch && line.includes("YEAR TO DATE")) {
      return parseInt(periodMatch[1], 10);
    }
  }
  for (const line of lines) {
    const yearsMatch = line.match(/YEARS?\s+ENDING\s+DECEMBER\s+31[,\s]+(\d{4})/i);
    if (yearsMatch) return parseInt(yearsMatch[1], 10);
  }
  for (const line of lines) {
    const headerMatch = line.match(/^(\d{4})\s/);
    if (headerMatch) return parseInt(headerMatch[1], 10);
  }
  return new Date().getFullYear();
}

/**
 * Extract years_ending from the document footer (e.g. "YEARS ENDING DECEMBER 31, 2026 and 2025").
 * @param {string[]} lines
 * @returns {string[]}
 */
function extractYearsEnding(lines) {
  for (const line of lines) {
    if (!line.includes("YEARS") || !line.includes("ENDING")) continue;
    const yearMatches = [...line.matchAll(/\b(19|20)\d{2}\b/g)];
    if (yearMatches.length > 0) {
      return [...new Set(yearMatches.map((m) => `December 31, ${m[0]}`))];
    }
  }
  return [];
}

/**
 * Parse financial statement text into structured data.
 * Extracts YTD actual, budget, and prior-year amounts for income and expenses.
 * The reporting year is extracted from the document (report period, years-ending, or column header).
 *
 * @param {string} text - Raw text from the financial statement PDF
 * @returns {Object} Parsed financial statement
 */
export function parseFinancialStatement(text) {
  const lines = toLines(text);
  const reportYear = String(extractReportYear(lines));

  const result = {
    document: {
      title: "THE CARING PLACE - Comparative Monthly Financial Report",
      report_type: "Statement of Income and Expenses",
      report_period: null,
      report_year: parseInt(reportYear, 10),
      years_ending: extractYearsEnding(lines),
    },
    [reportYear]: {
      income: {
        church_contributions: { items: [], total: null },
        other_income: { items: [], total: null },
        total_income: null,
      },
      expenses: {
        direct_help_to_clients: { items: [], total: null },
        all_other_expenses: { items: [], total: null },
        total_expenses: null,
      },
      net_income_expense: null,
    },
  };

  /** @type {'income' | 'expenses' | null} */
  let currentMajorSection = null;

  /** @type {string | null} */
  let currentSubsection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSeparator(line)) continue;

    // Extract report period (e.g. "February, 2026" near "YEAR TO DATE" in footer)
    const periodWithYtd = line.match(
      /((?:January|February|March|April|May|June|July|August|September|October|November|December),\s*\d{4})\s+.*YEAR TO DATE/i
    );
    if (periodWithYtd) {
      result.document.report_period = periodWithYtd[1];
    }

    // Section: INCOME (may have trailing content like dashes on same line)
    if (/^INCOME\b/.test(line.trim()) && !/^TOTAL INCOME/.test(line.trim())) {
      currentMajorSection = "income";
      currentSubsection = null;
      continue;
    }

    // Section: EXPENSES
    if (/^EXPENSES\b/.test(line.trim()) && !/^TOTAL EXPENSES/.test(line.trim())) {
      currentMajorSection = "expenses";
      currentSubsection = null;
      continue;
    }

    // Subsection: Church Contributions
    if (
      currentMajorSection === "income" &&
      /Church Contributions/i.test(line) &&
      !/^Total Church Contributions/.test(line)
    ) {
      currentSubsection = "church_contributions";
      continue;
    }

    // Total Church Contributions
    if (/^Total Church Contributions\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed && result[reportYear].income.church_contributions) {
        result[reportYear].income.church_contributions.total = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // Subsection: Other Income (after Church Contributions)
    if (
      currentMajorSection === "income" &&
      /^Other Income\s*$/.test(line.trim())
    ) {
      currentSubsection = "other_income";
      continue;
    }

    // Total Other Income
    if (/^Total Other Income\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed && result[reportYear].income.other_income) {
        result[reportYear].income.other_income.total = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // TOTAL INCOME
    if (/^TOTAL INCOME\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed) {
        result[reportYear].income.total_income = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // Subsection: Direct Help To Clients
    if (
      currentMajorSection === "expenses" &&
      /Direct Help To Clients/i.test(line) &&
      !/^Total Direct Help/.test(line)
    ) {
      currentSubsection = "direct_help_to_clients";
      continue;
    }

    // Total Direct Help to Clients
    if (/^Total Direct Help to Clients\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed && result[reportYear].expenses.direct_help_to_clients) {
        result[reportYear].expenses.direct_help_to_clients.total = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // Subsection: All Other Expenses (may have colon)
    if (
      currentMajorSection === "expenses" &&
      /^All Other Expenses:?\s*$/.test(line.trim())
    ) {
      currentSubsection = "all_other_expenses";
      continue;
    }

    // Total All Other Expenses
    if (/^Total All Other Expenses\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed && result[reportYear].expenses.all_other_expenses) {
        result[reportYear].expenses.all_other_expenses.total = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // TOTAL EXPENSES
    if (/^TOTAL EXPENSES\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed) {
        result[reportYear].expenses.total_expenses = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      currentSubsection = null;
      continue;
    }

    // NET INCOME / EXPENSE
    if (/^NET INCOME\s*\/\s*EXPENSE\s/i.test(line)) {
      const parsed = parseDataLine(line);
      if (parsed) {
        result[reportYear].net_income_expense = {
          actual: parsed.actual,
          budget: parsed.budget,
          prior_year: parsed.prior_year,
        };
      }
      continue;
    }

    // Data lines: add to current subsection items
    if (currentSubsection) {
      const parsed = parseDataLine(line);
      if (parsed && !parsed.label.toLowerCase().startsWith("total")) {
        const target =
          currentMajorSection === "income"
            ? result[reportYear].income[currentSubsection]
            : result[reportYear].expenses[currentSubsection];
        if (target?.items) {
          target.items.push({
            name: parsed.label,
            actual: parsed.actual,
            budget: parsed.budget,
            prior_year: parsed.prior_year,
          });
        }
      }
    }
  }

  // Build summary
  const ti = result[reportYear].income.total_income;
  const te = result[reportYear].expenses.total_expenses;
  const net = result[reportYear].net_income_expense;
  result[reportYear].summary = {
    income_ytd_actual: ti?.actual ?? 0,
    expenses_ytd_actual: te?.actual ?? 0,
    net_income_ytd_actual: net?.actual ?? 0,
    income_ytd_budget: ti?.budget ?? 0,
    expenses_ytd_budget: te?.budget ?? 0,
    net_income_ytd_budget: net?.budget ?? 0,
  };

  return result;
}
