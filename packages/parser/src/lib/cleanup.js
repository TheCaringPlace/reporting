/**
 * Cleans a key by replacing spaces with underscores, removing parentheses and lowering the case
 * @param {string} key
 * @returns {string} The cleaned key
 */
const cleanupKey = (key) =>
  key
    .trim()
    .replace(/\(.*\)/, "")
    .replace(/^\w\. /, "")
    .replace(/ \/ /g, "_")
    .trim()
    .replace(/ /g, "_")
    .toLowerCase();

/**
 * Recurses down object tree cleaning up keys
 * @param {any} value
 * @returns
 */
const cleanupValue = (value) => {
  if (typeof value === "object") {
    return cleanupKeys(value);
  }
  return value;
};

/**
 * Cleans all keys in an object by calling cleanupKey on each key
 * @param {object} obj
 * @returns {object} The cleaned object
 */
const cleanupKeys = (obj) => {
  if (typeof obj !== "object") {
    return obj;
  }
  if (obj === null || obj === undefined) {
    return obj;
  }
  const entries = Object.entries(obj)
    .filter(([key]) => key !== "items" && key !== "sections")
    .map(([key, value]) => [cleanupKey(key), cleanupValue(value)]);

  if (obj.sections) {
    entries.push(
      ...Object.entries(obj.sections).map(([key, value]) => [
        cleanupKey(key),
        cleanupValue(value),
      ]),
    );
  }
  if (obj.items) {
    entries.push(
      ...Object.entries(obj.items).map(([key, value]) => [
        cleanupKey(key),
        cleanupValue(value),
      ]),
    );
  }
  return Object.fromEntries(entries);
};

/**
 * Consolidates a list of reports into a single report
 * @param {object[]} reports
 * @returns {object[]} The consolidated reports, grouped by month
 */
export const consolidateReports = (reports) => {
  const monthReports = reports
    .map((report) => cleanupKeys(report))
    .filter((report) => report.daterange)
    .filter((report) =>
      report.daterange.from.split("/")[0] === report.daterange.to.split("/")[0],
    );
  const uniqueDates = new Set(
    monthReports.map((report) => report.daterange.from),
  );
  return [...uniqueDates].sort().map((date) => {
    console.log(`Handling month: ${date}`);
    const thisMonthReports = monthReports.filter(
      (report) => report.daterange.from === date,
    );
    const consolidatedReport = {};
    thisMonthReports.forEach((report) => {
      Object.entries(report).forEach(([key, value]) => {
        if (key !== "reporttype") {
          consolidatedReport[key] = value;
        }
      });
    });
    return consolidatedReport;
  });
};
