import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { deleteImage, deleteImages, uploadImage } from './r2.service.js';
import { formatSizes, normalizeMimeType } from '../utils/uploadHelpers.js';

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validateCreatePayload = ({ designNo, productName, files }) => {
  if (!designNo || !productName) {
    throw Object.assign(new Error('Design No and Product Name are required'), { statusCode: 400 });
  }

  if (files?.length) {
    files.forEach((file) => normalizeMimeType(file));
  }
};

const extractDesignNoFromFilename = (filename = '') => {
  const basename = String(filename).split(/[/\\]/).pop() || '';
  const match = basename.match(/^([a-zA-Z0-9-]+)/);
  return match ? normalizeText(match[1]) : '';
};

const collectImageKeys = (products = []) =>
  products.flatMap((product) => (product?.photos || []).map((photo) => photo?.key).filter(Boolean));

const normalizeBulkProduct = (product = {}, index = 0) => {
  const designNo = normalizeText(product.designNo);
  const productName = normalizeText(product.productName);

  validateCreatePayload({ designNo, productName, files: [] });

  return {
    designNo,
    productName,
    colour: normalizeText(product.colour),
    price: toNumber(product.price, 0),
    gender: normalizeText(product.gender) || 'Women',
    availableSizes: formatSizes(product.availableSizes),
    displayOrder: toInteger(product.displayOrder, index + 1)
  };
};

const rollbackUploadedImages = async (uploadedImages = []) => {
  const keys = uploadedImages.map((photo) => photo?.key).filter(Boolean);

  if (!keys.length) {
    return;
  }

  const results = await Promise.allSettled(keys.map((key) => deleteImage(key)));
  const failures = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason?.message || 'Rollback deletion failed');

  if (failures.length > 0) {
    throw Object.assign(new Error('Rollback failed. Some images may still exist in Cloudflare R2.'), {
      statusCode: 500,
      rollbackFailures: failures
    });
  }
};

const uploadFilesForProduct = async (files, productId) => {
  if (!files?.length) {
    return [];
  }

  const uploadResults = await Promise.allSettled(files.map((file) => uploadImage(file, productId)));
  const uploadedImages = [];
  const failures = [];

  uploadResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      uploadedImages.push(result.value);
      return;
    }

    failures.push({
      file: files[index]?.originalname || `photo-${index + 1}`,
      error: result.reason?.message || 'Unknown upload error'
    });
  });

  if (failures.length > 0) {
    await rollbackUploadedImages(uploadedImages);

    const uploadError = new Error('Upload failed. All uploaded images have been rolled back.');
    uploadError.statusCode = 500;
    uploadError.details = failures;
    throw uploadError;
  }

  return uploadedImages;
};

export const createProduct = async ({ designNo, productName, colour, price, gender, availableSizes, displayOrder, files }) => {
  validateCreatePayload({ designNo, productName, files });

  const productId = normalizeText(designNo);
  const existing = await Product.findOne({ designNo: productId });

  if (existing) {
    throw Object.assign(new Error(`Product with Design No "${productId}" already exists`), { statusCode: 409 });
  }

  let uploadedPhotos = [];

  try {
    uploadedPhotos = await uploadFilesForProduct(files, productId);

    const product = await Product.create({
      designNo: productId,
      productName: normalizeText(productName),
      colour: normalizeText(colour),
      price: toNumber(price, 0),
      gender: normalizeText(gender) || 'Women',
      availableSizes: formatSizes(availableSizes),
      displayOrder: toInteger(displayOrder, 0),
      photos: uploadedPhotos
    });

    return {
      success: true,
      message: 'Product created successfully',
      product
    };
  } catch (error) {
    if (uploadedPhotos.length > 0) {
      await rollbackUploadedImages(uploadedPhotos).catch((rollbackError) => {
        console.error('Rollback after createProduct failed:', rollbackError);
      });
    }

    throw error;
  }
};

export const replaceCatalogue = async ({ brandDetails, sizeChart, products, files = [] }) => {
  if (!Array.isArray(products)) {
    throw Object.assign(new Error('Bulk catalogue payload is invalid. Products must be an array.'), { statusCode: 400 });
  }

  const normalizedProducts = products.map((product, index) => normalizeBulkProduct(product, index));
  const seenDesignNos = new Set();
  const duplicateDesignNos = [];

  normalizedProducts.forEach((product) => {
    if (seenDesignNos.has(product.designNo)) {
      duplicateDesignNos.push(product.designNo);
      return;
    }

    seenDesignNos.add(product.designNo);
  });

  if (duplicateDesignNos.length > 0) {
    const uniqueDuplicates = [...new Set(duplicateDesignNos)];
    throw Object.assign(new Error(`Duplicate Design No values found: ${uniqueDuplicates.join(', ')}`), {
      statusCode: 400
    });
  }

  const photoMap = new Map();
  const unmatchedPhotos = [];

  files.forEach((file) => {
    normalizeMimeType(file);

    const designNo = extractDesignNoFromFilename(file.originalname);
    if (!designNo) {
      unmatchedPhotos.push({
        file: file.originalname,
        error: 'Could not detect Design No from the file name.'
      });
      return;
    }

    if (!seenDesignNos.has(designNo)) {
      unmatchedPhotos.push({
        file: file.originalname,
        error: `No matching Excel product found for Design No "${designNo}".`
      });
      return;
    }

    const currentFiles = photoMap.get(designNo) || [];
    currentFiles.push(file);
    photoMap.set(designNo, currentFiles);
  });

  if (unmatchedPhotos.length > 0) {
    throw Object.assign(new Error('Bulk upload stopped because some ZIP images do not match the Excel sheet.'), {
      statusCode: 400,
      details: unmatchedPhotos
    });
  }

  const uploadedPhotos = [];
  const productsForInsert = [];

  try {
    for (const product of normalizedProducts) {
      try {
        const productPhotos = await uploadFilesForProduct(photoMap.get(product.designNo) || [], product.designNo);
        uploadedPhotos.push(...productPhotos);
        productsForInsert.push({
          ...product,
          photos: productPhotos
        });
      } catch (error) {
        error.details = Array.isArray(error.details)
          ? error.details.map((detail) => ({
              product: product.designNo,
              file: detail.file,
              error: detail.error
            }))
          : [{ product: product.designNo, error: error.message || 'Image upload failed' }];
        throw error;
      }
    }

    const previousProducts = await Product.find().lean();
    const previousImageKeys = collectImageKeys(previousProducts);
    const normalizedBrandDetails =
      brandDetails && typeof brandDetails === 'object' && !Array.isArray(brandDetails) ? brandDetails : {};
    const normalizedSizeChart = Array.isArray(sizeChart) ? sizeChart : [];
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await Product.deleteMany({}, { session });

        if (productsForInsert.length > 0) {
          await Product.insertMany(productsForInsert, { session });
        }

        await Settings.updateOne(
          {},
          {
            $set: {
              brandDetails: normalizedBrandDetails,
              sizeChart: normalizedSizeChart
            }
          },
          {
            upsert: true,
            session
          }
        );
      });
    } finally {
      await session.endSession();
    }

    const warnings = [];
    if (previousImageKeys.length > 0) {
      try {
        await deleteImages(previousImageKeys);
      } catch (error) {
        warnings.push('Catalogue saved, but some old Cloudflare images could not be deleted.');
        console.error('Failed to delete old catalogue images after replacement:', error);
      }
    }

    return {
      success: true,
      message: `Catalogue replaced successfully. ${productsForInsert.length} products synced.`,
      warnings
    };
  } catch (error) {
    if (uploadedPhotos.length > 0) {
      await rollbackUploadedImages(uploadedPhotos).catch((rollbackError) => {
        console.error('Rollback after replaceCatalogue failed:', rollbackError);
        error.message = `${error.message} Rollback also failed for some Cloudflare images.`;
        error.rollbackFailures = rollbackError.rollbackFailures || [];
      });
    }

    throw error;
  }
};

export const updateProduct = async ({ designNo, payload = {}, files = [], replacePhotos = false }) => {
  const product = await Product.findOne({ designNo });

  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  const normalizedFieldMap = {
    productName: (value) => normalizeText(value),
    colour: (value) => normalizeText(value),
    price: (value) => toNumber(value, 0),
    gender: (value) => normalizeText(value) || 'Women',
    displayOrder: (value) => toInteger(value, 0)
  };

  Object.entries(normalizedFieldMap).forEach(([field, transform]) => {
    if (payload[field] !== undefined) {
      product[field] = transform(payload[field]);
    }
  });

  if (payload.availableSizes !== undefined) {
    product.availableSizes = formatSizes(payload.availableSizes);
  }

  let uploadedPhotos = [];

  try {
    if (files.length > 0) {
      uploadedPhotos = await uploadFilesForProduct(files, product.designNo);
    }

    if (uploadedPhotos.length > 0) {
      if (replacePhotos === true) {
        const existingKeys = (product.photos || []).map((photo) => photo.key).filter(Boolean);
        if (existingKeys.length > 0) {
          await deleteImages(existingKeys);
        }
        product.photos = uploadedPhotos;
      } else {
        product.photos = [...(product.photos || []), ...uploadedPhotos];
      }
    }

    await product.save();

    return {
      success: true,
      message: 'Product updated successfully',
      product
    };
  } catch (error) {
    if (uploadedPhotos.length > 0) {
      await rollbackUploadedImages(uploadedPhotos).catch((rollbackError) => {
        console.error('Rollback after updateProduct failed:', rollbackError);
      });
    }

    throw error;
  }
};

export const deleteProduct = async (designNo) => {
  const product = await Product.findOne({ designNo });

  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  const productSnapshot = {
    ...product.toObject(),
    _id: product._id,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
  const keys = (product.photos || []).map((photo) => photo.key).filter(Boolean);

  await Product.deleteOne({ designNo });

  try {
    await deleteImages(keys);
  } catch (error) {
    await Product.create(productSnapshot);
    throw error;
  }

  return {
    success: true,
    message: 'Product deleted successfully'
  };
};

export const deleteProductImage = async (designNo, imageIndex) => {
  const product = await Product.findOne({ designNo });

  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  const photo = product.photos?.[imageIndex];

  if (!photo?.key) {
    throw Object.assign(new Error('Selected image not found'), { statusCode: 400 });
  }

  const previousPhotos = [...(product.photos || [])];
  const currentPhotos = [...(product.photos || [])];
  currentPhotos.splice(imageIndex, 1);
  product.photos = currentPhotos;
  await product.save();

  try {
    await deleteImage(photo.key);
  } catch (error) {
    product.photos = previousPhotos;
    await product.save();
    throw error;
  }

  return {
    success: true,
    message: 'Image deleted successfully',
    product
  };
};

export const replaceProductImage = async (designNo, imageIndex, file) => {
  const product = await Product.findOne({ designNo });

  if (!product) {
    throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  }

  const oldPhoto = product.photos?.[imageIndex];

  if (!oldPhoto?.key) {
    throw Object.assign(new Error('Selected image not found'), { statusCode: 400 });
  }

  normalizeMimeType(file);

  let uploadedPhoto = null;

  try {
    uploadedPhoto = await uploadImage(file, product.designNo);
    product.photos[imageIndex] = uploadedPhoto;
    await product.save();

    try {
      await deleteImage(oldPhoto.key);
    } catch (deleteError) {
      product.photos[imageIndex] = oldPhoto;
      await product.save();
      await deleteImage(uploadedPhoto.key).catch((rollbackError) => {
        console.error('Rollback after replaceProductImage failed:', rollbackError);
      });
      throw deleteError;
    }

    return {
      success: true,
      message: 'Image replaced successfully',
      product
    };
  } catch (error) {
    if (uploadedPhoto?.key) {
      await deleteImage(uploadedPhoto.key).catch((rollbackError) => {
        console.error('Rollback after replaceProductImage failed:', rollbackError);
      });
    }

    throw error;
  }
};
