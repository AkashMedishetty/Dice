import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/mongodb.js';
import { Prize, DEFAULT_PRIZES } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await getDb();
    const collection = db.collection<Prize>('prizes');

    if (req.method === 'GET') {
      // Check if prizes exist, seed if not
      const count = await collection.countDocuments();
      if (count === 0) {
        const now = new Date();
        const prizes: Prize[] = DEFAULT_PRIZES.map(p => ({
          ...p,
          createdAt: now,
          updatedAt: now,
        }));
        await collection.insertMany(prizes);
        await collection.createIndex({ id: 1 }, { unique: true });
      }

      const prizes = await collection.find({}).sort({ id: 1 }).toArray();
      const availableFaces = prizes.filter(p => p.inventory > 0).map(p => p.id);

      return res.status(200).json({
        prizes: prizes.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon: p.icon,
          inventory: p.inventory,
        })),
        availableFaces,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Prizes API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('MONGODB_URI')) {
      return res.status(500).json({ 
        error: 'Database not configured',
        code: 'DB_NOT_CONFIGURED'
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'DB_ERROR'
    });
  }
}
