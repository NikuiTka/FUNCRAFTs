import type { Run } from '../model/types';

const sameStyle = (a: Run, b: Run) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.s === !!b.s;

// Прибирає м'які переноси, стискає пробіли (зокрема на межах фрагментів), обрізає краї абзацу,
// викидає порожні фрагменти й зливає сусідні з однаковим накресленням.
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    let text = run.text.replace(/­/g, '').replace(/\s+/g, ' ');
    const prev = out.at(-1);
    if ((!prev || prev.text.endsWith(' ')) && text.startsWith(' ')) text = text.slice(1);
    if (!text) continue;
    if (prev && sameStyle(prev, run)) prev.text += text;
    else out.push({ ...run, text });
  }
  const last = out.at(-1);
  if (last) {
    last.text = last.text.trimEnd();
    if (!last.text) out.pop();
  }
  return out;
}
