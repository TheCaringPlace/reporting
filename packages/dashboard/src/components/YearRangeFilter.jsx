export function YearRangeFilter({ yearStart, yearEnd, minYear, maxYear, onYearStartChange, onYearEndChange }) {
  const handleStart = (e) => {
    const v = Number(e.target.value);
    onYearStartChange(v);
    if (v > yearEnd) onYearEndChange(v);
  };
  const handleEnd = (e) => {
    const v = Number(e.target.value);
    onYearEndChange(v);
    if (v < yearStart) onYearStartChange(v);
  };

  return (
    <div class="filters">
      <div class="filter-group year-range">
        <label>Year range</label>
        <div class="year-sliders">
          <div class="slider-group">
            <span class="year-value">{yearStart}</span>
            <input type="range" min={minYear} max={maxYear} value={yearStart} onInput={handleStart} />
          </div>
          <div class="slider-group">
            <span class="year-value">{yearEnd}</span>
            <input type="range" min={minYear} max={maxYear} value={yearEnd} onInput={handleEnd} />
          </div>
        </div>
      </div>
    </div>
  );
}
