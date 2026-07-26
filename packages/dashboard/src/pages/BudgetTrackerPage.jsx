import { useMemo } from "preact/hooks";
import { Card } from "../components/Card.jsx";
import { Chart } from "../components/Chart.jsx";
import { DataTable } from "../components/DataTable.jsx";
import { Metrics } from "../components/Metric.jsx";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { useFetchJson } from "../lib/useFetchJson.js";
import { formatCurrency } from "../lib/utils.js";

function sumItems(items, key) {
  return (items ?? []).reduce((s, i) => s + (Number(i?.[key]) || 0), 0);
}

function getTotals(consolidated) {
  let incomeBudget = 0,
    incomeActual = 0,
    expenseBudget = 0,
    expenseActual = 0;
  if (consolidated?.income) {
    for (const cat of Object.values(consolidated.income)) {
      incomeBudget += sumItems(cat.items, "budget");
      incomeActual += sumItems(cat.items, "actual");
    }
  }
  if (consolidated?.expenses) {
    for (const cat of Object.values(consolidated.expenses)) {
      expenseBudget += sumItems(cat.items, "budget");
      expenseActual += sumItems(cat.items, "actual");
    }
  }
  const s = consolidated?.summary;
  if (s?.income_ytd_actual != null) incomeActual = s.income_ytd_actual;
  if (s?.expenses_ytd_actual != null) expenseActual = s.expenses_ytd_actual;
  return { incomeBudget, incomeActual, expenseBudget, expenseActual };
}

function getMonthsWithData(d) {
  return Math.max(0, (d?.monthly_actuals ?? []).length);
}

function buildCategoryData(consolidated, type, monthsFactor) {
  const categories =
    type === "income" ? consolidated?.income : consolidated?.expenses;
  if (!categories) {
    return { labels: [], budgetData: [], expectedData: [], actualData: [] };
  }
  const labels = [],
    budgetData = [],
    expectedData = [],
    actualData = [];
  for (const [catKey, cat] of Object.entries(categories)) {
    const label = catKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const budget = sumItems(cat.items, "budget");
    const actual = sumItems(cat.items, "actual");
    const expected = budget * monthsFactor;
    if (budget > 0 || actual > 0) {
      labels.push(label);
      budgetData.push(budget);
      expectedData.push(expected);
      actualData.push(actual);
    }
  }
  return { labels, budgetData, expectedData, actualData };
}

function formatCategoryLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatReportPeriod(reportPeriod) {
  if (!reportPeriod) {
    return "Unknown";
  }
  const parsed = new Date(reportPeriod.replace(",", ""));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }
  return reportPeriod;
}

function extractMonthlyCategoryTotals(section) {
  const totals = new Map();
  if (!section) {
    return totals;
  }
  for (const [catKey, cat] of Object.entries(section)) {
    if (!cat || typeof cat !== "object" || !Array.isArray(cat.items)) {
      continue;
    }
    const itemTotal = sumItems(cat.items, "actual");
    const total = typeof cat.total === "number" ? cat.total : itemTotal;
    totals.set(catKey, total);
  }
  return totals;
}

function buildCategoryTrendData(data, type) {
  const monthlyActuals = data?.monthly_actuals ?? [];
  if (monthlyActuals.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = monthlyActuals.map((month) =>
    formatReportPeriod(month.report_period),
  );
  const monthlyCategoryTotals = monthlyActuals.map((month) => ({
    income: extractMonthlyCategoryTotals(month?.data?.income),
    expenses: extractMonthlyCategoryTotals(month?.data?.expenses),
  }));

  const typeConfig =
    type === "income"
      ? {
          key: "income",
          label: "Income",
          colors: ["#059669", "#10b981", "#047857", "#34d399"],
        }
      : {
          key: "expenses",
          label: "Expenses",
          colors: ["#b94a9e", "#d946ef", "#9d174d", "#ec4899"],
        };

  const budgetCategories = data?.budget?.[typeConfig.key] ?? {};
  const categoryKeys = new Set(Object.keys(budgetCategories));
  for (const month of monthlyCategoryTotals) {
    for (const key of month[typeConfig.key].keys()) {
      categoryKeys.add(key);
    }
  }

  const datasets = [];
  Array.from(categoryKeys)
    .sort((a, b) => a.localeCompare(b))
    .forEach((catKey, idx) => {
      const annualBudget = sumItems(
        budgetCategories?.[catKey]?.items,
        "budget",
      );
      const monthlyBudget = annualBudget / 12;
      const actualData = monthlyCategoryTotals.map(
        (month) => month[typeConfig.key].get(catKey) ?? 0,
      );
      const hasActuals = actualData.some((v) => v > 0);
      if (!hasActuals && annualBudget <= 0) {
        return;
      }

      const color = typeConfig.colors[idx % typeConfig.colors.length];
      const categoryLabel = formatCategoryLabel(catKey);

      datasets.push({
        label: `${categoryLabel} Actual`,
        data: actualData,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.25,
      });
      datasets.push({
        label: `${categoryLabel} Budget`,
        data: labels.map(() => monthlyBudget),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0,
      });
    });

  return { labels, datasets };
}

function buildTableRows(categories, type, monthsFactor) {
  const rows = [];
  if (!categories) {
    return rows;
  }
  for (const [catKey, cat] of Object.entries(categories)) {
    const catLabel = catKey
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    for (const item of cat.items ?? []) {
      const budget = Number(item.budget) || 0;
      const actual = Number(item.actual) || 0;
      const expected = budget * monthsFactor;
      const pct =
        expected > 0 ? (actual / expected) * 100 : actual > 0 ? "-" : 0;
      const variance = actual - expected;
      const varianceClass =
        type === "income"
          ? variance >= 0
            ? "positive"
            : "negative"
          : variance <= 0
            ? "positive"
            : "negative";
      rows.push([
        catLabel,
        item.name || "—",
        formatCurrency(budget),
        formatCurrency(expected),
        formatCurrency(actual),
        expected > 0 ? `${pct.toFixed(1)}%` : actual > 0 ? "—" : "—",
        {
          content: `${variance >= 0 ? "+" : ""}${formatCurrency(variance)}`,
          className: varianceClass,
        },
      ]);
    }
  }
  return rows;
}

export default function BudgetTrackerPage() {
  const {
    data,
    loading: dataLoading,
    error: dataError,
  } = useFetchJson("./data/current-year-financials.json");
  const consolidated = data?.consolidated;
  const { incomeBudget, incomeActual, expenseBudget, expenseActual } =
    getTotals(consolidated);
  const monthsCount = getMonthsWithData(data ?? {});
  const monthsFactor = monthsCount > 0 ? monthsCount / 12 : 0;
  const monthsLabel =
    monthsCount > 0
      ? `(${monthsCount} month${monthsCount !== 1 ? "s" : ""})`
      : "";
  const incomeExpected = incomeBudget * monthsFactor;
  const expenseExpected = expenseBudget * monthsFactor;
  const hasData = incomeBudget > 0 || expenseBudget > 0;
  const expectedLabel =
    monthsCount > 0
      ? `expected for ${monthsCount} month${monthsCount !== 1 ? "s" : ""}`
      : "budget";

  const incChartConfig = useMemo(() => {
    const { labels, budgetData, expectedData, actualData } = buildCategoryData(
      consolidated,
      "income",
      monthsFactor,
    );
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Annual budget",
            data: budgetData,
            backgroundColor: "rgba(5, 150, 105, 0.25)",
          },
          {
            label: `Expected (${monthsCount} mo)`,
            data: expectedData,
            backgroundColor: "rgba(5, 150, 105, 0.5)",
          },
          {
            label: "Actual (YTD)",
            data: actualData,
            backgroundColor: "#059669",
          },
        ],
      },
      options: { scales: { y: { beginAtZero: true } } },
    };
  }, [consolidated, monthsFactor, monthsCount]);

  const expChartConfig = useMemo(() => {
    const { labels, budgetData, expectedData, actualData } = buildCategoryData(
      consolidated,
      "expenses",
      monthsFactor,
    );
    return {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Annual budget",
            data: budgetData,
            backgroundColor: "rgba(185, 74, 158, 0.25)",
          },
          {
            label: `Expected (${monthsCount} mo)`,
            data: expectedData,
            backgroundColor: "rgba(185, 74, 158, 0.5)",
          },
          {
            label: "Actual (YTD)",
            data: actualData,
            backgroundColor: "#b94a9e",
          },
        ],
      },
      options: { scales: { y: { beginAtZero: true } } },
    };
  }, [consolidated, monthsFactor, monthsCount]);

  const incomeTrendConfig = useMemo(() => {
    const { labels, datasets } = buildCategoryTrendData(data, "income");
    return {
      type: "line",
      data: { labels, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value),
            },
          },
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
      },
    };
  }, [data]);

  const expenseTrendConfig = useMemo(() => {
    const { labels, datasets } = buildCategoryTrendData(data, "expenses");
    return {
      type: "line",
      data: { labels, datasets },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value),
            },
          },
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
      },
    };
  }, [data]);

  const hasIncomeTrendData =
    incomeTrendConfig.data.labels.length > 0 &&
    incomeTrendConfig.data.datasets.length > 0;
  const hasExpenseTrendData =
    expenseTrendConfig.data.labels.length > 0 &&
    expenseTrendConfig.data.datasets.length > 0;

  const tableColumns = [
    "Category",
    "Line item",
    "Annual budget",
    "Expected (YTD)",
    "Actual (YTD)",
    "% of expected",
    "Variance",
  ];
  const incomeTableRows = useMemo(
    () => buildTableRows(consolidated?.income, "income", monthsFactor),
    [consolidated?.income, monthsFactor],
  );
  const expenseTableRows = useMemo(
    () => buildTableRows(consolidated?.expenses, "expense", monthsFactor),
    [consolidated?.expenses, monthsFactor],
  );

  if (dataLoading) {
    return <div class="loading">Loading…</div>;
  }
  if (dataError) {
    return <div class="loading">Failed to load data: {dataError.message}</div>;
  }
  if (!hasData) {
    return (
      <div class="loading">
        No budget or actual data available. Run{" "}
        <code>consolidate-current-year-financials</code> to generate.
      </div>
    );
  }

  const metricItems = [
    {
      value: formatCurrency(incomeActual),
      label: `Income YTD (${formatCurrency(incomeExpected)} ${expectedLabel})`,
      valueClass: "income",
    },
    {
      value: formatCurrency(expenseActual),
      label: `Expenses YTD (${formatCurrency(expenseExpected)} ${expectedLabel})`,
      valueClass: "expense",
    },
    {
      value: formatCurrency(incomeActual - expenseActual),
      label: "Net YTD",
      valueClass: incomeActual - expenseActual >= 0 ? "net" : "expense",
    },
  ];

  return (
    <>
      <Metrics items={metricItems} />
      <div class="grid">
        <div class="grid-half">
          <Card title="Income: Actual vs Expected (YTD)">
            <ProgressBar
              label="Income"
              expected={incomeExpected || incomeBudget}
              actual={incomeActual}
              isIncome
              monthsLabel={monthsLabel}
            />
            <Chart config={incChartConfig} height="tall" />
          </Card>
          <Card title="Expenses: Actual vs Expected (YTD)">
            <ProgressBar
              label="Expenses"
              expected={expenseExpected || expenseBudget}
              actual={expenseActual}
              isIncome={false}
              monthsLabel={monthsLabel}
            />
            <Chart config={expChartConfig} height="tall" />
          </Card>
        </div>
        {(hasIncomeTrendData || hasExpenseTrendData) && (
          <div class="grid-half">
            {hasIncomeTrendData && (
              <Card title="Income category trends over time">
                <Chart config={incomeTrendConfig} height="tall" />
              </Card>
            )}
            {hasExpenseTrendData && (
              <Card title="Expense category trends over time">
                <Chart config={expenseTrendConfig} height="tall" />
              </Card>
            )}
          </div>
        )}
        <h3 class="section-heading">Income by category</h3>
        <Card fullWidth>
          <DataTable columns={tableColumns} rows={incomeTableRows} />
        </Card>
        <h3 class="section-heading">Expenses by category</h3>
        <Card fullWidth>
          <DataTable columns={tableColumns} rows={expenseTableRows} />
        </Card>
      </div>
    </>
  );
}
