import { db } from '../src/config/database';
import { redis } from '../src/config/redis';

// Global test setup
beforeAll(async () => {
  // Setup test database connection
  console.log('Setting up test environment...');
});

// Global test teardown
afterAll(async () => {
  // Cleanup
  await db.$disconnect();
  await redis.quit();
  console.log('Test environment cleaned up');
});
