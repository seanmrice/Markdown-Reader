import { useState, useEffect, useCallback } from 'react';
import type { FileTreeNode, Preferences } from '../types';
import { useTheme } from './hooks/useTheme';
import Sidebar from './components/Sidebar';
import MarkdownViewer from './components/MarkdownViewer';
import WelcomeScreen from './components/WelcomeScreen';

function findDefaultFile(node: FileTreeNode): string | null {
  if (node.type === 'file') {
    return node.name.toLowerCase() === 'readme.md' ? node.path : null;
  }
  if (!node.children) return null;
  for (const child of node.children) {
    if (child.type === 'file' && child.name.toLowerCase() === 'readme.md') {
      return child.path;
    }
  }
  let first: string | null = null;
  for (const child of node.children) {
    if (child.type === 'file' && !first) {
      first = child.path;
    }
    const found = findDefaultFile(child);
    if (found) return found;
  }
  return first;
}

const DEFAULT_PREFERENCES: Preferences = {
  fontFamily: 'System Default',
  fontSize: 16,
  theme: 'system',
  customTheme: null,
};

const CUSTOM_THEME_STYLE_ID = 'custom-theme-css';

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');

  const [availableThemes, setAvailableThemes] = useState<string[] | null>(null);
  const resolvedTheme = useTheme(preferences.theme);

  useEffect(() => {
    window.api.getPreferences().then(setPreferences);
    window.api.getCustomThemes().then(setAvailableThemes);
  }, []);

  const openFile = useCallback(async (filePath: string) => {
    try {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      const tree = await window.api.readDirectory(dir);
      setFileTree(tree);
      setCurrentFolderName(tree.name);
      await window.api.addFolderToHistory(dir);
      const content = await window.api.readFile(filePath);
      setCurrentFile(filePath);
      setFileContent(content);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, []);

  useEffect(() => {
    return window.api.onOpenFile(openFile);
  }, [openFile]);

  const updatePreferences = useCallback((update: Partial<Preferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...update };
      window.api.savePreferences(next).catch(console.error);
      return next;
    });
  }, []);

  const applyThemeCss = useCallback((css: string | null) => {
    let el = document.getElementById(CUSTOM_THEME_STYLE_ID);
    if (css) {
      if (!el) {
        el = document.createElement('style');
        el.id = CUSTOM_THEME_STYLE_ID;
        document.head.appendChild(el);
      }
      el.textContent = css;
    } else if (el) {
      el.remove();
    }
  }, []);

  useEffect(() => {
    const unsub = window.api.onThemesListChanged(setAvailableThemes);
    return unsub;
  }, []);

  useEffect(() => {
    const themeName = preferences.customTheme;
    if (!themeName) {
      applyThemeCss(null);
      window.api.unwatchThemes();
      return;
    }
    window.api.readThemeCss(themeName).then((css) => {
      if (css === null) {
        updatePreferences({ customTheme: null });
        return;
      }
      applyThemeCss(css);
    });
    window.api.watchThemes(themeName);
    const unsub = window.api.onThemeCssChanged((css) => {
      if (css === null) {
        updatePreferences({ customTheme: null });
        return;
      }
      applyThemeCss(css);
    });
    return () => {
      unsub();
      window.api.unwatchThemes();
    };
  }, [preferences.customTheme, applyThemeCss, updatePreferences]);

  const openFolder = useCallback(async (folderPath?: string) => {
    try {
      let target: string | null;
      if (folderPath) {
        target = await window.api.reopenFolder(folderPath);
      } else {
        target = await window.api.openFolder();
      }
      if (!target) return;

      const tree = await window.api.readDirectory(target);
      setFileTree(tree);
      setCurrentFolderName(tree.name);
      await window.api.addFolderToHistory(target);

      const defaultFile = findDefaultFile(tree);
      if (defaultFile) {
        const content = await window.api.readFile(defaultFile);
        setCurrentFile(defaultFile);
        setFileContent(content);
      } else {
        setCurrentFile(null);
        setFileContent('');
      }
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, []);

  const closeFolder = useCallback(() => {
    setFileTree(null);
    setCurrentFile(null);
    setFileContent('');
    setCurrentFolderName('');
  }, []);

  const selectFile = useCallback(async (filePath: string) => {
    try {
      const content = await window.api.readFile(filePath);
      setCurrentFile(filePath);
      setFileContent(content);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, []);

  const navigateToFolder = useCallback(async (folderPath: string) => {
    try {
      const tree = await window.api.readDirectory(folderPath);
      const defaultFile = findDefaultFile(tree);
      if (defaultFile) {
        const content = await window.api.readFile(defaultFile);
        setCurrentFile(defaultFile);
        setFileContent(content);
      }
    } catch {
      // folder not found — no-op
    }
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
          onCloseFolder={closeFolder}
          folderName={currentFolderName}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          availableThemes={availableThemes}
          onAvailableThemesChange={setAvailableThemes}
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
            <MarkdownViewer
              content={fileContent}
              theme={resolvedTheme}
              currentFilePath={currentFile}
              onNavigate={selectFile}
              onNavigateFolder={navigateToFolder}
            />
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
