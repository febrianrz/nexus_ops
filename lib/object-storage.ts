import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

let client: S3Client | null = null;
function storage() {
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY || !process.env.MINIO_BUCKET) return null;
  client ??= new S3Client({ endpoint: process.env.MINIO_ENDPOINT, region: process.env.MINIO_REGION ?? 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY } });
  return client;
}
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const client = storage();
  if (!client) return null;
  await client.send(new PutObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET}/${key}`;
}
