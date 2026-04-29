import { ShikiHighlighter, isInlineCode } from 'react-shiki';
import type { Element } from 'hast';
import type { ThemeMode } from '../../types';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  node?: Element;
  theme: ThemeMode;
}

const SHIKI_THEME = { light: 'github-light', dark: 'github-dark' };

function getDefaultColor(theme: ThemeMode): string {
  if (theme === 'light') return 'light';
  if (theme === 'dark') return 'dark';
  return 'light-dark()';
}

export default function CodeBlock({ children, className, node, theme }: CodeBlockProps) {
  if (node && isInlineCode(node)) {
    return (
      <code
        style={{
          backgroundColor: 'var(--bg-code)',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '0.9em',
        }}
      >
        {children}
      </code>
    );
  }

  const language = className?.replace('language-', '') ?? '';
  const code = String(children).replace(/\n$/, '');

  return (
    <ShikiHighlighter
      language={language}
      theme={SHIKI_THEME}
      defaultColor={getDefaultColor(theme)}
    >
      {code}
    </ShikiHighlighter>
  );
}
