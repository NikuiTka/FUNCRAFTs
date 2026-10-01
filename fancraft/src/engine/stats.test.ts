import { describe, expect, it } from 'vitest';
import { blockRanges, bookStats, bookText } from './stats';
import type { Book, Page } from '../model/types';

const page = (kind: Page['kind'], number: number): Page => ({ kind, number, folio: false, lines: [] });

describe('bookStats', () => {
  it('сторінки, аркуші, кольорові аркуші, зошити, порожні — окремо навмисні', () => {
    // 12 сторінок, 1 зошит на 3 аркуші; полоса на с. 9 (аркуш 2).
    const kinds: Page['kind'][] = ['title', 'blank', 'chapter', 'chapter', 'tabula_rasa', 'tabula_rasa', 'chapter', 'chapter', 'plate', 'blank', 'blank', 'colophon'];
    const pages = kinds.map((k, i) => (k === 'plate' ? { ...page(k, i + 1), figure: { asset: 'img/img_001.jpg' } } : page(k, i + 1)) as Page);
    const stats = bookStats(pages, [3], 2);
    expect(stats).toEqual({ pages: 12, sheets: 3, colorSheets: 1, plan: [3], blanks: 5, intentionalBlanks: 2, free: 2 });
  });

  it('полоса без зображення — не кольорова; частина з фото — кольорова', () => {
    const kinds: Page['kind'][] = ['title', 'plate', 'blank', 'colophon'];
    expect(bookStats(kinds.map((k, i) => page(k, i + 1)), [1], 0).colorSheets).toBe(0);
    const pages = kinds.map((k, i) => page(k, i + 1));
    pages[2] = { ...page('part', 3), figure: { asset: 'img/img_001.jpg' } } as Page;
    expect(bookStats(pages, [1], 0).colorSheets).toBe(1);
  });
});

describe('blockRanges', () => {
  it('перша й остання сторінка кожного блоку; вставлені порожні не належать нікому', () => {
    const pages: Page[] = [
      page('title', 1), page('blank', 2),
      { ...page('chapter', 3), source: 'a' }, { ...page('chapter', 4), source: 'a' },
      page('blank', 5), { ...page('plate', 6), source: 'p' }, page('colophon', 7),
    ];
    expect(blockRanges(pages)).toEqual({ a: [3, 4], p: [6, 6] });
  });
});

describe('bookText', () => {
  it('частина — назва з позначкою й опис окремим абзацом', () => {
    const book = {
      meta: { title: '', author: '', year: '' },
      blocks: [{ id: 'p', type: 'part', title: 'Частина перша', description: 'Про дорогу.', asset: '' }],
    } as unknown as Book;
    expect(bookText(book)).toBe('[Частина] Частина перша\n\nПро дорогу.\n');
  });

  it('назви глав, текст, підписи ілюстрацій і питання — без верстки', () => {
    const book = {
      blocks: [
        { id: 't', type: 'toc', title: 'Зміст' },
        { id: 'c', type: 'chapter', title: 'День перший', body: [
          { type: 'paragraph', runs: [{ text: 'Перший ' }, { text: 'абзац', b: true }, { text: '.' }] },
          { type: 'paragraph', runs: [{ text: 'Вечір', b: true }] },
          { type: 'paragraph', runs: [{ text: 'Другий.' }] },
        ] },
        { id: 'p', type: 'plate', asset: 'img/img_001.jpg', title: 'Причал', caption: 'Ранок.', side: 'auto' },
        { id: 'q', type: 'questions', title: 'Що спитати', items: ['Чому?', ''], url: 'https://x', note: '' },
        { id: 'r', type: 'tabula_rasa', title: '', count: 2, side: 'auto' },
      ],
    } as unknown as Book;
    expect(bookText({ ...book, meta: { title: 'Книжка', author: 'Авторка', year: '2026' } })).toBe(
      'Книжка\nАвторка\n2026\n\n# День перший\n\nПерший абзац.\n\nВечір\n\nДругий.\n\n[Ілюстрація] Причал. Ранок.\n\n# Що спитати\n\n1. Чому?\n',
    );
  });
});
