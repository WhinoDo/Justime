export const setNodeEnv = (value: string) => {
  Object.defineProperty(process.env, 'NODE_ENV', { value, writable: true, configurable: true })
}
