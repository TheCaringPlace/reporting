import { useMemo } from 'preact/hooks';
import { useFetchJson } from '../lib/useFetchJson.js';
import { formatCurrency } from '../lib/utils.js';
import { Metrics } from '../components/Metric.jsx';
import { Card } from '../components/Card.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { Chart } from '../components/Chart.jsx';

function sumItems(items, key) {
  return (items ?? []).reduce((s, i) => s + (Number(i?.[key]) || 0), 0);
}

function getTotals(consolidated) {
  let incomeBudget = 0, incomeActual = 0, expenseBudget = 0, expenseActual = 0;
  if (consolidated?.income) {
    for (const cat of Object.values(consolidated.income)) {
      incomeBudget += sumItems(cat.items, 'budget');
      incomeActual += sumItems(cat.items, 'actual');
    }
  }
  if (consolidated?.expenses) {
    for (const cat of Object.values(consolidated.expenses)) {
      expenseBudget += sumItems(cat.items, 'budget');
      expenseActual += sumItems(cat.items, 'actual');
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
  const categories = type === 'income' ? consolidated?.income : consolidated?.expenses;
  if (!categories) {
    return { labels: [], budgetData: [], expectedData: [], actualData: [] };
  }
  const labels = [], budgetData = [], expectedData = [], actualData = [];
  for (const [catKey, cat] of Object.entries(categories)) {
    const label = catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const budget = sumItems(cat.items, 'budget');
    const actual = sumItems(cat.items, 'actual');
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

function buildTableRows(categories, type, monthsFactor) {
  const rows = [];
  if (!categories) {
    return rows;
  }
  for (const [catKey, cat] of Object.entries(categories)) {
    const catLabel = catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    for (const item of cat.items ?? []) {
      const budget = Number(item.budget) || 0;
      const actual = Number(item.actual) || 0;
      const expected = budget * monthsFactor;
      const pct = expected > 0 ? (actual / expected) * 100 : (actual > 0 ? '-' : 0);
      const variance = actual - expected;
      const varianceClass = type === 'income'
        ? variance >= 0 ? 'positive' : 'negative'
        : variance <= 0 ? 'positive' : 'negative';
      rows.push([
        catLabel,
        item.name || '—',
        formatCurrency(budget),
        formatCurrency(expected),
        formatCurrency(actual),
        expected > 0 ? `${pct.toFixed(1)}%` : (actual > 0 ? '—' : '—'),
        { content: `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`, className: varianceClass },
      ]);
    }
  }
  return rows;
}

export default function BudgetTrackerPage() {
  const { data, loading: dataLoading, error: dataError } = useFetchJson('./data/current-year-financials.json');
  const consolidated = data?.consolidated;
  const { incomeBudget, incomeActual, expenseBudget, expenseActual } = getTotals(consolidated);
  const monthsCount = getMonthsWithData(data ?? {});
  const monthsFactor = monthsCount > 0 ? monthsCount / 12 : 0;
  const monthsLabel = monthsCount > 0 ? `(${monthsCount} month${monthsCount !== 1 ? 's' : ''})` : '';
  const incomeExpected = incomeBudget * monthsFactor;
  const expenseExpected = expenseBudget * monthsFactor;
  const hasData = incomeBudget > 0 || expenseBudget > 0;
  const expectedLabel = monthsCount > 0 ? `expected for ${monthsCount} month${monthsCount !== 1 ? 's' : ''}` : 'budget';

  const incChartConfig = useMemo(() => {
    const { labels, budgetData, expectedData, actualData } = buildCategoryData(consolidated, 'income', monthsFactor);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Annual budget', data: budgetData, backgroundColor: 'rgba(5, 150, 105, 0.25)' },
          { label: `Expected (${monthsCount} mo)`, data: expectedData, backgroundColor: 'rgba(5, 150, 105, 0.5)' },
          { label: 'Actual (YTD)', data: actualData, backgroundColor: '#059669' },
        ],
      },
      options: { scales: { y: { beginAtZero: true } } },
    };
  }, [consolidated, monthsFactor, monthsCount]);

  const expChartConfig = useMemo(() => {
    const { labels, budgetData, expectedData, actualData } = buildCategoryData(consolidated, 'expenses', monthsFactor);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Annual budget', data: budgetData, backgroundColor: 'rgba(185, 74, 158, 0.25)' },
          { label: `Expected (${monthsCount} mo)`, data: expectedData, backgroundColor: 'rgba(185, 74, 158, 0.5)' },
          { label: 'Actual (YTD)', data: actualData, backgroundColor: '#b94a9e' },
        ],
      },
      options: { scales: { y: { beginAtZero: true } } },
    };
  }, [consolidated, monthsFactor, monthsCount]);

  const tableColumns = ['Category', 'Line item', 'Annual budget', 'Expected (YTD)', 'Actual (YTD)', '% of expected', 'Variance'];
  const incomeTableRows = useMemo(() => buildTableRows(consolidated?.income, 'income', monthsFactor), [consolidated?.income, monthsFactor]);
  const expenseTableRows = useMemo(() => buildTableRows(consolidated?.expenses, 'expense', monthsFactor), [consolidated?.expenses, monthsFactor]);

  if (dataLoading) {
    return <div class="loading">Loading…</div>;
  }
  if (dataError) {
    return <div class="loading">Failed to load data: {dataError.message}</div>;
  }
  if (!hasData) {
    return (
      <div class="loading">
        No budget or actual data available. Run <code>consolidate-current-year-financials</code> to generate.
      </div>
    );
  }

  const metricItems = [
    { value: formatCurrency(incomeActual), label: `Income YTD (${formatCurrency(incomeExpected)} ${expectedLabel})`, valueClass: 'income' },
    { value: formatCurrency(expenseActual), label: `Expenses YTD (${formatCurrency(expenseExpected)} ${expectedLabel})`, valueClass: 'expense' },
    { value: formatCurrency(incomeActual - expenseActual), label: 'Net YTD', valueClass: incomeActual - expenseActual >= 0 ? 'net' : 'expense' },
  ];

  return (
    <>
      <Metrics items={metricItems} />
      <div class="grid-half">
        <Card title="Income: Actual vs Expected (YTD)">
          <ProgressBar label="Income" expected={incomeExpected || incomeBudget} actual={incomeActual} isIncome monthsLabel={monthsLabel} />
          <Chart config={incChartConfig} height="tall" />
        </Card>
        <Card title="Expenses: Actual vs Expected (YTD)">
          <ProgressBar label="Expenses" expected={expenseExpected || expenseBudget} actual={expenseActual} isIncome={false} monthsLabel={monthsLabel} />
          <Chart config={expChartConfig} height="tall" />
        </Card>
      </div>
      <h3 class="section-heading">Income by category</h3>
      <Card fullWidth>
        <DataTable columns={tableColumns} rows={incomeTableRows} />
      </Card>
      <h3 class="section-heading">Expenses by category</h3>
      <Card fullWidth>
        <DataTable columns={tableColumns} rows={expenseTableRows} />
      </Card>
    </>
  );
}
