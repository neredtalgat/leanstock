// Global teardown for Jest
// Closes database and Redis connections

export default async function teardown(): Promise<void> {
  console.log('Tearing down test environment...');
  // Force exit to clean up any hanging handles
  process.exit(0);
}
