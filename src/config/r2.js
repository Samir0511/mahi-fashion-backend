import { S3Client } from '@aws-sdk/client-s3';

const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];

const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing Cloudflare R2 env vars: ${missing.join(', ')}`);
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: false
});

export const r2Config = {
  accountId: process.env.R2_ACCOUNT_ID,
  bucketName: process.env.R2_BUCKET_NAME,
  publicUrl: process.env.R2_PUBLIC_URL.replace(/\/$/, '')
};

export { r2Client };
