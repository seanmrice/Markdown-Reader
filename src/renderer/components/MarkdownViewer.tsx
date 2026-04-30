import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import type { ResolvedTheme } from '../hooks/useTheme';

interface MarkdownViewerProps {
  content: string;
  theme: ResolvedTheme;
  currentFilePath: string | null;
  onNavigate: (filePath: string) => void;
  onNavigateFolder: (folderPath: string) => void;
}

export default function MarkdownViewer({ content, theme, currentFilePath, onNavigate, onNavigateFolder }: MarkdownViewerProps) {
  return (
    <div
      className="markdown-body"
      style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 32px' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: (props) => <CodeBlock {...props} theme={theme} />,
          a: ({ children, href, title }) => {
            const SAFE_EXTERNAL = ['http://', 'https://', '#', 'mailto:'];
            const isExternal = !href || SAFE_EXTERNAL.some((p) => href.startsWith(p));

            if (!isExternal && currentFilePath) {
              const dir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
              const cleaned = href.replace(/\/$/, '');
              const isMarkdownFile = cleaned.endsWith('.md');

              return (
                <a
                  href="#"
                  title={title}
                  onClick={(e) => {
                    e.preventDefault();
                    if (isMarkdownFile) {
                      onNavigate(`${dir}/${cleaned}`);
                    } else {
                      onNavigateFolder(`${dir}/${cleaned}`);
                    }
                  }}
                >
                  {children}
                </a>
              );
            }

            return (
              <a href={href} title={title} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      <style>{`
        .markdown-body h1 { font-size: 2em; font-weight: 600; margin: 0.67em 0; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-light); }
        .markdown-body h2 { font-size: 1.5em; font-weight: 600; margin: 1em 0 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border-light); }
        .markdown-body h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0 0.5em; }
        .markdown-body h4 { font-size: 1em; font-weight: 600; margin: 1em 0 0.5em; }
        .markdown-body p { margin: 0.5em 0; line-height: 1.6; }
        .markdown-body ul, .markdown-body ol { padding-left: 2em; margin: 0.5em 0; }
        .markdown-body li { margin: 0.25em 0; line-height: 1.6; }
        .markdown-body blockquote { padding: 0 1em; color: var(--blockquote-text); border-left: 4px solid var(--blockquote-border); margin: 0.5em 0; }
        .markdown-body pre { margin: 0.5em 0; font-size: 0.9em; }
        .markdown-body pre pre { padding: 1.25rem 1.5rem; border-radius: 0.5rem; overflow-x: auto; }
        .markdown-body img { max-width: 100%; border-radius: 4px; }
        .markdown-body a { color: var(--link-color); text-decoration: none; }
        .markdown-body a:hover { color: var(--link-hover); text-decoration: underline; }
        .markdown-body hr { border: none; border-top: 1px solid var(--hr-color); margin: 1.5em 0; }
        .markdown-body table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .markdown-body th, .markdown-body td { padding: 8px 12px; border: 1px solid var(--table-border); text-align: left; }
        .markdown-body tr:nth-child(even) { background-color: var(--table-row-alt); }
        .markdown-body th { font-weight: 600; }
        .markdown-body input[type="checkbox"] { margin-right: 0.5em; }
        .markdown-body del { color: var(--text-muted); }
      `}</style>
    </div>
  );
}
