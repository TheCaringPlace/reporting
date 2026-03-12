import { formatCurrency } from '../lib/utils.js';

export function DataTable({ columns, rows }) {
  return (
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => {
                const c = typeof cell === 'object' && cell !== null && 'content' in cell ? cell : { content: cell };
                return (
                  <td key={j} class={c.className}>
                    {c.content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
