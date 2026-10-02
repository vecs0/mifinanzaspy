module.exports = {
  preset: 'jest-expo',
  testRegex: '__tests__[\\\\/].*\\.test\\.ts$',
  testPathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
};
