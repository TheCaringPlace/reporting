#!/usr/bin/env node
import { program } from "commander";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import { join, normalize } from "path";
import fastcsv from "fast-csv";
import { flatten } from "flat";
import { crawlDirectory, writeFileWithMkdir } from "./lib/fs.js";
import { extractTextFromPdf } from "./lib/pdf.js";
import { downloadFilesFromS3, uploadFilesToS3 } from "./lib/sync-s3.js";
import { parseReport } from "./parsers/parse-report.js";
import { consolidateReports } from "./lib/cleanup.js";
import {
  consolidateFinancials,
  consolidateCurrentYearFinancials,
} from "./lib/consolidate-financials.js";

program
  .name("service-report-parser")
  .description("CLI to parse service reports")
  .version("0.8.0");

program
  .command("sync-s3")
  .alias("download-s3")
  .requiredOption(
    "-b, --bucket-name <bucket-name>",
    "The name of the S3 bucket to sync",
  )
  .requiredOption(
    "-d, --destination-folder <destination-folder>",
    "The folder to save the synced files to",
  )
  .action(async ({ bucketName, destinationFolder }) => {
    await downloadFilesFromS3({ bucketName, destinationFolder });
  });

program
  .command("upload-s3")
  .requiredOption(
    "-b, --bucket-name <bucket-name>",
    "The name of the S3 bucket to sync",
  )
  .requiredOption(
    "-d, --source-folder <source-folder>",
    "The folder to source the files from",
  )
  .action(async ({ bucketName, sourceFolder }) => {
    await uploadFilesToS3({
      bucketName,
      sourceFolder,
    });
  });

program
  .command("to-text")
  .requiredOption(
    "-i, --input <input-folder>",
    "The folder containing the report PDFs",
  )
  .requiredOption(
    "-o, --output <output-folder>",
    "The folder to save the extracted text to",
  )
  .action(async ({ input, output }) => {
    const files = await crawlDirectory(input);
    for (const file of files) {
      if (!file.endsWith(".pdf")) {
        console.warn(`Skipping non-PDF file: ${file}`);
        continue;
      }
      console.info(`Extracting text from ${file}`);
      const text = await extractTextFromPdf(file);
      const targetPath = join(
        output,
        file.replace(input + "/", "").replace(".pdf", ".txt"),
      );
      console.info(`Saving text to ${targetPath}`);
      await writeFileWithMkdir(targetPath, text.text);
    }
  });

program
  .command("parse-reports")
  .description("Parse all reports in the input folder")
  .requiredOption(
    "-i, --input <input-folder>",
    "The folder containing the report PDFs",
  )
  .requiredOption(
    "-o, --output <output-folder>",
    "The folder to save the extracted JSON to",
  )
  .action(async ({ input, output }) => {
    const files = await crawlDirectory(input);
    for (const file of files) {
      if (!file.endsWith(".pdf")) {
        console.warn(`Skipping non-PDF file: ${file}`);
        continue;
      }
      console.info(`Parsing report ${file}`);
      const result = await extractTextFromPdf(file);

      const report = parseReport(result);
      if (report.reportType == null) {
        console.warn(
          `Skipping report ${file} because it could not be identified`,
        );
        continue;
      }
      const targetPath = join(
        output,
        normalize(file).replace(normalize(input), "").replace(".pdf", ".json"),
      );
      await writeFileWithMkdir(targetPath, JSON.stringify(report, null, 2));
    }
  });

program
  .command("consolidate-reports")
  .description("Consolidate all reports in the input folder")
  .requiredOption(
    "-i, --input <input-folder>",
    "The folder containing the report JSON files",
  )
  .requiredOption(
    "-o, --output <output-folder>",
    "The file to save the consolidated JSON and CSV",
  )
  .action(async ({ input, output }) => {
    const files = await crawlDirectory(input);
    const reports = await Promise.all(
      files.map(async (file) => {
        const text = await readFile(file, "utf8");
        return JSON.parse(text);
      }),
    );
    const consolidatedReports = consolidateReports(reports);
    await writeFileWithMkdir(
      join(output, "service-report.json"),
      JSON.stringify(consolidatedReports, null, 2),
    );

    const csvFile = join(output, "service-report.csv");
    const ws = createWriteStream(csvFile);

    fastcsv
      .write(
        consolidatedReports.map((report) => flatten(report)),
        { headers: true },
      )
      .pipe(ws)
      .on("finish", () => {
        console.log(`Finished writing data to: ${csvFile}`);
      });
  });

program
  .command("consolidate-financials")
  .description("Consolidate financial CSV files (Income, Expenses) into JSON")
  .requiredOption(
    "-i, --input <input-folder>",
    "The folder containing the financial CSV files",
  )
  .requiredOption(
    "-o, --output <output-file>",
    "The path for the output financials.json file",
  )
  .action(async ({ input, output }) => {
    await consolidateFinancials(input, output);
  });

program
  .command("consolidate-current-year-financials")
  .description(
    "Consolidate current year financials by merging proposed budget with monthly actuals",
  )
  .requiredOption(
    "-b, --budget <file>",
    "Path to the proposed budget JSON file",
  )
  .requiredOption(
    "-a, --actuals-folder <folder>",
    "Folder containing parsed monthly financial statement JSONs",
  )
  .requiredOption(
    "-o, --output <output-file>",
    "Path for the output consolidated JSON file",
  )
  .option(
    "-y, --year <year>",
    "Year to consolidate (defaults to current calendar year)",
    (v) => parseInt(v, 10),
  )
  .action(async ({ budget, actualsFolder, output, year }) => {
    await consolidateCurrentYearFinancials(
      budget,
      actualsFolder,
      output,
      year,
    );
  });

program.parse(process.argv);
