import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { MongoClient, Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 3: Entry Uniqueness**
 * *For any* two roll entries in the database, their _id fields SHALL be different.
 * **Validates: Requirements 2.3**
 */

describe('Entry Uniqueness Property', () => {
  let db: Db;

  beforeEach(() => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
  });

  it('Property 3: All entry IDs are unique across multiple entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 20 }), // Number of entries to create
        fc.array(fc.emailAddress(), { minLength: 2, maxLength: 20 }),
        async (count, emails) => {
          const entriesToCreate = Math.min(count, emails.length);
          const collection = db.collection('entries');
          
          // Create multiple entries
          const insertedIds: string[] = [];
          for (let i = 0; i < entriesToCreate; i++) {
            const result = await collection.insertOne({
              email: emails[i],
              prizeId: (i % 6) + 1,
              prizeName: `Prize ${(i % 6) + 1}`,
              prizeIcon: '🎁',
              collected: false,
              status: 'confirmed',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            insertedIds.push(result.insertedId.toString());
          }
          
          // Verify all IDs are unique
          const uniqueIds = new Set(insertedIds);
          expect(uniqueIds.size).toBe(insertedIds.length);
          
          // Clean up
          await collection.deleteMany({});
        }
      ),
      { numRuns: 100 }
    );
  });
});
