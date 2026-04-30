import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import Store from 'electron-store';
import { getFonts } from 'font-list';
import { autoUpdater } from 'electron-updater';
import type { FileTreeNode, Preferences, FolderHistoryEntry, ThemeMode } from './types';

const store = new Store<{
  preferences: Preferences;
  folderHistory: FolderHistoryEntry[];
}>({
  defaults: {
    preferences: {
      fontFamily: 'System Default',
      fontSize: 16,
      theme: 'system',
    },
    folderHistory: [],
  },
});

const HIDDEN_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules', '.DS_Store']);
const MAX_HISTORY = 10;
const VALID_THEMES: ThemeMode[] = ['system', 'light', 'dark'];

const allowedRoots = new Set<string>();

function isWithinAllowedRoot(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  for (const root of allowedRoots) {
    if (resolved === root || resolved.startsWith(root + path.sep)) return true;
  }
  return false;
}

function addAllowedRoot(dirPath: string) {
  allowedRoots.add(path.resolve(dirPath));
}

function isMarkdownFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
}

async function scanDirectory(dirPath: string): Promise<FileTreeNode> {
  const name = path.basename(dirPath);
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return { name, path: dirPath, type: 'directory', children: [] };
  }
  const children: FileTreeNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return 1;
    if (!a.isDirectory() && b.isDirectory()) return -1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (HIDDEN_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const subTree = await scanDirectory(fullPath);
      if (subTree.children && subTree.children.length > 0) {
        children.push(subTree);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      children.push({ name: entry.name, path: fullPath, type: 'file' });
    }
  }

  return { name, path: dirPath, type: 'directory', children };
}

function registerIpcHandlers() {
  ipcMain.handle('open-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const folderPath = result.filePaths[0];
    addAllowedRoot(folderPath);
    return folderPath;
  });

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    if (!isWithinAllowedRoot(resolved)) throw new Error('Access denied');
    return scanDirectory(resolved);
  });

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    const resolved = path.resolve(filePath);
    if (!isWithinAllowedRoot(resolved)) throw new Error('Access denied');
    if (!isMarkdownFile(resolved)) throw new Error('Not a markdown file');
    const stat = await fs.lstat(resolved);
    if (!stat.isFile()) throw new Error('Not a regular file');
    return fs.readFile(resolved, 'utf-8');
  });

  ipcMain.handle('get-preferences', () => {
    return store.get('preferences');
  });

  ipcMain.handle('save-preferences', (_event, prefs: unknown) => {
    if (typeof prefs !== 'object' || prefs === null) throw new Error('Invalid preferences');
    const { fontFamily, fontSize, theme } = prefs as Record<string, unknown>;
    if (typeof fontFamily !== 'string') throw new Error('Invalid fontFamily');
    if (typeof fontSize !== 'number' || fontSize < 8 || fontSize > 72) throw new Error('Invalid fontSize');
    if (!VALID_THEMES.includes(theme as ThemeMode)) throw new Error('Invalid theme');
    store.set('preferences', { fontFamily, fontSize, theme } as Preferences);
  });

  ipcMain.handle('get-folder-history', () => {
    return store.get('folderHistory');
  });

  ipcMain.handle('add-folder-to-history', (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) throw new Error('Invalid path');
    const history = store.get('folderHistory');
    const name = path.basename(folderPath);
    const filtered = history.filter((e) => e.path !== folderPath);
    const updated = [{ path: folderPath, name }, ...filtered].slice(0, MAX_HISTORY);
    store.set('folderHistory', updated);
  });

  ipcMain.handle('reopen-folder', (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) throw new Error('Invalid path');
    const history = store.get('folderHistory');
    if (!history.some((e) => e.path === folderPath)) throw new Error('Access denied');
    addAllowedRoot(folderPath);
    return folderPath;
  });

  ipcMain.handle('clear-folder-history', () => {
    store.set('folderHistory', []);
  });

  ipcMain.handle('get-system-fonts', async () => {
    const fonts = await getFonts();
    return fonts.map((f) => f.replace(/^"(.*)"$/, '$1')).sort();
  });

  ipcMain.handle('check-path-exists', async (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) return false;
    const history = store.get('folderHistory');
    if (!isWithinAllowedRoot(folderPath) && !history.some((e) => e.path === folderPath)) return false;
    try {
      await fs.access(folderPath);
      return true;
    } catch {
      return false;
    }
  });
}

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

function sendOpenFile(filePath: string) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('open-file', filePath);
  } else {
    pendingFilePath = filePath;
  }
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (isMarkdownFile(filePath)) {
    addAllowedRoot(path.dirname(filePath));
    sendOpenFile(filePath);
  }
});

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    if (pendingFilePath) {
      mainWindow!.webContents.send('open-file', pendingFilePath);
      pendingFilePath = null;
    }
  });

  if (isDev) {
    const port = process.env.VITE_DEV_PORT ?? '5173';
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
};

function initAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    autoUpdater.downloadUpdate().catch((err) => console.error('Update download failed:', err));
  });
  autoUpdater.on('error', (err) => console.error('Auto-updater error:', err));
  autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  setInterval(() => autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err)), 60 * 60 * 1000);
}

function installCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' file: data:; font-src 'self'"],
      },
    });
  });
}

app.on('ready', () => {
  installCSP();
  registerIpcHandlers();
  createWindow();
  if (!isDev) initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

