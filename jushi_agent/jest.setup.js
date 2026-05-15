import '@testing-library/jest-dom'

jest.mock('react-markdown', () => {
  return ({ children }) => children
})

jest.mock('remark-gfm', () => () => {})

jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }) => children,
  Light: ({ children }) => children,
}))

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  coy: {},
  dark: {},
  okaidia: {},
  oneDark: {},
  oneLight: {},
  vscDarkPlus: {},
}))

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
}) 