import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let indexesCreated = false;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not configured. Please add it to your Vercel project settings.');
  }

  // Return cached connection if available (skip ping for speed)
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 120000, // Keep connections alive longer
    serverSelectionTimeoutMS: 5000, // Faster timeout
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
  });

  await client.connect();
  const db = client.db('lucky-dice');

  cachedClient = client;
  cachedDb = db;

  // Create indexes in background (only once)
  if (!indexesCreated) {
    indexesCreated = true;
    createIndexes(db).catch(console.error);
  }

  return { client, db };
}

// Create indexes for faster queries
async function createIndexes(db: Db): Promise<void> {
  try {
    const entries = db.collection('entries');
    const prizes = db.collection('prizes');
    
    // Index for email lookup (most common query)
    await entries.createIndex({ email: 1, status: 1 }, { background: true });
    // Index for stale entry cleanup
    await entries.createIndex({ status: 1, createdAt: 1 }, { background: true });
    // Index for prize lookup
    await prizes.createIndex({ id: 1 }, { unique: true, background: true });
    await prizes.createIndex({ inventory: 1 }, { background: true });
  } catch (error) {
    // Indexes might already exist, ignore errors
    console.log('Index creation:', error instanceof Error ? error.message : 'done');
  }
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
