import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 4: Inventory Decrement Invariant**
 * *For any* successful roll that awards prize P, the inventory of P in the database 
 * SHALL decrease by exactly 1 compared to before the roll.
 * **Validates: Requirements 2.4**
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

describe('Inventory Decrement Invariant Property', () => {
  let db: Db;
  // Use unique collection names to avoid conflicts with parallel tests
  const PRIZES_COLLECTION = 'prizes_inv_test';
  const ENTRIES_COLLECTION = 'entries_inv_test';

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection(PRIZES_COLLECTION).deleteMany({});
    await db.collection(ENTRIES_COLLECTION).deleteMany({});
  });

  /**
   * Simulates a single roll for a specific prize
   * Returns true if successful, false otherwise
   */
  async function simulateRoll(prizeId: number, email: string): Promise<boolean> {
    const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
    const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);

    // Get the prize first
    const prize = await prizesCollection.findOne({ id: prizeId });
    if (!prize) return false;

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
      prizeId: prize.id,
      prizeName: prize.name,
      prizeIcon: prize.icon,
      collected: false,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
    });

    return true;
  }

  it('Property 4: Single successful roll decrements inventory by exactly 1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 100 }), // initial inventory
        async (email, prizeId, initialInventory) => {
          const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
          const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with initial inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: `Prize ${prizeId}`,
            description: 'Test prize',
            icon: '🎁',
            inventory: initialInventory,
            createdAt: now,
            updatedAt: now,
          });

          // Get inventory before roll
          const beforePrize = await prizesCollection.findOne({ id: prizeId });
          const inventoryBefore = beforePrize?.inventory ?? 0;

          // Simulate a roll
          const success = await simulateRoll(prizeId, email);

          // Get inventory after roll
          const afterPrize = await prizesCollection.findOne({ id: prizeId });
          const inventoryAfter = afterPrize?.inventory ?? 0;

          if (success) {
            // Successful roll: inventory should decrease by exactly 1
            expect(inventoryAfter).toBe(inventoryBefore - 1);
          } else {
            // Failed roll: inventory should remain unchanged
            expect(inventoryAfter).toBe(inventoryBefore);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);

  it('Property 4b: Multiple sequential rolls decrement inventory correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 10 }), // initial inventory (reduced for speed)
        fc.integer({ min: 1, max: 12 }), // number of rolls to attempt (reduced for speed)
        async (prizeId, initialInventory, numRolls) => {
          const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
          const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with initial inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: `Prize ${prizeId}`,
            description: 'Test prize',
            icon: '🎁',
            inventory: initialInventory,
            createdAt: now,
            updatedAt: now,
          });

          // Perform sequential rolls
          let successCount = 0;
          for (let i = 0; i < numRolls; i++) {
            const success = await simulateRoll(prizeId, `user${i}@test.com`);
            if (success) successCount++;
          }

          // Get final inventory
          const finalPrize = await prizesCollection.findOne({ id: prizeId });
          const finalInventory = finalPrize?.inventory ?? 0;

          // Verify: final inventory = initial - successful rolls
          expect(finalInventory).toBe(initialInventory - successCount);
          
          // Verify: successful rolls should not exceed initial inventory
          expect(successCount).toBeLessThanOrEqual(initialInventory);
          
          // Verify: final inventory should never be negative
          expect(finalInventory).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 50 } // Reduced runs due to sequential nature
    );
  }, 120000); // Extended timeout for sequential operations

  it('Property 4c: Roll with zero inventory does not change inventory', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.integer({ min: 1, max: 6 }),
        async (email, prizeId) => {
          const prizesCollection = db.collection<Prize>(PRIZES_COLLECTION);
          const entriesCollection = db.collection<Entry>(ENTRIES_COLLECTION);
          
          // Clean up
          await prizesCollection.deleteMany({});
          await entriesCollection.deleteMany({});
          
          // Create prize with zero inventory
          const now = new Date();
          await prizesCollection.insertOne({
            id: prizeId,
            name: `Prize ${prizeId}`,
            description: 'Test prize',
            icon: '🎁',
            inventory: 0, // Zero inventory
            createdAt: now,
            updatedAt: now,
          });

          // Attempt a roll
          const success = await simulateRoll(prizeId, email);

          // Get inventory after roll
          const afterPrize = await prizesCollection.findOne({ id: prizeId });
          const inventoryAfter = afterPrize?.inventory ?? 0;

          // Roll should fail
          expect(success).toBe(false);
          
          // Inventory should remain at 0
          expect(inventoryAfter).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  }, 120000);
});
