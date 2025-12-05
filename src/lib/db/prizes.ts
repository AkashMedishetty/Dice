import { getDb } from '../mongodb';
import { Prize, PrizeResponse, DEFAULT_PRIZES } from '../../types/database';

const COLLECTION = 'prizes';

export async function getPrizes(): Promise<PrizeResponse[]> {
  const db = await getDb();
  const prizes = await db.collection<Prize>(COLLECTION)
    .find({})
    .sort({ id: 1 })
    .toArray();
  
  return prizes.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    inventory: p.inventory,
  }));
}

export async function getPrizeById(id: number): Promise<Prize | null> {
  const db = await getDb();
  return db.collection<Prize>(COLLECTION).findOne({ id });
}

export async function getAvailableFaces(): Promise<number[]> {
  const db = await getDb();
  const prizes = await db.collection<Prize>(COLLECTION)
    .find({ inventory: { $gt: 0 } })
    .project({ id: 1 })
    .toArray();
  
  return prizes.map(p => p.id);
}

export async function updatePrize(
  id: number, 
  updates: Partial<Pick<Prize, 'name' | 'description' | 'icon' | 'inventory'>>
): Promise<Prize | null> {
  const db = await getDb();
  const result = await db.collection<Prize>(COLLECTION).findOneAndUpdate(
    { id },
    { 
      $set: { 
        ...updates, 
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export async function decrementInventory(id: number): Promise<Prize | null> {
  const db = await getDb();
  const result = await db.collection<Prize>(COLLECTION).findOneAndUpdate(
    { id, inventory: { $gt: 0 } },
    { 
      $inc: { inventory: -1 },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export async function incrementInventory(id: number): Promise<Prize | null> {
  const db = await getDb();
  const result = await db.collection<Prize>(COLLECTION).findOneAndUpdate(
    { id },
    { 
      $inc: { inventory: 1 },
      $set: { updatedAt: new Date() }
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export async function resetPrizes(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  
  const bulkOps = DEFAULT_PRIZES.map(prize => ({
    updateOne: {
      filter: { id: prize.id },
      update: {
        $set: {
          ...prize,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        }
      },
      upsert: true,
    }
  }));
  
  await db.collection<Prize>(COLLECTION).bulkWrite(bulkOps);
}

export async function seedPrizes(): Promise<void> {
  const db = await getDb();
  const count = await db.collection<Prize>(COLLECTION).countDocuments();
  
  if (count === 0) {
    const now = new Date();
    const prizes: Prize[] = DEFAULT_PRIZES.map(p => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    }));
    
    await db.collection<Prize>(COLLECTION).insertMany(prizes);
    
    // Create index
    await db.collection<Prize>(COLLECTION).createIndex({ id: 1 }, { unique: true });
  }
}

export async function hasAnyInventory(): Promise<boolean> {
  const faces = await getAvailableFaces();
  return faces.length > 0;
}
