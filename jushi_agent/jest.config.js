const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // 提供 Next.js 应用的路径以加载 next.config.js 和 .env 文件
  dir: './',
})

// 自定义 Jest 配置
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
}

// createJestConfig 是 async 的，所以需要等待它返回配置
module.exports = createJestConfig(customJestConfig) 