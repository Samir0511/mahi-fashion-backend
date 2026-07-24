import mongoose from 'mongoose';

const globalMongoose = globalThis;

if (!globalMongoose.__mahiMongoCache) {
  globalMongoose.__mahiMongoCache = {
    connection: null,
    promise: null
  };
}

export const connectDatabase = async () => {
  const mongoUri =process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME;
  const cache = globalMongoose.__mahiMongoCache;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  if (cache.connection && mongoose.connection.readyState === 1) {
    return cache.connection;
  }

  if (cache.promise) {
    return cache.promise;
  }

  try {
    cache.promise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        dbName
      })
      .then((connection) => {
        cache.connection = connection;
        return connection;
      })
      .catch((error) => {
        cache.promise = null;
        throw error;
      });

    await cache.promise;
  } catch (error) {
    cache.connection = null;
    cache.promise = null;
    const atlasHost = mongoUri.replace(/^mongodb\+srv:\/\//, '').split('/')[0];
    const friendlyError = new Error(
      `Unable to connect to MongoDB Atlas (${atlasHost}). Check Atlas Network Access/IP whitelist, cluster status, and database credentials.`
    );
    friendlyError.cause = error;
    throw friendlyError;
  }

  return cache.connection;
};
