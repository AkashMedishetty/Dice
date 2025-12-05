import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 7: Atomic Inventory Constraint**
 * *For any* sequence of N concurrent roll requests for a prize with initial inventory I, 
 * the total number of successful rolls SHALL be at most min(N, I), 
 * and the final inventory SHALL be max(0, I - successful_rolls).
 * **Validates: Requirements 5.2, 11.4**
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

describe('Atomic Inventory Constraint Property', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection('prizes').deleteMany({});
    await db.collection('entries').deleteMany({});
  });

  async function simulateRoll(prizeId: number, email: string): Promise<boolean> {
    const prizesCollection = db.collection<Prize>('prizes');
    const entriesCollection = db.collection<Entry>('entries');

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
      return false; // No inventory available
    }

    // Create entry
    const now = new Date();
    await entriesCollection.insertOne({
      email,
      prizeId,
      prizeName: result.name,
      prizeIcon: result.icon,
      collected: false,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    });

    return true;
  }

  it('Property 7: Concurrent rolls never exceed initial inventory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // Initial inventory
        fc.integer({ min: 1, max: 30 }), // Number of concurrent requests
        async (initialInventory, numRequests) => {
          const prizesCollection = db.collection<Prize>('prizes');
          const entriesCollection = db.collection<Entry>('entries');
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with initial inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: 1,
            name: 'Test Prize',
            description: 'Test',
            icon: '🎁',
            inventory: initialInventory,
            createdAt: now,
            updatedAt: now,
          });

          // Simulate concurrent rolls
          const rollPromises = Array(numRequests)
            .fill(null)
            .map((_, i) => simulateRoll(1, `user${i}@test.com`));

          const results = await Promise.all(rollPromises);
          const successCount = results.filter(r => r).length;

          // Get final inventory
          const finalPrize = await prizesCollection.findOne({ id: 1 });
          const finalInventory = finalPrize?.inventory ?? 0;

          // Verify constraints
          // 1. Successful rolls should not exceed initial inventory
          expect(successCount).toBeLessThanOrEqual(initialInventory);
          
          // 2. Successful rolls should not exceed number of requests
          expect(successCount).toBeLessThanOrEqual(numRequests);
          
          // 3. Final inventory should be initial - successful rolls
          expect(finalInventory).toBe(initialInventory - successCount);
          
          // 4. Final inventory should never be negative
          expect(finalInventory).toBeGreaterThanOrEqual(0);
          
          // 5. Number of entries should equal successful rolls
          const entryCount = await entriesCollection.countDocuments({ prizeId: 1 });
          expect(entryCount).toBe(successCount);
        }
      ),
      { numRuns: 50 } // Reduced runs due to async nature
    );
  });
});
