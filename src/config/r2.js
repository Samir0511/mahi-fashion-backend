import { S3Client } from '@aws-sdk/client-s3';

const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];

let r2Client = null;

const getMissingEnv = () => requiredEnv.filter((name) => !process.env[name]);

export const getR2Config = () => {
  const missing = getMissingEnv();
  if (missing.length > 0) {
    throw Object.assign(new Error(`Missing Cloudflare R2 env vars: ${missing.join(', ')}`), {
      statusCode: 500
    });
  }

  return {
    accountId: process.env.R2_ACCOUNT_ID,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL.replace(/\/$/, '')
  };
};

export const getR2Client = () => {
  if (r2Client) {
    return r2Client;
  }

  const config = getR2Config();

  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    },
    forcePathStyle: false
  });

  return r2Client;
};
