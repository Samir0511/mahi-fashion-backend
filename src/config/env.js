import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(serverRoot, '..');

const envCandidates = [
  path.join(serverRoot, '.env'),
  path.join(repoRoot, '.env'),
  path.join(serverRoot, '.env.example'),
  path.join(repoRoot, '.env.example')
];

envCandidates.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override: false
    });
  }
});
