/**
 * Shared utilities for parsing labeled-count sections.
 * Used by pantry-stats, program-stats, and service-summary.
 */

/**
 * Consumes data lines for a section: "number label" or "label number" pairs.
 * Stops when a line matches nextSectionTest (e.g. next section header).
 *
 * @param {string[]} lines - All lines
 * @param {number} start - Index of section header line
 * @param {Object} result - Parent result with result.sections
 * @param {string} title - Section title (key in result.sections)
 * @param {(line: string) => boolean} nextSectionTest - Returns true when line starts next section
 * @param {{ label: string, count: number }} [initialItem] - First row when it's on the header line
 * @param {{ parseDataLine?: (line: string, state?: object) => { label: string, count: number } | null, state?: object }} [options] - Custom line parser and state for multi-line handling
 * @returns {number} Last index consumed
 */
export function consumeLabeledCountSection(
  lines,
  start,
  result,
  title,
  nextSectionTest,
  initialItem,
  options = {},
) {
  const { parseDataLine, state = {} } = options;

  const defaultParseDataLine = (line) => {
    const m = line.match(/^(\d+)\s+(.+)$/);
    return m ? { label: m[2].trim(), count: parseInt(m[1], 10) } : null;
  };

  const parseLine = parseDataLine || defaultParseDataLine;

  const section = { items: {} };
  if (initialItem) {
    section.items[initialItem.label] = initialItem.count;
  }
  let i = start;
  for (i++; i < lines.length; i++) {
    const dataLine = lines[i];

    if (nextSectionTest(dataLine)) {
      i--;
      break;
    }

    const item = parseLine(dataLine, state);
    if (item) {
      section.items[item.label] = item.count;
    }
  }
  result.sections[title] = section;
  return i;
}
