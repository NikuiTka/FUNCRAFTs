import { EMOJI_GROUPS, EMOJI_REPLACE } from '../emojiConfig';
import type { Book, Run } from './types';

const ALLOWED = new Set(EMOJI_GROUPS.flatMap((g) => g.emoji));
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
// Селектори варіанта й тони шкіри: на чорно-білому папері вони нічого не змінюють.
const MODIFIERS = /\uFE0E|\uFE0F|[\u{1F3FB}-\u{1F3FF}]/gu;

// Блоки, де живуть емодзі. ©, ®, ™, стрілки ↔ теж «піктографічні», але це типографські знаки
// основного шрифту — їх не чіпаємо.
const inEmojiBlock = (cp: number) =>
  cp >= 0x1f000 || (cp >= 0x2300 && cp <= 0x23ff) || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff);

const isEmoji = (cluster: string) =>
  [...cluster].some((ch) => inEmojiBlock(ch.codePointAt(0)!) && PICTOGRAPHIC.test(ch)) ||
  (cluster.includes('\uFE0F') && PICTOGRAPHIC.test(cluster));

const graphemes = (text: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);

// Емодзі як ключ конфігу: без селектора варіанта й тону шкіри.
const keyOf = (cluster: string) => cluster.replace(MODIFIERS, '');

// Знаки, для яких у конфігу є заміна: емодзі-варіанти й символи без гліфа (★ ♪ ♡ — за Unicode не емодзі).
const REPLACEABLE = new RegExp(`[${[...new Set(Object.keys(EMOJI_REPLACE).flatMap((k) => [...k]))].join('')}]`, 'u');

// Імпорт: основні емодзі лишаються, варіанти й знаки із заміною стають основними, решта емодзі прибирається.
export function cleanEmoji(text: string): string {
  if (!PICTOGRAPHIC.test(text) && !REPLACEABLE.test(text)) return text;
  let removed = false;
  const out = graphemes(text).map((g) => {
    const key = keyOf(g);
    if (EMOJI_REPLACE[key]) return EMOJI_REPLACE[key];
    if (!isEmoji(g)) return g;
    if (ALLOWED.has(key)) return key;
    removed = true;
    return '';
  }).join('');
  // Краї рядків і фрагментів підрізають самі імпортери; тут — лише подвійний пробіл на місці знака.
  return removed ? out.replace(/ {2,}/g, ' ') : out;
}

// Усі емодзі книжки, найчастіші першими — для верху панелі емодзі.
export function usedEmoji(book: Book): string[] {
  const texts: string[] = [book.meta.title, book.meta.author, book.meta.description ?? ''];
  const runs = (rs: Run[]) => rs.map((r) => r.text).join('');
  for (const b of book.blocks) {
    switch (b.type) {
      case 'part': texts.push(b.title, b.description); break;
      case 'chapter': texts.push(b.title, ...b.body.map((p) => runs(p.runs))); break;
      case 'plate': texts.push(b.title, b.caption); break;
      case 'questions': texts.push(b.title, ...b.items, b.note); break;
      case 'toc': case 'tabula_rasa': texts.push(b.title); break;
    }
  }
  const counts = new Map<string, number>();
  for (const text of texts) {
    if (!PICTOGRAPHIC.test(text)) continue;
    for (const g of graphemes(text)) if (isEmoji(g)) counts.set(keyOf(g), (counts.get(keyOf(g)) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([e]) => e);
}
