import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 60000,
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
