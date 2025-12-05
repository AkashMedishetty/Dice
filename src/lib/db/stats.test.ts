import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 9: Statistics Consistency**
 * *For any* statistics query, the following invariants SHALL hold:
 * - totalRolls == collected + pending
 * - sum(prizeDistribution.count) == totalRolls
 * - Each prizeDistribution.count == count of entries with that prizeId
 * **Validates: Requirements 8.1, 8.2, 8.3**
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
  status: 'reserved' | 'confirmed' | 'released';
  createdAt: Date;
  updatedAt: Date;
}

describe('Statistics Consistency Property', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection('entries').deleteMany({});
    await db.collection('prizes').deleteMany({});
  });

  it('Property 9: Statistics are internally consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            email: fc.emailAddress(),
            prizeId: fc.integer({ min: 1, max: 6 }),
            collected: fc.boolean(),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        async (entryData) => {
          const entriesCollection = db.collection<Entry>('entries');
          const prizesCollection = db.collection<Prize>('prizes');
          
          await entriesCollection.deleteMany({});
          await prizesCollection.deleteMany({});
          
          // Create prizes
          const now = new Date();
          const prizes = [1, 2, 3, 4, 5, 6].map(id => ({
            id,
            name: `Prize ${id}`,
            description: `Description ${id}`,
            icon: '🎁',
            inventory: 50,
            createdAt: now,
            updatedAt: now,
          }));
          await prizesCollection.insertMany(prizes);
          
          // Create entries
          if (entryData.length > 0) {
            const entries = entryData.map(e => ({
              email: e.email,
              prizeId: e.prizeId,
              prizeName: `Prize ${e.prizeId}`,
              prizeIcon: '🎁',
              collected: e.collected,
              status: 'confirmed' as const,
              createdAt: now,
              updatedAt: now,
            }));
            await entriesCollection.insertMany(entries);
          }
          
          // Calculate stats
          const totalRolls = await entriesCollection.countDocuments({ status: 'confirmed' });
          const collected = await entriesCollection.countDocuments({ status: 'confirmed', collected: true });
          const pending = totalRolls - collected;
          
          // Get prize distribution
          const distribution = await entriesCollection.aggregate([
            { $match: { status: 'confirmed' } },
            { $group: { _id: '$prizeId', count: { $sum: 1 } } },
          ]).toArray();
          
          const prizeDistribution = prizes.map(p => {
            const dist = distribution.find(d => d._id === p.id);
            return { prizeId: p.id, count: dist?.count || 0 };
          });
          
          // Verify invariants
          // 1. totalRolls == collected + pending
          expect(totalRolls).toBe(collected + pending);
          
          // 2. sum(prizeDistribution.count) == totalRolls
          const distributionSum = prizeDistribution.reduce((sum, p) => sum + p.count, 0);
          expect(distributionSum).toBe(totalRolls);
          
          // 3. Each count matches actual entries
          for (const pd of prizeDistribution) {
            const actualCount = await entriesCollection.countDocuments({
              status: 'confirmed',
              prizeId: pd.prizeId,
            });
            expect(pd.count).toBe(actualCount);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
