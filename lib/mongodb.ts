import 'server-only';
import mongoose from 'mongoose';
const cache = globalThis as typeof globalThis & { mongoConnection?: Promise<typeof mongoose> };
export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_NOT_CONFIGURED');
  if (!cache.mongoConnection) {
    cache.mongoConnection = mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 }).catch(error => {
      cache.mongoConnection = undefined;
      throw error;
    });
  }
  return cache.mongoConnection;
}
