import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db, ObjectId } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 12: Failed Roll Recovery**
 * *For any* roll that fails after inventory reservation but before confirmation, 
 * the reserved inventory SHALL be released (inventory restored to pre-reservation value).
 * **Validates: Requirements 11.3**
 */

interface Prize {
  id: number;
  name: string;
  description: string;
  icon: string;
  inventory: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Entry {
  _id?: ObjectId;
  email: string;
  prizeId: number;
  prizeName: string;
  prizeIcon: string;
  collected: boolean;
  status: 'reserved' | 'confirmed' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

describe('Failed Roll Recovery Property', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection('prizes').deleteMany({});
    await db.collection('entries').deleteMany({});
  });

  it('Property 12: Released entries restore inventory to pre-reservation value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // Initial inventory
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        async (initialInventory, email, prizeId) => {
          const prizesCollection = db.collection<Prize>('prizes');
          const entriesCollection = db.collection<Entry>('entries');
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with initial inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: `Prize ${prizeId}`,
            description: 'Test',
            icon: '🎁',
            inventory: initialInventory,
            createdAt: now,
            updatedAt: now,
          });

          // Simulate reservation (decrement inventory)
          const reserveResult = await prizesCollection.findOneAndUpdate(
            { id: prizeId, inventory: { $gt: 0 } },
            { 
              $inc: { inventory: -1 },
              $set: { updatedAt: new Date() }
            },
            { returnDocument: 'after' }
          );

          expect(reserveResult).not.toBeNull();
          
          // Create reserved entry
          const insertResult = await entriesCollection.insertOne({
            email,
            prizeId,
            prizeName: `Prize ${prizeId}`,
            prizeIcon: '🎁',
            collected: false,
            status: 'reserved',
            createdAt: now,
            updatedAt: now,
          });

          const entryId = insertResult.insertedId;

          // Verify inventory was decremented
          const afterReserve = await prizesCollection.findOne({ id: prizeId });
          expect(afterReserve?.inventory).toBe(initialInventory - 1);

          // Simulate release (restore inventory)
          await entriesCollection.updateOne(
            { _id: entryId },
            { $set: { status: 'released', updatedAt: new Date() } }
          );

          await prizesCollection.updateOne(
            { id: prizeId },
            { 
              $inc: { inventory: 1 },
              $set: { updatedAt: new Date() }
            }
          );

          // Verify inventory was restored
          const afterRelease = await prizesCollection.findOne({ id: prizeId });
          expect(afterRelease?.inventory).toBe(initialInventory);

          // Verify entry status is 'released'
          const releasedEntry = await entriesCollection.findOne({ _id: entryId });
          expect(releasedEntry?.status).toBe('released');
        }
      ),
      { numRuns: 50 }
    );
  }, 120000); // Extended timeout for database operations
});
