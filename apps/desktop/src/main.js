const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_APP_URL = 'http://localhost:3000'
const isDev = !app.isPackaged

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function canOpenExternalUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') {
      return true
    }

    return url.protocol === 'http:' && isLocalHost(url.hostname)
  } catch {
    return false
  }
}

function openExternalUrl(value) {
  if (canOpenExternalUrl(value)) {
    shell.openExternal(value)
  }
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfiguredAppUrl() {
  const candidates = [
    process.env.JUSTIME_DESKTOP_URL,
    process.env.NEXT_PUBLIC_APP_URL
  ]

  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      candidates.push(rawConfig.appUrl)
    }
  } catch {
    // Ignore invalid local config and fall back to environment/default URL.
  }

  candidates.push(DEFAULT_APP_URL)
  return candidates.find((value) => typeof value === 'string' && isValidHttpUrl(value.trim())).trim()
}

function writeConfiguredAppUrl(appUrl) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  fs.writeFileSync(getConfigPath(), `${JSON.stringify({ appUrl }, null, 2)}\n`, 'utf8')
}

let appUrl = DEFAULT_APP_URL

function createMainWindow() {
  const macWindowOptions = process.platform === 'darwin'
    ? {
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 18 },
        vibrancy: 'under-window',
        visualEffectState: 'active',
      }
    : {}

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1120,
    minHeight: 760,
    title: 'Justime',
    backgroundColor: '#fbfaff',
    show: false,
    ...macWindowOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    try {
      const currentOrigin = new URL(appUrl).origin
      const nextOrigin = new URL(url).origin
      if (nextOrigin === currentOrigin) {
        return
      }
      event.preventDefault()
      openExternalUrl(url)
    } catch {
      event.preventDefault()
    }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Justime cannot load',
      message: '无法打开 Justime 前端。',
      detail: `URL: ${validatedURL || appUrl}\nError ${errorCode}: ${errorDescription}\n\n请确认前端服务已启动，或通过菜单 Justime > Configure App URL 设置已部署的 Justime Web 地址。`,
      buttons: ['OK', 'Configure App URL']
    }).then((result) => {
      if (result.response === 1) {
        openConfigHelp(win)
      }
    }).catch(() => {})
  })

  win.loadURL(appUrl)

  if (isDev && process.env.JUSTIME_DESKTOP_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  return win
}

function openConfigHelp(parentWindow) {
  const configPath = getConfigPath()
  const options = {
    type: 'info',
    title: 'Configure Justime URL',
    message: '配置桌面端加载的 Justime Web 地址',
    detail: `请编辑以下配置文件：\n${configPath}\n\n格式：\n{\n  "appUrl": "https://your-justime.example.com"\n}\n\n保存后重启 Justime。`,
    buttons: ['Create Default Config', 'Reveal in Finder', 'Cancel'],
    defaultId: 0,
    cancelId: 2
  }
  const result = parentWindow
    ? dialog.showMessageBoxSync(parentWindow, options)
    : dialog.showMessageBoxSync(options)

  if (result === 0) {
    writeConfiguredAppUrl(appUrl)
    shell.showItemInFolder(configPath)
  } else if (result === 1) {
    if (!fs.existsSync(configPath)) {
      writeConfiguredAppUrl(appUrl)
    }
    shell.showItemInFolder(configPath)
  }
}

function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        {
          label: 'Configure App URL',
          click: (_menuItem, browserWindow) => {
            openConfigHelp(browserWindow || BrowserWindow.getFocusedWindow())
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CommandOrControl+N',
          click: (_menuItem, browserWindow) => {
            const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
            targetWindow?.webContents.send('justime-desktop-command', 'new-chat')
          },
        },
        {
          label: 'Focus Chat Input',
          accelerator: 'CommandOrControl+L',
          click: (_menuItem, browserWindow) => {
            const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
            targetWindow?.webContents.send('justime-desktop-command', 'focus-chat-input')
          },
        },
        {
          label: 'Open Tasks',
          accelerator: 'CommandOrControl+Shift+T',
          click: (_menuItem, browserWindow) => {
            const targetWindow = browserWindow || BrowserWindow.getFocusedWindow()
            targetWindow?.webContents.send('justime-desktop-command', 'open-tasks')
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  app.setName('Justime')
  appUrl = readConfiguredAppUrl()
  createMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
