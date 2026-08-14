/**
 * Storage abstraction layer (§11).
 *
 * Bascule de provider via STORAGE_PROVIDER env var:
 *   - "r2"        → Cloudflare R2 (default)
 *   - "uploadthing" → Uploadthing
 *
 * A single surface the rest of the app imports.
 */

import { AppError, type ApiSuccess } from "@/lib/api-response";
import { r2 } from "@/lib/r2";

export type StorageProvider = "r2" | "uploadthing";

export interface PresignUploadInput {
  key: string;
  contentType: string;
  maxSizeBytes: number;
  expiresIn?: number;
}

export interface PresignUploadOutput {
  uploadUrl: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface PresignDownloadInput {
  key: string;
  expiresIn?: number;
}

export interface PresignDownloadOutput {
  downloadUrl: string;
  key: string;
}

export interface StorageAdapter {
  provider: StorageProvider;
  presignUpload(input: PresignUploadInput): Promise<PresignUploadOutput>;
  presignDownload(input: PresignDownloadInput): Promise<PresignDownloadOutput>;
  deleteObject(key: string): Promise<void>;
}

function getProvider(): StorageProvider {
  const raw = process.env.STORAGE_PROVIDER ?? "r2";
  if (raw !== "r2" && raw !== "uploadthing") {
    throw AppError.internal(`Unknown STORAGE_PROVIDER: ${raw}`);
  }
  return raw;
}

const r2Adapter: StorageAdapter = {
  provider: "r2",
  async presignUpload(input) {
    return r2.presignUpload(input);
  },
  async presignDownload(input) {
    const r = await r2.presignDownload(input);
    return { downloadUrl: r.downloadUrl, key: r.key };
  },
  async deleteObject(key) {
    return r2.deleteObject(key);
  },
};

export const storage: StorageAdapter = r2Adapter;

export type { ApiSuccess };
