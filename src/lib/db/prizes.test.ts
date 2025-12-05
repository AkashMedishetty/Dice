import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 10: Prize Update Persistence**
 * *For any* prize update operation (name, description, icon, or inventory), 
 * immediately querying the prize SHALL return the updated values.
 * **Validates: Requirements 10.1, 10.2**
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

describe('Prize Update Persistence Property', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    
    // Seed test prizes
    const collection = db.collection<Prize>('prizes');
    await collection.deleteMany({});
    
    const now = new Date();
    const prizes: Prize[] = [
      { id: 1, name: "Prize 1", description: "Desc 1", icon: "🎁", inventory: 50, createdAt: now, updatedAt: now },
      { id: 2, name: "Prize 2", description: "Desc 2", icon: "🎧", inventory: 20, createdAt: now, updatedAt: now },
      { id: 3, name: "Prize 3", description: "Desc 3", icon: "👕", inventory: 30, createdAt: now, updatedAt: now },
    ];
    await collection.insertMany(prizes);
  });

  it('Property 10: Prize updates are immediately persisted and queryable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // Prize ID
        fc.record({
          name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          description: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          icon: fc.option(fc.string({ minLength: 1, maxLength: 4 }), { nil: undefined }),
          inventory: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
        }),
        async (prizeId, updates) => {
          const collection = db.collection<Prize>('prizes');
          
          // Get original prize
          const original = await collection.findOne({ id: prizeId });
          expect(original).not.toBeNull();
          
          // Build update object (only include defined values)
          const updateFields: Partial<Prize> = { updatedAt: new Date() };
          if (updates.name !== undefined) updateFields.name = updates.name;
          if (updates.description !== undefined) updateFields.description = updates.description;
          if (updates.icon !== undefined) updateFields.icon = updates.icon;
          if (updates.inventory !== undefined) updateFields.inventory = updates.inventory;
          
          // Perform update
          await collection.updateOne({ id: prizeId }, { $set: updateFields });
          
          // Query immediately after update
          const updated = await collection.findOne({ id: prizeId });
          expect(updated).not.toBeNull();
          
          // Verify updated values match
          if (updates.name !== undefined) {
            expect(updated!.name).toBe(updates.name);
          }
          if (updates.description !== undefined) {
            expect(updated!.description).toBe(updates.description);
          }
          if (updates.icon !== undefined) {
            expect(updated!.icon).toBe(updates.icon);
          }
          if (updates.inventory !== undefined) {
            expect(updated!.inventory).toBe(updates.inventory);
          }
          
          // Restore original for next iteration
          await collection.updateOne({ id: prizeId }, { $set: original });
        }
      ),
      { numRuns: 100 }
    );
  });
});
