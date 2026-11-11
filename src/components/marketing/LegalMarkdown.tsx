import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function LegalMarkdown({ content }: { content: string }) {
  return (
    <div className="legal-markdown">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          table: ({ children }) => (
            <div className="legal-table-scroll" role="region" aria-label="Tableau" tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
          img: () => null,
        }}
      >
        {content.replace(/^\s*#\s+[^\n]+\n/, '').replace(/^\s*Dernière mise à jour\s*:[^\n]+\n/, '')}
      </Markdown>
    </div>
  );
}
