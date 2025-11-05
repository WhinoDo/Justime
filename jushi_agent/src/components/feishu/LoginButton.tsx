'use client'

import React from 'react'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { Button } from '@/components/ui/button'

interface LoginButtonProps {
  children?: React.ReactNode
  variant?: 'default' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  saveCurrentPath?: boolean
  showPrompt?: boolean
  promptMessage?: string
  disabled?: boolean
  useWindow?: boolean // 是否在新窗口中打开登录
  onLoginStart?: () => void
  onLoginSuccess?: () => void
  onLoginCancel?: () => void
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  children = '登录飞书',
  variant = 'default',
  size = 'default',
  className = '',
  saveCurrentPath = true,
  showPrompt = false,
  promptMessage = '请先登录飞书账号',
  disabled = false,
  useWindow = false,
  onLoginStart,
  onLoginSuccess,
  onLoginCancel
}) => {
  const handleClick = () => {
    if (disabled) return

    onLoginStart?.()

    if (showPrompt) {
      FeishuLoginRedirect.showLoginPrompt(promptMessage, true)
    } else if (useWindow) {
      const loginWindow = FeishuLoginRedirect.openLoginWindow()
      if (loginWindow) {
        FeishuLoginRedirect.watchLoginWindow(
          loginWindow,
          onLoginSuccess,
          onLoginCancel
        )
      }
    } else {
      FeishuLoginRedirect.redirectToLogin(saveCurrentPath)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

// 预设的登录按钮样式
export const PrimaryLoginButton: React.FC<Omit<LoginButtonProps, 'variant'>> = (props) => (
  <LoginButton variant="default" {...props}>
    🔗 登录飞书
  </LoginButton>
)

export const OutlineLoginButton: React.FC<Omit<LoginButtonProps, 'variant'>> = (props) => (
  <LoginButton variant="outline" {...props}>
    登录飞书账号
  </LoginButton>
)

export const SmallLoginButton: React.FC<Omit<LoginButtonProps, 'size'>> = (props) => (
  <LoginButton size="sm" {...props}>
    登录
  </LoginButton>
)

// 带图标的登录按钮
export const IconLoginButton: React.FC<LoginButtonProps> = (props) => (
  <LoginButton {...props}>
    <span className="flex items-center gap-2">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      登录飞书
    </span>
  </LoginButton>
)

export default LoginButton
