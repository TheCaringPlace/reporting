import { toLines } from "./report-text.js";
import { consumeLabeledCountSection } from "./section-parser.js";

/**
 * Parses Program Statistics report text into structured data.
 * Accepts text extracted from PDF (e.g. from to-text command or direct PDF).
 *
 * @param {string} text - Raw text from the report
 * @returns {Object} Parsed program statistics
 */
export function parseProgramStats(text) {
  const result = {
    dateRange: null,
    sections: {},
  };

  const lines = toLines(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Date range: "All people active from 1/1/2026 to 1/31/2026"
    const dateMatch = line.match(
      /All people active from (\d{1,2}\/\d{1,2}\/\d{4}) to (\d{1,2}\/\d{1,2}\/\d{4})/,
    );
    if (dateMatch) {
      result.dateRange = { from: dateMatch[1], to: dateMatch[2] };
      continue;
    }

    // Section headers: "1. Age groups...", "2. Sex...", etc.
    const sectionMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s+People)?\s*$/);
    if (sectionMatch) {
      const title = sectionMatch[2].trim();
      i = consumeLabeledCountSection(lines, i, result, title, (l) =>
        /^\d+\.\s+/.test(l),
      );
    }
  }

  return result;
}
