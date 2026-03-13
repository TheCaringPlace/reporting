import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { join, relative } from "path";
import { crawlDirectory, writeFileWithMkdir } from "./fs.js";

/**
 * Download all files from an S3 bucket to a local folder.
 * Uses the AWS SDK (no CLI required). Preserves directory structure.
 *
 * @param {{ bucketName: string, destinationFolder: string }}
 */
export const downloadFilesFromS3 = async ({
  bucketName,
  destinationFolder,
}) => {
  console.info(`Syncing from s3://${bucketName} to ${destinationFolder}`);
  const client = new S3Client({});

  for await (const page of paginateListObjectsV2(
    { client, pageSize: 1000 },
    { Bucket: bucketName },
  )) {
    if (!page.Contents?.length) continue;

    await Promise.all(
      page.Contents.filter((obj) => !obj.Key?.endsWith("/")).map(
        async (obj) => {
          const { Body, ContentType } = await client.send(
            new GetObjectCommand({ Bucket: bucketName, Key: obj.Key }),
          );
          if (ContentType?.includes("application/x-directory")) return;

          const path = join(destinationFolder, obj.Key);
          await writeFileWithMkdir(path, Body);
          console.info(`Downloaded ${obj.Key}`);
        },
      ),
    );
  }
};

/**
 * Compute MD5 hash of buffer for comparison with S3 ETag.
 * S3 ETag for single-part uploads is the MD5 hex digest.
 *
 * @param {Buffer} buffer
 * @returns {string} MD5 hex string
 */
const md5Hex = (buffer) =>
  createHash("md5").update(buffer).digest("hex");

/**
 * Upload files from a local folder to an S3 bucket.
 * - Removes files from S3 that no longer exist locally
 * - Only uploads files that are new or changed (skips unchanged files)
 * Preserves directory structure; keys use paths relative to the source folder.
 *
 * @param {{ bucketName: string, sourceFolder: string }}
 */
export const uploadFilesToS3 = async ({ bucketName, sourceFolder }) => {
  console.info(
    `Syncing files from ${sourceFolder} to S3 bucket ${bucketName}`,
  );
  const client = new S3Client({});
  const files = await crawlDirectory(sourceFolder);
  const localKeys = new Set(
    files.map((filePath) =>
      relative(sourceFolder, filePath).replace(/\\/g, "/"),
    ),
  );
  console.info(`Found ${files.length} local file(s)`);

  // Remove files from S3 that are not present locally
  console.info("Scanning S3 for files to remove (present in S3 but not locally)…");
  let deletedCount = 0;
  for await (const page of paginateListObjectsV2(
    { client, pageSize: 1000 },
    { Bucket: bucketName },
  )) {
    if (!page.Contents?.length) continue;

    const keysToDelete = page.Contents.filter(
      (obj) => obj.Key && !obj.Key.endsWith("/") && !localKeys.has(obj.Key),
    );

    for (const obj of keysToDelete) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucketName, Key: obj.Key }),
      );
      console.info(`  Deleted ${obj.Key} (not found locally)`);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.info(`Removed ${deletedCount} file(s) from S3`);
  }

  // Upload only new or changed files
  console.info("Checking local files for upload (new or changed only)…");
  let uploadedCount = 0;
  let skippedCount = 0;
  for (const filePath of files) {
    const key = relative(sourceFolder, filePath).replace(/\\/g, "/");
    const body = await readFile(filePath);
    const localMd5 = md5Hex(body);

    let shouldUpload = true;
    try {
      const { ETag } = await client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: key }),
      );
      // S3 ETag is quoted; single-part uploads use MD5 hex
      if (ETag && ETag.replace(/"/g, "") === localMd5) {
        shouldUpload = false;
      }
    } catch (err) {
      // NoSuchKey or NotFound when object doesn't exist; proceed with upload
      if (err.name !== "NoSuchKey" && err.name !== "NotFound") throw err;
    }

    if (shouldUpload) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: body,
        }),
      );
      console.info(`  Uploaded ${key}`);
      uploadedCount++;
    } else {
      console.info(`  Skipped ${key} (unchanged)`);
      skippedCount++;
    }
  }
  console.info(
    `Sync complete: ${uploadedCount} uploaded, ${skippedCount} skipped (unchanged), ${deletedCount} removed`,
  );
};
