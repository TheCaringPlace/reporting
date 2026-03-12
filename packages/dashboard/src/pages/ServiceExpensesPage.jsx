import { useState, useMemo, useEffect } from 'preact/hooks';
import { useFetchJson } from '../lib/useFetchJson.js';
import { formatCurrency } from '../lib/utils.js';
import { chartDefaults } from '../lib/charts.js';
import {
  buildServiceByYear,
  buildExpensesByYear,
  getExpensePerHouseholdYears,
} from '../lib/expense-per-household.js';
import { Metrics } from '../components/Metric.jsx';
import { Card } from '../components/Card.jsx';
import { Chart } from '../components/Chart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { YearRangeFilter } from '../components/YearRangeFilter.jsx';

export default function ServiceExpensesPage() {
  const f = useFetchJson('./data/financials.json');
  const s = useFetchJson('./data/service-report.json');
  const dataLoading = f.loading || s.loading;
  const dataError = f.error ?? s.error;

  const { serviceByYear, expensesByYear, allYears, minYear, maxYear } = useMemo(() => {
    const financialData = f.data ?? { expenses: [] };
    const serviceData = s.data ?? [];
    const { serviceByYear: sy, yearsWithFullServiceData } = buildServiceByYear(serviceData);
    const expensesByYear = buildExpensesByYear(financialData.expenses);
    const allYears = getExpensePerHouseholdYears(expensesByYear, yearsWithFullServiceData);
    const defaultYear = new Date().getFullYear();
    const minYear = allYears.length > 0 ? Math.min(...allYears) : defaultYear - 5;
    const maxYear = allYears.length > 0 ? Math.max(...allYears) : defaultYear;
    return { serviceByYear: sy, expensesByYear, allYears, minYear, maxYear };
  }, [f.data, s.data]);

  const [yearStart, setYearStart] = useState(minYear);
  const [yearEnd, setYearEnd] = useState(maxYear);
  useEffect(() => {
    setYearStart(minYear);
    setYearEnd(maxYear);
  }, [minYear, maxYear]);

  const filteredYears = useMemo(() => {
    const start = Math.min(yearStart, yearEnd);
    const end = Math.max(yearStart, yearEnd);
    return allYears.filter((y) => y >= start && y <= end);
  }, [allYears, yearStart, yearEnd]);

  const rows = useMemo(() => {
    return filteredYears.map((y) => {
      const exp = expensesByYear[y] ?? 0;
      const svc = serviceByYear[y] ?? { households: 0, individuals: 0 };
      const perHousehold = svc.households > 0 ? exp / svc.households : null;
      const perIndividual = svc.individuals > 0 ? exp / svc.individuals : null;
      return {
        year: y,
        expenses: exp,
        households: svc.households,
        individuals: svc.individuals,
        perHousehold,
        perIndividual,
      };
    });
  }, [filteredYears]);

  const metrics = useMemo(() => {
    const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
    const totalHouseholds = rows.reduce((s, r) => s + r.households, 0);
    const totalIndividuals = rows.reduce((s, r) => s + r.individuals, 0);
    const avgPerHousehold = totalHouseholds > 0 ? totalExpenses / totalHouseholds : null;
    const avgPerIndividual = totalIndividuals > 0 ? totalExpenses / totalIndividuals : null;
    return [
      { value: formatCurrency(avgPerHousehold ?? 0), label: 'Expenses per household' },
      { value: formatCurrency(avgPerIndividual ?? 0), label: 'Expenses per individual' },
      { value: totalHouseholds.toLocaleString(), label: 'Households served (selected range)' },
      { value: totalIndividuals.toLocaleString(), label: 'Individuals served (selected range)' },
    ];
  }, [rows]);

  const chartConfigs = useMemo(() => {
    const perHouseholdData = rows.map((r) => (r.perHousehold != null ? Math.round(r.perHousehold) : null));
    const perIndividualData = rows.map((r) => (r.perIndividual != null ? Math.round(r.perIndividual) : null));

    const peoplePerHouseholdData = rows.map((r) =>
      r.households > 0 ? Number((r.individuals / r.households).toFixed(1)) : null
    );

    const yoyLabels = [];
    const yoyPerHousehold = [];
    const yoyPerIndividual = [];
    for (let i = 1; i < rows.length; i++) {
      const curr = rows[i];
      const prev = rows[i - 1];
      yoyLabels.push(`${prev.year}→${curr.year}`);
      const pctHousehold =
        prev.perHousehold != null && prev.perHousehold > 0
          ? Math.round(((curr.perHousehold ?? 0) - prev.perHousehold) / prev.perHousehold * 100)
          : null;
      const pctIndividual =
        prev.perIndividual != null && prev.perIndividual > 0
          ? Math.round(((curr.perIndividual ?? 0) - prev.perIndividual) / prev.perIndividual * 100)
          : null;
      yoyPerHousehold.push(pctHousehold);
      yoyPerIndividual.push(pctIndividual);
    }

    const expensesData = rows.map((r) => r.expenses);
    const householdsData = rows.map((r) => r.households);
    const individualsData = rows.map((r) => r.individuals);

    return {
      overTime: {
        type: 'bar',
        data: {
          labels: filteredYears.map(String),
          datasets: [
            { label: 'Expenses per household', data: perHouseholdData, backgroundColor: 'rgba(35, 54, 88, 0.8)', yAxisID: 'y' },
            { label: 'Expenses per individual', data: perIndividualData, backgroundColor: 'rgba(240, 101, 30, 0.8)', yAxisID: 'y' },
          ],
        },
        options: {
          scales: {
            y: {
              type: 'linear',
              beginAtZero: true,
              ticks: { callback: (v) => (typeof v === 'number' ? '$' + v.toLocaleString() : v) },
            },
          },
          plugins: {
            ...chartDefaults.plugins,
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.raw;
                  return v != null ? `${ctx.dataset.label}: ${formatCurrency(v)}` : 'No data';
                },
              },
            },
          },
        },
      },
      peoplePerHousehold: {
        type: 'line',
        data: {
          labels: filteredYears.map(String),
          datasets: [{
            label: 'People per household',
            data: peoplePerHouseholdData,
            borderColor: 'rgba(35, 54, 88, 1)',
            backgroundColor: 'rgba(35, 54, 88, 0.1)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      yoyChange: {
        type: 'bar',
        data: {
          labels: yoyLabels,
          datasets: [
            { label: 'Expense per household % change', data: yoyPerHousehold, backgroundColor: 'rgba(35, 54, 88, 0.8)' },
            { label: 'Expense per individual % change', data: yoyPerIndividual, backgroundColor: 'rgba(240, 101, 30, 0.8)' },
          ],
        },
        options: {
          scales: {
            y: {
              ticks: { callback: (v) => (typeof v === 'number' ? v + '%' : v) },
            },
          },
          plugins: {
            ...chartDefaults.plugins,
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.raw;
                  return v != null ? `${ctx.dataset.label}: ${v > 0 ? '+' : ''}${v}%` : 'No data';
                },
              },
            },
          },
        },
      },
      totals: {
        type: 'line',
        data: {
          labels: filteredYears.map(String),
          datasets: [
            {
              label: 'Total expenses',
              data: expensesData,
              borderColor: 'rgba(35, 54, 88, 1)',
              backgroundColor: 'rgba(35, 54, 88, 0.1)',
              fill: true,
              tension: 0.3,
              yAxisID: 'y',
            },
            {
              label: 'Households',
              data: householdsData,
              borderColor: 'rgba(240, 101, 30, 1)',
              tension: 0.3,
              yAxisID: 'y1',
            },
            {
              label: 'Individuals',
              data: individualsData,
              borderColor: 'rgba(244, 159, 45, 1)',
              tension: 0.3,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          scales: {
            y: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              ticks: { callback: (v) => (typeof v === 'number' ? '$' + v.toLocaleString() : v) },
            },
            y1: {
              type: 'linear',
              position: 'right',
              beginAtZero: true,
              grid: { drawOnChartArea: false },
            },
          },
          plugins: {
            ...chartDefaults.plugins,
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.raw;
                  if (v == null) {
                    return 'No data';
                  }
                  if (ctx.dataset.label === 'Total expenses') {
                    return `Total expenses: ${formatCurrency(v)}`;
                  }
                  return `${ctx.dataset.label}: ${v.toLocaleString()}`;
                },
              },
            },
          },
        },
      },
    };
  }, [rows, filteredYears]);

  const tableRows = useMemo(() => {
    return rows.map((r) => [
      r.year,
      formatCurrency(r.expenses),
      r.households.toLocaleString(),
      r.individuals.toLocaleString(),
      r.perHousehold != null ? formatCurrency(r.perHousehold) : '—',
      r.perIndividual != null ? formatCurrency(r.perIndividual) : '—',
    ]);
  }, [rows]);

  const hasData = rows.length > 0;

  if (dataLoading) {
    return <div class="loading">Loading…</div>;
  }
  if (dataError) {
    return <div class="loading">Failed to load data: {dataError.message}</div>;
  }
  if (!hasData) {
    return (
      <div class="loading">
        No data available for the selected year range. Only years with 12 months of service data and financial records are included.
      </div>
    );
  }

  return (
    <>
      <YearRangeFilter
        yearStart={yearStart}
        yearEnd={yearEnd}
        minYear={minYear}
        maxYear={maxYear}
        onYearStartChange={setYearStart}
        onYearEndChange={setYearEnd}
      />
      <p class="chart-desc">Only years with 12 months of service data and financial records are included.</p>
      <Metrics items={metrics} />
      <div class="grid">
        <Card title="Expenses per household & per individual" fullWidth>
        <Chart config={chartConfigs.overTime} height="tall" />
      </Card>
      <div class="grid-half">
        <Card title="People per household over time" desc="Individuals ÷ households by year">
          <Chart config={chartConfigs.peoplePerHousehold} height="tall" />
        </Card>
        <Card title="Year-over-year change in cost efficiency" desc="% change in expense per household and per individual vs prior year">
          <Chart config={chartConfigs.yoyChange} height="tall" />
        </Card>
      </div>
      <Card title="Total expenses, households & individuals" desc="Raw totals over time for context" fullWidth>
        <Chart config={chartConfigs.totals} height="tall" />
      </Card>
      <Card title="By year" fullWidth>
        <DataTable
          columns={['Year', 'Expenses', 'Households served', 'Individuals served', 'Expense per household', 'Expense per individual']}
          rows={tableRows}
        />
      </Card>
      </div>
    </>
  );
}
