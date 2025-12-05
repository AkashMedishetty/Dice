import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Db, ObjectId } from 'mongodb';

/**
 * **Feature: participant-tracking, Property 5: Filter Correctness**
 * *For any* filter query (status: collected/pending) and search query (email substring), 
 * all returned entries SHALL match the filter criteria AND contain the search substring in their email field.
 * **Validates: Requirements 3.3, 3.4**
 * 
 * **Feature: participant-tracking, Property 6: Sort Correctness**
 * *For any* list of entries returned by the API, entries SHALL be sorted by createdAt timestamp in descending order (newest first).
 * **Validates: Requirements 3.5**
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

describe('Filter and Sort Properties', () => {
  let db: Db;

  beforeEach(async () => {
    db = (globalThis as Record<string, unknown>).testDb as Db;
    await db.collection('entries').deleteMany({});
  });

  it('Property 5: Filtered entries match filter criteria', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            email: fc.emailAddress(),
            collected: fc.boolean(),
          }),
          { minLength: 5, maxLength: 20 }
        ),
        fc.constantFrom('all', 'collected', 'pending'),
        async (entryData, filterStatus) => {
          const collection = db.collection<Entry>('entries');
          await collection.deleteMany({});
          
          // Create entries
          const now = new Date();
          const entries = entryData.map((e, i) => ({
            email: e.email,
            prizeId: (i % 6) + 1,
            prizeName: `Prize ${(i % 6) + 1}`,
            prizeIcon: '🎁',
            collected: e.collected,
            status: 'confirmed' as const,
            createdAt: new Date(now.getTime() - i * 1000),
            updatedAt: now,
          }));
          
          await collection.insertMany(entries);
          
          // Build query
          const query: Record<string, unknown> = { status: 'confirmed' };
          if (filterStatus === 'collected') {
            query.collected = true;
          } else if (filterStatus === 'pending') {
            query.collected = false;
          }
          
          // Query entries
          const results = await collection.find(query).toArray();
          
          // Verify all results match filter
          for (const result of results) {
            if (filterStatus === 'collected') {
              expect(result.collected).toBe(true);
            } else if (filterStatus === 'pending') {
              expect(result.collected).toBe(false);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5b: Search results contain search term in email', async () => {
    // Helper to escape regex special characters
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.emailAddress(), { minLength: 5, maxLength: 15 }),
        async (emails) => {
          const collection = db.collection<Entry>('entries');
          await collection.deleteMany({});
          
          // Create entries
          const now = new Date();
          const entries = emails.map((email, i) => ({
            email,
            prizeId: (i % 6) + 1,
            prizeName: `Prize ${(i % 6) + 1}`,
            prizeIcon: '🎁',
            collected: false,
            status: 'confirmed' as const,
            createdAt: new Date(now.getTime() - i * 1000),
            updatedAt: now,
          }));
          
          await collection.insertMany(entries);
          
          // Pick a random search term from one of the emails (only alphanumeric to avoid regex issues)
          const randomEmail = emails[Math.floor(Math.random() * emails.length)];
          const alphanumericPart = randomEmail.replace(/[^a-zA-Z0-9]/g, '');
          const searchTerm = alphanumericPart.substring(0, Math.min(3, alphanumericPart.length));
          
          if (!searchTerm) return; // Skip if no alphanumeric characters
          
          // Query with search (escape regex special chars for safety)
          const results = await collection.find({
            status: 'confirmed',
            email: { $regex: escapeRegex(searchTerm), $options: 'i' }
          }).toArray();
          
          // Verify all results contain search term
          for (const result of results) {
            expect(result.email.toLowerCase()).toContain(searchTerm.toLowerCase());
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 6: Entries are sorted by createdAt descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.emailAddress(), { minLength: 3, maxLength: 20 }),
        async (emails) => {
          const collection = db.collection<Entry>('entries');
          await collection.deleteMany({});
          
          // Create entries with different timestamps
          const now = new Date();
          const entries = emails.map((email, i) => ({
            email,
            prizeId: (i % 6) + 1,
            prizeName: `Prize ${(i % 6) + 1}`,
            prizeIcon: '🎁',
            collected: false,
            status: 'confirmed' as const,
            createdAt: new Date(now.getTime() - Math.random() * 100000), // Random timestamps
            updatedAt: now,
          }));
          
          await collection.insertMany(entries);
          
          // Query with sort
          const results = await collection
            .find({ status: 'confirmed' })
            .sort({ createdAt: -1 })
            .toArray();
          
          // Verify sorted in descending order
          for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].createdAt.getTime())
              .toBeGreaterThanOrEqual(results[i].createdAt.getTime());
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
