import { Router } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { requireAdmin } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { getOrCreateSettings } from '../models/Settings.js';
import { normalizeMimeType } from '../utils/uploadHelpers.js';
import { serializeProduct } from '../utils/productSerializer.js';
import {
  createProductController,
  deleteProductController,
  deleteProductImageController,
  replaceCatalogueController,
  replaceProductImageController,
  updateProductController
} from '../controllers/product.controller.js';

const router = Router();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    try {
      normalizeMimeType(file);
      callback(null, true);
    } catch (error) {
      callback(error);
    }
  }
});

const bulkPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    try {
      normalizeMimeType(file);
      callback(null, true);
    } catch (error) {
      callback(error);
    }
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ admin: true, username }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: '12h'
  });

  return res.json({ token, username });
});

router.get('/products', requireAdmin, async (_req, res) => {
  try {
    const products = await Product.find().sort({ displayOrder: 1 }).lean();
    return res.json(products.map(serializeProduct));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load products' });
  }
});

router.post('/products', requireAdmin, photoUpload.array('photos', 20), createProductController);

router.post('/catalogue/replace', requireAdmin, bulkPhotoUpload.array('photos', 500), replaceCatalogueController);

router.put('/products/:designNo', requireAdmin, photoUpload.array('photos', 20), updateProductController);

router.delete('/products/:designNo', requireAdmin, deleteProductController);

router.delete('/products/:designNo/images/:imageIndex', requireAdmin, deleteProductImageController);

router.put('/products/:designNo/images/:imageIndex', requireAdmin, photoUpload.single('photo'), replaceProductImageController);

router.put('/brand', requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    settings.brandDetails = {
      ...(settings.brandDetails || {}),
      ...req.body
    };
    await settings.save();
    return res.json(settings.brandDetails);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update brand details' });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();

    if (req.body.brandDetails && typeof req.body.brandDetails === 'object') {
      settings.brandDetails = {
        ...(settings.brandDetails || {}),
        ...req.body.brandDetails
      };
    }

    if (Array.isArray(req.body.sizeChart)) {
      settings.sizeChart = req.body.sizeChart;
    }

    await settings.save();

    return res.json({
      brandDetails: settings.brandDetails,
      sizeChart: settings.sizeChart
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update settings' });
  }
});

export default router;
