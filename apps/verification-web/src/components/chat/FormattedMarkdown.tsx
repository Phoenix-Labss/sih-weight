import React from 'react';

interface FormattedMarkdownProps {
  content: string;
  isUser?: boolean;
}

export const FormattedMarkdown: React.FC<FormattedMarkdownProps> = ({
  content,
  isUser = false,
}) => {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Parse inline styles (bold, italic, code)
  const renderInline = (text: string): React.ReactNode => {
    // Split by markdown bold **text** or *text* or `code`
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
    const tokens = text.split(regex);

    tokens.forEach((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={idx} className="italic text-slate-700 dark:text-slate-300">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={idx}
            className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] rounded font-semibold"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token) {
        parts.push(token);
      }
    });

    return parts;
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      elements.push(<div key={`spacer-${i}`} className="h-1.5" />);
      continue;
    }

    // 1. Headings: ### Title or ## Title or # Title
    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={`h4-${i}`}
          className="font-bold text-[13px] text-indigo-700 dark:text-indigo-300 mt-2 mb-1 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-3.5 bg-amber-500 rounded-full inline-block" />
          {renderInline(line.replace(/^###\s+/, ''))}
        </h4>
      );
      continue;
    }

    if (line.startsWith('## ') || line.startsWith('# ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="font-bold text-sm text-indigo-800 dark:text-indigo-200 mt-2.5 mb-1 flex items-center gap-1.5"
        >
          <span className="w-2 h-4 bg-indigo-500 rounded-full inline-block" />
          {renderInline(line.replace(/^#+\s+/, ''))}
        </h3>
      );
      continue;
    }

    // 2. Blockquotes: > quote text
    if (line.startsWith('> ')) {
      elements.push(
        <div
          key={`quote-${i}`}
          className="border-l-2 border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2 rounded-r-lg my-1.5 text-[11px] leading-relaxed"
        >
          {renderInline(line.replace(/^>\s+/, ''))}
        </div>
      );
      continue;
    }

    // 3. Numbered lists: 1. Item or 2. Item
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const num = numMatch[1];
      const rest = numMatch[2];
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1">
          <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-indigo-200 dark:border-indigo-800">
            {num}
          </span>
          <div className="flex-1 leading-relaxed">{renderInline(rest)}</div>
        </div>
      );
      continue;
    }

    // 4. Bullet lists: * item or - item or • item
    if (line.startsWith('* ') || line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 my-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
          <div className="flex-1 leading-relaxed">
            {renderInline(line.replace(/^[\*\-•]\s+/, ''))}
          </div>
        </div>
      );
      continue;
    }

    // 5. Normal text paragraph
    elements.push(
      <p key={`p-${i}`} className="my-0.5 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  return <div className="space-y-0.5 text-xs font-sans">{elements}</div>;
};
