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
