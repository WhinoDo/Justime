import { readDesktopRuntime } from '../useDesktopRuntime'

describe('readDesktopRuntime', () => {
  beforeEach(() => {
    delete window.justimeDesktop
    document.documentElement.removeAttribute('data-justime-runtime')
    document.documentElement.removeAttribute('data-justime-platform')
  })

  it('returns web defaults without Electron bridge', () => {
    expect(readDesktopRuntime()).toEqual({
      isDesktop: false,
      isMac: false,
      platform: 'web',
      versions: {},
    })
  })

  it('detects desktop from bridge', () => {
    window.justimeDesktop = {
      isDesktop: true,
      platform: 'darwin',
      isMac: true,
      versions: { electron: '31.7.7' },
    }

    expect(readDesktopRuntime()).toMatchObject({
      isDesktop: true,
      isMac: true,
      platform: 'darwin',
      versions: { electron: '31.7.7' },
    })
  })

  it('detects desktop from html dataset', () => {
    document.documentElement.dataset.justimeRuntime = 'desktop'
    document.documentElement.dataset.justimePlatform = 'darwin'

    expect(readDesktopRuntime()).toMatchObject({
      isDesktop: true,
      isMac: true,
      platform: 'darwin',
    })
  })
})
