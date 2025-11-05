/**
 * 飞书SDK加载器
 * 确保SDK安全加载并提供类型支持
 */

declare global {
  interface Window {
    QRLogin: (config: {
      id: string
      goto: string
      style: string
    }) => {
      matchOrigin: (origin: string) => boolean
    }
  }
}

export class FeishuSDKLoader {
  private static instance: FeishuSDKLoader
  private isLoaded = false
  private isLoading = false
  private loadPromise: Promise<boolean> | null = null

  private constructor() {}

  static getInstance(): FeishuSDKLoader {
    if (!FeishuSDKLoader.instance) {
      FeishuSDKLoader.instance = new FeishuSDKLoader()
    }
    return FeishuSDKLoader.instance
  }

  /**
   * 检查SDK是否已加载
   */
  isSDKLoaded(): boolean {
    return this.isLoaded && typeof window !== 'undefined' && !!window.QRLogin
  }

  /**
   * 加载飞书SDK
   */
  async loadSDK(): Promise<boolean> {
    // 如果已经加载，直接返回
    if (this.isSDKLoaded()) {
      return true
    }

    // 如果正在加载，返回现有的Promise
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise
    }

    // 开始加载
    this.isLoading = true
    this.loadPromise = this.doLoadSDK()

    try {
      const result = await this.loadPromise
      this.isLoaded = result
      return result
    } finally {
      this.isLoading = false
    }
  }

  private async doLoadSDK(): Promise<boolean> {
    return new Promise((resolve) => {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        resolve(false)
        return
      }

      // 检查SDK是否已经存在
      if (window.QRLogin) {
        resolve(true)
        return
      }

      // 检查script标签是否已存在
      const existingScript = document.querySelector(
        'script[src*="LarkSSOSDKWebQRCode"]'
      )

      if (existingScript) {
        // 如果script已存在，等待加载完成
        const checkLoaded = () => {
          if (window.QRLogin) {
            resolve(true)
          } else {
            setTimeout(checkLoaded, 100)
          }
        }
        checkLoaded()
        return
      }

      // 动态加载SDK
      const script = document.createElement('script')
      script.src = 'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js'
      script.async = true

      script.onload = () => {
        // 等待一小段时间确保SDK完全初始化
        setTimeout(() => {
          resolve(!!window.QRLogin)
        }, 100)
      }

      script.onerror = () => {
        console.error('飞书SDK加载失败')
        resolve(false)
      }

      // 设置超时
      setTimeout(() => {
        if (!window.QRLogin) {
          console.error('飞书SDK加载超时')
          resolve(false)
        }
      }, 10000) // 10秒超时

      document.head.appendChild(script)
    })
  }

  /**
   * 等待SDK加载完成
   */
  async waitForSDK(timeout = 10000): Promise<boolean> {
    const startTime = Date.now()

    while (!this.isSDKLoaded() && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return this.isSDKLoaded()
  }
}

// 导出单例实例
export const feishuSDKLoader = FeishuSDKLoader.getInstance()
