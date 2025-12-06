import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongodb.js';
import { Entry } from '../_lib/types.js';

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

    // Update entry status from 'reserved' to 'confirmed'
    // Use updateOne for speed (we don't need the returned document)
    const result = await entriesCollection.updateOne(
      { _id: new ObjectId(entryId), status: 'reserved' },
      { $set: { status: 'confirmed', updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      // Entry not found or already confirmed - check if already confirmed
      const existingEntry = await entriesCollection.findOne(
        { _id: new ObjectId(entryId) },
        { projection: { status: 1 } } // Only fetch status field
      );
      
      if (!existingEntry) {
        return res.status(404).json({
          success: false,
          error: 'Entry not found',
          code: 'NOT_FOUND',
        });
      }

      if (existingEntry.status === 'confirmed') {
        // Already confirmed - return success immediately
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({
        success: false,
        error: 'Entry cannot be confirmed',
        code: 'CONFLICT',
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Confirm API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'DB_ERROR',
    });
  }
}
