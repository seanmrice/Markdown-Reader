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
  reopenFolder: (folderPath: string) => ipcRenderer.invoke('reopen-folder', folderPath),
  clearFolderHistory: () => ipcRenderer.invoke('clear-folder-history'),
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  checkPathExists: (folderPath: string) => ipcRenderer.invoke('check-path-exists', folderPath),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onOpenFile: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('open-file', listener);
    return () => ipcRenderer.removeListener('open-file', listener);
  },
  getCustomThemes: () => ipcRenderer.invoke('get-custom-themes'),
  initializeThemes: () => ipcRenderer.invoke('initialize-themes'),
  readThemeCss: (themeName: string) => ipcRenderer.invoke('read-theme-css', themeName),
  watchThemes: (themeName: string) => ipcRenderer.invoke('watch-themes', themeName),
  unwatchThemes: () => ipcRenderer.invoke('unwatch-themes'),
  onThemeCssChanged: (callback: (css: string | null) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, css: string | null) => callback(css);
    ipcRenderer.on('theme-css-changed', listener);
    return () => ipcRenderer.removeListener('theme-css-changed', listener);
  },
  onThemesListChanged: (callback: (themes: string[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, themes: string[]) => callback(themes);
    ipcRenderer.on('themes-list-changed', listener);
    return () => ipcRenderer.removeListener('themes-list-changed', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);
