import { randomUUID } from "node:crypto";

import { Client } from "minio";
import { env } from "@doctor.com/env/server";

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
};

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
    console.error(`❌ MinIO bucket check failed:`, err);
  }
}

export async function uploadFile(params: {
  file: Express.Multer.File;
  folder?: string;
}): Promise<{ url: string; objectName: string; size: number; mimeType: string }> {
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
    url: `http://${storageConfig.endpoint}:${storageConfig.port}/${storageConfig.bucket}/${objectName}`,
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
    throw new Error("Invalid MinIO URL format.");
  }

  return decodeURIComponent(parsedUrl.pathname.slice(pathPrefix.length));
}
