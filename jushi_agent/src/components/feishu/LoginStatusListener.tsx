'use client'

import { useEffect } from 'react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'

interface LoginStatusListenerProps {
  onLoginChange?: (isLoggedIn: boolean) => void
}

/**
 * 飞书登录状态监听器
 * 监听 localStorage 变化，实时更新登录状态
 */
export function LoginStatusListener({ onLoginChange }: LoginStatusListenerProps) {
  useEffect(() => {
    // 监听 localStorage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feishu_login_status' || e.key === 'feishu_session') {
        console.log('🔄 检测到飞书登录状态变化:', e.key, e.newValue)
        
        // 延迟检查，确保所有相关数据都已保存
        setTimeout(() => {
          const isLoggedIn = FeishuTokenManager.isLoggedIn()
          console.log('🔍 更新后的登录状态:', isLoggedIn)
          onLoginChange?.(isLoggedIn)
        }, 100)
      }
    }

    // 监听跨窗口的登录成功消息
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      
      if (e.data?.type === 'FEISHU_LOGIN_SUCCESS') {
        console.log('🔄 收到跨窗口登录成功消息')
        setTimeout(() => {
          const isLoggedIn = FeishuTokenManager.isLoggedIn()
          console.log('🔍 跨窗口登录后的状态:', isLoggedIn)
          onLoginChange?.(isLoggedIn)
        }, 100)
      }
    }

    // 监听 BroadcastChannel 消息
    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('feishu_login')
      channel.onmessage = (e) => {
        if (e.data?.type === 'FEISHU_LOGIN_SUCCESS') {
          console.log('🔄 收到 BroadcastChannel 登录成功消息')
          setTimeout(() => {
            const isLoggedIn = FeishuTokenManager.isLoggedIn()
            console.log('🔍 BroadcastChannel 登录后的状态:', isLoggedIn)
            onLoginChange?.(isLoggedIn)
          }, 100)
        }
      }
    }

    // 添加事件监听器
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('message', handleMessage)

    // 页面获得焦点时检查登录状态（用户可能在其他标签页登录）
    const handleFocus = () => {
      console.log('🔍 页面获得焦点，检查登录状态')
      setTimeout(() => {
        const isLoggedIn = FeishuTokenManager.isLoggedIn()
        onLoginChange?.(isLoggedIn)
      }, 100)
    }

    window.addEventListener('focus', handleFocus)

    // 清理函数
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('focus', handleFocus)
      if (channel) {
        channel.close()
      }
    }
  }, [onLoginChange])

  // 这个组件不渲染任何内容
  return null
}
