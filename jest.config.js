module.exports = {
  preset: 'jest-expo',
  testRegex: '__tests__[\\\\/].*\\.test\\.ts$',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
