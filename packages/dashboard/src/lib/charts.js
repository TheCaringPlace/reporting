/**
 * Shared Chart.js configuration and helpers.
 */

export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: "bottom" } },
};

/**
 * Destroy a chart from a charts map and clear the slot.
 * @param {Record<string, import('chart.js').Chart | null>} charts
 * @param {string} id
 */
export function destroyChart(charts, id) {
  if (charts[id]) {
    charts[id].destroy();
    charts[id] = null;
  }
}
