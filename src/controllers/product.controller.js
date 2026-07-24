import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  replaceCatalogue,
  replaceProductImage,
  updateProduct
} from '../services/product.service.js';

const sendError = (res, error, fallbackMessage = 'Request failed') => {
  const statusCode = error?.statusCode || 500;
  const message = error?.message || fallbackMessage;
  return res.status(statusCode).json({
    success: false,
    message,
    details: error?.details,
    rollbackFailures: error?.rollbackFailures
  });
};

export const createProductController = async (req, res) => {
  try {
    const result = await createProduct({
      designNo: req.body.designNo,
      productName: req.body.productName,
      colour: req.body.colour,
      price: req.body.price,
      gender: req.body.gender,
      availableSizes: req.body.availableSizes,
      displayOrder: req.body.displayOrder,
      files: req.files || []
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error, 'Failed to create product');
  }
};

export const updateProductController = async (req, res) => {
  try {
    const result = await updateProduct({
      designNo: req.params.designNo,
      payload: req.body,
      files: req.files || [],
      replacePhotos: req.body.replacePhotos === 'true'
    });

    return res.json(result);
  } catch (error) {
    return sendError(res, error, 'Failed to update product');
  }
};

export const replaceCatalogueController = async (req, res) => {
  try {
    const rawCatalogue = req.body.catalogue;
    const parsedCatalogue = typeof rawCatalogue === 'string' ? JSON.parse(rawCatalogue) : rawCatalogue;

    const result = await replaceCatalogue({
      brandDetails: parsedCatalogue?.brandDetails,
      sizeChart: parsedCatalogue?.sizeChart,
      products: parsedCatalogue?.products,
      files: req.files || []
    });

    return res.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendError(
        res,
        Object.assign(new Error('Bulk catalogue payload is not valid JSON.'), { statusCode: 400 }),
        'Failed to replace catalogue'
      );
    }

    return sendError(res, error, 'Failed to replace catalogue');
  }
};

export const deleteProductController = async (req, res) => {
  try {
    const result = await deleteProduct(req.params.designNo);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 'Failed to delete product');
  }
};

export const deleteProductImageController = async (req, res) => {
  try {
    const result = await deleteProductImage(req.params.designNo, Number(req.params.imageIndex));
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 'Failed to delete image');
  }
};

export const replaceProductImageController = async (req, res) => {
  try {
    const result = await replaceProductImage(req.params.designNo, Number(req.params.imageIndex), req.file);
    return res.json(result);
  } catch (error) {
    return sendError(res, error, 'Failed to replace image');
  }
};
