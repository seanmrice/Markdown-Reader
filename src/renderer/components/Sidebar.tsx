import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileTreeNode as FileTreeNodeType, Preferences } from '../../types';
import FileTree from './FileTree';
import CustomizePanel from './CustomizePanel';
import HamburgerMenu from './HamburgerMenu';

const MIN_WIDTH = 180;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 280;

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  fileTree: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  onOpenFolder: () => void;
  onCloseFolder: () => void;
  folderName: string;
  preferences: Preferences;
  onUpdatePreferences: (update: Partial<Preferences>) => void;
  availableThemes: string[] | null;
  onAvailableThemesChange: (themes: string[] | null) => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  fileTree,
  currentFile,
  onSelectFile,
  onOpenFolder,
  onCloseFolder,
  folderName,
  preferences,
  onUpdatePreferences,
  availableThemes,
  onAvailableThemesChange,
}: SidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(clamped);
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (handleRef.current) handleRef.current.style.backgroundColor = 'transparent';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        aria-label="Expand sidebar"
        style={{
          position: 'fixed',
          top: '8px',
          left: '8px',
          zIndex: 100,
          width: '28px',
          height: '28px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-sidebar)',
          border: '1px solid var(--border-color)',
        }}
      >
        {'▶'}
      </button>
    );
  }

  return (
    <aside
      style={{
        width: `${width}px`,
        minWidth: `${width}px`,
        height: '100vh',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minHeight: '44px',
      }}>
        <HamburgerMenu onOpenFolder={onOpenFolder} onCloseFolder={onCloseFolder} />
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          color: 'var(--text-primary)',
        }}>
          {folderName}
        </span>
        <button
          onClick={onToggle}
          aria-label="Collapse sidebar"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {'◀'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
        <FileTree node={fileTree} currentFile={currentFile} onSelectFile={onSelectFile} depth={0} />
      </div>

      <CustomizePanel
        preferences={preferences}
        onUpdatePreferences={onUpdatePreferences}
        availableThemes={availableThemes}
        onAvailableThemesChange={onAvailableThemesChange}
      />

      <div
        ref={handleRef}
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '4px',
          height: '100%',
          cursor: 'col-resize',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-color)';
        }}
        onMouseLeave={(e) => {
          if (!dragging.current) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      />
    </aside>
  );
}
