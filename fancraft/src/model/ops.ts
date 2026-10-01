import type { Block, ChapterBlock, Para, Run } from './types';

const TITLE_MAX_LENGTH = 60;

const plain = (para: Para) => para.runs.map((r) => r.text).join('').trim();

// Короткий окремий рядок без розділового знака в кінці — схожий на назву.
const looksLikeTitle = (para: Para) => {
  const text = plain(para);
  return para.type === 'paragraph' && text.length > 0 && text.length <= TITLE_MAX_LENGTH && !/[.!?…:;,]$/.test(text);
};

// Перше речення тексту — до кінцевого розділового знака (. ! ? …) з пробілом чи кінцем абзацу після нього;
// без такого знака — увесь абзац.
const SENTENCE = /^\s*(.+?[.!?…]+)(?=\s|$)/s;

// Прибирає з початку абзацу n знаків разом із пробілами після них; накреслення решти зберігаються.
function dropStart(runs: Run[], n: number): Run[] {
  const out: Run[] = [];
  let left = n;
  for (const run of runs) {
    if (left >= run.text.length) { left -= run.text.length; continue; }
    out.push({ ...run, text: run.text.slice(left) });
    left = 0;
  }
  if (out.length) out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, '') };
  return out.filter((r) => r.text);
}

// Кожна глава починається з назви. Глава без назви бере назвою перше речення свого тексту: воно
// переходить із тексту в назву (решта абзацу лишається). Глава без тексту лишається як є.
export function withTitle(block: ChapterBlock): ChapterBlock {
  if (block.title.trim()) return block;
  const index = block.body.findIndex((p) => plain(p));
  if (index < 0) return block;
  const para = block.body[index];
  const text = para.runs.map((r) => r.text).join('');
  const sentence = SENTENCE.exec(text);
  const cut = sentence ? sentence[0].length : text.length;
  const title = text.slice(0, cut).replace(/\s+/g, ' ').trim();
  const runs = dropStart(para.runs, cut);
  const body = [...block.body.slice(0, index), ...(runs.length ? [{ ...para, runs }] : []), ...block.body.slice(index + 1)];
  return { ...block, title, body };
}

// «Розділити тут»: друга половина починається з абзацу index. Її перший рядок стає назвою,
// якщо схожий на назву; інакше назвою стає перше речення.
export function splitChapter(block: ChapterBlock, index: number, newId: string): [ChapterBlock, ChapterBlock] {
  const rest = block.body.slice(index);
  const titled = rest.length > 0 && looksLikeTitle(rest[0]);
  return [
    { ...block, body: block.body.slice(0, index) },
    withTitle({ id: newId, type: 'chapter', title: titled ? plain(rest[0]) : '', body: titled ? rest.slice(1) : rest }),
  ];
}

const MARKER = /^#{3,}\s*(.*)$/;

// «Розбити за мітками»: абзац «###» (з назвою після нього чи без) починає нову главу.
// Без назви після ### назвою стає наступний абзац, якщо схожий на назву, інакше — перше речення.
export function splitByMarkers(block: ChapterBlock, makeId: () => string): ChapterBlock[] {
  const parts: ChapterBlock[] = [{ ...block, body: [] }];
  for (let i = 0; i < block.body.length; i++) {
    const para = block.body[i];
    const marker = para.type === 'paragraph' ? MARKER.exec(plain(para)) : null;
    if (!marker) { parts.at(-1)!.body.push(para); continue; }
    let title = marker[1].trim();
    if (!title && block.body[i + 1] && looksLikeTitle(block.body[i + 1])) title = plain(block.body[++i]);
    parts.push({ id: makeId(), type: 'chapter', title, body: [] });
  }
  return parts.map(withTitle);
}

export function moveBlock(blocks: Block[], from: number, to: number): Block[] {
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
