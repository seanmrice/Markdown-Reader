export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  lazy?: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Preferences {
  fontFamily: string;
  fontSize: number;
  theme: ThemeMode;
  customTheme: string | null;
}

export interface FolderHistoryEntry {
  path: string;
  name: string;
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  readDirectory: (dirPath: string) => Promise<FileTreeNode>;
  expandDirectory: (dirPath: string) => Promise<FileTreeNode>;
  readFile: (filePath: string) => Promise<string>;
  getPreferences: () => Promise<Preferences>;
  savePreferences: (prefs: Preferences) => Promise<void>;
  getFolderHistory: () => Promise<FolderHistoryEntry[]>;
  addFolderToHistory: (folderPath: string) => Promise<void>;
  reopenFolder: (folderPath: string) => Promise<string>;
  clearFolderHistory: () => Promise<void>;
  getSystemFonts: () => Promise<string[]>;
  checkPathExists: (folderPath: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  onOpenFile: (callback: (filePath: string) => void) => () => void;
  getCustomThemes: () => Promise<string[] | null>;
  initializeThemes: () => Promise<string[]>;
  readThemeCss: (themeName: string) => Promise<string | null>;
  watchThemes: (themeName: string) => Promise<void>;
  unwatchThemes: () => Promise<void>;
  onThemeCssChanged: (callback: (css: string | null) => void) => () => void;
  onThemesListChanged: (callback: (themes: string[]) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
