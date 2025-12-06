import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/mongodb.js';
import { Prize, DEFAULT_PRIZES } from '../_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDb();
    const collection = db.collection<Prize>('prizes');
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

    await collection.bulkWrite(bulkOps);

    const prizes = await collection.find({}).sort({ id: 1 }).toArray();

    return res.status(200).json({
      success: true,
      prizes: prizes.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon,
        inventory: p.inventory,
      })),
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
