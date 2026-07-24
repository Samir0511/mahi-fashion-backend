import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { r2Client, r2Config } from '../config/r2.js';

const optimizeImage = async (buffer) => {
  return sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
};

const uploadWithRetry = async (key, buffer, mimeType = 'image/webp') => {
  const command = new PutObjectCommand({
    Bucket: r2Config.bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ACL: 'public-read'
  });

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await r2Client.send(command);
      return {
        url: `${r2Config.publicUrl}/${key}`,
        key
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
};

export const uploadImage = async (file, productId = 'products') => {
  const optimizedBuffer = await optimizeImage(file.buffer);
  const key = `products/${productId}/${randomUUID()}.webp`;
  return uploadWithRetry(key, optimizedBuffer, 'image/webp');
};

export const uploadMultiple = async (files, productId = 'products') => {
  const results = await Promise.allSettled(files.map((file) => uploadImage(file, productId)));

  const uploads = [];
  const failures = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      uploads.push(result.value);
      return;
    }

    failures.push({
      file: files[index]?.originalname || `photo-${index + 1}`,
      error: result.reason?.message || 'Unknown upload error'
    });
  });

  if (failures.length > 0) {
    const error = new Error('One or more uploads failed. All uploaded images have been rolled back.');
    error.failures = failures;
    throw error;
  }

  return uploads;
};

export const deleteImage = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: r2Config.bucketName,
    Key: key
  });

  await r2Client.send(command);
};

export const deleteImages = async (keys = []) => {
  const results = await Promise.allSettled(keys.map((key) => deleteImage(key)));
  const failures = results.filter((result) => result.status === 'rejected');

  if (failures.length > 0) {
    const error = new Error('Failed to delete one or more images from Cloudflare R2');
    error.failures = failures;
    throw error;
  }
};

export const replaceImage = async (oldKey, file, productId = 'products') => {
  if (oldKey) {
    await deleteImage(oldKey);
  }

  return uploadImage(file, productId);
};
