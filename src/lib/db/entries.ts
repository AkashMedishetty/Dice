import { ObjectId } from 'mongodb';
import { getDb } from '../mongodb';
import { Entry, EntryResponse, StatsResponse } from '../../types/database';
import { getPrizes } from './prizes';

const COLLECTION = 'entries';

export async function createEntry(
  email: string,
  prizeId: number,
  prizeName: string,
  prizeIcon: string
): Promise<Entry> {
  const db = await getDb();
  const now = new Date();
  
  const entry: Entry = {
    email,
    prizeId,
    prizeName,
    prizeIcon,
    collected: false,
    status: 'reserved',
    createdAt: now,
    updatedAt: now,
  };
  
  const result = await db.collection<Entry>(COLLECTION).insertOne(entry);
  return { ...entry, _id: result.insertedId };
}

export async function confirmEntry(entryId: string): Promise<Entry | null> {
  const db = await getDb();
  const result = await db.collection<Entry>(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(entryId), status: 'reserved' },
    { 
      $set: { 
        status: 'confirmed',
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export async function releaseEntry(entryId: string): Promise<Entry | null> {
  const db = await getDb();
  const result = await db.collection<Entry>(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(entryId), status: 'reserved' },
    { 
      $set: { 
        status: 'released',
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export async function updateCollectionStatus(
  entryId: string, 
  collected: boolean
): Promise<Entry | null> {
  const db = await getDb();
  const result = await db.collection<Entry>(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(entryId) },
    { 
      $set: { 
        collected,
        updatedAt: new Date() 
      } 
    },
    { returnDocument: 'after' }
  );
  
  return result;
}

export interface GetEntriesOptions {
  page?: number;
  limit?: number;
  status?: 'all' | 'collected' | 'pending';
  search?: string;
}

export async function getEntries(options: GetEntriesOptions = {}): Promise<{
  entries: EntryResponse[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const db = await getDb();
  const { page = 1, limit = 20, status = 'all', search = '' } = options;
  
  const query: Record<string, unknown> = {
    status: 'confirmed', // Only show confirmed entries
  };
  
  if (status === 'collected') {
    query.collected = true;
  } else if (status === 'pending') {
    query.collected = false;
  }
  
  if (search) {
    query.email = { $regex: search, $options: 'i' };
  }
  
  const total = await db.collection<Entry>(COLLECTION).countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  
  const entries = await db.collection<Entry>(COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();
  
  return {
    entries: entries.map(e => ({
      _id: e._id!.toString(),
      email: e.email,
      prizeId: e.prizeId,
      prizeName: e.prizeName,
      prizeIcon: e.prizeIcon,
      collected: e.collected,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    total,
    page,
    totalPages,
  };
}

export async function getStats(): Promise<StatsResponse> {
  const db = await getDb();
  
  const [totalRolls, collected, prizes] = await Promise.all([
    db.collection<Entry>(COLLECTION).countDocuments({ status: 'confirmed' }),
    db.collection<Entry>(COLLECTION).countDocuments({ status: 'confirmed', collected: true }),
    getPrizes(),
  ]);
  
  const pending = totalRolls - collected;
  
  // Get prize distribution
  const distribution = await db.collection<Entry>(COLLECTION).aggregate([
    { $match: { status: 'confirmed' } },
    { $group: { _id: '$prizeId', count: { $sum: 1 } } },
  ]).toArray();
  
  const prizeDistribution = prizes.map(p => {
    const dist = distribution.find(d => d._id === p.id);
    return {
      prizeId: p.id,
      name: p.name,
      icon: p.icon,
      count: dist?.count || 0,
    };
  });
  
  return {
    totalRolls,
    collected,
    pending,
    prizeDistribution,
  };
}

export async function getEntryById(entryId: string): Promise<Entry | null> {
  const db = await getDb();
  return db.collection<Entry>(COLLECTION).findOne({ _id: new ObjectId(entryId) });
}

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  const collection = db.collection<Entry>(COLLECTION);
  
  await collection.createIndex({ email: 1 });
  await collection.createIndex({ status: 1 });
  await collection.createIndex({ collected: 1 });
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ email: 'text' });
}
