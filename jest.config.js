/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts', // CLI entry point - difficult to unit test
    '!src/__tests__/**',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    // Coverage thresholds for tested modules
    'src/utils/formatting.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    'src/utils/config.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    'src/utils/data.ts': {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    // Coverage thresholds for command handlers using middleware pattern
    // These thresholds ensure comprehensive testing while allowing for some
    // hard-to-reach branches in error handling and edge cases
    'src/status-middleware.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/queue-middleware.ts': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
};
