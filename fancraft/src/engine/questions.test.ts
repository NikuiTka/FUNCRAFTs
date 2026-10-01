import { describe, expect, it } from 'vitest';
import { questionsPages } from './questions';
import type { QuestionsBlock } from '../model/types';
import { L, QUESTIONS_QR_SIZE, ROWS, TEXT_TOP, measure, settings } from './testGrid';

// QR — унизу смуги: займає цілі рядки плюс рядок проміжку над ним; текст — не нижче за LAST.
const QR_ROWS = Math.ceil(QUESTIONS_QR_SIZE / L - 1e-9) + 1;
const LAST = ROWS - QR_ROWS - 1;
// Питання — по одному рядку з TEXT_TOP (під назвою): стільки влазить над QR.
const FIT = LAST - TEXT_TOP + 1;

const block = (n: number, url = 'https://example.com/book.txt', note = ''): QuestionsBlock => ({
  id: 'q', type: 'questions', title: 'Що спитати', url, note,
  items: Array.from({ length: n }, (_, i) => `Питання ${i + 1}?`),
});
const texts = (lines: { runs: { text: string }[] }[]) => lines.map((l) => l.runs.map((r) => r.text).join(''));

describe('questionsPages', () => {
  it('назва, пронумеровані питання без абзацного відступу, QR на сторінці', () => {
    const pages = questionsPages(block(3), settings, measure);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ kind: 'questions', folio: false, qr: { url: 'https://example.com/book.txt', size: QUESTIONS_QR_SIZE } });
    const body = pages[0].lines.filter((l) => l.role === 'body');
    expect(texts(body)).toEqual(['1. Питання 1?', '2. Питання 2?', '3. Питання 3?']);
    expect(body.every((l) => l.indent === 0)).toBe(true);
  });

  it('порожні питання пропускаються, нумерація без дірок; примітка — після питань', () => {
    const b = { ...block(0, '', 'Текст книжки — за посиланням.'), items: ['Перше?', '', '  ', 'Друге?'] };
    const [page] = questionsPages(b, settings, measure);
    expect(texts(page.lines.filter((l) => l.role === 'body'))).toEqual(['1. Перше?', '2. Друге?', 'Текст книжки — за посиланням.']);
  });

  it('питань рівно до рядка над QR — QR ще влазить на ту саму сторінку', () => {
    const pages = questionsPages(block(FIT), settings, measure);
    expect(pages).toHaveLength(1);
    expect(Math.max(...pages[0].lines.map((l) => l.row))).toBe(LAST);
  });

  it('завжди одна сторінка: що не влізло над QR — не друкується, limit.cut', () => {
    const pages = questionsPages(block(FIT + 1), settings, measure);
    expect(pages).toHaveLength(1);
    expect(pages[0].qr?.url).toBe('https://example.com/book.txt');
    expect(pages[0].lines.filter((l) => l.role === 'body')).toHaveLength(FIT);
    expect(pages[0].limit?.cut).toBe(true);
    expect(questionsPages(block(FIT), settings, measure)[0].limit?.cut).toBe(false);
  });

  it('місце QR резервується й без посилання: влазить стільки ж', () => {
    const [page] = questionsPages(block(FIT + 3, ''), settings, measure);
    expect(page.qr).toBeUndefined();
    expect(page.lines.filter((l) => l.role === 'body')).toHaveLength(FIT);
  });

  it('limit: знаки в пунктах і примітці проти місткості сторінки', () => {
    const [page] = questionsPages({ ...block(0), items: ['Раз?', 'Два?'], note: 'Ось.' }, settings, measure);
    expect(page.limit).toMatchObject({ used: 12, cut: false });
    expect(page.limit!.max).toBeGreaterThan(FIT * 10);
  });

  it('показ на екрані: порожній пункт лишається пронумерованим рядком', () => {
    const [page] = questionsPages({ ...block(0), items: ['Раз?', ''] }, settings, measure, { keepEmpty: true });
    expect(texts(page.lines.filter((l) => l.role === 'body'))).toEqual(['1. Раз?', '2.']);
  });

  it('без посилання — без QR', () => {
    expect(questionsPages(block(3, ''), settings, measure)[0].qr).toBeUndefined();
  });
});
