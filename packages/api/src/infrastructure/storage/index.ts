import { randomUUID } from "node:crypto";

import type {} from "multer";
import { Client } from "minio";
import { env } from "@doctor.com/env/server";

const UNAVAILABLE_STORAGE_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
]);

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ROOT_USER,
  secretKey: env.MINIO_ROOT_PASSWORD,
});

export const storageConfig = {
  bucket: env.MINIO_BUCKET,
  endpoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  protocol: env.MINIO_USE_SSL ? "https" : "http",
};

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function isStorageUnavailableError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code !== null && UNAVAILABLE_STORAGE_ERROR_CODES.has(code);
}

export async function ensureBucketExists(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(env.MINIO_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(env.MINIO_BUCKET);
      console.log(`✅ MinIO bucket "${env.MINIO_BUCKET}" created.`);
    } else {
      console.log(`✅ MinIO bucket "${env.MINIO_BUCKET}" already exists.`);
    }
  } catch (err) {
    console.error(
      "❌ MinIO bucket check failed:",
      {
        endpoint: env.MINIO_ENDPOINT,
        port: env.MINIO_PORT,
        useSSL: env.MINIO_USE_SSL,
        code: getErrorCode(err),
      },
      err,
    );
    throw err;
  }
}

export async function uploadFile(params: {
  file: Express.Multer.File;
  folder?: string;
}): Promise<{
  url: string;
  objectName: string;
  size: number;
  mimeType: string;
}> {
  const objectName = `${params.folder ?? "documents"}/${randomUUID()}-${params.file.originalname}`;

  await minioClient.putObject(
    storageConfig.bucket,
    objectName,
    params.file.buffer,
    params.file.size,
    {
      "Content-Type": params.file.mimetype,
    },
  );

  return {
    url: `${storageConfig.protocol}://${storageConfig.endpoint}:${storageConfig.port}/${storageConfig.bucket}/${objectName}`,
    objectName,
    size: params.file.size,
    mimeType: params.file.mimetype,
  };
}

export async function deleteFile(objectName: string): Promise<void> {
  await minioClient.removeObject(storageConfig.bucket, objectName);
}

export function getObjectNameFromUrl(url: string): string {
  const parsedUrl = new URL(url);
  const pathPrefix = `/${storageConfig.bucket}/`;

  if (!parsedUrl.pathname.startsWith(pathPrefix)) {
    throw new Error("Le lien de stockage du document est invalide.");
  }

  return decodeURIComponent(parsedUrl.pathname.slice(pathPrefix.length));
}
