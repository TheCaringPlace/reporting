export function Metric({ value, label, valueClass = '' }) {
  return (
    <div class="metric">
      <div class={`metric-value ${valueClass}`}>{value}</div>
      <div class="metric-label">{label}</div>
    </div>
  );
}

export function Metrics({ items }) {
  return (
    <div class="metrics">
      {items.map((item, i) => (
        <Metric key={i} value={item.value} label={item.label} valueClass={item.valueClass} />
      ))}
    </div>
  );
}
