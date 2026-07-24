import './src/config/env.js';
import app from './src/app.js';
import { connectDatabase } from './src/config/database.js';

const PORT = Number(process.env.PORT || 3000);

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
