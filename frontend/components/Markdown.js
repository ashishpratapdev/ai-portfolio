import { parseMarkdown, safeHref } from "@/lib/markdown";

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text": return n.value;
      case "code": return <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.9em]">{n.value}</code>;
      case "strong": return <strong key={i}><Inline nodes={n.children} /></strong>;
      case "em": return <em key={i}><Inline nodes={n.children} /></em>;
      case "link": {
        if (!n.href || !safeHref(n.href)) return <Inline key={i} nodes={n.children} />;
        const external = /^https?:/i.test(n.href);
        return (
          <a key={i} href={n.href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}
            className="text-teal underline decoration-teal/40 decoration-2 underline-offset-4 hover:decoration-teal">
            <Inline nodes={n.children} />
          </a>
        );
      }
      default: return null;
    }
  });
}

function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "heading": {
        const Tag = `h${Math.min(Math.max(b.level + 1, 2), 6)}`; // page title is the h1
        return <Tag key={i} className="mb-3 mt-10 text-2xl font-semibold"><Inline nodes={b.children} /></Tag>;
      }
      case "p": return <p key={i} className="my-4"><Inline nodes={b.children} /></p>;
      case "ul": return <ul key={i} className="my-4 list-disc space-y-1 pl-6">{b.items.map((it, j) => <li key={j}><Inline nodes={it} /></li>)}</ul>;
      case "ol": return <ol key={i} className="my-4 list-decimal space-y-1 pl-6">{b.items.map((it, j) => <li key={j}><Inline nodes={it} /></li>)}</ol>;
      case "quote": return <blockquote key={i} className="my-4 border-l-4 border-teal pl-4 text-muted"><Blocks blocks={b.children} /></blockquote>;
      case "code": return <pre key={i} className="my-4 overflow-x-auto rounded-xl border border-line bg-surface p-4 font-mono text-sm"><code>{b.value}</code></pre>;
      case "hr": return <hr key={i} className="my-8 border-line" />;
      default: return null;
    }
  });
}

export default function Markdown({ source }) {
  return <div className="max-w-prose text-lg leading-relaxed"><Blocks blocks={parseMarkdown(source)} /></div>;
}
