import { CAPTION_MIN_WIDTH_RATIO, PLATE_MIN_DPI, PLATE_OPTICAL_RAISE, SCHEMES } from '../config';
import type { Asset, Line, Lines, Measure, Mm, Page, PlateBlock, Settings } from '../model/types';
import { geometry, rowsFor } from './geometry';
import { breakLines } from './lines';

const MM_PER_PT = 25.4 / 72;
const MM_PER_INCH = 25.4;

// Ілюстрація на цілу сторінку. Рушій знає лише розмір у пікселях — самого зображення він не бачить.
// Зображення ще не вибране (asset не задано) — сторінка з самим підписом, щоб верстка не зупинялася.
export function platePage(block: PlateBlock, asset: Asset | undefined, settings: Settings, measure: Measure): Omit<Page, 'number'> {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const W = g.textBlock.width;
  const L = g.leading * MM_PER_PT;
  const H = g.textBlock.lines * L;
  const aspect = asset ? asset.heightPx / asset.widthPx : 0;
  // Не збільшувати понад PLATE_MIN_DPI: пікселі не домальовуються.
  const maxWidth = asset ? (asset.widthPx / PLATE_MIN_DPI) * MM_PER_INCH : W;

  // Підпис тримає ширину зображення, але не вужчий за частку смуги.
  const captionAt = (width: number) => {
    const opts = { width: Math.max(width, W * CAPTION_MIN_WIDTH_RATIO) as Mm, indent: 0 as Mm, align: 'left' as const };
    return [
      ...breakLines([{ text: block.title, b: true }], { ...opts, size: scheme.captionTitle, role: 'captionTitle' }, measure).map((l) => ({ ...l, field: 'title' as const })),
      ...breakLines([{ text: block.caption, i: true }], { ...opts, size: scheme.caption, role: 'caption' }, measure).map((l) => ({ ...l, field: 'caption' as const })),
    ];
  };
  const rowsOf = (lines: Omit<Line, 'row'>[]) =>
    lines.reduce((n, l) => n + rowsFor(l.role === 'captionTitle' ? scheme.captionTitle : scheme.caption, g.leading), 0);

  // Ширина підпису залежить від ширини зображення, а висота зображення — від висоти підпису.
  // Кілька кроків, поки ширина не перестане змінюватися. Не влазить — зменшується зображення, не текст.
  let width = Math.min(W, maxWidth);
  let caption = captionAt(width);
  for (let i = 0; i < 5; i++) {
    const rows = rowsOf(caption);
    // Рядок проміжку, рядки підпису і ще один — запас на прив'язку до сітки.
    const reserve = rows ? (rows + 2) * L : 0;
    const next = aspect ? Math.min(W, maxWidth, (H - reserve) / aspect) : W;
    const done = Math.abs(next - width) < 1e-9;
    width = next;
    caption = captionAt(width);
    if (done) break;
  }

  const height = width * aspect;
  const captionRows = rowsOf(caption);
  const composition = height + (captionRows ? (captionRows + 1) * L : 0);
  const x = (W - width) / 2;
  const y = Math.max(0, (H - composition) / 2 - PLATE_OPTICAL_RAISE * H);

  // Підпис — на сітці: перший вільний рядок під зображенням, плюс рядок проміжку.
  let row = Math.ceil((y + height) / L - 1e-9) + 1;
  const lines: Line[] = caption.map((line) => {
    row += rowsFor(line.role === 'captionTitle' ? scheme.captionTitle : scheme.caption, g.leading);
    return { ...line, row: (row - 1) as Lines, indent: x as Mm };
  });

  return {
    kind: 'plate',
    folio: false,
    lines,
    ...(asset && { figure: { asset: block.asset, x: x as Mm, y: y as Mm, width: width as Mm, height: height as Mm } }),
  };
}
