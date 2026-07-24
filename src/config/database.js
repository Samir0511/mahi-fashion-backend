import mongoose from 'mongoose';

export const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'mahi-fashion';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      dbName
    });
  } catch (error) {
    const atlasHost = mongoUri.replace(/^mongodb\+srv:\/\//, '').split('/')[0];
    const friendlyError = new Error(
      `Unable to connect to MongoDB Atlas (${atlasHost}). Check Atlas Network Access/IP whitelist, cluster status, and database credentials.`
    );
    friendlyError.cause = error;
    throw friendlyError;
  }

  console.log(`MongoDB connected (${dbName})`);
};
