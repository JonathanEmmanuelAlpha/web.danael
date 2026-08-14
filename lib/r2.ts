/**
 * §11 — Cloudflare R2 client (S3-compatible API).
 *
 * Used when STORAGE_PROVIDER=r2.
 */

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const REGION = process.env.R2_REGION ?? "auto";
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME ?? "danael-dev";

function getR2Client(): S3Client {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw AppError.provider("R2 credentials are not configured");
  }
  return new S3Client({
    region: REGION,
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
}

export interface PresignUploadParams {
  key: string;
  contentType: string;
  maxSizeBytes: number;
  expiresIn?: number; // seconds
}

export interface PresignDownloadParams {
  key: string;
  expiresIn?: number;
}

/**
 * §11.4 — Generate a presigned PUT URL for direct client upload.
 */
export async function presignUpload(params: PresignUploadParams): Promise<{
  uploadUrl: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
}> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.maxSizeBytes,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: params.expiresIn ?? 120, // 2 min
    });
    return {
      uploadUrl,
      key: params.key,
      method: "PUT",
      headers: { "Content-Type": params.contentType },
    };
  } catch (err) {
    logger.error("R2 presignUpload failed", { key: params.key, error: String(err) });
    throw AppError.provider("Could not generate upload URL");
  }
}

/**
 * §11.5 — Generate a presigned GET URL for secure download.
 */
export async function presignDownload(
  params: PresignDownloadParams,
): Promise<{ downloadUrl: string; key: string }> {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
  });

  try {
    const downloadUrl = await getSignedUrl(client, command, {
      expiresIn: params.expiresIn ?? 300, // 5 min
    });
    return { downloadUrl, key: params.key };
  } catch (err) {
    logger.error("R2 presignDownload failed", { key: params.key, error: String(err) });
    throw AppError.provider("Could not generate download URL");
  }
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  try {
    await client.send(command);
  } catch (err) {
    logger.error("R2 deleteObject failed", { key, error: String(err) });
    throw AppError.provider("Could not delete file");
  }
}

export const r2 = {
  presignUpload,
  presignDownload,
  deleteObject,
  bucket: BUCKET,
};
