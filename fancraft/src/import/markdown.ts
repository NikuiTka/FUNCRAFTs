import type { Unit } from '../model/chapters';
import { cleanText } from '../model/import';
import type { Run } from '../model/types';
import { normalizeRuns } from './runs';

// **жирний** / __жирний__, *курсив* / _курсив_, ~~закреслений~~. Решта розмітки лишається текстом.
function inline(text: string): Run[] {
  const runs: Run[] = [];
  const state = { b: false, i: false, s: false };
  let buf = '';
  const flush = () => {
    if (buf) runs.push({ text: buf, ...(state.b && { b: true }), ...(state.i && { i: true }), ...(state.s && { s: true }) });
    buf = '';
  };
  for (let k = 0; k < text.length; k++) {
    const two = text.slice(k, k + 2);
    const prev = text[k - 1] ?? ' ';
    const next = text[k + 1] ?? ' ';
    if (two === '**' || two === '__') { flush(); state.b = !state.b; k++; continue; }
    if (two === '~~') { flush(); state.s = !state.s; k++; continue; }
    // Підкреслення всередині слова (snake_case) — не розмітка.
    if (text[k] === '*' || (text[k] === '_' && (!/\p{L}/u.test(prev) || !/\p{L}/u.test(next)))) { flush(); state.i = !state.i; continue; }
    buf += text[k];
  }
  flush();
  return normalizeRuns(runs);
}

// Картинка окремим рядком, вбудована в сам файл: ![підпис](data:image/png;base64,…). Посилання на файли
// з диска браузер прочитати не може — такі картинки пропускаються. Підпис (alt) — окремою одиницею-підписом.
const DATA_IMAGE = /^!\[([^\]]*)\]\(data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)\)$/i;
const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)$/;

function imageUnits(line: string): Unit[] | null {
  if (!IMAGE_LINE.test(line)) return null;
  const m = DATA_IMAGE.exec(line);
  if (!m) return [];
  const bytes = Uint8Array.from(atob(m[3].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const caption = cleanText(m[1]);
  return [{ runs: [], image: { bytes, type: m[2].toLowerCase() } }, ...(caption ? [{ runs: [{ text: caption }], caption: true }] : [])];
}

export function parseMarkdown(text: string): Unit[] {
  const units: Unit[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      const runs = inline(cleanText(para.join(' ')));
      if (runs.length) units.push({ runs });
    }
    para = [];
  };

  for (const raw of text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!line) { flush(); continue; }
    if (heading) {
      flush();
      const runs = inline(cleanText(heading[2].replace(/\s#+$/, '')));
      if (runs.length) units.push({ runs, heading: heading[1].length === 1 ? 1 : 2 });
      continue;
    }
    const images = imageUnits(line);
    if (images) { flush(); units.push(...images); continue; }
    // Горизонтальна лінія — окремий абзац як є.
    if (/^(?:[-*_]\s*){3,}$/.test(line)) { flush(); units.push({ runs: [{ text: line }] }); continue; }
    para.push(line);
  }
  flush();
  return units;
}
