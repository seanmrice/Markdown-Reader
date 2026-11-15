import { ShikiHighlighter, isInlineCode } from 'react-shiki';
import type { Element } from 'hast';
import type { ResolvedTheme } from '../hooks/useTheme';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  node?: Element;
  theme: ResolvedTheme;
}

// react-shiki >=0.11 bundles its own copy of the hast types, which TS treats as
// distinct from @types/hast even though they're structurally the same at runtime.
type ShikiElement = Parameters<typeof isInlineCode>[0];

const SHIKI_THEME = { light: 'github-light', dark: 'github-dark' };

export default function CodeBlock({ children, className, node, theme }: CodeBlockProps) {
  if (node && isInlineCode(node as unknown as ShikiElement)) {
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
