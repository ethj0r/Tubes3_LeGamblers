export interface TextNodeRecord {
  node: Text;
  start: number;
  end: number;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'HEAD']);

export function collectPageText(root: Node = document.body): {
  fullText: string;
  records: TextNodeRecord[];
} {
  const records: TextNodeRecord[] = [];
  const parts: string[] = [];
  let offset = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue ?? '';
    records.push({ node: n as Text, start: offset, end: offset + text.length });
    parts.push(text);
    offset += text.length + 1;
  }

  return { fullText: parts.join('\n'), records };
}
