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

export async function checkStorageAccess(options?: { deep?: boolean }): Promise<void> {
  const exists = await minioClient.bucketExists(env.MINIO_BUCKET);
  if (!exists) {
    throw new Error(`MinIO bucket "${env.MINIO_BUCKET}" does not exist.`);
  }

  if (!options?.deep) {
    return;
  }

  const objectName = `healthz/${randomUUID()}.txt`;
  const content = Buffer.from("doctor.com storage health check", "utf8");

  await minioClient.putObject(env.MINIO_BUCKET, objectName, content, content.length, {
    "Content-Type": "text/plain",
  });

  try {
    await minioClient.statObject(env.MINIO_BUCKET, objectName);
    const stream = await minioClient.getObject(env.MINIO_BUCKET, objectName);
    await new Promise<void>((resolve, reject) => {
      stream.on("data", () => {});
      stream.on("error", reject);
      stream.on("end", resolve);
    });
  } finally {
    await minioClient.removeObject(env.MINIO_BUCKET, objectName);
  }
}

export async function uploadFile(params: {
  file: Express.Multer.File;
  folder?: string;
  objectName?: string;
}): Promise<{
  url: string;
  objectName: string;
  size: number;
  mimeType: string;
}> {
  const objectName =
    params.objectName ??
    `${params.folder ?? "documents"}/${randomUUID()}-${sanitizeObjectSegment(params.file.originalname)}`;

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

export function buildPatientDocumentObjectName(params: {
  patientSlug: string;
  documentType: string;
  originalName: string;
  date?: Date;
}): string {
  const datePart = (params.date ?? new Date()).toISOString().slice(0, 10);
  const typeSlug = slugifySegment(params.documentType) || "documents";
  const patientSlug = slugifySegment(params.patientSlug) || "patient";
  const extension = getFileExtension(params.originalName);
  const filename = `${typeSlug}-${datePart}-${patientSlug}-${randomUUID().slice(0, 8)}${extension}`;

  return `patients/${patientSlug}/documents/${filename}`;
}

export function buildPatientStorageSlug(patient: {
  nom?: string | null;
  prenom?: string | null;
  matricule?: string | null;
  id: string;
}): string {
  const nameSlug = slugifySegment(
    [patient.nom, patient.prenom, patient.matricule].filter(Boolean).join("-"),
  );
  return `${nameSlug || "patient"}-${patient.id.slice(0, 8)}`;
}

function getFileExtension(filename: string): string {
  const match = filename.match(/\.([a-z0-9]{1,8})$/i);
  return match?.[1] ? `.${match[1].toLowerCase()}` : "";
}

function sanitizeObjectSegment(value: string): string {
  return slugifySegment(value) || "document";
}

function slugifySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
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
