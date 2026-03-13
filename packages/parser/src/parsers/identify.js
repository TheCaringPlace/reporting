/**
 * Identifies the type of report based on the text
 * @param {string} text - The text to identify the report type from
 * @returns {'pantry-stats' | 'program-stats' | 'service-summary' | 'financial-report' | null} The type of report
 */
export function identifyReport(text) {
  if (text.includes("Pantry Statistical Report")) {
    return "pantry-stats";
  }
  if (text.includes("Program Statistics")) {
    return "program-stats";
  }
  if (text.includes("Service summary")) {
    return "service-summary";
  }
  if(text.includes("COMPARATIVE MONTHLY FINANCIAL REPORT")) {
    return "financial-statement";
  }
  return null;
}
