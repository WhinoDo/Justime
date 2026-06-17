import { renderHook } from '@testing-library/react'
import { useDesktopCommands } from '../useDesktopCommands'

describe('useDesktopCommands', () => {
  beforeEach(() => {
    delete window.justimeDesktop
  })

  it('subscribes to desktop commands through bridge', () => {
    const unsubscribe = jest.fn()
    window.justimeDesktop = {
      isDesktop: true,
      platform: 'darwin',
      isMac: true,
      versions: {},
      onCommand: (callback) => {
        callback('new-chat')
        return unsubscribe
      },
    }

    const onCommand = jest.fn()
    const { unmount } = renderHook(() => useDesktopCommands(onCommand))

    expect(onCommand).toHaveBeenCalledWith('new-chat')

    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
