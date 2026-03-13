import { useState, useMemo, useEffect } from 'preact/hooks';
import { useFetchJson } from '../lib/useFetchJson.js';
import { formatCurrency } from '../lib/utils.js';
import { chartDefaults } from '../lib/charts.js';
import { Metrics } from '../components/Metric.jsx';
import { Card } from '../components/Card.jsx';
import { Chart } from '../components/Chart.jsx';
import { DataTable } from '../components/DataTable.jsx';
import { YearRangeFilter } from '../components/YearRangeFilter.jsx';

export default function FinancialsPage() {
  const { data, loading: dataLoading, error: dataError } = useFetchJson('./data/financials.json');
  const dataYears = data?.years ?? [];
  const minYear = dataYears.length > 0 ? Math.min(...dataYears) : new Date().getFullYear() - 5;
  const maxYear = dataYears.length > 0 ? Math.max(...dataYears) : new Date().getFullYear();

  const [yearStart, setYearStart] = useState(minYear);
  const [yearEnd, setYearEnd] = useState(maxYear);
  useEffect(() => {
    setYearStart(minYear);
    setYearEnd(maxYear);
  }, [minYear, maxYear]);

  const filtered = useMemo(() => {
    if (!data) {
      return { expenses: [], income: [] };
    }
    const start = Math.min(yearStart, yearEnd);
    const end = Math.max(yearStart, yearEnd);
    const filter = (rows) => (rows ?? []).filter((r) => r.year >= start && r.year <= end);
    return {
      expenses: filter(data.expenses),
      income: filter(data.income),
    };
  }, [data, yearStart, yearEnd]);

  const metrics = useMemo(() => {
    const totalIncome = (filtered.income ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalExpense = (filtered.expenses ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const net = totalIncome - totalExpense;
    return [
      { value: formatCurrency(totalIncome), label: 'Total Income', valueClass: 'income' },
      { value: formatCurrency(totalExpense), label: 'Total Expenses', valueClass: 'expense' },
      { value: formatCurrency(net), label: 'Net', valueClass: 'net' },
    ];
  }, [filtered]);

  const chartConfigs = useMemo(() => {
    const byYear = {};
    (filtered.income ?? []).forEach((r) => {
      byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
      byYear[r.year].income += Number(r.amount) || 0;
    });
    (filtered.expenses ?? []).forEach((r) => {
      byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
      byYear[r.year].expense += Number(r.amount) || 0;
    });
    const years = Object.keys(byYear).sort((a, b) => a - b);

    const incomeData = years.map((y) => byYear[y].income);
    const expenseData = years.map((y) => byYear[y].expense);
    const netData = years.map((y) => byYear[y].income - byYear[y].expense);

    const incByCat = {};
    (filtered.income ?? []).forEach((r) => {
      const amt = Number(r.amount) || 0;
      incByCat[r.category] = (incByCat[r.category] || 0) + amt;
    });
    const incCatEntries = Object.entries(incByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const expByCat = {};
    (filtered.expenses ?? []).forEach((r) => {
      const amt = Number(r.amount) || 0;
      expByCat[r.category] = (expByCat[r.category] || 0) + amt;
    });
    const expCatEntries = Object.entries(expByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const incBySource = {};
    (filtered.income ?? []).forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (amt > 0) incBySource[r.source] = (incBySource[r.source] || 0) + amt;
    });
    const topIncome = Object.entries(incBySource).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const expBySource = {};
    (filtered.expenses ?? []).forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (amt > 0) expBySource[r.source] = (expBySource[r.source] || 0) + amt;
    });
    const topExpense = Object.entries(expBySource).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const incByYearCat = {};
    (filtered.income ?? []).forEach((r) => {
      if (!incByYearCat[r.year]) incByYearCat[r.year] = {};
      const amt = Number(r.amount) || 0;
      incByYearCat[r.year][r.category] = (incByYearCat[r.year][r.category] || 0) + amt;
    });
    const incCategories = [...new Set((filtered.income ?? []).map((r) => r.category))].filter(Boolean);
    const incCompColors = ['#059669', '#0891b2', '#2563eb', '#7c3aed'];

    const expByYearCat = {};
    (filtered.expenses ?? []).forEach((r) => {
      if (!expByYearCat[r.year]) expByYearCat[r.year] = {};
      const amt = Number(r.amount) || 0;
      expByYearCat[r.year][r.category] = (expByYearCat[r.year][r.category] || 0) + amt;
    });
    const expCategories = [...new Set((filtered.expenses ?? []).map((r) => r.category))].filter(Boolean);
    const expCompColors = ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4'];

    const top5IncSources = topIncome.slice(0, 5).map(([k]) => k);
    const incByYearSource = {};
    (filtered.income ?? []).forEach((r) => {
      if (!incByYearSource[r.year]) incByYearSource[r.year] = {};
      const amt = Number(r.amount) || 0;
      incByYearSource[r.year][r.source] = (incByYearSource[r.year][r.source] || 0) + amt;
    });
    const trendIncColors = ['#059669', '#047857', '#065f46', '#134e4a', '#042f2e'];

    const top5ExpSources = topExpense.slice(0, 5).map(([k]) => k);
    const expByYearSource = {};
    (filtered.expenses ?? []).forEach((r) => {
      if (!expByYearSource[r.year]) expByYearSource[r.year] = {};
      const amt = Number(r.amount) || 0;
      expByYearSource[r.year][r.source] = (expByYearSource[r.year][r.source] || 0) + amt;
    });
    const trendExpColors = ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4', '#6d4ab3'];

    const netMarginData = years.map((y) => {
      const inc = byYear[y].income;
      const exp = byYear[y].expense;
      const net = inc - exp;
      return inc > 0 ? Math.round((net / inc) * 100) : 0;
    });

    const yoyLabels = [];
    const yoyIncome = [];
    const yoyExpense = [];
    for (let i = 1; i < years.length; i++) {
      const y = years[i];
      const prevY = years[i - 1];
      const inc = byYear[y].income;
      const prevInc = byYear[prevY].income;
      const exp = byYear[y].expense;
      const prevExp = byYear[prevY].expense;
      yoyLabels.push(`${prevY}→${y}`);
      yoyIncome.push(prevInc > 0 ? Math.round(((inc - prevInc) / prevInc) * 100) : 0);
      yoyExpense.push(prevExp > 0 ? Math.round(((exp - prevExp) / prevExp) * 100) : 0);
    }

    return {
      overview: {
        type: 'line',
        data: {
          labels: years,
          datasets: [
            { label: 'Income', data: incomeData, borderColor: '#059669', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3 },
            { label: 'Expenses', data: expenseData, borderColor: '#b94a9e', backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointHoverBackgroundColor: '#b94a9e', pointHoverBorderColor: '#b94a9e' },
            {
              label: 'Net',
              data: netData,
              borderColor: 'transparent',
              fill: 'origin',
              pointRadius: 0,
              pointHoverRadius: 4,
              tension: 0.3,
              segment: {
                backgroundColor: (ctx) => {
                  const y = ctx.p1.parsed.y;
                  return y >= 0 ? 'rgba(5, 150, 105, 0.35)' : 'rgba(185, 74, 158, 0.35)';
                },
              },
            },
          ],
        },
        options: {
          scales: { y: { beginAtZero: true }, x: {} },
          plugins: {
            ...chartDefaults.plugins,
            tooltip: {
              callbacks: {
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  if (idx != null && netData[idx] != null) {
                    const n = netData[idx];
                    return n >= 0 ? `Net: +$${n.toLocaleString()}` : `Net: -$${Math.abs(n).toLocaleString()}`;
                  }
                  return '';
                },
              },
            },
          },
        },
      },
      incomeCategory: {
        type: 'doughnut',
        data: {
          labels: incCatEntries.map(([k]) => k),
          datasets: [{ data: incCatEntries.map(([, v]) => v), backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'] }],
        },
        options: chartDefaults,
      },
      expenseCategory: {
        type: 'doughnut',
        data: {
          labels: expCatEntries.map(([k]) => k),
          datasets: [{
            data: expCatEntries.map(([, v]) => v),
            backgroundColor: ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4', '#6d4ab3'],
            hoverBackgroundColor: ['#e08a8a', '#d96ab7', '#b58cd9', '#9d7cd4', '#8d6ec3'],
          }],
        },
        options: chartDefaults,
      },
      incomeSources: {
        type: 'bar',
        data: {
          labels: topIncome.map(([k]) => k),
          datasets: [{ label: 'Amount', data: topIncome.map(([, v]) => v), backgroundColor: '#059669' }],
        },
        options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } },
      },
      expenseSources: {
        type: 'bar',
        data: {
          labels: topExpense.map(([k]) => k),
          datasets: [{ label: 'Amount', data: topExpense.map(([, v]) => v), backgroundColor: '#b94a9e', hoverBackgroundColor: '#d96ab7' }],
        },
        options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } },
      },
      incomeComposition: {
        type: 'line',
        data: {
          labels: years,
          datasets: incCategories.map((cat, i) => ({
            label: cat,
            data: years.map((y) => incByYearCat[y]?.[cat] ?? 0),
            borderColor: incCompColors[i % incCompColors.length],
            backgroundColor: incCompColors[i % incCompColors.length],
            fill: true,
            tension: 0.3,
          })),
        },
        options: { scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } } },
      },
      expenseComposition: {
        type: 'line',
        data: {
          labels: years,
          datasets: expCategories.map((cat, i) => ({
            label: cat,
            data: years.map((y) => expByYearCat[y]?.[cat] ?? 0),
            borderColor: expCompColors[i % expCompColors.length],
            backgroundColor: expCompColors[i % expCompColors.length],
            fill: true,
            tension: 0.3,
            pointHoverBackgroundColor: expCompColors[i % expCompColors.length],
            pointHoverBorderColor: expCompColors[i % expCompColors.length],
          })),
        },
        options: { scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } } },
      },
      incomeSourcesTrend: {
        type: 'line',
        data: {
          labels: years,
          datasets: top5IncSources.map((src, i) => ({
            label: src,
            data: years.map((y) => incByYearSource[y]?.[src] ?? 0),
            borderColor: trendIncColors[i],
            backgroundColor: 'transparent',
            tension: 0.3,
          })),
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      expenseSourcesTrend: {
        type: 'line',
        data: {
          labels: years,
          datasets: top5ExpSources.map((src, i) => ({
            label: src,
            data: years.map((y) => expByYearSource[y]?.[src] ?? 0),
            borderColor: trendExpColors[i],
            backgroundColor: 'transparent',
            tension: 0.3,
            pointHoverBackgroundColor: trendExpColors[i],
            pointHoverBorderColor: trendExpColors[i],
          })),
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      netMargin: {
        type: 'bar',
        data: {
          labels: years,
          datasets: [{
            label: 'Net margin %',
            data: netMarginData,
            backgroundColor: netMarginData.map((v) => (v >= 0 ? 'rgba(5, 150, 105, 0.8)' : 'rgba(185, 74, 158, 0.8)')),
            hoverBackgroundColor: netMarginData.map((v) => (v >= 0 ? 'rgba(5, 150, 105, 1)' : 'rgba(185, 74, 158, 1)')),
          }],
        },
        options: {
          scales: {
            y: {
              title: { display: true, text: '%' },
              ticks: { callback: (v) => v + '%' },
            },
          },
        },
      },
      yoy: {
        type: 'bar',
        data: {
          labels: yoyLabels,
          datasets: [
            { label: 'Income', data: yoyIncome, backgroundColor: 'rgba(5, 150, 105, 0.7)' },
            { label: 'Expenses', data: yoyExpense, backgroundColor: 'rgba(185, 74, 158, 0.7)', hoverBackgroundColor: 'rgba(185, 74, 158, 1)' },
          ],
        },
        options: {
          scales: {
            y: {
              title: { display: true, text: '% change' },
              ticks: { callback: (v) => v + '%' },
            },
          },
        },
      },
    };
  }, [filtered]);

  const tableRows = useMemo(() => {
    const byYear = {};
    (filtered.income ?? []).forEach((r) => {
      byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
      byYear[r.year].income += Number(r.amount) || 0;
    });
    (filtered.expenses ?? []).forEach((r) => {
      byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
      byYear[r.year].expense += Number(r.amount) || 0;
    });
    const years = Object.keys(byYear).sort((a, b) => a - b);
    return years.map((y) => {
      const inc = byYear[y].income;
      const exp = byYear[y].expense;
      const net = inc - exp;
      const margin = inc > 0 ? Math.round((net / inc) * 100) : 0;
      return [y, formatCurrency(inc), formatCurrency(exp), formatCurrency(net), `${margin}%`];
    });
  }, [filtered]);

  const hasData = (filtered.income?.length ?? 0) > 0 || (filtered.expenses?.length ?? 0) > 0;

  if (dataLoading) {
    return <div class="loading">Loading…</div>;
  }
  if (dataError) {
    return <div class="loading">Failed to load data: {dataError.message}</div>;
  }
  if (!hasData) {
    return (
      <div class="loading">
        No financial data available for the selected year range.
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
      <Metrics items={metrics} />
      <div class="grid">
        <h3 class="section-heading">Overview</h3>
      <Card title="Income vs Expenses over time" fullWidth>
        <Chart config={chartConfigs.overview} height="tall" />
      </Card>
      <div class="grid-half">
        <Card title="Net margin" desc="Net as % of income">
          <Chart config={chartConfigs.netMargin} />
        </Card>
        <Card title="Year-over-year change">
          <Chart config={chartConfigs.yoy} height="tall" />
        </Card>
      </div>
      <h3 class="section-heading">Income</h3>
      <div class="grid-half">
        <Card title="Income by category">
          <Chart config={chartConfigs.incomeCategory} height="taller" />
        </Card>
        <Card title="Top income sources">
          <Chart config={chartConfigs.incomeSources} height="taller" />
        </Card>
      </div>
      <Card title="Income composition over time" fullWidth>
        <Chart config={chartConfigs.incomeComposition} height="tall" />
      </Card>
      <Card title="Top income sources over time" fullWidth>
        <Chart config={chartConfigs.incomeSourcesTrend} height="tall" />
      </Card>
      <h3 class="section-heading">Expenses</h3>
      <div class="grid-half">
        <Card title="Expenses by category">
          <Chart config={chartConfigs.expenseCategory} height="taller" />
        </Card>
        <Card title="Top expense sources">
          <Chart config={chartConfigs.expenseSources} height="taller" />
        </Card>
      </div>
      <Card title="Expense composition over time" fullWidth>
        <Chart config={chartConfigs.expenseComposition} height="tall" />
      </Card>
      <Card title="Top expense sources over time" fullWidth>
        <Chart config={chartConfigs.expenseSourcesTrend} height="tall" />
      </Card>
      <h3 class="section-heading">Summary</h3>
      <Card title="By year" fullWidth>
        <DataTable
          columns={['Year', 'Total income', 'Total expenses', 'Net', 'Net margin %']}
          rows={tableRows}
        />
      </Card>
      </div>
    </>
  );
}
