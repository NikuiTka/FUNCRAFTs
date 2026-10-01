// Сітка сторінки для тестів рушія: усі розміри — з конфігу й geometry, а не числами в тестах.
// Змінилися поля, пропуски чи проміжок між абзацами — тести рахують нові місця самі.
import { COVER_AUTHOR_GAP, COVER_QR_SIZE, COVER_TITLE_BEFORE, PARAGRAPH_INDENT_EM, PARAGRAPH_SPACE, PLATE_MIN_DPI, PLATE_OPTICAL_RAISE, QUESTIONS_QR_SIZE, SCHEMES } from '../config';
import type { Measure, Para, Pt, Settings } from '../model/types';
import { geometry, rowsFor } from './geometry';

const MM_PER_PT = 25.4 / 72;

// Умовна метрика: літера — 0,5 кегля (жирна — 0,6).
export const measure: Measure = (text, face, size) =>
  (text.length * size * (face === 'bold' || face === 'boldItalic' ? 0.6 : 0.5)) as Pt;

// A4 → A5, середня схема — основний шлях.
export const settings: Settings = { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 };

const g = geometry(settings);
export const scheme = SCHEMES[settings.scheme];
// Рядків сітки на сторінці, ширина смуги (мм), крок рядка (мм), висота сітки (мм).
export const ROWS = g.textBlock.lines;
export const W = g.textBlock.width;
export const L = g.leading * MM_PER_PT;
export const H = ROWS * L;
// Проміжок між абзацами глави, у рядках.
export const SPACE = PARAGRAPH_SPACE;
// Скільки цілих рядків займає проміжок, коли треба «не менше ніж».
export const SPACE_ROWS = Math.ceil(SPACE - 1e-9);

// Назва глави: скільки рядків сітки займає один її рядок; базова лінія однорядкової назви;
// перший рядок тексту під нею.
export const TITLE_ROWS = rowsFor(scheme.chapterTitle.size, g.leading);
export const TITLE_BASE = scheme.chapterTitle.spaceBefore + TITLE_ROWS - 1;
export const TEXT_TOP = TITLE_BASE + 1 + scheme.chapterTitle.spaceAfter;
// Третина смуги — базова лінія назви на обкладинці й частині без фото.
export const THIRD = Math.floor(ROWS / 3);
export const PART_ROWS = rowsFor(scheme.partTitle, g.leading);

// Скільки літер умовної метрики влазить у рядок; абзацний відступ у літерах.
export const CHARS = Math.floor((W / MM_PER_PT) / (scheme.body * 0.5) + 1e-9);
const INDENT_CHARS = Math.ceil(PARAGRAPH_INDENT_EM / 0.5);

// Абзац рівно на n рядків: рівно 5 слів у рядку, і з абзацним відступом теж.
const WORD = Math.floor((CHARS - INDENT_CHARS + 1) / 5) - 1;
let counter = 0;
const word = () => `с${String(counter++).padStart(WORD - 1, '0')}`;
export const para = (n: number): Para => ({ type: 'paragraph', runs: [{ text: Array.from({ length: n * 5 }, word).join(' ') }] });

// Скільки слів «аа» (два знаки й пробіл) лягає в рядок.
export const AA_PER_LINE = Math.floor((CHARS + 1) / 3);

// Зображення 2000 × 1000 px (при 150 dpi ширше за смугу) — у ширину смуги.
export const WIDE = { widthPx: 2000, heightPx: 1000 };
export const WIDE_W = Math.min(W, (2000 / PLATE_MIN_DPI) * 25.4);
export const WIDE_H = WIDE_W / 2;

export { COVER_AUTHOR_GAP, COVER_QR_SIZE, COVER_TITLE_BEFORE, PLATE_MIN_DPI, PLATE_OPTICAL_RAISE, QUESTIONS_QR_SIZE };
