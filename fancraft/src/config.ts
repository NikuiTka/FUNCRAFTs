// Налаштування програми. Не зберігаються в .book і не залежать від книжки.
import type { Lines, Mm, Pt, Settings, SheetFormat, SheetsPerSignature, SizeScheme } from './model/types';

// ── зображення ──────────────────────────────────────────────────────────

// Зображення, ширші за це значення, зменшуються при імпорті. Це єдина обробка зображень.
export const IMAGE_MAX_WIDTH_PX = 2000;

// Картинки з документа, вужчі за це (значки, лінії, картинки-емодзі), при імпорті пропускаються.
export const IMPORT_IMAGE_MIN_PX = 300;

// Якість JPEG після зменшення (0–1).
export const IMAGE_JPEG_QUALITY = 0.9;

// Ілюстрація не збільшується так, щоб роздільність упала нижче цього значення (150 dpi = 200 %).
export const PLATE_MIN_DPI = 150;

// Композицію «зображення + підпис» піднято над геометричним центром смуги на цю частку її висоти.
export const PLATE_OPTICAL_RAISE = 0.025;

// Підпис не вужчий за цю частку ширини смуги, навіть під малим зображенням.
export const CAPTION_MIN_WIDTH_RATIO = 0.5;

// Фото на сторінці частини книги — угорі смуги, не вище за цю частку її висоти.
export const PART_PHOTO_MAX_HEIGHT = 0.5;

// QR на сторінці питань: сторона квадрата; стоїть унизу смуги, по лівому краю.
export const QUESTIONS_QR_SIZE = 30 as Mm;

// QR книжки на обкладинці: сторона квадрата; стоїть по центру під копірайтом, унизу смуги.
export const COVER_QR_SIZE = 11.2 as Mm;

// Місце фото на обкладинці — квадрат, сторона — така частка ширини смуги набору; стоїть по центру між
// підзаголовком і QR (з рівними відступами); якщо місця менше — квадрат менший.
export const COVER_PHOTO_RATIO = 0.55;

// Автор на обкладинці — угорі смуги: скільки порожніх рядків над ним (відрив від верху смуги).
export const COVER_AUTHOR_GAP = 1 as Lines;
// Пропуск над назвою на обкладинці з фото — під автором чи від верху смуги.
export const COVER_TITLE_BEFORE = 3 as Lines;

// Копірайт: відступ між полями внизу (назва, автор, © рік) — частка рядка, щоб поля не зливались.
export const COLOPHON_FIELD_GAP = 0.5 as Lines;

// ── формати ─────────────────────────────────────────────────────────────

// Аркуш альбомно; сторінка книжки — його половина.
export const SHEETS: Record<SheetFormat, { width: Mm; height: Mm }> = {
  A3: { width: 420 as Mm, height: 297 as Mm },
  A4: { width: 297 as Mm, height: 210 as Mm },
  A5: { width: 210 as Mm, height: 148 as Mm },
};

// Поля з усіх боків — частка ширини сторінки (вужчі — більше тексту на сторінці, менше зошитів).
export const MARGIN_RATIO = 0.09;

// ── типографіка ─────────────────────────────────────────────────────────

// Інтерліньяж — частка кегля основного тексту; задає крок сітки рядків.
export const LEADING_RATIO = 1.32;

// Абзацний відступ — у кеглях основного тексту.
export const PARAGRAPH_INDENT_EM = 1;

// Проміжок між абзацами тексту глави — у рядках сітки (нагорі сторінки не ставиться). Пів рядка:
// після проміжку рядки зсуваються з базової сітки на півкроку.
export const PARAGRAPH_SPACE = 0.5 as Lines;

export interface Spaced {
  size: Pt;
  spaceBefore: Lines;
  spaceAfter: Lines;
}

export interface Scheme {
  body: Pt;
  // Назва частини книги — більша за назву глави.
  partTitle: Pt;
  chapterTitle: Spaced;
  captionTitle: Pt;
  caption: Pt;
  folio: Pt;
  sheetMark: { signature: Pt; sheet: Pt };
}

export const SCHEMES: Record<SizeScheme, Scheme> = {
  large: {
    body: 13 as Pt,
    partTitle: 26 as Pt,
    chapterTitle: { size: 20 as Pt, spaceBefore: 0 as Lines, spaceAfter: 2 as Lines },
    captionTitle: 13 as Pt,
    caption: 11 as Pt,
    folio: 9 as Pt,
    sheetMark: { signature: 9 as Pt, sheet: 7 as Pt },
  },
  medium: {
    body: 11 as Pt,
    partTitle: 22 as Pt,
    chapterTitle: { size: 17 as Pt, spaceBefore: 0 as Lines, spaceAfter: 2 as Lines },
    captionTitle: 11 as Pt,
    caption: 9 as Pt,
    folio: 9 as Pt,
    sheetMark: { signature: 9 as Pt, sheet: 7 as Pt },
  },
  small: {
    body: 9 as Pt,
    partTitle: 18 as Pt,
    chapterTitle: { size: 14 as Pt, spaceBefore: 0 as Lines, spaceAfter: 2 as Lines },
    captionTitle: 9 as Pt,
    caption: 7 as Pt,
    folio: 9 as Pt,
    sheetMark: { signature: 9 as Pt, sheet: 7 as Pt },
  },
};

// Колонцифра й римська позначка — на стільки рядків сітки нижче останнього рядка смуги.
export const FOLIO_ROWS_BELOW = 2;

// Розрядка римської позначки — частка кегля між літерами.
export const SHEET_MARK_TRACKING = 0.05;

// ── зошити ──────────────────────────────────────────────────────────────

// Папір визначає, скільки аркушів складається в один зошит: що щільніший папір, то менше аркушів
// згинаються рівно. Щільність — у г/м². Зошити завжди повні.
export const PAPER: Record<SheetsPerSignature, string> = {
  5: '60–70',
  4: '80',
  3: '90+',
};

// Ручне шиття: з цієї кількості зошитів — попередження, понад другу межу — сильніше.
// Експорт не зупиняється ніколи.
export const SIGNATURES_SOFT_LIMIT = 8;
export const SIGNATURES_HARD_LIMIT = 10;

// ── нова книжка ─────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  sheet: 'A4',
  scheme: 'medium',
  sheetsPerSignature: 5,
};
