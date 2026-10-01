import { paginate } from '../engine/book';
import { chapterLayouts, pagePreviews, sheetSequence } from '../engine/pageMap';
import { withSignatures } from '../engine/signatures';
import { blockRanges, bookStats, bookText } from '../engine/stats';
import { bookWarnings } from '../engine/warnings';
import type { Warning } from '../model/errors';
import type { Measure, Project } from '../model/types';
import { createMeasure, createShaper, type FontFaces, type Shaper } from './fonts';

// Вимір — один на набір шрифтів: розбір шрифтів fontkit і кеш ширин живуть між перерахунками.
const measures = new WeakMap<FontFaces, Measure>();
const measureFor = (fonts: FontFaces) => {
  if (!measures.has(fonts)) measures.set(fonts, createMeasure(fonts));
  return measures.get(fonts)!;
};

const shapers = new WeakMap<FontFaces, Shaper>();
const shaperFor = (fonts: FontFaces) => {
  if (!shapers.has(fonts)) shapers.set(fonts, createShaper(fonts));
  return shapers.get(fonts)!;
};

// Невидимі знаки, що живуть при емодзі (селектори варіанта, ZWJ, тони шкіри, keycap, теги прапорів), і керівні.
const invisible = (cp: number) => cp < 0x20 || cp === 0xfe0e || cp === 0xfe0f || cp === 0x200d || cp === 0x20e3
  || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0020 && cp <= 0xe007f);

// Знаки книжки, яких немає ні в гарнітурі, ні в шрифті емодзі: у PDF вони — порожні квадратики, а
// редактор (браузер) малює їх чужим шрифтом іншої ширини. Кожен — один раз.
export function missingGlyphs(text: string, covers: (cp: number) => boolean): string[] {
  const out = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!/\s/.test(ch) && !invisible(cp) && !covers(cp)) out.add(ch);
  }
  return [...out];
}

const glyphWarnings = (warnings: Warning[], missing: string[]): Warning[] =>
  (missing.length ? [...warnings, { code: 'missingGlyphs', chars: missing.join('') }] : warnings);

// Сторінки книжки, статистика й попередження — без рендеру PDF. Годиться для рядка статистики в інтерфейсі.
export function layoutBook(project: Project, fonts: FontFaces) {
  const { book } = project;
  const measure = measureFor(fonts);
  const { pages, plan, free } = withSignatures(paginate(book, measure), book.settings.sheetsPerSignature);
  return {
    pages, plan,
    stats: bookStats(pages, plan, free),
    ranges: blockRanges(pages),
    layouts: chapterLayouts(pages, book),
    previews: pagePreviews(pages, book, measure),
    sequence: sheetSequence(pages),
    warnings: glyphWarnings(bookWarnings(book, plan), missingGlyphs(bookText(book), shaperFor(fonts).covers)),
  };
}
