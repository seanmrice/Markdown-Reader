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
      setCurrentFile(null);
      setFileContent('');
      await window.api.addFolderToHistory(target);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
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
