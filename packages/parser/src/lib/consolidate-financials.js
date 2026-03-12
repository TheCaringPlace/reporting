import { parseFile } from "fast-csv";
import { join, basename } from "path";
import { writeFileWithMkdir } from "./fs.js";
import { readdir, readFile } from "fs/promises";
import { crawlDirectory } from "./fs.js";

/**
 * Parse a currency amount string (e.g. " 1,628.14 " or " 43,533.10 ") to a number.
 * Empty or invalid values return 0.
 * @param {string} value
 * @returns {number}
 */
function parseAmount(value) {
  if (value == null || String(value).trim() === "") return 0;
  const cleaned = String(value).replace(/[,\s$]/g, "");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Read and parse a financial CSV file.
 * @param {string} filePath
 * @returns {Promise<Array<{year: number, category: string, source: string, amount: number}>>}
 */
async function parseFinancialCsv(filePath) {
  const rows = [];
  return new Promise((resolve, reject) => {
    parseFile(filePath, { headers: true, trim: true })
      .on("data", (row) => {
        const year = parseInt(row.Year, 10);
        if (Number.isNaN(year)) return;
        rows.push({
          year,
          category: row.Category || "",
          source: row.Source || "",
          amount: parseAmount(row.Amount),
        });
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

/**
 * Consolidate financial CSV files into a single JSON structure.
 * @param {string} inputFolder - Folder containing Expenses and Income CSV files
 * @param {string} outputPath - Path for financials.json
 */
export async function consolidateFinancials(inputFolder, outputPath) {
  const files = await readdir(inputFolder);

  const expensesFile = files.find(
    (f) => f.toLowerCase().endsWith("expenses.csv"),
  );
  const incomeFile = files.find((f) => f.toLowerCase().endsWith("income.csv"));

  if (!expensesFile) {
    throw new Error(
      `No Expenses CSV found in ${inputFolder}. Expected a file ending with "Expenses.csv"`,
    );
  }
  if (!incomeFile) {
    throw new Error(
      `No Income CSV found in ${inputFolder}. Expected a file ending with "Income.csv"`,
    );
  }

  const [expensesRaw, incomeRaw] = await Promise.all([
    parseFinancialCsv(join(inputFolder, expensesFile)),
    parseFinancialCsv(join(inputFolder, incomeFile)),
  ]);

  const expenses = expensesRaw.map((r) => ({ ...r, type: "expense" }));
  const income = incomeRaw.map((r) => ({ ...r, type: "income" }));

  const allYears = [
    ...new Set([
      ...expenses.map((r) => r.year),
      ...income.map((r) => r.year),
    ]),
  ].sort((a, b) => a - b);

  const result = {
    expenses,
    income,
    years: allYears,
  };

  await writeFileWithMkdir(outputPath, JSON.stringify(result, null, 2));
  console.info(`Wrote financial data to ${outputPath}`);
}

const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Extract month index from report period string (e.g. "February, 2026").
 * @param {string} reportPeriod
 * @returns {number} 0-11 for January-December, -1 if unparseable
 */
/**
 * Extract 4-digit year from a file path (e.g. "2026-proposed-budget.json" → 2026).
 * @param {string} filePath
 * @returns {number | null}
 */
function parseYearFromPath(filePath) {
  const name = basename(filePath, ".json");
  const match = name.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function parseReportMonth(reportPeriod) {
  if (!reportPeriod || typeof reportPeriod !== "string") return -1;
  const monthName = reportPeriod.split(",")[0]?.trim();
  const idx = MONTH_ORDER.findIndex(
    (m) => m.toLowerCase() === monthName?.toLowerCase(),
  );
  return idx >= 0 ? idx : -1;
}

/**
 * Merge a budget items array with an actuals items array by matching names.
 * @param {Array<{name: string, budget?: number}>} budgetItems
 * @param {Array<{name: string, actual?: number}>} actualItems
 * @returns {Array<{name: string, budget: number, actual: number}>}
 */
function mergeItems(budgetItems, actualItems) {
  const byName = new Map();
  for (const item of budgetItems ?? []) {
    const name = item?.name?.trim() ?? "";
    if (name) {
      byName.set(name, {
        name,
        budget: Number(item.budget) || 0,
        actual: 0,
      });
    }
  }
  for (const item of actualItems ?? []) {
    const name = item?.name?.trim() ?? "";
    if (name) {
      const existing = byName.get(name);
      const actual = Number(item.actual) ?? 0;
      if (existing) {
        existing.actual = actual;
      } else {
        byName.set(name, { name, budget: 0, actual });
      }
    }
  }
  return [...byName.values()];
}

/**
 * Consolidate current year financials by merging the proposed budget with available monthly actuals.
 * Uses the most recent month's YTD actuals. Output includes budget, actual (YTD), and variance.
 * Year can be derived from the budget filename (e.g. 2026-proposed-budget.json) when not provided.
 *
 * @param {string} budgetPath - Path to the proposed budget JSON file
 * @param {string} actualsFolder - Folder containing parsed financial statement JSONs
 * @param {string} outputPath - Path for the output JSON file
 * @param {number} [year] - Year to consolidate (defaults to filename or current calendar year)
 */
export async function consolidateCurrentYearFinancials(
  budgetPath,
  actualsFolder,
  outputPath,
  year = parseYearFromPath(budgetPath) ?? new Date().getFullYear(),
) {

  const actualsFiles = await crawlDirectory(actualsFolder);
  const financialStatements = await Promise.all(
    actualsFiles
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const text = await readFile(f, "utf8");
        return JSON.parse(text);
      }),
  );

  const yearStr = String(year);
  const statementsForYear = financialStatements.filter(
    (s) =>
      s.reportType === "financial-statement" &&
      (s[yearStr] != null || s.document?.report_year === year),
  );

  if (statementsForYear.length === 0) {
    console.warn(
      `No monthly actuals found for year ${year} in ${actualsFolder}. Output will contain budget only.`,
    );
  }

  const sortedByMonth = [...statementsForYear].sort((a, b) => {
    const ma = parseReportMonth(a.document?.report_period);
    const mb = parseReportMonth(b.document?.report_period);
    return ma - mb;
  });
  const latestActuals = sortedByMonth[sortedByMonth.length - 1];

  const budgetContent = JSON.parse(await readFile(budgetPath, "utf8"));
  const budget = budgetContent.budget;
  if (!budget?.income || !budget?.expenses) {
    throw new Error(
      `Invalid budget file ${budgetPath}. Expected structure with budget.income and budget.expenses`,
    );
  }

  const result = {
    year,
    budget,
    actuals_ytd: null,
    monthly_actuals: sortedByMonth.map((s) => ({
      report_period: s.document?.report_period,
      data: s[yearStr] ?? s[Object.keys(s).find((k) => /^\d{4}$/.test(k))],
    })),
    consolidated: {
      income: {},
      expenses: {},
    },
  };

  if (latestActuals?.[yearStr]) {
    result.actuals_ytd = latestActuals[yearStr];
  }

  const incomeCategories = ["church_contributions", "other_income"];
  const expenseCategories = ["direct_help_to_clients", "all_other_expenses"];

  for (const cat of incomeCategories) {
    const b = budget.income?.[cat];
    const a = latestActuals?.[yearStr]?.income?.[cat];
    result.consolidated.income[cat] = {
      items: mergeItems(b?.items ?? [], a?.items ?? []),
      total_budget: typeof b?.total === "number" ? b.total : null,
      total_actual: typeof a?.total === "number" ? a.total : null,
    };
  }

  for (const cat of expenseCategories) {
    const b = budget.expenses?.[cat];
    const a = latestActuals?.[yearStr]?.expenses?.[cat];
    result.consolidated.expenses[cat] = {
      items: mergeItems(b?.items ?? [], a?.items ?? []),
      total_budget: typeof b?.total === "number" ? b.total : null,
      total_actual: typeof a?.total === "number" ? a.total : null,
    };
  }

  result.consolidated.summary = {
    income_ytd_actual: latestActuals?.[yearStr]?.summary?.income ?? null,
    expenses_ytd_actual: latestActuals?.[yearStr]?.summary?.expenses ?? null,
    net_income_ytd_actual:
      latestActuals?.[yearStr]?.summary?.net_income ?? null,
  };

  await writeFileWithMkdir(outputPath, JSON.stringify(result, null, 2));
  console.info(
    `Wrote consolidated current-year financials (${year}) to ${outputPath}`,
  );
}
