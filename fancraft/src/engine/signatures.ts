import type { Page } from '../model/types';

// Аркушів у кожному зошиті. Зошити завжди повні: те, що не заповнив текст, — вільні сторінки.
export function signaturePlan(pageCount: number, sheets: number): number[] {
  return Array(Math.ceil(Math.max(0, pageCount) / (sheets * 4))).fill(sheets);
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function roman(n: number): string {
  let out = '';
  for (const [value, digits] of ROMAN) while (n >= value) { out += digits; n -= value; }
  return out;
}

// Римська позначка «зошит · аркуш»: лише на правій половині лиця аркуша —
// непарна сторінка з першої половини зошита. Сторінки нумеруються з 1.
export function sheetMark(page: number, plan: number[]): { signature: number; sheet: number } | null {
  let start = 0;
  for (let i = 0; i < plan.length; i++) {
    const size = plan[i] * 4;
    if (page <= start + size) {
      const local = page - start;
      return local % 2 === 1 && local <= 2 * plan[i] - 1 ? { signature: i + 1, sheet: (local + 1) / 2 } : null;
    }
    start += size;
  }
  return null;
}

// Добиває книжку порожніми сторінками до повних зошитів. Вільні сторінки стають перед колофоном,
// щоб він лишився останньою сторінкою; free — скільки їх: їх можна заповнити блоками.
export function withSignatures(pages: Page[], sheets: number): { pages: Page[]; plan: number[]; free: number } {
  const plan = signaturePlan(pages.length, sheets);
  const free = plan.reduce((s, n) => s + n * 4, 0) - pages.length;
  const blanks: Page[] = Array.from({ length: free }, () => ({ kind: 'blank', number: 0, folio: false, lines: [] }));
  const tail = pages.at(-1)?.kind === 'colophon' ? pages.slice(-1) : [];
  const body = pages.slice(0, pages.length - tail.length);
  return {
    plan,
    free,
    pages: [...body, ...blanks, ...tail].map((p, i) => ({ ...p, number: i + 1 })),
  };
}
