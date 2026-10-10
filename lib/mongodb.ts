import 'server-only';
import mongoose from 'mongoose';
const cache = globalThis as typeof globalThis & { mongoConnection?: Promise<typeof mongoose> };
export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[mongodb] connection unavailable', {
      reason: 'MONGODB_NOT_CONFIGURED',
    });
    throw new Error('MONGODB_NOT_CONFIGURED');
  }
  if (!cache.mongoConnection) {
    cache.mongoConnection = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch(error => {
      cache.mongoConnection = undefined;
      console.error('[mongodb] connection failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });
  }
  return cache.mongoConnection;
}
