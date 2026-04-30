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
};

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentFolderName, setCurrentFolderName] = useState<string>('');

  const resolvedTheme = useTheme(preferences.theme);

  useEffect(() => {
    window.api.getPreferences().then(setPreferences);
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

  const openFolder = useCallback(async (folderPath?: string) => {
    try {
      const target = folderPath ?? (await window.api.openFolder());
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
