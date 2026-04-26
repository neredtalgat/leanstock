/** @type {import("jest").Config} **/
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};