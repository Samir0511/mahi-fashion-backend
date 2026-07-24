import './config/env.js';
import express from 'express';
import cors from 'cors';
import catalogueRoutes from './routes/catalogue.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mahi-fashion-api',
    basePath: '/api'
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', catalogueRoutes);
app.use('/api/admin', adminRoutes);

app.use((error, _req, res, _next) => {
  if (!error) {
    return res.status(500).json({ success: false, message: 'Unexpected server error' });
  }

  const isMulterLimit = error?.name === 'MulterError' && error?.code === 'LIMIT_FILE_SIZE';
  const statusCode = error?.statusCode || (error?.name === 'MulterError' ? 400 : 500);
  const message = isMulterLimit ? 'Image upload failed: each file must be 5 MB or smaller.' : error.message || 'Unexpected server error';

  return res.status(statusCode).json({
    success: false,
    message
  });
});

export default app;
