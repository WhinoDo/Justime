import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future IPC channels
  getPlatform: (): string => process.platform,
  getVersion: (): string => process.env.npm_package_version || '0.1.0',
});
