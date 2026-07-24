import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const serverRoot = path.resolve(projectRoot, 'server');

const envCandidates = [
  path.join(serverRoot, '.env'),
  path.join(projectRoot, '.env'),
  path.join(serverRoot, '.env.example'),
  path.join(projectRoot, '.env.example')
];

envCandidates.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override: false
    });
  }
});
