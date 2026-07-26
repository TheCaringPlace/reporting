import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

/**
 * @typedef {Object} TextResult
 * @property {string} text - The extracted text
 * @property {{text: string}[]} pages - The pages in the PDF
 */

/**
 * Extracts text from a PDF file
 * @param {string} filePath - The path to the PDF file to extract text from
 * @returns {Promise<TextResult>} - The extracted text
 */
export const extractTextFromPdf = async (filePath) => {
  const dataBuffer = await fs.readFile(filePath);
  const parser = new PDFParse({
    data: dataBuffer,
  });
  const data = await parser.getText();
  return data;
};
