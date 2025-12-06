import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/mongodb.js';
import { Entry, Prize } from './_lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDb();
    const entriesCollection = db.collection<Entry>('entries');
    const prizesCollection = db.collection<Prize>('prizes');

    // Get counts
    const [totalRolls, collected, prizes] = await Promise.all([
      entriesCollection.countDocuments({ status: 'confirmed' }),
      entriesCollection.countDocuments({ status: 'confirmed', collected: true }),
      prizesCollection.find({}).sort({ id: 1 }).toArray(),
    ]);

    const pending = totalRolls - collected;

    // Get prize distribution
    const distribution = await entriesCollection.aggregate([
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
        inventory: p.inventory,
      };
    });

    return res.status(200).json({
      totalRolls,
      collected,
      pending,
      prizeDistribution,
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
