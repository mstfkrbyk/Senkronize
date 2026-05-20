import type { ReactElement, ReactNode } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-sky-600 underline" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return html;
}

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = (): void => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`list-${String(key++)}`} className="my-3 list-disc space-y-1 pl-6">
        {listItems.map((item) => (
          <li
            key={item}
            dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }}
          />
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    flushList();

    if (trimmed.startsWith('### ')) {
      nodes.push(
        <h3 key={`h3-${String(key++)}`} className="mb-2 mt-4 text-base font-semibold">
          {trimmed.slice(4)}
        </h3>,
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(
        <h2 key={`h2-${String(key++)}`} className="mb-2 mt-5 text-lg font-semibold">
          {trimmed.slice(3)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(
        <h1 key={`h1-${String(key++)}`} className="mb-3 mt-2 text-xl font-bold">
          {trimmed.slice(2)}
        </h1>,
      );
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    nodes.push(
      <p
        key={`p-${String(key++)}`}
        className="my-2 leading-relaxed text-foreground"
        dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed) }}
      />,
    );
  }

  flushList();
  return nodes;
}

interface Props {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: Props): ReactElement {
  return (
    <article className={className}>
      {renderMarkdown(content)}
    </article>
  );
}
