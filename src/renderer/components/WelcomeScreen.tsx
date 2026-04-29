import { useState, useEffect } from 'react';
import type { FolderHistoryEntry } from '../../types';

interface WelcomeScreenProps {
  onOpenFolder: (path?: string) => void;
}

export default function WelcomeScreen({ onOpenFolder }: WelcomeScreenProps) {
  const [history, setHistory] = useState<FolderHistoryEntry[]>([]);
  const [existsMap, setExistsMap] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    window.api.getFolderHistory().then(async (entries) => {
      setHistory(entries);
      setExistsMap(Object.fromEntries(entries.map((e) => [e.path, null])));
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
              const checked = existsMap[entry.path];
              const isLoading = checked === null || checked === undefined;
              const exists = checked === true;
              return (
                <button
                  key={entry.path}
                  onClick={() => exists && onOpenFolder(entry.path)}
                  disabled={!exists || isLoading}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '10px 14px',
                    textAlign: 'left',
                    borderBottom: i < history.length - 1 ? '1px solid var(--border-light)' : 'none',
                    opacity: isLoading ? 0.6 : exists ? 1 : 0.4,
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
