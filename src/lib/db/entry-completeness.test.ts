import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 2: Entry Completeness**
 * *For any* successfully completed roll, the created entry SHALL contain all required fields:
 * email (non-empty string), prizeId (1-6), prizeName (non-empty string), 
 * prizeIcon (non-empty string), timestamp (valid date), and collected (boolean, initially false).
 * **Validates: Requirements 2.1**
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
  email: string;
  prizeId: number;
  prizeName: string;
  prizeIcon: string;
  collected: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EntryWithId extends Entry {
  _id?: unknown;
}

describe('Entry Completeness Property', () => {
  let db: Db;
  // Use unique collection names to avoid conflicts with parallel tests
  const PRIZES_COLLECTION = 'prizes_completeness_test';
  const ENTRIES_COLLECTION = 'entries_completeness_test';

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection(PRIZES_COLLECTION).deleteMany({});
    await db.collection(ENTRIES_COLLECTION).deleteMany({});
  });

  /**
   * Simulates a complete roll flow: reserves inventory, creates entry
   * Returns the created entry or null if roll failed
   */
  async function simulateCompleteRoll(email: string, prizeId: number): Promise<EntryWithId | null> {
    const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
    const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);

    // Get the prize
    const prize = await prizesCollection.findOne({ id: prizeId });
    if (!prize) return null;

    // Atomic decrement - only succeeds if inventory > 0
    const result = await prizesCollection.findOneAndUpdate(
      { id: prizeId, inventory: { $gt: 0 } },
      { 
        $inc: { inventory: -1 },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return null; // No inventory available
    }

    // Create entry with all required fields
    const now = new Date();
    const entry: Entry = {
      email,
      prizeId: prize.id,
      prizeName: prize.name,
      prizeIcon: prize.icon,
      collected: false,
      status: 'reserved',
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await entriesCollection.insertOne(entry);
    
    // Confirm the entry (simulating physics completion)
    await entriesCollection.updateOne(
      { _id: insertResult.insertedId },
      { $set: { status: 'confirmed', updatedAt: new Date() } }
    );

    // Return the confirmed entry
    return entriesCollection.findOne({ _id: insertResult.insertedId }) as Promise<EntryWithId | null>;
  }

  it('Property 2: Successfully completed rolls contain all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 50 }), // inventory
        async (email, prizeId, inventory) => {
          const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
          const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: `Prize ${prizeId}`,
            description: `Description for prize ${prizeId}`,
            icon: '🎁',
            inventory,
            createdAt: now,
            updatedAt: now,
          });

          // Simulate a complete roll
          const entry = await simulateCompleteRoll(email, prizeId);

          // If roll succeeded, verify all required fields
          if (entry) {
            // email: non-empty string
            expect(typeof entry.email).toBe('string');
            expect(entry.email.length).toBeGreaterThan(0);
            expect(entry.email).toBe(email);

            // prizeId: 1-6
            expect(typeof entry.prizeId).toBe('number');
            expect(entry.prizeId).toBeGreaterThanOrEqual(1);
            expect(entry.prizeId).toBeLessThanOrEqual(6);
            expect(entry.prizeId).toBe(prizeId);

            // prizeName: non-empty string
            expect(typeof entry.prizeName).toBe('string');
            expect(entry.prizeName.length).toBeGreaterThan(0);

            // prizeIcon: non-empty string
            expect(typeof entry.prizeIcon).toBe('string');
            expect(entry.prizeIcon.length).toBeGreaterThan(0);

            // createdAt: valid date (timestamp)
            expect(entry.createdAt).toBeInstanceOf(Date);
            expect(entry.createdAt.getTime()).not.toBeNaN();

            // updatedAt: valid date
            expect(entry.updatedAt).toBeInstanceOf(Date);
            expect(entry.updatedAt.getTime()).not.toBeNaN();

            // collected: boolean, initially false
            expect(typeof entry.collected).toBe('boolean');
            expect(entry.collected).toBe(false);

            // status: should be 'confirmed' after complete flow
            expect(entry.status).toBe('confirmed');

            // _id: should exist (unique identifier)
            expect(entry._id).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);

  it('Property 2b: Entry fields match the prize data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
        async (email, prizeId, prizeName, prizeIcon) => {
          const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
          const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with specific name and icon
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: prizeName,
            description: 'Test description',
            icon: prizeIcon,
            inventory: 10,
            createdAt: now,
            updatedAt: now,
          });

          // Simulate a complete roll
          const entry = await simulateCompleteRoll(email, prizeId);

          // Verify entry fields match prize data
          if (entry) {
            expect(entry.prizeName).toBe(prizeName);
            expect(entry.prizeIcon).toBe(prizeIcon);
            expect(entry.prizeId).toBe(prizeId);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);
});
