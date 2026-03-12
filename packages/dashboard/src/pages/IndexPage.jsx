import { useMemo } from 'preact/hooks';
import { useFetchJson } from '../lib/useFetchJson.js';
import { formatCurrency, formatYearRange } from '../lib/utils.js';
import {
  buildServiceByYear,
  buildExpensesByYear,
  getExpensePerHouseholdYears,
} from '../lib/expense-per-household.js';
import { Card } from '../components/Card.jsx';
import { Metrics } from '../components/Metric.jsx';

export default function IndexPage() {
  const { data: serviceData, loading: serviceLoading, error: serviceError } = useFetchJson('./data/service-report.json');
  const { data: financialData, loading: financialLoading, error: financialError } = useFetchJson('./data/financials.json');

  const { serviceMetrics, financialMetrics, expenseMetrics } = useMemo(() => {
    if (!serviceData || !financialData) {
      return { serviceMetrics: [], financialMetrics: [], expenseMetrics: [] };
    }

    const serviceTotals = (serviceData ?? []).reduce(
      (acc, row) => {
        acc.households += row.client_types?.households ?? 0;
        acc.people += row.client_types?.total ?? 0;
        acc.volunteerHours += row.volunteerhours ?? 0;
        acc.reportPeriods += 1;
        return acc;
      },
      { households: 0, people: 0, volunteerHours: 0, reportPeriods: 0 }
    );

    const totalIncome = (financialData.income ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpenses = (financialData.expenses ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const financialYears = [...new Set([
      ...(financialData.income ?? []).map((r) => r.year),
      ...(financialData.expenses ?? []).map((r) => r.year),
    ])].filter(Boolean).sort();
    const yearRange = financialYears.length > 0 ? `${financialYears[0]}–${financialYears[financialYears.length - 1]}` : '—';

    const { serviceByYear, yearsWithFullServiceData } = buildServiceByYear(serviceData);
    const expensesByYear = buildExpensesByYear(financialData.expenses);
    const expensePerHouseholdYears = getExpensePerHouseholdYears(expensesByYear, yearsWithFullServiceData);

    let totalExpForMetrics = 0, totalHouseholdsForMetrics = 0, totalIndividualsForMetrics = 0;
    for (const y of expensePerHouseholdYears ?? []) {
      totalExpForMetrics += expensesByYear[y] ?? 0;
      const svc = serviceByYear[y] ?? { households: 0, individuals: 0 };
      totalHouseholdsForMetrics += svc.households;
      totalIndividualsForMetrics += svc.individuals;
    }
    const avgPerHousehold = totalHouseholdsForMetrics > 0 ? totalExpForMetrics / totalHouseholdsForMetrics : 0;
    const avgPerIndividual = totalIndividualsForMetrics > 0 ? totalExpForMetrics / totalIndividualsForMetrics : 0;
    const expenseYearRange = formatYearRange(expensePerHouseholdYears);

    return {
      serviceMetrics: [
        { value: serviceTotals.households.toLocaleString(), label: 'Households served' },
        { value: serviceTotals.people.toLocaleString(), label: 'People served' },
        { value: serviceTotals.volunteerHours.toLocaleString(), label: 'Volunteer hours' },
        { value: serviceTotals.reportPeriods, label: 'Report periods' },
      ],
      financialMetrics: [
        { value: formatCurrency(totalIncome), label: 'Total income', valueClass: 'income' },
        { value: formatCurrency(totalExpenses), label: 'Total expenses', valueClass: 'expense' },
        { value: formatCurrency(totalIncome - totalExpenses), label: 'Net', valueClass: 'net' },
        { value: yearRange, label: 'Years' },
      ],
      expenseMetrics: [
        { value: formatCurrency(avgPerHousehold), label: 'Expense per household' },
        { value: formatCurrency(avgPerIndividual), label: 'Expense per individual' },
        { value: totalHouseholdsForMetrics.toLocaleString(), label: 'Households (full-year data)' },
        { value: expenseYearRange, label: 'Years' },
      ],
    };
  }, [serviceData, financialData]);

  const loading = serviceLoading || financialLoading;
  const error = serviceError || financialError;

  if (loading) {
    return <div class="loading">Loading…</div>;
  }
  if (error) {
    return <div class="loading">Failed to load data: {error.message}</div>;
  }

  return (
    <div class="grid">
      <Card title="Service summary" fullWidth>
        <Metrics items={serviceMetrics} />
        <a href="#/service-report" class="report-link">View Service Report →</a>
      </Card>
      <Card title="Financial summary" fullWidth>
        <Metrics items={financialMetrics} />
        <a href="#/financials" class="report-link">View Financial Report →</a>
      </Card>
      <Card
        title="Expense per Household & Individual"
        desc="Combined expenses divided by households and individuals served. Only years with 12 months of service data."
        fullWidth
      >
        <Metrics items={expenseMetrics} />
        <a href="#/service-expenses" class="report-link">View Expense per Household & Individual →</a>
      </Card>
    </div>
  );
}
