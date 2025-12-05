import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongodb';
import { Entry } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || !ObjectId.isValid(id as string)) {
    return res.status(400).json({ error: 'Invalid entry ID' });
  }

  try {
    const db = await getDb();
    const collection = db.collection<Entry>('entries');

    if (req.method === 'GET') {
      const entry = await collection.findOne({ _id: new ObjectId(id as string) });
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      return res.status(200).json({
        _id: entry._id!.toString(),
        email: entry.email,
        prizeId: entry.prizeId,
        prizeName: entry.prizeName,
        prizeIcon: entry.prizeIcon,
        collected: entry.collected,
        status: entry.status,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      });
    }

    if (req.method === 'PATCH') {
      const { collected } = req.body;

      if (typeof collected !== 'boolean') {
        return res.status(400).json({ error: 'collected must be a boolean' });
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(id as string) },
        { 
          $set: { 
            collected,
            updatedAt: new Date() 
          } 
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      return res.status(200).json({
        success: true,
        entry: {
          _id: result._id!.toString(),
          email: result.email,
          prizeId: result.prizeId,
          prizeName: result.prizeName,
          prizeIcon: result.prizeIcon,
          collected: result.collected,
          status: result.status,
          createdAt: result.createdAt.toISOString(),
          updatedAt: result.updatedAt.toISOString(),
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Entry API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
