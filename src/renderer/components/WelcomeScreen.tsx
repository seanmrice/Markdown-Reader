import { useState, useEffect } from 'react';
import type { FolderHistoryEntry } from '../../types';

interface WelcomeScreenProps {
  onOpenFolder: (path?: string) => void;
}

export default function WelcomeScreen({ onOpenFolder }: WelcomeScreenProps) {
  const [history, setHistory] = useState<FolderHistoryEntry[]>([]);
  const [existsMap, setExistsMap] = useState<Record<string, boolean | null>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (showSettings && analyticsEnabled === null) {
      window.api.getAnalyticsEnabled().then(setAnalyticsEnabled);
    }
  }, [showSettings, analyticsEnabled]);

  const toggleAnalytics = async () => {
    const newValue = !analyticsEnabled;
    setAnalyticsEnabled(newValue);
    await window.api.setAnalyticsEnabled(newValue);
  };

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
      position: 'relative',
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

      <button
        onClick={() => setShowSettings((s) => !s)}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: showSettings ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!showSettings) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!showSettings) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        Settings
      </button>

      {showSettings && (
        <div style={{
          position: 'absolute',
          bottom: '52px',
          right: '20px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px 16px',
          minWidth: '200px',
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            gap: '12px',
          }}>
            Analytics
            <button
              onClick={toggleAnalytics}
              style={{
                position: 'relative',
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                backgroundColor: analyticsEnabled ? 'var(--accent-color)' : 'var(--border-color)',
                transition: 'background-color 0.2s',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: analyticsEnabled ? '18px' : '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                transition: 'left 0.2s',
              }} />
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
