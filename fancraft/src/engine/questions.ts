import { QUESTIONS_QR_SIZE, SCHEMES } from '../config';
import type { Measure, Mm, Page, Para, QuestionsBlock, Settings } from '../model/types';
import { chapterPages } from './chapter';
import { geometry } from './geometry';

const MM_PER_PT = 25.4 / 72;
const PT_PER_MM = 72 / 25.4;

export interface QuestionsOptions {
  // Показ на екрані: порожні пункти лишаються рядками («3. »), щоб новий пункт було видно й куди писати.
  keepEmpty?: boolean;
}

// Питання — завжди одна сторінка: назва, пронумерований перелік, примітка; унизу смуги — місце QR
// (резервується завжди, як на обкладинці: екран і PDF однакові; сам QR — лише з посиланням).
// Що не влізло над QR, не друкується; limit каже, скільки знаків є й скільки влазить (інтерфейс не дає
// набрати більше й попереджає, якщо щось не влізло).
export function questionsPages(block: QuestionsBlock, settings: Settings, measure: Measure, { keepEmpty = false }: QuestionsOptions = {}): Omit<Page, 'number'>[] {
  const items = block.items.map((q) => q.trim()).filter((q) => keepEmpty || q);
  const body: Para[] = items.map((q, i) => ({ type: 'paragraph', runs: [{ text: `${i + 1}. ${q}` }] }));
  if (block.note.trim()) body.push({ type: 'paragraph', runs: [{ text: block.note }] });

  const g = geometry(settings);
  const L = g.leading * MM_PER_PT;
  const qrRows = Math.ceil(QUESTIONS_QR_SIZE / L - 1e-9) + 1;
  const lastTextRow = g.textBlock.lines - qrRows - 1;

  // Рядки переліку — поле items, примітки — note: інтерфейс редагує їх просто на сторінці.
  const laid = chapterPages(
    { id: block.id, type: 'chapter', title: block.title, body }, settings, measure,
    { kind: 'questions', indent: false, spaced: false },
  );
  const all = laid.flatMap((page, i) => page.lines.map((l) => ({ ...l, page: i })));
  const fits = all.filter((l) => l.page === 0 && l.row <= lastTextRow);
  const lines = fits.map(({ page: _page, ...l }) => (l.para === undefined ? l : { ...l, field: l.para < items.length ? 'items' as const : 'note' as const }));

  // Скільки знаків влазить: рядки від першого рядка тексту (під назвою) до рядка над QR, по ширині смуги.
  const scheme = SCHEMES[settings.scheme];
  const titleRows = laid[0]?.lines.filter((l) => l.role === 'chapterTitle').map((l) => l.row) ?? [];
  const textTop = titleRows.length ? Math.max(...titleRows) + 1 + scheme.chapterTitle.spaceAfter : 0;
  const perLine = Math.floor((g.textBlock.width * PT_PER_MM) / measure('н', 'regular', scheme.body) + 1e-9);
  const max = Math.max(0, (lastTextRow - textTop + 1) * perLine);
  const used = block.items.reduce((s, q) => s + q.trim().length, 0) + block.note.trim().length;
  const limit = { used, max, cut: fits.length < all.length };

  const gridHeight = g.textBlock.lines * L;
  const qr = block.url.trim()
    ? { url: block.url, size: QUESTIONS_QR_SIZE, x: 0 as Mm, y: (gridHeight - QUESTIONS_QR_SIZE) as Mm }
    : undefined;
  return [{ kind: 'questions', folio: laid[0]?.folio ?? false, lines, limit, ...(qr && { qr }) }];
}
