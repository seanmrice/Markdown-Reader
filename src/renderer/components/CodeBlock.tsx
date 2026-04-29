import { ShikiHighlighter, isInlineCode } from 'react-shiki';
import type { Element } from 'hast';
import type { ResolvedTheme } from '../hooks/useTheme';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  node?: Element;
  theme: ResolvedTheme;
}

const SHIKI_THEME = { light: 'github-light', dark: 'github-dark' };

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
      defaultColor={theme}
      addDefaultStyles
    >
      {code}
    </ShikiHighlighter>
  );
}
