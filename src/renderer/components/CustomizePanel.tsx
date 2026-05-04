import { useState, useEffect } from 'react';
import type { Preferences, ThemeMode } from '../../types';

interface CustomizePanelProps {
  preferences: Preferences;
  onUpdatePreferences: (update: Partial<Preferences>) => void;
  availableThemes: string[] | null;
  onAvailableThemesChange: (themes: string[] | null) => void;
}

export default function CustomizePanel({
  preferences,
  onUpdatePreferences,
  availableThemes,
  onAvailableThemesChange,
}: CustomizePanelProps) {
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

  const handleInitializeThemes = async () => {
    const themes = await window.api.initializeThemes();
    onAvailableThemesChange(themes);
  };

  const handleThemeSelect = (themeName: string) => {
    const value = themeName === '' ? null : themeName;
    onUpdatePreferences({ customTheme: value });
  };

  const themesInitialized = availableThemes !== null;

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
          {'▼'}
        </span>
      </button>

      {isOpen && (
        <div style={{ padding: '8px 14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <span style={{ fontSize: '12px', minWidth: '28px', flexShrink: 0 }}>
                {preferences.fontSize}px
              </span>
              <input
                type="range"
                min={10}
                max={32}
                value={preferences.fontSize}
                onChange={(e) => onUpdatePreferences({ fontSize: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent-color)' }}
              />
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

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Customize Theme
            </label>
            {themesInitialized ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  value={preferences.customTheme ?? ''}
                  onChange={(e) => handleThemeSelect(e.target.value)}
                  style={{ flex: 1, fontSize: '12px' }}
                >
                  <option value="">Default (built-in)</option>
                  {availableThemes.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleInitializeThemes}
                  title="Open themes folder"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {'📂'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleInitializeThemes}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Start
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
