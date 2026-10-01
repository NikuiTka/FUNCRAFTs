import { PAPER } from '../config';
import type { Settings } from '../model/types';
import { roman } from './signatures';
import type { BookStats } from './stats';

type Lang = 'uk' | 'en';

// 1 сторінка, 2 сторінки, 5 сторінок; 1 аркуш, 2 аркуші — у родовому після «на»: 8 аркушах.
const ukPlural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10, dd = n % 100;
  return d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
};

const BOOK = { A3: 'A4', A4: 'A5', A5: 'A6' } as const;

const TEXT = {
  uk: {
    title: 'Складальний аркуш',
    format: (s: Settings) => `Аркуш ${s.sheet}, книжка ${BOOK[s.sheet]}, двобічний друк, 100 %`,
    pages: (p: number, sh: number, mono: number, color: number) =>
      `${p} ${ukPlural(p, 'сторінка', 'сторінки', 'сторінок')} на ${sh} ${sh === 1 ? 'аркуші' : 'аркушах'}` +
      (color ? `: ${mono} Ч/Б + ${color} ${ukPlural(color, 'кольоровий', 'кольорові', 'кольорових')}` : ''),
    signatures: (n: number, sheets: number, paper: string) =>
      `${n} ${ukPlural(n, 'зошит', 'зошити', 'зошитів')} по ${sheets} ${ukPlural(sheets, 'аркушу', 'аркуші', 'аркушів')}, папір ${paper} г/м²`,
    signature: (sig: string, first: string, last: string, from: number, to: number) =>
      `Зошит ${sig} — аркуші ${first} … ${last}, сторінки ${from}–${to}`,
    color: 'Кольорові аркуші: ',
    note: 'Аркуші кожного зошита вкладаються один в одний за римськими позначками внизу правої сторінки.',
  },
  en: {
    title: 'Assembly sheet',
    format: (s: Settings) => `Sheet ${s.sheet}, ${BOOK[s.sheet]} book, duplex, 100 %`,
    pages: (p: number, sh: number, mono: number, color: number) =>
      `${p} pages on ${sh} ${sh === 1 ? 'sheet' : 'sheets'}` + (color ? `: ${mono} B/W + ${color} colour` : ''),
    signatures: (n: number, sheets: number, paper: string) =>
      `${n} ${n === 1 ? 'signature' : 'signatures'} of ${sheets} sheets, paper ${paper} g/m²`,
    signature: (sig: string, first: string, last: string, from: number, to: number) =>
      `Signature ${sig} — sheets ${first} … ${last}, pages ${from}–${to}`,
    color: 'Colour sheets: ',
    note: 'Nest the sheets of each signature by the roman marks at the foot of the right-hand page.',
  },
};

// «зошит · аркуш» для аркуша з наскрізним номером (з 1).
function markOf(sheet: number, plan: number[]): string {
  let start = 0;
  for (let i = 0; i < plan.length; i++) {
    if (sheet <= start + plan[i]) return `${roman(i + 1)} · ${roman(sheet - start)}`;
    start += plan[i];
  }
  return '?';
}

// Складальний аркуш — поза книжкою, друкується першим: формат, аркуші, розклад зошитів.
// colorSheets — наскрізні номери кольорових аркушів (з 1).
export function assemblyLines(stats: BookStats, settings: Settings, colorSheets: number[], lang: Lang): string[] {
  const t = TEXT[lang];
  const { plan } = stats;
  const lines = [
    t.title, '',
    t.format(settings),
    t.pages(stats.pages, stats.sheets, stats.sheets - stats.colorSheets, stats.colorSheets),
    t.signatures(plan.length, settings.sheetsPerSignature, PAPER[settings.sheetsPerSignature]),
    '',
  ];
  let page = 1;
  plan.forEach((sheets, i) => {
    const sig = roman(i + 1);
    const to = page + sheets * 4 - 1;
    lines.push(t.signature(sig, `${sig} · I`, `${sig} · ${roman(sheets)}`, page, to));
    page = to + 1;
  });
  if (colorSheets.length) lines.push('', t.color + colorSheets.map((s) => markOf(s, plan)).join(', '));
  lines.push('', t.note);
  return lines;
}
