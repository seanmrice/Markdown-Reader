import { useState, useEffect } from 'react';
import type { FileTreeNode as FileTreeNodeType } from '../../types';
import FileTree from './FileTree';

interface FileTreeNodeProps {
  node: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}

export default function FileTreeNode({ node, currentFile, onSelectFile, depth }: FileTreeNodeProps) {
  const containsCurrentFile = node.type === 'directory'
    && currentFile !== null
    && currentFile.startsWith(node.path + '/');

  const [expanded, setExpanded] = useState(containsCurrentFile);
  const [loadedNode, setLoadedNode] = useState<FileTreeNodeType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (containsCurrentFile) setExpanded(true);
  }, [containsCurrentFile]);
  const isActive = node.type === 'file' && node.path === currentFile;
  const paddingLeft = 14 + depth * 16;

  const handleToggle = async () => {
    if (node.lazy && !loadedNode && !expanded) {
      setLoading(true);
      try {
        const result = await window.api.expandDirectory(node.path);
        setLoadedNode(result);
      } catch {
        // expansion failed — leave collapsed
      }
      setLoading(false);
    }
    setExpanded((e) => !e);
  };

  if (node.type === 'directory') {
    const displayNode = loadedNode ?? node;
    return (
      <div>
        <button
          onClick={handleToggle}
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
            flexShrink: 0,
          }}>
            {'▶'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          {loading && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>...</span>
          )}
        </button>
        {expanded && !node.lazy && (
          <FileTree node={node} currentFile={currentFile} onSelectFile={onSelectFile} depth={depth + 1} />
        )}
        {expanded && node.lazy && loadedNode && (
          <FileTree node={loadedNode} currentFile={currentFile} onSelectFile={onSelectFile} depth={depth + 1} />
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
