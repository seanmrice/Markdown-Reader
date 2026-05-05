import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';
import Store from 'electron-store';
import { getFonts } from 'font-list';
import { autoUpdater } from 'electron-updater';
import type { FileTreeNode, Preferences, FolderHistoryEntry, ThemeMode } from './types';
import { initAnalytics, isAnalyticsEnabled, setAnalyticsEnabled, captureAppClosed, captureAppUpdated, captureException, captureRendererCrash, shutdownAnalytics } from './analytics';

const store = new Store<{
  preferences: Preferences;
  folderHistory: FolderHistoryEntry[];
}>({
  defaults: {
    preferences: {
      fontFamily: 'System Default',
      fontSize: 16,
      theme: 'system',
      customTheme: null,
    },
    folderHistory: [],
  },
});

const HIDDEN_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules', '.DS_Store']);
const MAX_HISTORY = 10;
const VALID_THEMES: ThemeMode[] = ['system', 'light', 'dark'];

const THEMES_DIR = path.join(homedir(), 'Documents', 'Markdown-Reader-Themes');

const DEFAULT_THEME_CSS = `/* Markdown Reader — Custom Theme
 * Override any CSS variables below to customize the appearance.
 * Variables you omit will use the built-in defaults.
 * Save this file to see changes applied instantly.
 *
 * Light mode uses the :root section.
 * Dark mode uses the @media and .theme-dark sections.
 * To make a single-palette theme (same colors in both modes),
 * set the same values in all three sections.
 */

/* ── Light Mode ── */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-sidebar: #f0f0f0;
  --bg-code: #f6f8fa;
  --bg-hover: #e8e8e8;
  --bg-active: #dcdcdc;

  --text-primary: #1a1a1a;
  --text-secondary: #555555;
  --text-muted: #888888;
  --text-code: #1a1a1a;

  --border-color: #d0d0d0;
  --border-light: #e5e5e5;

  --link-color: #0366d6;
  --link-hover: #0550ae;

  --accent-color: #0366d6;

  --blockquote-border: #d0d7de;
  --blockquote-text: #555555;

  --table-border: #d0d7de;
  --table-row-alt: #f6f8fa;

  --hr-color: #d0d7de;

  --scrollbar-thumb: #c0c0c0;
  --scrollbar-track: transparent;
}

/* ── Dark Mode (system preference) ── */
@media (prefers-color-scheme: dark) {
  :root:not(.theme-light) {
    --bg-primary: #1a1a1a;
    --bg-secondary: #222222;
    --bg-sidebar: #1e1e1e;
    --bg-code: #2d2d2d;
    --bg-hover: #333333;
    --bg-active: #3a3a3a;

    --text-primary: #e0e0e0;
    --text-secondary: #aaaaaa;
    --text-muted: #777777;
    --text-code: #e0e0e0;

    --border-color: #3a3a3a;
    --border-light: #2d2d2d;

    --link-color: #58a6ff;
    --link-hover: #79b8ff;

    --accent-color: #58a6ff;

    --blockquote-border: #3a3a3a;
    --blockquote-text: #aaaaaa;

    --table-border: #3a3a3a;
    --table-row-alt: #222222;

    --hr-color: #3a3a3a;

    --scrollbar-thumb: #555555;
    --scrollbar-track: transparent;
  }
}

/* ── Dark Mode (explicit selection) ── */
.theme-dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #222222;
  --bg-sidebar: #1e1e1e;
  --bg-code: #2d2d2d;
  --bg-hover: #333333;
  --bg-active: #3a3a3a;

  --text-primary: #e0e0e0;
  --text-secondary: #aaaaaa;
  --text-muted: #777777;
  --text-code: #e0e0e0;

  --border-color: #3a3a3a;
  --border-light: #2d2d2d;

  --link-color: #58a6ff;
  --link-hover: #79b8ff;

  --accent-color: #58a6ff;

  --blockquote-border: #3a3a3a;
  --blockquote-text: #aaaaaa;

  --table-border: #3a3a3a;
  --table-row-alt: #222222;

  --hr-color: #3a3a3a;

  --scrollbar-thumb: #555555;
  --scrollbar-track: transparent;
}
`;

let themeWatcher: FSWatcher | null = null;
let watchedThemeName: string | null = null;

async function themeFolderExists(): Promise<boolean> {
  try {
    await fs.access(THEMES_DIR);
    return true;
  } catch {
    return false;
  }
}

async function listThemeFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(THEMES_DIR);
    return entries
      .filter((f) => f.toLowerCase().endsWith('.css'))
      .map((f) => f.replace(/\.css$/i, ''))
      .sort();
  } catch {
    return [];
  }
}

async function readThemeFile(themeName: string): Promise<string | null> {
  const filePath = path.join(THEMES_DIR, `${themeName}.css`);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(THEMES_DIR) + path.sep)) return null;
  try {
    return await fs.readFile(resolved, 'utf-8');
  } catch {
    return null;
  }
}

function stopThemeWatcher() {
  if (themeWatcher) {
    themeWatcher.close();
    themeWatcher = null;
    watchedThemeName = null;
  }
}

function broadcastToWindows(channel: string, data: unknown) {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function startThemeWatcher(themeName: string) {
  stopThemeWatcher();
  watchedThemeName = themeName;
  const targetFile = `${themeName}.css`;

  try {
    themeWatcher = watch(THEMES_DIR, async (_eventType, filename) => {
      if (!filename?.toLowerCase().endsWith('.css')) return;

      const themes = await listThemeFiles();
      broadcastToWindows('themes-list-changed', themes);

      if (filename !== targetFile) return;
      const snapshotName = watchedThemeName;
      const css = await readThemeFile(themeName);
      if (watchedThemeName !== snapshotName) return;

      broadcastToWindows('theme-css-changed', css);
    });
  } catch {
    // folder may not exist yet
  }
}

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

const SCAN_MAX_DEPTH = 2;

async function hasVisibleEntries(dirPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.some((e) =>
      !HIDDEN_DIRS.has(e.name) && !e.name.startsWith('.') && !e.isSymbolicLink()
      && (e.isDirectory() || (e.isFile() && isMarkdownFile(e.name)))
    );
  } catch {
    return false;
  }
}

async function scanDirectory(dirPath: string, depth = 0): Promise<FileTreeNode> {
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
      if (depth >= SCAN_MAX_DEPTH) {
        if (await hasVisibleEntries(fullPath)) {
          children.push({ name: entry.name, path: fullPath, type: 'directory', lazy: true });
        }
      } else {
        const subTree = await scanDirectory(fullPath, depth + 1);
        if (subTree.children && subTree.children.length > 0) {
          children.push(subTree);
        }
      }
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      children.push({ name: entry.name, path: fullPath, type: 'file' });
    }
  }

  return { name, path: dirPath, type: 'directory', children };
}

function registerIpcHandlers() {
  ipcMain.handle('open-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory'] };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    const folderPath = result.filePaths[0];
    addAllowedRoot(folderPath);
    return folderPath;
  });

  ipcMain.handle('open-external', async (_event, url: string) => {
    if (typeof url !== 'string') throw new Error('Invalid URL');
    const parsed = new URL(url);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) throw new Error('Protocol not allowed');
    await shell.openExternal(url);
  });

  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    if (!isWithinAllowedRoot(resolved)) throw new Error('Access denied');
    return scanDirectory(resolved);
  });

  ipcMain.handle('expand-directory', async (_event, dirPath: string) => {
    const resolved = path.resolve(dirPath);
    if (!isWithinAllowedRoot(resolved)) throw new Error('Access denied');
    return scanDirectory(resolved);
  });

  ipcMain.handle('read-file', async (event, filePath: string) => {
    const resolved = path.resolve(filePath);
    if (!isWithinAllowedRoot(resolved)) throw new Error('Access denied');
    if (!isMarkdownFile(resolved)) throw new Error('Not a markdown file');
    const stat = await fs.lstat(resolved);
    if (!stat.isFile()) throw new Error('Not a regular file');
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (stat.size > MAX_FILE_SIZE) {
      const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: Electron.MessageBoxOptions = {
        type: 'warning',
        buttons: ['Cancel', 'Open Anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Large File',
        message: `This file is ${sizeMB} MB. Do you want to open it?`,
      };
      const result = win
        ? await dialog.showMessageBox(win, dialogOptions)
        : await dialog.showMessageBox(dialogOptions);
      if (result.response === 0) throw new Error('File too large — user cancelled');
    }
    return fs.readFile(resolved, 'utf-8');
  });

  ipcMain.handle('get-preferences', () => {
    return store.get('preferences');
  });

  ipcMain.handle('save-preferences', (_event, prefs: unknown) => {
    if (typeof prefs !== 'object' || prefs === null) throw new Error('Invalid preferences');
    const { fontFamily, fontSize, theme, customTheme } = prefs as Record<string, unknown>;
    if (typeof fontFamily !== 'string') throw new Error('Invalid fontFamily');
    if (typeof fontSize !== 'number' || fontSize < 8 || fontSize > 72) throw new Error('Invalid fontSize');
    if (!VALID_THEMES.includes(theme as ThemeMode)) throw new Error('Invalid theme');
    if (customTheme !== null && typeof customTheme !== 'string') throw new Error('Invalid customTheme');
    store.set('preferences', { fontFamily, fontSize, theme, customTheme } as Preferences);
  });

  ipcMain.handle('get-folder-history', () => {
    return store.get('folderHistory');
  });

  ipcMain.handle('add-folder-to-history', (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) throw new Error('Invalid path');
    if (!isWithinAllowedRoot(folderPath)) throw new Error('Access denied');
    const history = store.get('folderHistory');
    const name = path.basename(folderPath);
    const filtered = history.filter((e) => e.path !== folderPath);
    const updated = [{ path: folderPath, name }, ...filtered].slice(0, MAX_HISTORY);
    store.set('folderHistory', updated);
  });

  ipcMain.handle('reopen-folder', async (_event, folderPath: string) => {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) throw new Error('Invalid path');
    if (isWithinAllowedRoot(folderPath)) return folderPath;
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

  ipcMain.handle('report-error', (_event, errorData: unknown) => {
    if (typeof errorData !== 'object' || errorData === null) return;
    const { message, stack } = errorData as Record<string, unknown>;
    if (typeof message !== 'string') return;
    const error = new Error(message);
    if (typeof stack === 'string') error.stack = stack;
    captureException(error, 'renderer');
  });

  ipcMain.handle('get-analytics-enabled', () => {
    return isAnalyticsEnabled();
  });

  ipcMain.handle('set-analytics-enabled', async (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new Error('Invalid value');
    await setAnalyticsEnabled(enabled);
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

  ipcMain.handle('get-custom-themes', async () => {
    if (!(await themeFolderExists())) return null;
    return listThemeFiles();
  });

  ipcMain.handle('initialize-themes', async () => {
    await fs.mkdir(THEMES_DIR, { recursive: true });
    const defaultPath = path.join(THEMES_DIR, 'Default.css');
    try {
      await fs.access(defaultPath);
    } catch {
      await fs.writeFile(defaultPath, DEFAULT_THEME_CSS, 'utf-8');
    }
    shell.openPath(THEMES_DIR);
    return listThemeFiles();
  });

  ipcMain.handle('read-theme-css', async (_event, themeName: string) => {
    if (typeof themeName !== 'string') throw new Error('Invalid theme name');
    return readThemeFile(themeName);
  });

  ipcMain.handle('watch-themes', async (_event, themeName: string) => {
    if (typeof themeName !== 'string') throw new Error('Invalid theme name');
    startThemeWatcher(themeName);
  });

  ipcMain.handle('unwatch-themes', async () => {
    stopThemeWatcher();
  });
}

const isDev = !app.isPackaged;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'mailto:']);
const windows = new Set<BrowserWindow>();
let pendingFilePath: string | null = null;

function sendOpenFile(filePath: string) {
  const focused = BrowserWindow.getFocusedWindow();
  const target = focused ?? Array.from(windows)[0];
  if (target && !target.isDestroyed()) {
    target.webContents.send('open-file', filePath);
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

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
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

  windows.add(win);
  win.on('closed', () => windows.delete(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch { /* invalid URL — ignore */ }
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    captureRendererCrash(details.reason, details.exitCode);
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:')) return;
    event.preventDefault();
    try {
      const parsed = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
        shell.openExternal(url);
      }
    } catch { /* invalid URL — ignore */ }
  });

  win.once('ready-to-show', () => {
    win.show();
    if (pendingFilePath) {
      win.webContents.send('open-file', pendingFilePath);
      pendingFilePath = null;
    }
  });

  if (isDev) {
    const port = process.env.VITE_DEV_PORT ?? '5173';
    win.loadURL(`http://localhost:${port}`);
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  return win;
}

function initAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    autoUpdater.downloadUpdate().catch((err) => console.error('Update download failed:', err));
  });
  autoUpdater.on('update-downloaded', (info) => {
    captureAppUpdated(info.version);
  });
  autoUpdater.on('error', (err) => console.error('Auto-updater error:', err));
  autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
  setInterval(() => autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err)), 60 * 60 * 1000);
}

function installCSP() {
  if (isDev) return;
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' file: data:; font-src 'self'"],
      },
    });
  });
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Window', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' as const }, { role: 'front' as const }] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (windows.size > 0) {
      const win = Array.from(windows)[0];
      if (win.isMinimized()) win.restore();
      win.focus();
    } else {
      createWindow();
    }
  });

  process.on('uncaughtException', (error) => {
    captureException(error, 'main');
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    captureException(error, 'main');
  });

  app.on('ready', () => {
    installCSP();
    registerIpcHandlers();
    buildAppMenu();
    createWindow();
    initAnalytics();
    if (!isDev) initAutoUpdater();
  });

  let isShuttingDown = false;

  app.on('before-quit', (event) => {
    stopThemeWatcher();
    if (isShuttingDown) return;
    event.preventDefault();
    captureAppClosed();
    shutdownAnalytics().finally(() => {
      isShuttingDown = true;
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (windows.size === 0) {
      createWindow();
    }
  });
}

