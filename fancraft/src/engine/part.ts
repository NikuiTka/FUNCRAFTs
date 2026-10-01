import { COVER_PHOTO_RATIO, PLATE_MIN_DPI, SCHEMES } from '../config';
import type { Asset, Figure, Line, Lines, Measure, Mm, Page, PartBlock, Settings } from '../model/types';
import { geometry, rowsFor } from './geometry';
import { breakLines } from './lines';

const MM_PER_PT = 25.4 / 72;
const MM_PER_INCH = 25.4;

// Фото по центру смуги з відступом y згори: у ширину смуги, але не дрібніше за PLATE_MIN_DPI
// і не вище за maxHeight. Спільне для сторінки частини й обкладинки (титулу).
export function fitPhoto(asset: Asset, path: string, blockWidth: number, y: number, maxHeight: number): Figure {
  const aspect = asset.heightPx / asset.widthPx;
  let width = Math.min(blockWidth, (asset.widthPx / PLATE_MIN_DPI) * MM_PER_INCH);
  let height = width * aspect;
  if (height > maxHeight) { height = Math.max(0, maxHeight); width = height / aspect; }
  return { asset: path, x: ((blockWidth - width) / 2) as Mm, y: y as Mm, width: width as Mm, height: height as Mm };
}

// Сторінка частини книги — одна, права; оформлена як обкладинка, лише без автора й QR: назва на третині
// смуги (з фото не рухається), підзаголовок (опис) жирним через рядок під нею, під ними квадрат фото
// (COVER_PHOTO_RATIO ширини смуги) — посередині між підзаголовком і низом смуги, з рівними відступами.
// Рядок підзаголовка резервується й без нього. Фото вписується в квадрат зі своїми пропорціями, по центру;
// не дрібніше за PLATE_MIN_DPI.
export function partPage(block: PartBlock, asset: Asset | undefined, settings: Settings, measure: Measure): Omit<Page, 'number'> {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const W = g.textBlock.width;
  const L = g.leading * MM_PER_PT;
  const H = g.textBlock.lines * L;
  const titleRows = rowsFor(scheme.partTitle, g.leading);

  const opts = { width: W, indent: 0 as Mm, align: 'center' as const };
  const title = (block.title.trim() ? breakLines([{ text: block.title.trim() }], { ...opts, size: scheme.partTitle, role: 'partTitle' }, measure) : [])
    .map((line) => ({ ...line, field: 'title' as const }));
  const description = (block.description.trim()
    ? breakLines([{ text: block.description.trim(), b: true }], { ...opts, size: scheme.body, role: 'body' }, measure)
    : []).map((line) => ({ ...line, field: 'description' as const }));
  // row — скільки рядків сітки вже зайнято; рядок тексту стає на нижній зі своїх рядків.
  let row = Math.max(0, Math.floor(g.textBlock.lines / 3) - titleRows + 1);

  const lines: Line[] = [];
  const place = (line: Omit<Line, 'row'>, rows: number) => {
    row += rows;
    // Довгий опис, що не влазить у смугу, обрізається: сторінка частини — одна.
    if (row <= g.textBlock.lines) lines.push({ ...line, row: (row - 1) as Lines });
  };
  for (const line of title) place(line, titleRows);
  row += 1;
  const subtitleFirst = row;
  for (const line of description) place(line, 1);
  // Низ тексту — з рядком підзаголовка, навіть коли його немає: квадрат фото від нього не стрибає.
  const textBottom = Math.max(row, subtitleFirst + 1) * L;

  const space = H - textBottom;
  const side = Math.max(0, Math.min(COVER_PHOTO_RATIO * W, space - 2 * L));
  const photoZone = { x: ((W - side) / 2) as Mm, y: (textBottom + (space - side) / 2) as Mm, width: side as Mm, height: side as Mm };

  let figure: Figure | undefined;
  if (asset && block.asset && side > 0) {
    const fit = fitPhoto(asset, block.asset, side, 0, side);
    figure = { ...fit, x: (photoZone.x + (side - fit.width) / 2) as Mm, y: (photoZone.y + (side - fit.height) / 2) as Mm };
  }
  return { kind: 'part', folio: false, lines, ...(side > 0 && { photoZone }), ...(figure && { figure }) };
}
