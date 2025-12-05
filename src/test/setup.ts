import { MongoClient, Db } from 'mongodb';
import { beforeAll, afterAll } from 'vitest';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dice:6yRkOhEwQX2ufQg3@dice.63nhevr.mongodb.net/?appName=Dice';

let client: MongoClient;

beforeAll(async () => {
  client = new MongoClient(TEST_MONGODB_URI);
  await client.connect();
  
  // Use test database with unique name to avoid conflicts
  const dbName = `lucky-dice-test-${Date.now()}`;
  const db = client.db(dbName);
  
  // Store for use in tests
  (globalThis as Record<string, unknown>).testDb = db;
  (globalThis as Record<string, unknown>).testClient = client;
  (globalThis as Record<string, unknown>).testDbName = dbName;
});

afterAll(async () => {
  if (client) {
    // Drop the test database
    const dbName = (globalThis as Record<string, unknown>).testDbName as string;
    if (dbName) {
      await client.db(dbName).dropDatabase();
    }
    await client.close();
  }
});
