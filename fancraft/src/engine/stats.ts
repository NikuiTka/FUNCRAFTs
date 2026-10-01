import type { Book, Page, Run } from '../model/types';

export interface BookStats {
  pages: number;
  sheets: number;
  colorSheets: number;
  plan: number[];
  // Усі порожні сторінки: вставлені пагінацією й зошитами плюс навмисні.
  blanks: number;
  intentionalBlanks: number;
  // Вільні сторінки в кінці останнього зошита, перед колофоном; вони ж входять у blanks.
  free: number;
}

// Номери сторінок одного аркуша: лице [N − 2i, 1 + 2i], зворот [2 + 2i, N − 1 − 2i].
export function sheetPages(plan: number[]): number[][] {
  const sheets: number[][] = [];
  let start = 0;
  for (const count of plan) {
    const n = count * 4;
    for (let i = 0; i < count; i++) {
      sheets.push([n - 2 * i, 1 + 2 * i, 2 + 2 * i, n - 1 - 2 * i].map((p) => start + p));
    }
    start += n;
  }
  return sheets;
}

// Кольорова сторінка — та, на якій є зображення: полоса чи фото частини. Без зображення — лише текст.
export const isColor = (page: Page | undefined) => !!page?.figure;

// Наскрізні номери кольорових аркушів (з 1): на аркуші є хоч одна полоса.
export function colorSheetNumbers(pages: Page[], plan: number[]): number[] {
  return sheetPages(plan)
    .map((nums, i) => (nums.some((n) => isColor(pages[n - 1])) ? i + 1 : 0))
    .filter(Boolean);
}

export function bookStats(pages: Page[], plan: number[], free: number): BookStats {
  const intentionalBlanks = pages.filter((p) => p.kind === 'tabula_rasa').length;
  return {
    pages: pages.length,
    sheets: plan.reduce((s, n) => s + n, 0),
    // Аркуш кольоровий, якщо хоч одна з його чотирьох сторінок — полоса.
    colorSheets: sheetPages(plan).filter((sheet) => sheet.some((n) => isColor(pages[n - 1]))).length,
    plan,
    blanks: pages.filter((p) => p.kind === 'blank').length + intentionalBlanks,
    intentionalBlanks,
    free,
  };
}

// Перша й остання сторінка кожного блоку — для рядків структури («с. 24–38»).
export function blockRanges(pages: Page[]): Record<string, [number, number]> {
  const ranges: Record<string, [number, number]> = {};
  for (const p of pages) {
    if (!p.source) continue;
    const r = ranges[p.source];
    if (r) r[1] = p.number;
    else ranges[p.source] = [p.number, p.number];
  }
  return ranges;
}

const plain = (runs: Run[]) => runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();

// book.txt — чистий текст книжки для ШІ: без верстки, номерів сторінок і переносів.
export function bookText(book: Book): string {
  const parts: string[] = [];
  const header = [book.meta.title, book.meta.author, book.meta.year].map((s) => s.trim()).filter(Boolean);
  if (header.length) parts.push(header.join('\n'));
  if (book.meta.description?.trim()) parts.push(book.meta.description.trim());

  for (const block of book.blocks) {
    switch (block.type) {
      case 'part': {
        if (block.title.trim()) parts.push(`[Частина] ${block.title.trim()}`);
        if (block.description.trim()) parts.push(block.description.trim());
        break;
      }
      case 'chapter':
        if (block.title.trim()) parts.push(`# ${block.title.trim()}`);
        for (const para of block.body) {
          const text = plain(para.runs);
          if (text) parts.push(text);
        }
        break;
      case 'plate': {
        const text = [block.title, block.caption].map((s) => s.trim()).filter(Boolean).join('. ');
        if (text) parts.push(`[Ілюстрація] ${text}`);
        break;
      }
      case 'questions': {
        if (block.title.trim()) parts.push(`# ${block.title.trim()}`);
        const items = block.items.map((q) => q.trim()).filter(Boolean);
        if (items.length) parts.push(items.map((q, i) => `${i + 1}. ${q}`).join('\n'));
        if (block.note.trim()) parts.push(block.note.trim());
        break;
      }
      case 'toc':
      case 'tabula_rasa':
        break;
    }
  }
  return parts.join('\n\n') + '\n';
}
