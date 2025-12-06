import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/mongodb';
import { Prize, Entry, validateEmail } from './_lib/types';

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
    const { email } = req.body;

    // Validate email
    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    const db = await getDb();
    const prizesCollection = db.collection<Prize>('prizes');
    const entriesCollection = db.collection<Entry>('entries');

    // Clean up stale reserved entries (older than 5 minutes)
    // This prevents inventory from being locked by abandoned rolls
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    const staleEntries = await entriesCollection.find({
      status: 'reserved',
      createdAt: { $lt: staleThreshold }
    }).toArray();
    
    // Release stale entries and restore inventory
    for (const staleEntry of staleEntries) {
      await entriesCollection.updateOne(
        { _id: staleEntry._id },
        { $set: { status: 'released', updatedAt: new Date() } }
      );
      await prizesCollection.updateOne(
        { id: staleEntry.prizeId },
        { $inc: { inventory: 1 }, $set: { updatedAt: new Date() } }
      );
    }

    // Check if email has already been used (confirmed or recent reserved entries)
    // This prevents race conditions where same email is used on multiple devices
    const existingEntry = await entriesCollection.findOne({ 
      email: normalizedEmail, 
      status: { $in: ['confirmed', 'reserved'] }
    });
    if (existingEntry) {
      return res.status(400).json({
        success: false,
        error: 'This email has already been used to roll. Each participant can only roll once.',
        code: 'EMAIL_ALREADY_USED',
      });
    }

    // Get available prizes (inventory > 0)
    const availablePrizes = await prizesCollection
      .find({ inventory: { $gt: 0 } })
      .toArray();

    if (availablePrizes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No prizes available',
        code: 'NO_INVENTORY',
      });
    }

    // Randomly select a prize
    const selectedPrize = availablePrizes[Math.floor(Math.random() * availablePrizes.length)];

    // Atomically decrement inventory and create entry
    // This prevents race conditions - if inventory hits 0, the update fails
    const updateResult = await prizesCollection.findOneAndUpdate(
      { id: selectedPrize.id, inventory: { $gt: 0 } },
      { 
        $inc: { inventory: -1 },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!updateResult) {
      // Race condition - prize ran out, try again with different prize
      const retryPrizes = await prizesCollection
        .find({ inventory: { $gt: 0 } })
        .toArray();

      if (retryPrizes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No prizes available',
          code: 'NO_INVENTORY',
        });
      }

      // Retry with first available prize
      const retryPrize = retryPrizes[0];
      const retryResult = await prizesCollection.findOneAndUpdate(
        { id: retryPrize.id, inventory: { $gt: 0 } },
        { 
          $inc: { inventory: -1 },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

      if (!retryResult) {
        return res.status(409).json({
          success: false,
          error: 'Inventory conflict, please try again',
          code: 'CONFLICT',
        });
      }

      // Create entry with retry prize
      const now = new Date();
      const entry: Entry = {
        email: normalizedEmail,
        prizeId: retryPrize.id,
        prizeName: retryPrize.name,
        prizeIcon: retryPrize.icon,
        collected: false,
        status: 'reserved',
        createdAt: now,
        updatedAt: now,
      };

      const insertResult = await entriesCollection.insertOne(entry);

      return res.status(200).json({
        success: true,
        entryId: insertResult.insertedId.toString(),
        winningFace: retryPrize.id,
        prize: {
          id: retryPrize.id,
          name: retryPrize.name,
          description: retryPrize.description,
          icon: retryPrize.icon,
        },
      });
    }

    // Create entry with selected prize
    const now = new Date();
    const entry: Entry = {
      email: normalizedEmail,
      prizeId: selectedPrize.id,
      prizeName: selectedPrize.name,
      prizeIcon: selectedPrize.icon,
      collected: false,
      status: 'reserved',
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await entriesCollection.insertOne(entry);

    return res.status(200).json({
      success: true,
      entryId: insertResult.insertedId.toString(),
      winningFace: selectedPrize.id,
      prize: {
        id: selectedPrize.id,
        name: selectedPrize.name,
        description: selectedPrize.description,
        icon: selectedPrize.icon,
      },
    });
  } catch (error) {
    console.error('Roll API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'DB_ERROR',
    });
  }
}
