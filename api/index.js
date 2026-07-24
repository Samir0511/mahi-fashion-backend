import '../src/config/env.js';
import app from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';

let databaseConnectionPromise = null;

const ensureDatabaseConnection = async () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = connectDatabase().catch((error) => {
      databaseConnectionPromise = null;
      throw error;
    });
  }

  return databaseConnectionPromise;
};

export default async function handler(req, res) {
  try {
    await ensureDatabaseConnection();
    return app(req, res);
  } catch (error) {
    console.error('Vercel function startup failed:', error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Failed to start API function'
    });
  }
}
