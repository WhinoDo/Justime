import React from 'react'
import { render, screen } from '@testing-library/react'
import { PWAInstallBanner } from '../PWAInstallBanner'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'

jest.mock('@/hooks/usePWAInstall')
jest.mock('@/hooks/useDesktopRuntime')

const mockUsePWAInstall = usePWAInstall as jest.Mock
const mockUseDesktopRuntime = useDesktopRuntime as jest.Mock

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDesktopRuntime.mockReturnValue({ isDesktop: false })
  })

  it('renders PWA install banner when install is possible and on web', () => {
    mockUsePWAInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
    })

    render(<PWAInstallBanner />)

    expect(screen.getByText('安装矩时应用')).toBeInTheDocument()
  })

  it('does not render install banner inside desktop runtime', () => {
    mockUseDesktopRuntime.mockReturnValue({ isDesktop: true })
    mockUsePWAInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
    })

    render(<PWAInstallBanner />)

    expect(screen.queryByText('安装矩时应用')).not.toBeInTheDocument()
  })
})
