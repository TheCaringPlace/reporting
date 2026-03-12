export function Card({ title, desc, children, fullWidth }) {
  return (
    <div class={`card ${fullWidth ? 'full-width' : ''}`}>
      {title && <h2>{title}</h2>}
      {desc && <p class="chart-desc">{desc}</p>}
      {children}
    </div>
  );
}
