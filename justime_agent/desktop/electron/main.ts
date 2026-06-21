import { app, BrowserWindow, Menu, shell } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Determine if we are in development mode
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const PORT = 3456;
const STARTUP_TIMEOUT = 30000; // 30s

function getStandaloneServerDir(): string {
  // In production, the standalone output is at the app resources level
  const resourcesPath = process.resourcesPath;
  return path.join(resourcesPath, '..', 'standalone');
}

function getServerEntry(): string {
  if (isDev) {
    return '';
  }
  const standaloneDir = getStandaloneServerDir();
  // Next.js standalone output places server.js at the root
  return path.join(standaloneDir, 'server.js');
}

async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start within ${timeout / 1000}s`);
}

async function startDevServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = path.join(__dirname, '..', '..');
    const child = spawn('npm', ['run', 'dev'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(PORT),
      },
      shell: true,
    });

    serverProcess = child;

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        child.kill();
        reject(new Error('Dev server start timeout'));
      }
    }, STARTUP_TIMEOUT);

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[next-dev] ${text}`);
      // Check if Next.js dev server is ready on the specified port
      if (
        !started &&
        (text.includes(`http://localhost:${PORT}`) || text.includes(`localhost:${PORT}`))
      ) {
        started = true;
        clearTimeout(timeout);
        resolve(`http://localhost:${PORT}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[next-dev:err] ${data.toString()}`);
    });

    child.on('close', (code) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function startProdServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const serverEntry = getServerEntry();
    const standaloneDir = getStandaloneServerDir();

    if (!fs.existsSync(serverEntry)) {
      reject(
        new Error(
          `Standalone server not found at ${serverEntry}. Run 'npm run build' and 'npm run desktop:build' first.`
        )
      );
      return;
    }

    const child = spawn('node', ['server.js'], {
      cwd: standaloneDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(PORT),
        HOSTNAME: '127.0.0.1',
      },
      shell: false,
    });

    serverProcess = child;

    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        child.kill();
        reject(new Error('Production server start timeout'));
      }
    }, STARTUP_TIMEOUT);

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[standalone] ${text}`);
      if (!started) {
        started = true;
        clearTimeout(timeout);
        resolve(`http://127.0.0.1:${PORT}`);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      console.error(`[standalone:err] ${data.toString()}`);
    });

    child.on('close', (code) => {
      if (!started) {
        clearTimeout(timeout);
        reject(new Error(`Standalone server exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  // Remove default menu in production for cleaner look
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  createWindow();

  try {
    let appUrl: string;

    if (isDev) {
      appUrl = await startDevServer();
    } else {
      appUrl = await startProdServer();
    }

    await waitForServer(appUrl, STARTUP_TIMEOUT);

    if (mainWindow) {
      mainWindow.loadURL(appUrl);
    }
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    if (serverProcess) {
      // Window will be shown via bootstrap logic
    }
  }
});

// Cleanup server process on quit
app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
