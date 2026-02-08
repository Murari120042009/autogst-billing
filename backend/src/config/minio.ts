import dotenv from "dotenv";
dotenv.config();

import { Client } from "minio";

if (!process.env.MINIO_ENDPOINT) {
  throw new Error("MINIO_ENDPOINT is not defined");
}

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!
});

export async function uploadBufferToMinio({ bucketName, objectName, buffer }: { bucketName: string; objectName: string; buffer: Buffer }) {
  await minioClient.putObject(bucketName, objectName, buffer);
  return `${process.env.MINIO_PUBLIC_URL}/${bucketName}/${objectName}`;
}
