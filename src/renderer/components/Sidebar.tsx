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
              {'📂'}
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
