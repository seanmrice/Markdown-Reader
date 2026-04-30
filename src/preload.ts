import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI, Preferences } from './types';

const api: ElectronAPI = {
  openFolder: () => ipcRenderer.invoke('open-folder'),
  readDirectory: (dirPath: string) => ipcRenderer.invoke('read-directory', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  getPreferences: () => ipcRenderer.invoke('get-preferences'),
  savePreferences: (prefs: Preferences) => ipcRenderer.invoke('save-preferences', prefs),
  getFolderHistory: () => ipcRenderer.invoke('get-folder-history'),
  addFolderToHistory: (folderPath: string) => ipcRenderer.invoke('add-folder-to-history', folderPath),
  clearFolderHistory: () => ipcRenderer.invoke('clear-folder-history'),
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  checkPathExists: (folderPath: string) => ipcRenderer.invoke('check-path-exists', folderPath),
  onOpenFile: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('open-file', listener);
    return () => ipcRenderer.removeListener('open-file', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
