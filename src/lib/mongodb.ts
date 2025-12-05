import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = import.meta.env.VITE_MONGODB_URI || process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.warn('MONGODB_URI environment variable is not set');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });

  await client.connect();
  const db = client.db('lucky-dice');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
  }
}
