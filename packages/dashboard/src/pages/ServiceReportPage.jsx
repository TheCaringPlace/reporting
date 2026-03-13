import { useState, useMemo } from 'preact/hooks';
import { useFetchJson } from '../lib/useFetchJson.js';
import { formatPeriod, parseDatePart } from '../lib/utils.js';
import { chartDefaults } from '../lib/charts.js';
import { Metrics } from '../components/Metric.jsx';
import { Card } from '../components/Card.jsx';
import { Chart } from '../components/Chart.jsx';
import { DataTable } from '../components/DataTable.jsx';

const MONTHS = [
  { value: 'all', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function ServiceReportPage() {
  const { data, loading: dataLoading, error: dataError } = useFetchJson('./data/service-report.json');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');

  const sortedData = useMemo(() => {
    const raw = data ?? [];
    return [...raw]
      .filter((row) => row.daterange?.from)
      .map((row) => {
        const parsed = parseDatePart(row.daterange.from);
        const date = parsed ? new Date(parsed.year, parsed.month - 1, 1) : new Date(0);
        return {
          ...row,
          date,
          year: parsed?.year ?? date.getFullYear(),
          month: parsed?.month ?? date.getMonth() + 1,
          label: formatPeriod(row.daterange),
        };
      })
      .sort((a, b) => a.date - b.date);
  }, [data]);

  const years = useMemo(() => [...new Set(sortedData.map((r) => r.year))].sort(), [sortedData]);

  const filtered = useMemo(() => {
    return sortedData.filter((row) => {
      const yearMatch = year === 'all' || row.year === Number(year);
      const monthMatch = month === 'all' || row.month === Number(month);
      return yearMatch && monthMatch;
    });
  }, [sortedData, year, month]);

  const metrics = useMemo(() => {
    const totals = filtered.reduce(
      (acc, row) => {
        acc.households += row.client_types?.households ?? 0;
        acc.people += row.client_types?.total ?? 0;
        acc.volunteerHours += row.volunteerhours ?? 0;
        acc.days += row.operatingdays ?? 0;
        return acc;
      },
      { households: 0, people: 0, volunteerHours: 0, days: 0 }
    );
    return [
      { value: totals.households.toLocaleString(), label: 'Households' },
      { value: totals.people.toLocaleString(), label: 'People served' },
      { value: totals.volunteerHours.toLocaleString(), label: 'Volunteer hours' },
      { value: totals.days, label: 'Operating days' },
    ];
  }, [filtered]);

  const chartConfigs = useMemo(() => {
    const labels = filtered.map((r) => r.label);
    const svcLabel = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const seniorsPerRow = (r) => {
      const s = r.total_number_of_seniors_served || {};
      return (s.households_without_children ?? 0) + (s.households_with_children ?? 0);
    };

    const vf = filtered.reduce(
      (acc, r) => {
        const v = r.client_visit_frequency || {};
        acc.first += v.first_time ?? 0;
        acc.second += v.second_time ?? 0;
        acc.third += v.third_or_more_time ?? 0;
        return acc;
      },
      { first: 0, second: 0, third: 0 }
    );

    const serviceCounts = {};
    filtered.forEach((r) => {
      const svc = r.services || {};
      Object.entries(svc).forEach(([k, v]) => {
        if (!k.startsWith('z_') || v > 0) {
          const name = k.replace(/^z_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          serviceCounts[name] = (serviceCounts[name] ?? 0) + Number(v);
        }
      });
    });
    const topServices = Object.entries(serviceCounts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    const ageGroups = {};
    const ageKeys = ['infants:_0_-_5', 'between_6_and_12', 'between_13_and_27', 'between_18_and_30', 'between_31_and_45', 'between_46_and_59', 'between_60_and_74', '75_and_over', 'unknown'];
    const ageLabels = { 'infants:_0_-_5': '0–5', between_6_and_12: '6–12', between_13_and_27: '13–17', between_18_and_30: '18–30', between_31_and_45: '31–45', between_46_and_59: '46–59', between_60_and_74: '60–74', '75_and_over': '75+', unknown: 'Unknown' };
    filtered.forEach((r) => {
      const ag = r.age_groups || {};
      ageKeys.forEach((k) => {
        ageGroups[k] = (ageGroups[k] ?? 0) + (ag[k] ?? 0);
      });
    });

    const incLevels = {};
    filtered.forEach((r) => {
      const inc = r.income_levels || {};
      Object.entries(inc).forEach(([k, v]) => {
        incLevels[k] = (incLevels[k] ?? 0) + Number(v);
      });
    });
    const incLabels = { extremely_low: 'Extremely low', very_low: 'Very low', low: 'Low', normal: 'Normal', 'n/a': 'N/A' };

    const sexCounts = {};
    filtered.forEach((r) => {
      const s = r.sex || {};
      Object.entries(s).forEach(([k, v]) => {
        sexCounts[k] = (sexCounts[k] ?? 0) + Number(v);
      });
    });
    const sexLabels = { f: 'Female', m: 'Male', o: 'Other', 'n/a': 'N/A' };
    const sexEntries = Object.entries(sexCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const ethnicCounts = {};
    filtered.forEach((r) => {
      const eb = r.ethnic_background || {};
      Object.entries(eb).forEach(([k, v]) => {
        ethnicCounts[k] = (ethnicCounts[k] ?? 0) + Number(v);
      });
    });
    const ethnicLabels = { american_indian_alaskan_native: 'American Indian / Alaskan Native', asian_pacific: 'Asian / Pacific Islander', black_african_american: 'Black / African American', hispanic: 'Hispanic', multiracial: 'Multiracial', white: 'White', unknown: 'Unknown', 'n/a': 'N/A' };
    const ethnicEntries = Object.entries(ethnicCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

    const incKeys = ['extremely_low', 'very_low', 'low', 'normal', 'n/a'];

    return {
      clients: {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Total people', data: filtered.map((r) => r.client_types?.total ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3 },
            { label: 'Households', data: filtered.map((r) => r.client_types?.households ?? 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)', fill: true, tension: 0.3 },
            { label: 'Volunteer hours', data: filtered.map((r) => r.volunteerhours ?? 0), borderColor: '#0891b2', yAxisID: 'y1', borderDash: [5, 5], tension: 0.3 },
          ],
        },
        options: {
          scales: {
            y: { beginAtZero: true },
            y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
          },
        },
      },
      population: {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Adults', data: filtered.map((r) => r.client_types?.adults ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.2)', fill: true, tension: 0.3 },
            { label: 'Children', data: filtered.map((r) => r.client_types?.children ?? 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.2)', fill: true, tension: 0.3 },
            { label: 'Seniors', data: filtered.map(seniorsPerRow), borderColor: '#0891b2', backgroundColor: 'rgba(8, 145, 178, 0.2)', fill: true, tension: 0.3 },
          ],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      visitsTrend: {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'First visit', data: filtered.map((r) => (r.client_visit_frequency || {}).first_time ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3 },
            { label: 'Second visit', data: filtered.map((r) => (r.client_visit_frequency || {}).second_time ?? 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)', fill: true, tension: 0.3 },
            { label: 'Third or more', data: filtered.map((r) => (r.client_visit_frequency || {}).third_or_more_time ?? 0), borderColor: '#0891b2', backgroundColor: 'rgba(8, 145, 178, 0.1)', fill: true, tension: 0.3 },
          ],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      servicesTrend: {
        type: 'line',
        data: {
          labels,
          datasets: ['food', 'clothing', 'laundry', 'housewares', 'senior_box', 'transportation'].map((k, i) => ({
            label: svcLabel(k),
            data: filtered.map((r) => (r.services || {})[k] ?? 0),
            borderColor: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#b87070'][i],
            tension: 0.3,
          })),
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      incomeTrend: {
        type: 'bar',
        data: {
          labels,
          datasets: incKeys.map((k, i) => ({
            label: incLabels[k],
            data: filtered.map((r) => (r.income_levels || {})[k] ?? 0),
            backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'][i],
          })),
        },
        options: { scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } } },
      },
      volunteerPerHousehold: {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Hours per household',
            data: filtered.map((r) => {
              const h = r.client_types?.households ?? 0;
              return h > 0 ? Number(((r.volunteerhours ?? 0) / h).toFixed(1)) : 0;
            }),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      peoplePerHousehold: {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'People per household',
            data: filtered.map((r) => {
              const h = r.client_types?.households ?? 0;
              return h > 0 ? Number(((r.client_types?.total ?? 0) / h).toFixed(1)) : 0;
            }),
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      operatingDays: {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Operating days',
            data: filtered.map((r) => r.operatingdays ?? 0),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            fill: true,
            tension: 0.3,
          }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      households: {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Without children', data: filtered.map((r) => r.number_of_households?.households_without_children ?? 0), backgroundColor: '#2563eb' },
            { label: 'With children', data: filtered.map((r) => r.number_of_households?.households_with_children ?? 0), backgroundColor: '#7c3aed' },
          ],
        },
        options: { scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } } },
      },
      visits: {
        type: 'doughnut',
        data: {
          labels: ['First visit', 'Second visit', 'Third or more'],
          datasets: [{ data: [vf.first, vf.second, vf.third], backgroundColor: ['#2563eb', '#7c3aed', '#0891b2'] }],
        },
        options: chartDefaults,
      },
      services: {
        type: 'bar',
        data: {
          labels: topServices.map(([k]) => k),
          datasets: [{ label: 'Usage count', data: topServices.map(([, v]) => v), backgroundColor: '#2563eb' }],
        },
        options: { indexAxis: 'y', scales: { x: { beginAtZero: true } } },
      },
      ages: {
        type: 'bar',
        data: {
          labels: ageKeys.filter((k) => (ageGroups[k] ?? 0) > 0).map((k) => ageLabels[k]),
          datasets: [{ label: 'Count', data: ageKeys.filter((k) => (ageGroups[k] ?? 0) > 0).map((k) => ageGroups[k]), backgroundColor: '#2563eb' }],
        },
        options: { scales: { y: { beginAtZero: true } } },
      },
      income: {
        type: 'doughnut',
        data: {
          labels: Object.keys(incLevels).map((k) => incLabels[k] ?? k),
          datasets: [{ data: Object.values(incLevels), backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'] }],
        },
        options: chartDefaults,
      },
      sex: {
        type: 'doughnut',
        data: {
          labels: sexEntries.map(([k]) => sexLabels[k] ?? k),
          datasets: [{ data: sexEntries.map(([, v]) => v), backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#94a3b8'] }],
        },
        options: chartDefaults,
      },
      ethnicity: {
        type: 'doughnut',
        data: {
          labels: ethnicEntries.map(([k]) => ethnicLabels[k] ?? k.replace(/_/g, ' ')),
          datasets: [{ data: ethnicEntries.map(([, v]) => v), backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#b87070', '#ca8a04', '#64748b', '#94a3b8'] }],
        },
        options: chartDefaults,
      },
    };
  }, [filtered]);

  const tableRows = useMemo(() => {
    return filtered.map((r) => {
      const h = r.client_types?.households ?? 0;
      const p = r.client_types?.total ?? 0;
      const ppH = h > 0 ? (p / h).toFixed(1) : '—';
      return [r.label, h.toLocaleString(), p.toLocaleString(), (r.volunteerhours ?? 0).toLocaleString(), r.operatingdays ?? 0, ppH];
    });
  }, [filtered]);

  if (dataLoading) {
    return <div class="loading">Loading…</div>;
  }
  if (dataError) {
    return <div class="loading">Failed to load data: {dataError.message}</div>;
  }
  if (!sortedData.length) {
    return <div class="loading">No service report data available.</div>;
  }

  return (
    <>
      <div class="filters">
        <div class="filter-group">
          <label for="year">Year</label>
          <select id="year" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div class="filter-group">
          <label for="month">Month</label>
          <select id="month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Metrics items={metrics} />
      <div class="grid">
        <h3 class="section-heading">Volume & trends</h3>
      <Card title="Clients served over time" fullWidth>
        <Chart config={chartConfigs.clients} height="tall" />
      </Card>
      <div class="grid-half">
        <Card title="Operating days over time">
          <Chart config={chartConfigs.operatingDays} />
        </Card>
        <Card title="Volunteer hours per household">
          <Chart config={chartConfigs.volunteerPerHousehold} />
        </Card>
        <Card title="People per household">
          <Chart config={chartConfigs.peoplePerHousehold} />
        </Card>
      </div>
      <h3 class="section-heading">Visit patterns</h3>
      <div class="grid-half">
        <Card title="First-time vs returning clients over time">
          <Chart config={chartConfigs.visitsTrend} />
        </Card>
        <Card title="Visit frequency">
          <Chart config={chartConfigs.visits} />
        </Card>
      </div>
      <h3 class="section-heading">Services</h3>
      <div class="grid-half">
        <Card title="Top services over time">
          <Chart config={chartConfigs.servicesTrend} height="tall" />
        </Card>
        <Card title="Top services used">
          <Chart config={chartConfigs.services} />
        </Card>
      </div>
      <h3 class="section-heading">Client demographics</h3>
      <div class="grid-half">
        <Card title="Population: adults vs children vs seniors">
          <Chart config={chartConfigs.population} height="tall" />
        </Card>
        <Card title="Households & people">
          <Chart config={chartConfigs.households} />
        </Card>
      </div>
      <div class="grid-half">
        <Card title="Age distribution">
          <Chart config={chartConfigs.ages} />
        </Card>
        <Card title="Sex">
          <Chart config={chartConfigs.sex} />
        </Card>
        <Card title="Ethnic background">
          <Chart config={chartConfigs.ethnicity} />
        </Card>
      </div>
      <h3 class="section-heading">Income levels</h3>
      <div class="grid-half">
        <Card title="Income level mix over time">
          <Chart config={chartConfigs.incomeTrend} />
        </Card>
        <Card title="Income levels">
          <Chart config={chartConfigs.income} />
        </Card>
      </div>
      <h3 class="section-heading">Summary</h3>
      <Card title="By period" fullWidth>
        <DataTable
          columns={['Period', 'Households', 'People served', 'Volunteer hours', 'Operating days', 'People per household']}
          rows={tableRows}
        />
      </Card>
      </div>
    </>
  );
}
