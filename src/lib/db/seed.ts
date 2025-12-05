import { seedPrizes } from './prizes';
import { ensureIndexes } from './entries';

export async function seedDatabase(): Promise<void> {
  console.log('Seeding database...');
  
  await seedPrizes();
  console.log('Prizes seeded');
  
  await ensureIndexes();
  console.log('Indexes created');
  
  console.log('Database seeding complete');
}
