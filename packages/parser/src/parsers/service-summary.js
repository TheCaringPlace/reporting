import { toLines } from "./report-text.js";
import { consumeLabeledCountSection } from "./section-parser.js";

const NEXT_SECTION = (l) => /^\d+\.\s+/.test(l);

function parseClientTypesLine(line, state) {
  if (/^\d+$/.test(line.trim()) && state.pending) {
    const item = { label: state.pending, count: parseInt(line.trim(), 10) };
    state.pending = null;
    return item;
  }
  const itemMatch = line.match(/^([a-e])\.\s+(.+?)\s+(\d+)\s*$/i);
  if (itemMatch) {
    if (state.pending) state.pending = null;
    return { label: itemMatch[2].trim(), count: parseInt(itemMatch[3], 10) };
  }
  const letterMatch = line.match(/^([a-e])\.\s+(.+)$/i);
  if (letterMatch) {
    const label = letterMatch[2].trim();
    const trailingNum = label.match(/\s+(\d+)\s*$/);
    if (trailingNum) {
      if (state.pending) state.pending = null;
      return {
        label: label.replace(/\s+\d+\s*$/, "").trim(),
        count: parseInt(trailingNum[1], 10),
      };
    }
    if (state.pending) state.pending = null;
    state.pending = label;
    return null;
  }
  if (state.pending && !/^[a-e]\./i.test(line)) {
    state.pending = `${state.pending} ${line.trim()}`;
    return null;
  }
  return null;
}

function parseClientVisitFrequencyLine(line) {
  const m = line.match(/^([a-c])\.\s+(.+?)\s+(\d+)\s*$/i);
  return m ? { label: m[2].trim(), count: parseInt(m[3], 10) } : null;
}

function parseServicesLine(line) {
  const m = line.match(/^(.+?)\s+(\d+)\s*$/);
  return m ? { label: m[1].trim(), count: parseInt(m[2], 10) } : null;
}

/**
 * Parses Service Summary report text into structured data.
 * Accepts text extracted from PDF (e.g. from to-text command or direct PDF).
 *
 * @param {string} text - Raw text from the report
 * @returns {Object} Parsed service summary
 */
export function parseServiceSummary(text) {
  const result = {
    dateRange: null,
    sections: {},
    volunteerHours: null,
    operatingDays: null,
  };

  const lines = toLines(text);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const dateMatch = line.match(
      /^(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})$/,
    );
    if (dateMatch) {
      result.dateRange = { from: dateMatch[1], to: dateMatch[2] };
      continue;
    }

    if (/^1\.\s+Client types$/i.test(line)) {
      const clientTypesState = { pending: null };
      i = consumeLabeledCountSection(
        lines,
        i,
        result,
        "Client types",
        NEXT_SECTION,
        null,
        { parseDataLine: parseClientTypesLine, state: clientTypesState },
      );
      const section = result.sections["Client types"];
      if (clientTypesState.pending) {
        section.items[clientTypesState.pending] = 0;
      }
      continue;
    }

    if (/^2\.\s+Client visit frequency/i.test(line)) {
      i = consumeLabeledCountSection(
        lines,
        i,
        result,
        "Client visit frequency",
        NEXT_SECTION,
        null,
        { parseDataLine: parseClientVisitFrequencyLine },
      );
      continue;
    }

    if (/^3\.\s+Services/i.test(line)) {
      i = consumeLabeledCountSection(
        lines,
        i,
        result,
        "Services",
        NEXT_SECTION,
        null,
        { parseDataLine: parseServicesLine },
      );
      continue;
    }

    if (/^4\.\s+Volunteer hours$/i.test(line) && i + 1 < lines.length) {
      const numMatch = lines[i + 1].match(/^([\d.]+)\s*$/);
      if (numMatch) {
        result.volunteerHours = parseFloat(numMatch[1]);
        i++;
      }
      continue;
    }

    if (/^5\.\s+Operating days$/i.test(line) && i + 1 < lines.length) {
      const numMatch = lines[i + 1].match(/^(\d+)\s*$/);
      if (numMatch) {
        result.operatingDays = parseInt(numMatch[1], 10);
        i++;
      }
    }
  }

  return result;
}
