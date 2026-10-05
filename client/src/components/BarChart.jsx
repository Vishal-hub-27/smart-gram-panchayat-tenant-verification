// A deliberately lightweight bar chart — no charting library dependency.
// Each row already comes pre-aggregated from the backend, so this only
// needs to turn { label, value } pairs into proportional bars.
export default function BarChart({ data, valueKey = 'value', labelKey = 'label', maxBars = 12 }) {
  const rows = data.slice(-maxBars);
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));

  if (rows.length === 0) {
    return <div className="chart-empty">No data yet</div>;
  }

  return (
    <div className="bar-chart">
      {rows.map((row, i) => (
        <div className="bar-chart-row" key={i}>
          <span className="bar-chart-label">{row[labelKey]}</span>
          <div className="bar-chart-track">
            <div className="bar-chart-fill" style={{ width: `${(row[valueKey] / max) * 100}%` }} />
          </div>
          <span className="bar-chart-value">{row[valueKey]}</span>
        </div>
      ))}
    </div>
  );
}
