import { toLines } from "./report-text.js";
import { consumeLabeledCountSection } from "./section-parser.js";

/**
 * Parses Pantry Statistical Report text into structured data.
 * Accepts text extracted from PDF (e.g. from to-text command or direct PDF).
 *
 * @param {string} text - Raw text from the report
 * @returns {Object} Parsed pantry statistics
 */
export function parsePantryStats(text) {
  const result = {
    dateRange: null,
    sections: {},
  };

  const lines = toLines(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Date range: "1/1/2025 to 1/31/2025"
    const dateMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})$/,
    );
    if (dateMatch) {
      result.dateRange = { from: dateMatch[1], to: dateMatch[2] };
      continue;
    }

    // Section header with first row on same line
    // e.g. "A. Number of households 	75	Households without children"
    const sectionWithData = line.match(/^([A-F])\.\s+(.+?)\s+(\d+)\s+(.+)$/);
    if (sectionWithData) {
      const title = sectionWithData[2].trim();
      i = consumeLabeledCountSection(
        lines,
        i,
        result,
        title,
        (l) => /^[A-F]\.\s+/.test(l),
        {
          label: sectionWithData[4].trim(),
          count: parseInt(sectionWithData[3], 10),
        },
      );
      continue;
    }

    // Section header only
    const sectionMatch = line.match(/^([A-F])\.\s+(.+)$/);
    if (sectionMatch) {
      const title = sectionMatch[2].trim();
      i = consumeLabeledCountSection(lines, i, result, title, (l) =>
        /^[A-F]\.\s+/.test(l),
      );
    }
  }

  return result;
}
