export type JustimeDesktopCommand =
  | 'new-chat'
  | 'focus-chat-input'
  | 'toggle-sidebar'
  | 'open-tasks'

export interface JustimeDesktopBridge {
  isDesktop: true
  platform: NodeJS.Platform | string
  isMac: boolean
  versions: {
    chrome?: string
    electron?: string
    node?: string
  }
  onCommand?: (callback: (command: JustimeDesktopCommand) => void) => () => void
}

declare global {
  interface Window {
    justimeDesktop?: JustimeDesktopBridge
  }
}

export {}
