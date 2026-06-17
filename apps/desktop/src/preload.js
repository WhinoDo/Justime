const { contextBridge, ipcRenderer } = require('electron')

const allowedCommands = new Set([
  'new-chat',
  'focus-chat-input',
  'toggle-sidebar',
  'open-tasks',
])

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.justimeRuntime = 'desktop'
  document.documentElement.dataset.justimePlatform = process.platform
  document.documentElement.classList.add('desktop-runtime')
})

contextBridge.exposeInMainWorld('justimeDesktop', {
  isDesktop: true,
  platform: process.platform,
  isMac: process.platform === 'darwin',
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  onCommand(callback) {
    if (typeof callback !== 'function') {
      return () => {}
    }

    const handler = (_event, command) => {
      if (allowedCommands.has(command)) {
        callback(command)
      }
    }

    ipcRenderer.on('justime-desktop-command', handler)
    return () => ipcRenderer.removeListener('justime-desktop-command', handler)
  },
})
