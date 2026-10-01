import { describe, expect, it } from 'vitest';
import { printJobs, type PrintOptions } from './jobs';
import type { Mm, Page } from '../model/types';

// 12 сторінок = 1 зошит на 3 аркуші. Сторони: [12,1] [2,11] [10,3] [4,9] [8,5] [6,7].
const pages = (plates: number[] = []): Page[] =>
  Array.from({ length: 12 }, (_, i): Page => (plates.includes(i + 1)
    ? { kind: 'plate', number: i + 1, folio: false, lines: [], figure: { asset: 'img/img_001.jpg', x: 0 as Mm, y: 0 as Mm, width: 10 as Mm, height: 10 as Mm } }
    : { kind: 'chapter', number: i + 1, folio: true, lines: [] }));
const plan = [3];
const opts = (o: Partial<PrintOptions> = {}): PrintOptions => ({
  mode: 'duplex', reverseBacks: false, rotateBacks: false, splitColor: false, ...o,
});
const sides = (job: { sides: { side: unknown }[] }) => job.sides.map((s) => s.side);

describe('printJobs', () => {
  it('дуплекс — один файл: лице, зворот, лице, зворот…', () => {
    const jobs = printJobs(pages(), plan, opts());
    expect(jobs.map((j) => j.name)).toEqual(['book.pdf']);
    expect(sides(jobs[0])).toEqual([[12, 1], [2, 11], [10, 3], [4, 9], [8, 5], [6, 7]]);
    expect(jobs[0].sides.every((s) => !s.rotate)).toBe(true);
  });

  it('двопрохідний — два файли: лиця й звороти', () => {
    const jobs = printJobs(pages(), plan, opts({ mode: 'twoPass' }));
    expect(jobs.map((j) => j.name)).toEqual(['book-fronts.pdf', 'book-backs.pdf']);
    expect(sides(jobs[0])).toEqual([[12, 1], [10, 3], [8, 5]]);
    expect(sides(jobs[1])).toEqual([[2, 11], [4, 9], [6, 7]]);
  });

  it('тумблери двопрохідного: зворотний порядок і поворот зворотів', () => {
    const [, backs] = printJobs(pages(), plan, opts({ mode: 'twoPass', reverseBacks: true, rotateBacks: true }));
    expect(sides(backs)).toEqual([[6, 7], [4, 9], [2, 11]]);
    expect(backs.sides.every((s) => s.rotate)).toBe(true);
  });

  it('кольорові аркуші окремо: аркуш із полосою цілком іде в кольоровий файл', () => {
    // Полоса на с. 9 — це аркуш 2: [10,3] / [4,9].
    const jobs = printJobs(pages([9]), plan, opts({ splitColor: true }));
    expect(jobs.map((j) => j.name)).toEqual(['book-mono.pdf', 'book-color.pdf']);
    expect(sides(jobs[0])).toEqual([[12, 1], [2, 11], [8, 5], [6, 7]]);
    expect(sides(jobs[1])).toEqual([[10, 3], [4, 9]]);
  });

  it('розділення без кольорових аркушів — лише Ч/Б файл', () => {
    expect(printJobs(pages(), plan, opts({ splitColor: true })).map((j) => j.name)).toEqual(['book-mono.pdf']);
  });

  it('розділення + двопрохідний — чотири файли', () => {
    const names = printJobs(pages([1]), plan, opts({ splitColor: true, mode: 'twoPass' })).map((j) => j.name);
    expect(names).toEqual(['book-mono-fronts.pdf', 'book-mono-backs.pdf', 'book-color-fronts.pdf', 'book-color-backs.pdf']);
  });
});
