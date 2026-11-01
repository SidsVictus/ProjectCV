import "server-only";

import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "./r2-rules";

const URL_TTL_SECONDS = 5 * 60;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** S3 API client for Cloudflare R2. Credentials are server-only. R2_ENDPOINT points tests at a local mock. */
function client(): S3Client {
  const local = Boolean(process.env.R2_ENDPOINT);
  return new S3Client({
    region: local ? "us-east-1" : "auto",
    endpoint: process.env.R2_ENDPOINT || `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") },
    forcePathStyle: local,
    // A default CRC32 checksum would be computed over an empty body and break presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

const bucket = () => required("R2_BUCKET_NAME");

/** The signature covers Content-Length, so the upload must be exactly the reserved size. */
export function presignUpload(key: string, mime: string, size: number): Promise<string> {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime, ContentLength: size }), {
    expiresIn: URL_TTL_SECONDS, signableHeaders: new Set(["content-length", "content-type"]),
  });
}

/** Opens inline in a new tab, under the document's own name. */
export function presignDownload(key: string, name: string): Promise<string> {
  const safe = name.replace(/[^\w .()-]/g, "_");
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: `inline; filename="${safe}"` }),
    { expiresIn: URL_TTL_SECONDS },
  );
}

/** Size and type of an uploaded object, or null when it is not there. */
export async function headObject(key: string): Promise<{ size: number; type: string } | null> {
  try {
    const r = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: r.ContentLength ?? 0, type: r.ContentType ?? "" };
  } catch {
    return null;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    await client().send(new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}
