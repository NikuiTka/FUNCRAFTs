import { PARAGRAPH_INDENT_EM, PARAGRAPH_SPACE, PART_PHOTO_MAX_HEIGHT, SCHEMES } from '../config';
import type { Asset, ChapterBlock, Figure, Line, Lines, Measure, Mm, Page, PageKind, Settings } from '../model/types';
import { geometry, rowsFor } from './geometry';
import { breakLines } from './lines';
import { fitPhoto } from './part';

const MM_PER_PT = 25.4 / 72;

type Draft = Omit<Line, 'row'>;

export interface ChapterOptions {
  kind?: PageKind;
  // Абзацний відступ; для переліків (питання) — без нього.
  indent?: boolean;
  // Проміжок PARAGRAPH_SPACE між абзацами; для переліків (питання) — без нього.
  spaced?: boolean;
  // Розміри зображення під назвою (block.asset); немає — глава без зображення.
  asset?: Asset;
}

// Сторінки однієї глави. Номери сторінок і парність — справа проходу по книжці.
export function chapterPages(
  block: ChapterBlock, settings: Settings, measure: Measure,
  { kind = 'chapter', indent: indented = true, spaced = true, asset }: ChapterOptions = {},
): Omit<Page, 'number'>[] {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const height = g.textBlock.lines;
  // Глава завжди починається з назви: місце під назву є й тоді, коли вона ще порожня (на екрані — поле з
  // підказкою, у PDF — порожнє місце), і глава без назви та тексту не зникає з книжки — лише хрестиком.
  const titled = block.title.trim() !== '' || kind === 'chapter';

  const titleRows = rowsFor(scheme.chapterTitle.size, g.leading);

  const indent = (scheme.body * PARAGRAPH_INDENT_EM * MM_PER_PT) as Mm;
  // Абзаци глави. Кожен рядок знає свій абзац (para — індекс у block.body): за ним редактор ставить межі
  // сторінок. Перший абзац — без відступу.
  const items: Draft[][] = [];
  block.body.forEach((para, index) => {
    const lines = breakLines(para.runs, { width: g.textBlock.width, indent: items.length === 0 || !indented ? 0 as Mm : indent, size: scheme.body, align: 'justify', role: 'body' }, measure)
      .map((line) => ({ ...line, para: index }));
    if (lines.length) items.push(lines);
  });

  const pages: Omit<Page, 'number'>[] = [];
  let lines: Line[] = [];
  let row = 0;

  // Зображення під назвою — лише на першій сторінці глави.
  let figure: Figure | undefined;
  const newPage = () => {
    pages.push({ kind, folio: !(titled && pages.length === 0), lines, ...(figure && !pages.length ? { figure } : {}) });
    lines = [];
    row = 0;
  };
  const place = (line: Draft, rows: number) => {
    row += rows;
    lines.push({ ...line, row: (row - 1) as Lines });
  };
  // Пропуск нагорі сторінки не ставиться.
  const skip = (n: number) => { if (row > 0) row += n; };

  if (titled) {
    // Назва глави — на свіжій сторінці, пропуск перед нею навмисний.
    const broken = breakLines([{ text: block.title }], { width: g.textBlock.width, indent: 0 as Mm, size: scheme.chapterTitle.size, align: 'center', role: 'chapterTitle' }, measure);
    const title = broken.length ? broken : [{ runs: [{ text: '' }], indent: 0 as Mm, align: 'center' as const, role: 'chapterTitle' as const }];
    row = scheme.chapterTitle.spaceBefore;
    for (const line of title) place({ ...line, align: 'center', field: 'title' }, titleRows);
    row += scheme.chapterTitle.spaceAfter;
  }

  // Зображення під назвою: по центру, у ширину смуги, не вище за частку смуги; текст — через рядок під ним.
  if (asset && block.asset) {
    const L = g.leading * MM_PER_PT;
    figure = fitPhoto(asset, block.asset, g.textBlock.width, row * L, height * L * PART_PHOTO_MAX_HEIGHT);
    row += Math.ceil(figure.height / L - 1e-9) + 1;
  }

  items.forEach((item, i) => {
    // Між абзацами — проміжок.
    if (spaced && i > 0) skip(PARAGRAPH_SPACE);
    // Абзац: на сторінці не лишається один рядок ні знизу, ні зверху.
    let rest = item;
    while (rest.length) {
      // Проміжок між абзацами може бути в пів рядка — на сторінку влазить лише ціла кількість рядків.
      let k = Math.min(Math.max(Math.floor(height - row + 1e-9), 0), rest.length);
      if (k < rest.length) {
        if (rest.length - k < 2) k = rest.length - 2;
        if (k < 2) k = 0;
        if (k === 0 && row === 0) k = Math.min(height, rest.length); // сторінка порожня — правила не виконати
      }
      for (const line of rest.slice(0, k)) place(line, 1);
      rest = rest.slice(k);
      if (rest.length) newPage();
    }
  });

  if (lines.length || !pages.length) newPage();
  return pages;
}
