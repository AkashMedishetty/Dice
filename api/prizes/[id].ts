import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/mongodb';
import { Prize } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;
  const prizeId = parseInt(id as string, 10);

  if (isNaN(prizeId) || prizeId < 1 || prizeId > 6) {
    return res.status(400).json({ error: 'Invalid prize ID' });
  }

  try {
    const db = await getDb();
    const collection = db.collection<Prize>('prizes');

    if (req.method === 'GET') {
      const prize = await collection.findOne({ id: prizeId });
      if (!prize) {
        return res.status(404).json({ error: 'Prize not found' });
      }
      return res.status(200).json({
        id: prize.id,
        name: prize.name,
        description: prize.description,
        icon: prize.icon,
        inventory: prize.inventory,
      });
    }

    if (req.method === 'PUT') {
      const { name, description, icon, inventory } = req.body;
      
      const updates: Partial<Prize> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (icon !== undefined) updates.icon = icon;
      if (inventory !== undefined) updates.inventory = Math.max(0, inventory);

      const result = await collection.findOneAndUpdate(
        { id: prizeId },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result) {
        return res.status(404).json({ error: 'Prize not found' });
      }

      return res.status(200).json({
        success: true,
        prize: {
          id: result.id,
          name: result.name,
          description: result.description,
          icon: result.icon,
          inventory: result.inventory,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
