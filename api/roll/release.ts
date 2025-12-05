import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongodb';
import { Entry, Prize } from '../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { entryId } = req.body;

    if (!entryId) {
      return res.status(400).json({
        success: false,
        error: 'Entry ID is required',
      });
    }

    // Validate ObjectId format
    if (!ObjectId.isValid(entryId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entry ID format',
      });
    }

    const db = await getDb();
    const entriesCollection = db.collection<Entry>('entries');
    const prizesCollection = db.collection<Prize>('prizes');

    // Find the entry first to get the prize ID
    const entry = await entriesCollection.findOne({ 
      _id: new ObjectId(entryId), 
      status: 'reserved' 
    });

    if (!entry) {
      // Entry not found or not in reserved state
      const existingEntry = await entriesCollection.findOne({ _id: new ObjectId(entryId) });
      
      if (!existingEntry) {
        return res.status(404).json({
          success: false,
          error: 'Entry not found',
          code: 'NOT_FOUND',
        });
      }

      if (existingEntry.status === 'released') {
        // Already released - return success
        return res.status(200).json({
          success: true,
          message: 'Entry already released',
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Entry cannot be released (not in reserved state)',
        code: 'CONFLICT',
      });
    }

    // Update entry status to 'released'
    await entriesCollection.updateOne(
      { _id: new ObjectId(entryId) },
      { 
        $set: { 
          status: 'released',
          updatedAt: new Date() 
        } 
      }
    );

    // Restore inventory for the prize
    await prizesCollection.updateOne(
      { id: entry.prizeId },
      { 
        $inc: { inventory: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Entry released and inventory restored',
    });
  } catch (error) {
    console.error('Release API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'DB_ERROR',
    });
  }
}
