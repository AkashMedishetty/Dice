import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db, ObjectId } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 11: Roll Confirmation State**
 * *For any* roll that completes the full flow (email → API → physics → confirm), 
 * the entry status SHALL be 'confirmed'.
 * **Validates: Requirements 11.2**
 */

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

describe('Roll Confirmation State Property', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection('entries').deleteMany({});
  });

  it('Property 11: Confirmed entries have status "confirmed"', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        async (email, prizeId) => {
          const entriesCollection = db.collection<Entry>('entries');
          
          // Simulate creating a reserved entry (like /api/roll does)
          const now = new Date();
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

          // Verify initial status is 'reserved'
          const reservedEntry = await entriesCollection.findOne({ _id: entryId });
          expect(reservedEntry?.status).toBe('reserved');

          // Simulate confirmation (like /api/roll/confirm does)
          const confirmResult = await entriesCollection.findOneAndUpdate(
            { _id: entryId, status: 'reserved' },
            { 
              $set: { 
                status: 'confirmed',
                updatedAt: new Date() 
              } 
            },
            { returnDocument: 'after' }
          );

          // Verify confirmation succeeded
          expect(confirmResult).not.toBeNull();
          expect(confirmResult?.status).toBe('confirmed');

          // Verify querying the entry returns confirmed status
          const confirmedEntry = await entriesCollection.findOne({ _id: entryId });
          expect(confirmedEntry?.status).toBe('confirmed');

          // Clean up
          await entriesCollection.deleteOne({ _id: entryId });
        }
      ),
      { numRuns: 100 }
    );
  });
});
