import { LEADING_RATIO, MARGIN_RATIO, SCHEMES, SHEETS } from '../config';
import type { Lines, Mm, Pt, Settings } from '../model/types';

const PT_PER_MM = 72 / 25.4;

// Похідна геометрія сторінки. Зберігається лише формат аркуша й схема розмірів;
// усе інше обчислюється тут.
export interface PageGeometry {
  page: { width: Mm; height: Mm };
  margin: Mm;
  textBlock: { width: Mm; height: Mm; lines: Lines };
  leading: Pt;
}

// Скільки рядків сітки займає рядок тексту цього кегля; базова лінія — на нижньому з них.
export const rowsFor = (size: Pt, leading: Pt) => Math.max(1, Math.ceil((size * LEADING_RATIO) / leading - 1e-9));

export function geometry(settings: Settings): PageGeometry {
  const sheet = SHEETS[settings.sheet];
  const page = { width: (sheet.width / 2) as Mm, height: sheet.height };
  const margin = (page.width * MARGIN_RATIO) as Mm;
  const width = (page.width - 2 * margin) as Mm;
  const height = (page.height - 2 * margin) as Mm;
  const leading = (SCHEMES[settings.scheme].body * LEADING_RATIO) as Pt;
  // Скільки рядків сітки влазить у смугу; решта висоти лишається порожньою знизу.
  const lines = Math.floor((height * PT_PER_MM) / leading + 1e-9) as Lines;
  return { page, margin, textBlock: { width, height, lines }, leading };
}
