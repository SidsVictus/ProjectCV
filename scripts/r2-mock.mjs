// Local stand-in for Cloudflare R2 (same S3 API) for development and tests. Not used in production.
import S3rver from "s3rver";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const cors = `<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader></CORSRule></CORSConfiguration>`;
const server = new S3rver({
  port: 4569, address: "127.0.0.1", silent: true,
  directory: mkdtempSync(path.join(tmpdir(), "r2-mock-")),
  configureBuckets: [{ name: process.env.R2_BUCKET_NAME || "projectcv-local", configs: [cors] }],
});
await server.run();
console.log("R2 mock listening on http://127.0.0.1:4569");
