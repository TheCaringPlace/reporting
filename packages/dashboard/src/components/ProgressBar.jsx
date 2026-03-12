import { formatCurrency } from '../lib/utils.js';

export function ProgressBar({ label, expected, actual, isIncome, monthsLabel }) {
  const pct = expected > 0 ? (actual / expected) * 100 : 0;
  const statusClass = isIncome
    ? pct >= 100 ? 'on-track' : pct >= 50 ? 'partial' : 'behind'
    : pct <= 100 ? 'on-track' : pct <= 120 ? 'over' : 'over-budget';
  const fillPct = Math.min(pct, 100);
  const overflowPct = Math.min(Math.max(pct - 100, 0), 50);

  return (
    <div class="budget-progress">
      <div class="progress-bar-label">
        <span>{label} {monthsLabel || ''}</span>
        <span class="progress-bar-values">
          {formatCurrency(actual)} / {formatCurrency(expected)} expected ({pct.toFixed(1)}%)
        </span>
      </div>
      <div class="progress-bar-track">
        <div class={`progress-bar-fill ${statusClass}`} style={{ width: `${fillPct}%` }} />
        {!isIncome && overflowPct > 0 && (
          <div class="progress-bar-fill over-budget" style={{ width: `${overflowPct}%`, left: '100%' }} />
        )}
      </div>
    </div>
  );
}
