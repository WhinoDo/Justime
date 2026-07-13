import React from 'react'
import { render } from '@testing-library/react'

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/hooks/useDesktopRuntime', () => ({
  useDesktopRuntime: jest.fn(),
}))

jest.mock('@/components/ui/JustimeBackground', () => ({
  JustimeBackground: () => <div data-testid="justime-background" />,
}))

jest.mock('gsap', () => ({
  gsap: { registerPlugin: jest.fn(), fromTo: jest.fn() },
}))

jest.mock('@gsap/react', () => ({
  useGSAP: jest.fn(),
}))

import DashboardPage from '../page'
import { useAuth } from '@/hooks/useAuth'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseDesktopRuntime = useDesktopRuntime as jest.MockedFunction<typeof useDesktopRuntime>

function setupDesktopAuthenticated(role = 'user') {
  mockUseAuth.mockReturnValue({
    user: { username: 'TestUser', role },
    isLoading: false,
    isAuthenticated: true,
  } as ReturnType<typeof useAuth>)
  mockUseDesktopRuntime.mockReturnValue({
    isDesktop: true,
  } as ReturnType<typeof useDesktopRuntime>)
}

describe('DashboardPage desktop app-frame layout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses justime-app full-height shell for authenticated desktop path', () => {
    setupDesktopAuthenticated()
    const { container } = render(<DashboardPage />)

    const shell = container.querySelector('.justime-app')
    expect(shell).toBeTruthy()
  })

  it('renders content wrapper with flex column and local-scroll descendant', () => {
    setupDesktopAuthenticated()
    const { container } = render(<DashboardPage />)

    const content = container.querySelector('.local-scroll')
    expect(content).toBeTruthy()
  })

  it('card grid has overflow-y-auto for local scrolling', () => {
    setupDesktopAuthenticated()
    const { container } = render(<DashboardPage />)

    const scrollRegion = container.querySelector('.overflow-y-auto')
    expect(scrollRegion).toBeTruthy()
  })

  it('admin card is present for admin users', () => {
    setupDesktopAuthenticated('admin')
    const { getByText } = render(<DashboardPage />)

    expect(getByText('后台管理')).toBeInTheDocument()
  })

  it('desktop loading state uses fullHeight shell', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    } as ReturnType<typeof useAuth>)
    mockUseDesktopRuntime.mockReturnValue({
      isDesktop: true,
    } as ReturnType<typeof useDesktopRuntime>)

    const { container } = render(<DashboardPage />)

    const shell = container.querySelector('.justime-app')
    expect(shell).toBeTruthy()
  })
})
