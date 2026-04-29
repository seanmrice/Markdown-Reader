# Markdown Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS Electron app that lets users select a folder and read all markdown files in a clean, themed viewer with a collapsible sidebar for navigation and customization.

**Architecture:** Electron Forge + Vite + React + TypeScript. Main process handles file I/O, preferences, and native dialogs. Renderer is a pure React app communicating via a typed IPC bridge (preload script). No nodeIntegration.

**Tech Stack:** Electron 41.2.0, Electron Forge 7.11.1, React 19.x, TypeScript, react-markdown 10.1.0, remark-gfm 4.0.1, shiki 4.0.2, react-shiki 0.9.3, electron-store 11.0.2, font-list 2.0.2, pnpm.

---

## File Structure

```
markdown-reader/
├── .gitignore
├── entitlements.plist
├── forge.config.ts
├── tsconfig.json
├── vite.main.config.ts
├── vite.preload.config.ts
├── vite.renderer.config.ts
├── package.json
├── src/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # contextBridge IPC bridge
│   ├── types.ts                   # Shared types (FileTreeNode, Preferences, etc.)
│   ├── renderer/
│   │   ├── index.html             # HTML entry
│   │   ├── index.tsx              # React entry point
│   │   ├── App.tsx                # Root component, layout, state management
│   │   ├── app.css                # Global styles and CSS custom properties (theme)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # Collapsible sidebar container
│   │   │   ├── FileTree.tsx       # Recursive file tree with folder expand/collapse
│   │   │   ├── FileTreeNode.tsx   # Individual tree node (file or directory)
│   │   │   ├── CustomizePanel.tsx # Font, font size, theme controls
│   │   │   ├── MarkdownViewer.tsx # react-markdown + shiki rendering
│   │   │   ├── WelcomeScreen.tsx  # Open folder / folder history
│   │   │   └── CodeBlock.tsx      # Shiki-powered code block for react-markdown
│   │   └── hooks/
│   │       └── useTheme.ts        # Theme detection + application logic
```

---

### Task 1: Scaffold Electron Forge project

**Files:**
- Create: `package.json`, `forge.config.ts`, `tsconfig.json`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`, `.gitignore`

- [ ] **Step 1: Create the Electron Forge app with Vite + TypeScript template**

```bash
cd "/Users/sean/Library/Mobile Documents/com~apple~CloudDocs/Markdown Reader"
pnpm dlx create-electron-app@latest markdown-reader --template=vite-typescript
```

- [ ] **Step 2: Move scaffolded files to project root**

The template creates a `markdown-reader/` subdirectory. Move its contents up to the repo root:

```bash
cd "/Users/sean/Library/Mobile Documents/com~apple~CloudDocs/Markdown Reader"
cp -r markdown-reader/* markdown-reader/.* . 2>/dev/null || true
rm -rf markdown-reader
```

- [ ] **Step 3: Install React and additional dependencies**

```bash
pnpm add react react-dom react-markdown remark-gfm shiki react-shiki electron-store font-list
pnpm add -D @types/react @types/react-dom
```

- [ ] **Step 4: Verify the app starts**

```bash
pnpm start
```

Expected: Electron window opens with the default Forge template content.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron Forge project with Vite + TypeScript"
```

---

### Task 2: Shared types and IPC API

**Files:**
- Create: `src/types.ts`
- Modify: `src/preload.ts`

- [ ] **Step 1: Create shared types**

Create `src/types.ts`:

```typescript
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Preferences {
  fontFamily: string;
  fontSize: number;
  theme: ThemeMode;
}

export interface FolderHistoryEntry {
  path: string;
  name: string;
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  readDirectory: (dirPath: string) => Promise<FileTreeNode>;
  readFile: (filePath: string) => Promise<string>;
  getPreferences: () => Promise<Preferences>;
  savePreferences: (prefs: Preferences) => Promise<void>;
  getFolderHistory: () => Promise<FolderHistoryEntry[]>;
  addFolderToHistory: (folderPath: string) => Promise<void>;
  clearFolderHistory: () => Promise<void>;
  getSystemFonts: () => Promise<string[]>;
  checkPathExists: (folderPath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
```

- [ ] **Step 2: Set up the preload script with contextBridge**

Replace the contents of `src/preload.ts`:

```typescript
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
};

contextBridge.exposeInMainWorld('api', api);
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/preload.ts
git commit -m "feat: add shared types and preload IPC bridge"
```

---

### Task 3: Main process — IPC handlers

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Implement main process with all IPC handlers**

Replace the contents of `src/main.ts`:

```typescript
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import Store from 'electron-store';
import fontList from 'font-list';
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
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const children: FileTreeNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
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
    const fonts = await fontList.getFonts();
    return fonts.map((f: string) => f.replace(/^"(.*)"$/, '$1')).sort();
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

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.on('ready', () => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
```

- [ ] **Step 2: Verify the app builds**

```bash
pnpm start
```

Expected: App starts without errors (window may show old template content).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: implement main process with all IPC handlers"
```

---

### Task 4: Theme system (CSS custom properties)

**Files:**
- Create: `src/renderer/app.css`, `src/renderer/hooks/useTheme.ts`

- [ ] **Step 1: Create theme CSS with custom properties**

Create `src/renderer/app.css`:

```css
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

  --sidebar-width: 280px;
  --sidebar-collapsed-width: 0px;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 16px;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

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

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  overflow: hidden;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

#app {
  display: flex;
  height: 100vh;
  width: 100vw;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

button {
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
}

select {
  color: var(--text-primary);
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  font: inherit;
}
```

- [ ] **Step 2: Create the useTheme hook**

Create `src/renderer/hooks/useTheme.ts`:

```typescript
import { useEffect } from 'react';
import type { ThemeMode } from '../../types';

export function useTheme(theme: ThemeMode) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'light') {
      root.classList.add('theme-light');
    } else if (theme === 'dark') {
      root.classList.add('theme-dark');
    }
  }, [theme]);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/app.css src/renderer/hooks/useTheme.ts
git commit -m "feat: add theme system with CSS custom properties and useTheme hook"
```

---

### Task 5: React entry point and App shell

**Files:**
- Modify: `src/renderer/index.html`
- Create: `src/renderer/index.tsx`, `src/renderer/App.tsx`

- [ ] **Step 1: Update index.html**

Replace the contents of the `<body>` in `src/renderer/index.html` (keep the existing `<!DOCTYPE html>` and `<head>`):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Markdown Reader</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create React entry point**

Create `src/renderer/index.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Create the App shell component**

Create `src/renderer/App.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import type { FileTreeNode, Preferences } from '../types';
import { useTheme } from './hooks/useTheme';
import Sidebar from './components/Sidebar';
import MarkdownViewer from './components/MarkdownViewer';
import WelcomeScreen from './components/WelcomeScreen';

const DEFAULT_PREFERENCES: Preferences = {
  fontFamily: 'System Default',
  fontSize: 16,
  theme: 'system',
};

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');

  useTheme(preferences.theme);

  useEffect(() => {
    window.api.getPreferences().then(setPreferences);
  }, []);

  const updatePreferences = useCallback((update: Partial<Preferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...update };
      window.api.savePreferences(next);
      return next;
    });
  }, []);

  const openFolder = useCallback(async (folderPath?: string) => {
    const target = folderPath ?? (await window.api.openFolder());
    if (!target) return;

    const tree = await window.api.readDirectory(target);
    setFileTree(tree);
    setCurrentFolderName(tree.name);
    setCurrentFile(null);
    setFileContent('');
    await window.api.addFolderToHistory(target);
  }, []);

  const selectFile = useCallback(async (filePath: string) => {
    const content = await window.api.readFile(filePath);
    setCurrentFile(filePath);
    setFileContent(content);
  }, []);

  const fontStyle = preferences.fontFamily !== 'System Default'
    ? { fontFamily: `"${preferences.fontFamily}", sans-serif` }
    : {};

  return (
    <>
      {fileTree && (
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          fileTree={fileTree}
          currentFile={currentFile}
          onSelectFile={selectFile}
          onOpenFolder={() => openFolder()}
          folderName={currentFolderName}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
        />
      )}
      <main
        style={{
          flex: 1,
          overflow: 'auto',
          ...fontStyle,
          fontSize: `${preferences.fontSize}px`,
        }}
      >
        {fileTree ? (
          currentFile ? (
            <MarkdownViewer content={fileContent} theme={preferences.theme} />
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a file from the sidebar
            </div>
          )
        ) : (
          <WelcomeScreen onOpenFolder={openFolder} />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/index.html src/renderer/index.tsx src/renderer/App.tsx
git commit -m "feat: add React entry point and App shell component"
```

---

### Task 6: WelcomeScreen component

**Files:**
- Create: `src/renderer/components/WelcomeScreen.tsx`

- [ ] **Step 1: Create the WelcomeScreen component**

Create `src/renderer/components/WelcomeScreen.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { FolderHistoryEntry } from '../../types';

interface WelcomeScreenProps {
  onOpenFolder: (path?: string) => void;
}

export default function WelcomeScreen({ onOpenFolder }: WelcomeScreenProps) {
  const [history, setHistory] = useState<FolderHistoryEntry[]>([]);
  const [existsMap, setExistsMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.api.getFolderHistory().then(async (entries) => {
      setHistory(entries);
      const checks: Record<string, boolean> = {};
      await Promise.all(
        entries.map(async (e) => {
          checks[e.path] = await window.api.checkPathExists(e.path);
        })
      );
      setExistsMap(checks);
    });
  }, []);

  const clearHistory = async () => {
    await window.api.clearFolderHistory();
    setHistory([]);
    setExistsMap({});
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '24px',
    }}>
      <h1 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>
        Markdown Reader
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
        A clean markdown reader
      </p>
      <button
        onClick={() => onOpenFolder()}
        style={{
          padding: '10px 24px',
          backgroundColor: 'var(--accent-color)',
          color: '#ffffff',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        Open Folder
      </button>

      {history.length > 0 && (
        <div style={{ width: '400px', maxWidth: '90%', marginTop: '16px' }}>
          <h3 style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: '8px',
            letterSpacing: '0.05em',
          }}>
            Recent Folders
          </h3>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}>
            {history.map((entry, i) => {
              const exists = existsMap[entry.path] !== false;
              return (
                <button
                  key={entry.path}
                  onClick={() => exists && onOpenFolder(entry.path)}
                  disabled={!exists}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    borderBottom: i < history.length - 1 ? '1px solid var(--border-light)' : 'none',
                    opacity: exists ? 1 : 0.4,
                    cursor: exists ? 'pointer' : 'default',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (exists) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{entry.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {entry.path}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={clearHistory}
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '8px',
              padding: '4px 0',
            }}
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/WelcomeScreen.tsx
git commit -m "feat: add WelcomeScreen with folder history"
```

---

### Task 7: Sidebar, FileTree, and FileTreeNode components

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`, `src/renderer/components/FileTree.tsx`, `src/renderer/components/FileTreeNode.tsx`

- [ ] **Step 1: Create the Sidebar component**

Create `src/renderer/components/Sidebar.tsx`:

```tsx
import type { FileTreeNode as FileTreeNodeType, Preferences } from '../../types';
import FileTree from './FileTree';
import CustomizePanel from './CustomizePanel';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  fileTree: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  onOpenFolder: () => void;
  folderName: string;
  preferences: Preferences;
  onUpdatePreferences: (update: Partial<Preferences>) => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  fileTree,
  currentFile,
  onSelectFile,
  onOpenFolder,
  folderName,
  preferences,
  onUpdatePreferences,
}: SidebarProps) {
  return (
    <>
      <button
        onClick={onToggle}
        aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          position: 'fixed',
          top: '8px',
          left: isOpen ? 'calc(var(--sidebar-width) - 36px)' : '8px',
          zIndex: 100,
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          backgroundColor: 'var(--bg-sidebar)',
          border: '1px solid var(--border-color)',
          transition: 'left 0.2s ease',
        }}
      >
        {isOpen ? '◀' : '▶'}
      </button>

      {isOpen && (
        <aside
          style={{
            width: 'var(--sidebar-width)',
            minWidth: 'var(--sidebar-width)',
            height: '100vh',
            backgroundColor: 'var(--bg-sidebar)',
            borderRight: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '44px',
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {folderName}
            </span>
            <button
              onClick={onOpenFolder}
              title="Open folder"
              style={{
                marginLeft: '8px',
                fontSize: '16px',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              📂
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <FileTree node={fileTree} currentFile={currentFile} onSelectFile={onSelectFile} depth={0} />
          </div>

          <CustomizePanel preferences={preferences} onUpdatePreferences={onUpdatePreferences} />
        </aside>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create the FileTree component**

Create `src/renderer/components/FileTree.tsx`:

```tsx
import type { FileTreeNode as FileTreeNodeType } from '../../types';
import FileTreeNode from './FileTreeNode';

interface FileTreeProps {
  node: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}

export default function FileTree({ node, currentFile, onSelectFile, depth }: FileTreeProps) {
  if (!node.children || node.children.length === 0) return null;

  return (
    <div>
      {node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          currentFile={currentFile}
          onSelectFile={onSelectFile}
          depth={depth}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the FileTreeNode component**

Create `src/renderer/components/FileTreeNode.tsx`:

```tsx
import { useState } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '../../types';
import FileTree from './FileTree';

interface FileTreeNodeProps {
  node: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}

export default function FileTreeNode({ node, currentFile, onSelectFile, depth }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const isActive = node.type === 'file' && node.path === currentFile;
  const paddingLeft = 14 + depth * 16;

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            width: '100%',
            padding: `4px 8px 4px ${paddingLeft}px`,
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{
            fontSize: '10px',
            display: 'inline-block',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}>
            ▶
          </span>
          {node.name}
        </button>
        {expanded && (
          <FileTree node={node} currentFile={currentFile} onSelectFile={onSelectFile} depth={depth + 1} />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'block',
        width: '100%',
        padding: `4px 8px 4px ${paddingLeft + 14}px`,
        fontSize: '13px',
        textAlign: 'left',
        backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isActive ? 500 : 400,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {node.name}
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Sidebar.tsx src/renderer/components/FileTree.tsx src/renderer/components/FileTreeNode.tsx
git commit -m "feat: add Sidebar, FileTree, and FileTreeNode components"
```

---

### Task 8: CustomizePanel component

**Files:**
- Create: `src/renderer/components/CustomizePanel.tsx`

- [ ] **Step 1: Create the CustomizePanel component**

Create `src/renderer/components/CustomizePanel.tsx`:

```tsx
import { useState, useEffect } from 'react';
import type { Preferences, ThemeMode } from '../../types';

interface CustomizePanelProps {
  preferences: Preferences;
  onUpdatePreferences: (update: Partial<Preferences>) => void;
}

export default function CustomizePanel({ preferences, onUpdatePreferences }: CustomizePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && systemFonts.length === 0) {
      window.api.getSystemFonts().then(setSystemFonts);
    }
  }, [isOpen, systemFonts.length]);

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  return (
    <div style={{ borderTop: '1px solid var(--border-color)' }}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '10px 14px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span>Customize</span>
        <span style={{
          fontSize: '10px',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
        }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Font
            </label>
            <select
              value={preferences.fontFamily}
              onChange={(e) => onUpdatePreferences({ fontFamily: e.target.value })}
              style={{ width: '100%', fontSize: '12px' }}
            >
              <option value="System Default">System Default</option>
              {systemFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Font Size
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => onUpdatePreferences({ fontSize: Math.max(10, preferences.fontSize - 1) })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                −
              </button>
              <span style={{ fontSize: '13px', minWidth: '32px', textAlign: 'center' }}>
                {preferences.fontSize}px
              </span>
              <button
                onClick={() => onUpdatePreferences({ fontSize: Math.min(32, preferences.fontSize + 1) })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Theme
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onUpdatePreferences({ theme: opt.value })}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: preferences.theme === opt.value ? 'var(--accent-color)' : 'transparent',
                    color: preferences.theme === opt.value ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: preferences.theme === opt.value ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CustomizePanel.tsx
git commit -m "feat: add CustomizePanel with font, size, and theme controls"
```

---

### Task 9: CodeBlock and MarkdownViewer components

**Files:**
- Create: `src/renderer/components/CodeBlock.tsx`, `src/renderer/components/MarkdownViewer.tsx`

- [ ] **Step 1: Create the CodeBlock component**

Create `src/renderer/components/CodeBlock.tsx`:

```tsx
import { ShikiHighlighter, isInlineCode } from 'react-shiki';
import type { ThemeMode } from '../../types';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  node?: import('hast').Element;
  theme: ThemeMode;
}

function resolveShikiTheme(theme: ThemeMode): { light: string; dark: string } {
  return { light: 'github-light', dark: 'github-dark' };
}

export default function CodeBlock({ children, className, node, theme }: CodeBlockProps) {
  if (isInlineCode(node)) {
    return (
      <code
        style={{
          backgroundColor: 'var(--bg-code)',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '0.9em',
        }}
      >
        {children}
      </code>
    );
  }

  const language = className?.replace('language-', '') ?? '';
  const code = String(children).replace(/\n$/, '');
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themes = resolveShikiTheme(theme);

  return (
    <ShikiHighlighter
      language={language}
      theme={isDark ? themes.dark : themes.light}
    >
      {code}
    </ShikiHighlighter>
  );
}
```

- [ ] **Step 2: Create the MarkdownViewer component**

Create `src/renderer/components/MarkdownViewer.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import type { ThemeMode } from '../../types';

interface MarkdownViewerProps {
  content: string;
  theme: ThemeMode;
}

export default function MarkdownViewer({ content, theme }: MarkdownViewerProps) {
  return (
    <div
      className="markdown-body"
      style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 32px' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: (props) => <CodeBlock {...props} theme={theme} />,
          a: ({ children, href, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      <style>{`
        .markdown-body h1 { font-size: 2em; font-weight: 600; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-light); }
        .markdown-body h2 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-light); }
        .markdown-body h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
        .markdown-body h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
        .markdown-body p { margin: 0.5em 0; line-height: 1.6; }
        .markdown-body ul, .markdown-body ol { padding-left: 2em; margin: 0.5em 0; }
        .markdown-body li { margin: 0.25em 0; line-height: 1.6; }
        .markdown-body blockquote { padding: 0 1em; color: var(--blockquote-text); border-left: 4px solid var(--blockquote-border); margin: 0.5em 0; }
        .markdown-body pre { background-color: var(--bg-code); border-radius: 6px; padding: 16px; overflow-x: auto; margin: 0.5em 0; font-size: 0.9em; }
        .markdown-body img { max-width: 100%; border-radius: 4px; }
        .markdown-body a { color: var(--link-color); text-decoration: none; }
        .markdown-body a:hover { color: var(--link-hover); text-decoration: underline; }
        .markdown-body hr { border: none; border-top: 1px solid var(--hr-color); margin: 1.5em 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .markdown-body th, .markdown-body td { padding: 8px 12px; border: 1px solid var(--table-border); text-align: left; }
        .markdown-body tr:nth-child(even) { background-color: var(--table-row-alt); }
        .markdown-body th { font-weight: 600; }
        .markdown-body input[type="checkbox"] { margin-right: 0.5em; }
        .markdown-body del { color: var(--text-muted); }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/CodeBlock.tsx src/renderer/components/MarkdownViewer.tsx
git commit -m "feat: add MarkdownViewer with GFM and Shiki syntax highlighting"
```

---

### Task 10: Entitlements and Forge config for macOS signing

**Files:**
- Create: `entitlements.plist`
- Modify: `forge.config.ts`

- [ ] **Step 1: Create the entitlements plist**

Create `entitlements.plist` in the project root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-only</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 2: Update forge.config.ts with app identity and signing**

Update `forge.config.ts` to include the app bundle ID, architecture target, osxSign config, and DMG maker. The exact structure will depend on the scaffolded template, but the key additions are:

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.untasker.markdownreader',
    name: 'Markdown Reader',
    arch: 'arm64',
    osxSign: {
      optionsForFile: () => ({
        entitlements: './entitlements.plist',
      }),
    },
    osxNotarize: {
      // Fill in before distribution:
      // appleId: process.env.APPLE_ID,
      // appleIdPassword: process.env.APPLE_ID_PASSWORD,
      // teamId: process.env.APPLE_TEAM_ID,
    },
  },
  makers: [
    new MakerDMG({
      format: 'ULFO',
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
        { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
```

- [ ] **Step 3: Install the DMG maker**

```bash
pnpm add -D @electron-forge/maker-dmg
```

- [ ] **Step 4: Commit**

```bash
git add entitlements.plist forge.config.ts
git commit -m "feat: add macOS entitlements and Forge signing config"
```

---

### Task 11: Clean up template files and final integration

**Files:**
- Remove: any template boilerplate files (e.g., default CSS, template renderer files)
- Modify: any Vite config adjustments needed for React JSX

- [ ] **Step 1: Remove scaffolded template files that are no longer needed**

Delete the default template renderer files that were replaced by our React components (e.g., `src/renderer/index.css`, `src/renderer/renderer.ts`, or any other template defaults).

- [ ] **Step 2: Update Vite renderer config for React**

Install the Vite React plugin and update `vite.renderer.config.ts`:

```bash
pnpm add -D @vitejs/plugin-react
```

Update `vite.renderer.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 3: Add .gitignore entries**

Ensure `.gitignore` includes:

```
node_modules/
out/
.vite/
dist/
*.dmg
.DS_Store
```

- [ ] **Step 4: Verify the full app starts and runs**

```bash
pnpm start
```

Expected: App opens, shows welcome screen. Clicking "Open Folder" opens native picker. Selecting a folder with `.md` files shows the file tree. Clicking a file renders the markdown. Customize panel adjusts font/size/theme in real time.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: clean up template and finalize integration"
```

---

## Dependency Summary

**Runtime:**
- `electron` 41.2.0
- `react` ^19.x
- `react-dom` ^19.x
- `react-markdown` 10.1.0
- `remark-gfm` 4.0.1
- `shiki` 4.0.2
- `react-shiki` 0.9.3
- `electron-store` 11.0.2
- `font-list` 2.0.2

**Dev:**
- `@electron-forge/cli` 7.11.1
- `@electron-forge/maker-dmg`
- `@electron-forge/plugin-vite`
- `@vitejs/plugin-react`
- `@types/react`
- `@types/react-dom`
- `typescript`
- `vite`
