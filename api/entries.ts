import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/mongodb';
import { Entry } from './_lib/types';

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
    const collection = db.collection<Entry>('entries');

    // Parse query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string || 'all';
    const search = (req.query.search as string || '').trim();

    // Build query
    const query: Record<string, unknown> = {
      status: 'confirmed', // Only show confirmed entries
    };

    if (status === 'collected') {
      query.collected = true;
    } else if (status === 'pending') {
      query.collected = false;
    }

    if (search) {
      // Escape regex special characters to prevent injection
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.email = { $regex: escapedSearch, $options: 'i' };
    }

    // Get total count
    const total = await collection.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    // Get entries
    const entries = await collection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error('Entries API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
