const path = require('path');

const ROOT = __dirname;

module.exports = {
  preset: 'jest-expo',
  rootDir: ROOT,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Force all React to use the project's version (19.1.0) to avoid duplicate copy issues
    '^react$': '<rootDir>/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|react-navigation|@react-navigation|@react-native-async-storage|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-web|react-native-calendars|react-native-worklets|react-native-reanimated|date-fns))/',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
