import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Crawl a directory and return all files in the directory and subdirectories.
 * @param {string} directory
 * @returns {Promise<string[]>} The files in the directory
 */
export const crawlDirectory = async (directory) => {
  const files = [];
  const children = await readdir(directory);
  for await (const child of children) {
    const childPath = join(directory, child);
    const stats = await stat(childPath);
    if (stats.isDirectory()) {
      console.log(`Crawling ${childPath}`);
      const directoryFiles = await crawlDirectory(childPath);
      files.push(...directoryFiles);
    } else {
      files.push(childPath);
    }
  }
  return files;
};

/**
 * Write a file safely, creating the directory if it doesn't exist.
 * @param {string} path
 * @param {string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView> | Stream} data
 */
export const writeFileWithMkdir = async (path, data) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
};
