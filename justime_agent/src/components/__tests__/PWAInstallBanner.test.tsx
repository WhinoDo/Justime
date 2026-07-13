import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { PWAInstallBanner } from '../PWAInstallBanner'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { usePWAUpdate } from '@/hooks/usePWAUpdate'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'

jest.mock('@/hooks/usePWAInstall')
jest.mock('@/hooks/usePWAUpdate')
jest.mock('@/hooks/useDesktopRuntime')

const mockUsePWAInstall = usePWAInstall as jest.Mock
const mockUsePWAUpdate = usePWAUpdate as jest.Mock
const mockUseDesktopRuntime = useDesktopRuntime as jest.Mock

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDesktopRuntime.mockReturnValue({ isDesktop: false })
    mockUsePWAInstall.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
      canSafariInstall: false,
      isSafariDesktop: false,
    })
    mockUsePWAUpdate.mockReturnValue({
      updateAvailable: false,
      isUpdating: false,
      applyUpdate: jest.fn(),
    })
  })

  it('renders PWA install banner when install is possible and on web', () => {
    mockUsePWAInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
      canSafariInstall: false,
      isSafariDesktop: false,
    })

    render(<PWAInstallBanner />)

    expect(screen.getByText('安装 Justime 应用')).toBeInTheDocument()
  })

  it('renders the update banner and applies the available update', () => {
    const applyUpdate = jest.fn()
    mockUsePWAUpdate.mockReturnValue({
      updateAvailable: true,
      isUpdating: false,
      applyUpdate,
    })

    render(<PWAInstallBanner />)

    expect(screen.getByText('新版本可用')).toBeInTheDocument()
    expect(
      screen.getByText('Justime 有新版本，点击刷新以获取最新功能和修复')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '立即刷新' }))
    expect(applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('renders the Safari Dock installation guide', () => {
    mockUsePWAInstall.mockReturnValue({
      canInstall: false,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
      canSafariInstall: true,
      isSafariDesktop: true,
    })

    render(<PWAInstallBanner />)

    expect(screen.getByText('安装 Justime 到 Dock')).toBeInTheDocument()
    expect(screen.getByText('在分享菜单中选择「添加到 Dock」')).toBeInTheDocument()
    expect(screen.getByText('确认后即可从 Dock 快速启动 Justime')).toBeInTheDocument()
  })

  it('does not render install banner inside desktop runtime', () => {
    mockUseDesktopRuntime.mockReturnValue({ isDesktop: true })
    mockUsePWAInstall.mockReturnValue({
      canInstall: true,
      isInstalled: false,
      isOffline: false,
      install: jest.fn(),
      canSafariInstall: false,
      isSafariDesktop: false,
    })

    render(<PWAInstallBanner />)

    expect(screen.queryByText('安装 Justime 应用')).not.toBeInTheDocument()
  })
})
