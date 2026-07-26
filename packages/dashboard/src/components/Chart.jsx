import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef } from "preact/hooks";
import { chartDefaults } from "../lib/charts.js";

ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
);

export function Chart({ config, height = "tall" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !config) {
      return;
    }
    const chart = new ChartJS(canvasRef.current, {
      ...config,
      options: { ...chartDefaults, ...config.options },
    });
    return () => chart.destroy();
  }, [config]);

  return (
    <div class={`chart-container ${height}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
