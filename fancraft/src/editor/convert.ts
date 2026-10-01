import type { JSONContent } from '@tiptap/core';
import type { Para, Run } from '../model/types';

const MARKS = [['b', 'bold'], ['i', 'italic'], ['s', 'strike']] as const;

const toNode = (run: Run): JSONContent => {
  const marks = MARKS.filter(([key]) => run[key]).map(([, type]) => ({ type }));
  return { type: 'text', text: run.text, ...(marks.length ? { marks } : {}) };
};

const fromNode = (node: JSONContent): Run => {
  const has = (type: string) => node.marks?.some((m) => m.type === type) ?? false;
  const run: Run = { text: node.text ?? '' };
  for (const [key, type] of MARKS) if (has(type)) run[key] = true;
  return run;
};

const sameStyle = (a: Run, b: Run) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.s === !!b.s;

export function toEditor(body: Para[]): JSONContent {
  if (!body.length) return { type: 'doc', content: [{ type: 'paragraph' }] };
  return {
    type: 'doc',
    content: body.map((para) => ({
      // Лише абзаци: підзаголовки старих .book стають звичайними абзацами.
      type: 'paragraph',
      content: para.runs.map(toNode),
    })),
  };
}

// Порожні абзаци відкидаються: вертикальні відступи задає схема розмірів у рядках.
export function fromEditor(json: JSONContent): Para[] {
  const body: Para[] = [];
  for (const node of json.content ?? []) {
    const runs: Run[] = [];
    for (const run of (node.content ?? []).filter((n) => n.type === 'text').map(fromNode)) {
      const last = runs.at(-1);
      if (last && sameStyle(last, run)) last.text += run.text;
      else runs.push(run);
    }
    if (!runs.map((r) => r.text).join('').trim()) continue;
    body.push({ type: 'paragraph', runs });
  }
  return body;
}
