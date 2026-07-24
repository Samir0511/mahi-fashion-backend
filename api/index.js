import '../src/config/env.js';
import app from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';

let databaseConnectionPromise = null;

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:4200',
  'https://mahi-fashion.vercel.app',
  ...configuredOrigins
]);

const ensureDatabaseConnection = async () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDatabase().catch((error) => {
      databaseConnectionPromise = null;
      throw error;
    });
  }

  return databaseConnectionPromise;
};

const applyCorsHeaders = (req, res) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
};

const shouldSkipDatabaseBootstrap = (req) => {
  if (req.method === 'OPTIONS') {
    return true;
  }

  const requestPath = req.url?.split('?')[0] || '';

  return requestPath === '/api/admin/login' || requestPath === '/api/health' || requestPath === '/health' || requestPath === '/';
};

export default async function handler(req, res) {
  applyCorsHeaders(req, res);

  try {
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (!shouldSkipDatabaseBootstrap(req)) {
      await ensureDatabaseConnection();
    }

    return app(req, res);
  } catch (error) {
    console.error('Vercel function startup failed:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to start API function'
    });
  }
}
