import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import Store from 'electron-store';
import { getFonts } from 'font-list';
import type { FileTreeNode, Preferences, FolderHistoryEntry } from './types';

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
    return result.filePaths[0];
  });

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    return scanDirectory(dirPath);
  });

  ipcMain.handle('read-file', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('get-preferences', () => {
    return store.get('preferences');
  });

  ipcMain.handle('save-preferences', (_event, prefs: Preferences) => {
    store.set('preferences', prefs);
  });

  ipcMain.handle('get-folder-history', () => {
    return store.get('folderHistory');
  });

  ipcMain.handle('add-folder-to-history', (_event, folderPath: string) => {
    const history = store.get('folderHistory');
    const name = path.basename(folderPath);
    const filtered = history.filter((e) => e.path !== folderPath);
    const updated = [{ path: folderPath, name }, ...filtered].slice(0, MAX_HISTORY);
    store.set('folderHistory', updated);
  });

  ipcMain.handle('clear-folder-history', () => {
    store.set('folderHistory', []);
  });

  ipcMain.handle('get-system-fonts', async () => {
    const fonts = await getFonts();
    return fonts.map((f) => f.replace(/^"(.*)"$/, '$1')).sort();
  });

  ipcMain.handle('check-path-exists', async (_event, folderPath: string) => {
    try {
      await fs.access(folderPath);
      return true;
    } catch {
      return false;
    }
  });
}

const isDev = !app.isPackaged;

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    const port = process.env.VITE_DEV_PORT ?? '5173';
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
};

app.on('ready', () => {
  registerIpcHandlers();
  createWindow();
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

