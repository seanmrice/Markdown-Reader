import type { FileTreeNode as FileTreeNodeType } from '../../types';
import FileTreeNode from './FileTreeNode';

interface FileTreeProps {
  node: FileTreeNodeType;
  currentFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}

export default function FileTree({ node, currentFile, onSelectFile, depth }: FileTreeProps) {
  if (!node.children || node.children.length === 0) return null;

  return (
    <div>
      {node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          currentFile={currentFile}
          onSelectFile={onSelectFile}
          depth={depth}
        />
      ))}
    </div>
  );
}
