import { Router } from 'express';
import { Product } from '../models/Product.js';
import { getOrCreateSettings } from '../models/Settings.js';
import { serializeProduct } from '../utils/productSerializer.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mahi-fashion-api' });
});

router.get('/catalogue', async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const products = await Product.find().sort({ displayOrder: 1 }).lean();

    return res.json({
      brandDetails: settings.brandDetails,
      sizeChart: settings.sizeChart,
      products: products.map(serializeProduct)
    });
  } catch (error) {
    console.error('GET /catalogue error:', error);
    return res.status(500).json({ message: 'Failed to load catalogue' });
  }
});

router.get('/catalogue/:designNo', async (req, res) => {
  try {
    const product = await Product.findOne({ designNo: req.params.designNo }).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(serializeProduct(product));
  } catch (error) {
    console.error('GET /catalogue/:designNo error:', error);
    return res.status(500).json({ message: 'Failed to load product' });
  }
});

export default router;
