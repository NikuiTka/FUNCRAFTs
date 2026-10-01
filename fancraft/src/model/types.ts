// Одиниці. Брендовані, щоб компілятор не дав сплутати рядки з міліметрами.
export type Mm = number & { readonly __unit: 'mm' };
export type Pt = number & { readonly __unit: 'pt' };
export type Lines = number & { readonly __unit: 'lines' };

// ── налаштування книжки ─────────────────────────────────────────────────

// Формат аркуша друку; сторінка книжки — його половина.
export type SheetFormat = 'A3' | 'A4' | 'A5';

// Схема розмірів; самі кеглі — у config.ts.
export type SizeScheme = 'large' | 'medium' | 'small';

export type SheetsPerSignature = 3 | 4 | 5;

export interface Settings {
  sheet: SheetFormat;
  scheme: SizeScheme;
  sheetsPerSignature: SheetsPerSignature;
}

// ── блоки ───────────────────────────────────────────────────────────────

// Сторінка, з якої починається блок: права, ліва або найближча вільна.
export type Side = 'auto' | 'recto' | 'verso';

// Фрагмент тексту з накресленням. Відсутнє поле — false.
export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  s?: boolean;
}

// Абзац або підзаголовок усередині глави.
export interface Para {
  // Підзаголовків немає: усередині глави лише абзаци (для акцентів — жирний).
  type: 'paragraph';
  runs: Run[];
}

// Порожній title — глава без заголовка: починається з наступної вільної сторінки, у зміст не йде.
export interface ChapterBlock {
  id: string;
  type: 'chapter';
  title: string;
  body: Para[];
  // Зображення під назвою, перед текстом (необов'язкове): шлях в архіві, img/img_001.jpg.
  asset?: string;
}

// asset — шлях в архіві, img/img_001.jpg.
export interface PlateBlock {
  id: string;
  type: 'plate';
  asset: string;
  title: string;
  caption: string;
  side: Side;
}

export interface QuestionsBlock {
  id: string;
  type: 'questions';
  title: string;
  items: string[];
  url: string;
  note: string;
}

// Частина книги: окрема права сторінка з назвою, коротким описом і фото (необов'язковим).
// asset — шлях в архіві, img/img_001.jpg; порожній — без фото.
export interface PartBlock {
  id: string;
  type: 'part';
  title: string;
  description: string;
  asset: string;
}

// Зміст будується з назв частин і глав; блок лише позначає його місце.
export interface TocBlock {
  id: string;
  type: 'toc';
  title: string;
}

// Навмисно порожні сторінки.
export interface TabulaRasaBlock {
  id: string;
  type: 'tabula_rasa';
  title: string;
  count: number;
  side: Side;
  // «Для нотаток»: сторінка розлінована рядками сітки (під місцем назви).
  ruled?: boolean;
}

// id потрібен лише інтерфейсу; модель на нього не посилається.
export type Block = PartBlock | ChapterBlock | PlateBlock | QuestionsBlock | TocBlock | TabulaRasaBlock;

// ── обкладинка ──────────────────────────────────────────────────────────

export interface Qr {
  url: string;
  size: Mm;
}

// Обкладинка (титул, завжди перша сторінка): фото під назвою й описом і QR книжки над копірайтом.
// Лише вміст; позиції — рушій, від меж смуги. photo — шлях в архіві, img/img_001.jpg.
export interface Cover {
  qr: Qr | null;
  photo?: string | null;
}

// Колофон складається сам із назви, автора й року — налаштувань не має.
export interface Template {
  titlePage: Cover;
}

// ── книжка (book.json) ──────────────────────────────────────────────────

export interface Meta {
  title: string;
  author: string;
  year: string;
  // Короткий опис на титулі (обкладинці). Необов'язковий: старі .book його не мають.
  description?: string;
  // Довільний текст угорі сторінки копірайту (анотація, подяки, вихідні дані). Необов'язковий.
  colophon?: string;
}

// Розмір зображення в пікселях — щоб розмістити його без декодування файлу.
export interface Asset {
  widthPx: number;
  heightPx: number;
}

export interface Book {
  version: 1;
  meta: Meta;
  settings: Settings;
  blocks: Block[];
  template: Template;
  // Ключ — шлях в архіві: img/img_001.jpg.
  assets: Record<string, Asset>;
  // Копірайт (колофон: назва, автор, © рік) — необов'язковий, додає автор: одразу після титульної (с. 2,
  // зворот титулу) чи на останній сторінці книжки. Немає поля (старі .book) — в кінці, як було.
  copyright?: CopyrightPlace;
}

export type CopyrightPlace = 'none' | 'front' | 'back';

// Відкритий проєкт: book.json плюс байти файлів з img/ і vec/ за шляхами в архіві.
export interface Project {
  book: Book;
  files: Record<string, Uint8Array>;
}

// ── результат верстки (обчислюється, не зберігається) ───────────────────

export type Face = 'regular' | 'bold' | 'italic' | 'boldItalic';

// Ширина тексту заданим накресленням і кеглем.
export type Measure = (text: string, face: Face, size: Pt) => Pt;

// right — номери сторінок у змісті.
export type Align = 'justify' | 'left' | 'center' | 'right';

// Роль рядка визначає кегль через схему розмірів.
export type TextRole = 'body' | 'partTitle' | 'chapterTitle' | 'captionTitle' | 'caption';
// Ролі, що завжди жирні: назви глав (і змісту, питань, нотаток, обкладинки), частин, заголовок підпису.
export const BOLD_ROLES: ReadonlySet<TextRole> = new Set(['chapterTitle', 'partTitle', 'captionTitle']);

// blank — порожня сторінка, вставлена пагінацією; tabula_rasa — поставлена користувачем.
export type PageKind =
  | 'part' | 'chapter' | 'plate' | 'questions' | 'toc'
  | 'tabula_rasa' | 'blank' | 'title' | 'colophon';

// row — номер рядка сітки від верху смуги.
export interface Line {
  row: Lines;
  runs: Run[];
  indent: Mm;
  align: Align;
  role: TextRole;
  // Рядок тексту глави: індекс абзацу в block.body. Назви, колонтитули й службові рядки — без нього.
  para?: number;
  // Рядок сторінки-макета (титул, колофон, частина, ілюстрація): з якого поля текст —
  // title, author, year, description, caption. За ним інтерфейс редагує текст просто на сторінці.
  field?: TextField;
  // Лише для показу в інтерфейсі: поле порожнє, рядок — місце, де стоятиме текст. У PDF таких немає.
  placeholder?: boolean;
}

export type TextField = 'title' | 'author' | 'year' | 'description' | 'caption' | 'items' | 'note';

// Розміщення ілюстрації відносно лівого верхнього кута смуги.
export interface Figure {
  asset: string;
  x: Mm;
  y: Mm;
  width: Mm;
  height: Mm;
}

// QR на сторінці: лівий верхній кут відносно лівого верхнього кута смуги.
export interface PlacedQr extends Qr {
  x: Mm;
  y: Mm;
  // Лише для показу в інтерфейсі: посилання ще немає, рамка — місце, де стоятиме QR. У PDF такого немає.
  placeholder?: boolean;
}

export interface Page {
  kind: PageKind;
  // Номер рахується завжди, навіть коли колонцифра не друкується.
  number: number;
  folio: boolean;
  lines: Line[];
  figure?: Figure;
  // Місце зображення, яке рушій відвів на сторінці (обкладинка) — є й без зображення: там інтерфейс
  // показує заглушку, а зображення вписується в нього.
  photoZone?: Omit<Figure, 'asset'>;
  // Розлінована сторінка («Для нотаток»): лінії по базових лініях рядків сітки, починаючи з цього рядка.
  ruled?: number;
  // Питання: скільки знаків у переліку й примітці, скільки влазить на сторінку і чи щось не влізло.
  limit?: { used: number; max: number; cut: boolean };
  qr?: PlacedQr;
  // id блоку, з якого сторінка, — лише для інтерфейсу (діапазон сторінок у структурі).
  // Порожні, вставлені пагінацією, титул і колофон — без нього.
  source?: string;
}
