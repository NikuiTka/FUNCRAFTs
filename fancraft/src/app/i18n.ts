import { createContext, useContext } from 'react';
import type { EmojiGroup } from '../emojiConfig';
import { AppError, type Problem, type Warning } from '../model/errors';
import type { Block, SheetFormat, SheetsPerSignature, Side, SizeScheme } from '../model/types';

export type UiLang = 'uk' | 'en';

// 1 сторінка, 2 сторінки, 5 сторінок, 21 сторінка.
const ukPlural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10, dd = n % 100;
  return `${n} ${d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many}`;
};
const enPlural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const uk = {
  open: 'Відкрити',
  save: 'Зберегти',
  importTxt: 'Імпорт тексту',
  export: 'Експорт',
  unsaved: 'Незбережені зміни буде втрачено. Продовжити?',
  clearAll: 'Очистити все',
  confirmClear: 'Очистити все? Текст, ілюстрації, титул і колофон буде видалено. Налаштування книжки (формат, розмір шрифту, папір) залишаться. Файл на диску не зміниться.',
  loading: 'Завантаження…',
  restored: 'Відновлено автозбереження — збережіть у файл, щоб не залежати від браузера.',

  book: 'Титульна',
  metaTitle: 'Назва',
  metaAuthor: 'Автор',
  metaYear: 'Рік',
  titlePage: 'Титул',
  qrUrl: 'посилання для QR',
  blockType: { part: 'Частина', chapter: 'Глава', plate: 'Ілюстрація', questions: 'Питання', toc: 'Зміст', tabula_rasa: 'Вільна' } as Record<Block['type'], string>,
  add: 'Додати',
  addAfterSelected: 'Додати після вибраного',
  removeWhat: {
    part: 'Видалити частину', chapter: 'Видалити главу', plate: 'Видалити ілюстрацію', questions: 'Видалити питання',
    toc: 'Видалити зміст', tabula_rasa: 'Видалити вільну сторінку', notes: 'Видалити нотатки', copyright: 'Видалити копірайт',
  },
  untitled: '(без назви)',
  pageShort: 'с.',
  moveUp: 'Вище',
  moveDown: 'Нижче',
  remove: 'Видалити',
  confirmRemove: 'Видалити цей блок?',
  pagesCount: (n: number) => ukPlural(n, 'сторінка', 'сторінки', 'сторінок'),
  defaults: { questions: 'Що спитати в цієї книжки', toc: 'Зміст' },

  chapterTitle: 'Назва глави',
  chapterText: 'Текст глави',
  addPlate: 'Додати ілюстрацію до глави — окремою сторінкою на розвороті з назвою',
  split: 'Розділити тут',
  splitMarkers: 'Розбити за ###',
  splitMarkersHint: 'Поставте ### окремим абзацом там, де має початися нова глава',
  splitBy: 'Розбивка',
  splitModes: { headings: 'заголовки документа', keywords: 'ключові слова (Глава N, Частина N…)' },
  splitFound: (chapters: number, parts: number) => `${ukPlural(chapters, 'глава', 'глави', 'глав')}${parts ? `, ${ukPlural(parts, 'частина', 'частини', 'частин')}` : ''}`,
  splitParts: 'частини',
  splitImages: (n: number) => `ілюстрації окремими сторінками (${n})`,
  copy: 'Копіювати',
  cut: 'Вирізати',
  paste: 'Вставити',
  pasteDenied: 'Браузер не дав доступу до буфера — натисніть Ctrl+V.',
  driftGuard: {
    button: 'Сторож: перевірка збігу екрана з PDF',
    title: 'Розбіжності екрана з друком',
    empty: 'Розбіжностей не знайдено: кожна сторінка на екрані стоїть у своїй рамці, і кожна глава займає стільки ж сторінок, скільки в PDF.',
    hint: 'Номери сторінок і PDF рахує рушій — вони правильні; тут те, що не збіглося на екрані. Скопіюйте текст нижче й надішліть розробнику.',
    row: (first: number, got: number, want: number) => `с. ${first}: у редакторі ${got} с., у PDF ${want} с.`,
    copy: 'Скопіювати для розробника',
    copied: 'Скопійовано',
    shifted: (page: number, at: number | null, n: number) => `Зсув полотна: с. ${page} стоїть ${at ? `у рамці с. ${at}` : 'поза рамками'} (усього зсунутих місць: ${n}).`,
  },
  bold: 'Жирний',
  italic: 'Курсив',
  strike: 'Перекреслений',
  upper: 'Верхній регістр',
  lower: 'Нижній регістр',
  emoji: 'Емодзі — друкуються чорно-білими, як тут',
  selectAll: 'Виділити весь текст глави',
  colophonNote: 'Текст угорі сторінки (анотація, подяки…)',
  emojiGroups: { symbols: 'Знаки', faces: 'Обличчя', hands: 'Руки', nature: 'Природа', things: 'Речі' } as Record<EmojiGroup, string>,

  image: 'Зображення',
  chooseImage: 'Вибрати зображення',
  replaceImage: 'Замінити зображення',
  removeImage: 'Прибрати',
  imageHere: 'тут буде зображення',
  lowResShort: 'мало пікселів',
  notesTitleLabel: 'Назва (необовʼязково)',
  chapterImage: 'Зображення під назвою',
  replaceChapterImage: 'Замінити зображення під назвою',
  photoHere: 'тут може бути фото',
  partTitle: 'Назва частини',
  partDescription: 'Підзаголовок',
  partPhoto: 'Фото (необовʼязково)',
  coverPhoto: 'Фото обкладинки (необовʼязково)',
  captionTitle: 'Заголовок підпису',
  caption: 'Опис',
  side: 'Сторінка',
  sides: { auto: 'найближча', recto: 'праворуч від назви', verso: 'ліворуч від назви' } as Record<Side, string>,
  sideHint: 'Ілюстрація — на розвороті з першою сторінкою глави над нею: ліворуч чи праворуч від сторінки з назвою',
  sideUnbound: 'Над ілюстрацією не глава — вона стоїть на найближчій сторінці',
  lowRes: (mm: string, full: string) => `Мало пікселів: надрукується ${mm} мм завширшки замість ${full} мм — по центру сторінки.`,

  items: 'Питання — по одному в рядку',
  url: 'Посилання для QR (текст книжки для ШІ)',
  note: 'Примітка',
  tocHint: 'Зміст складається сам із назв частин і глав та їхніх номерів сторінок. Частини — жирним.',
  count: 'Кількість сторінок',

  sheet: 'Формат',
  sheets: { A3: 'A3 → книжка A4', A4: 'A4 → книжка A5', A5: 'A5 → книжка A6' } as Record<SheetFormat, string>,
  scheme: 'Розмір шрифту',
  schemes: { large: 'великий', medium: 'середній', small: 'малий' } as Record<SizeScheme, string>,
  paper: 'Папір',
  paperOption: (grams: string, sheets: SheetsPerSignature) => `${grams} г/м² — ${ukPlural(sheets, 'аркуш', 'аркуші', 'аркушів')} у зошиті`,
  mode: 'Друк',
  modes: { duplex: 'Дуплекс — один файл', twoPass: 'Двопрохідний — лиця й звороти окремо', draft: 'Чернетка — для вичитки, без спуску' },
  reverseBacks: 'Звороти у зворотному порядку',
  rotateBacks: 'Звороти повернуті на 180°',
  splitColor: 'Кольорові аркуші окремим файлом',
  assembly: 'Складальний аркуш (друкується першим)',
  doExport: 'Експортувати',
  exporting: 'Готую файли…',
  printReminder: 'Друкуйте у фактичному розмірі (100 %), не «вписати на сторінку».',
  close: 'Закрити',
  files: 'Файли',
  openFile: 'відкрити',
  download: 'завантажити',

  stats: {
    pages: (n: number) => ukPlural(n, 'сторінка', 'сторінки', 'сторінок'),
    sheets: (n: number, mono: number, color: number) => `${ukPlural(n, 'аркуш', 'аркуші', 'аркушів')}${color ? ` (${mono} Ч/Б + ${color} кольор.)` : ''}`,
    signatures: (n: number, sheets: number) => `${ukPlural(n, 'зошит', 'зошити', 'зошитів')} по ${sheets}`,
    free: (n: number) => `вільних ${n}`,
    blanks: (n: number, intentional: number) => `${ukPlural(n, 'порожня', 'порожні', 'порожніх')}${intentional ? ` (${intentional} навмисн${intentional === 1 ? 'а' : 'і'})` : ''}`,
    counting: 'рахую…',
  },

  free: 'Вільні сторінки',
  colophon: 'Копірайт',
  freeAddHint: 'Вільні сторінки — додайте сюди блок:',
  slotAddHint: 'Ліва сторінка вільна — можна зайняти її однією сторінкою:',
  addItem: '+ Пункт',
  questionsLimit: (used: number, max: number) => `${used} / ${max} знаків`,
  questionsLimitHint: 'Питання — завжди одна сторінка: стільки знаків влазить у перелік і примітку над QR',
  questionsCut: 'Не все влазить — зайве не надрукується',
  colophonHint: 'Останній аркуш книжки (колофон): назва, автор, © рік — з титульної сторінки',
  autoBlank: 'Вільна',
  autoBlankNote: 'від верстки',
  autoBlankHint: 'Порожню сторінку вставила верстка: щоб частина почалася з правої сторінки',
  freeHint: 'Зошити завжди повні. Вільні сторінки стоять перед колофоном — заповніть їх блоками або залиште порожніми.',
  fillQuestions: '+ Питання',
  fillBlank: '+ Для нотаток',
  addReasons: {
    exists: 'Уже є в книжці',
    rectoOnly: 'Лише на правій сторінці — тут ліва',
    onePage: 'Тут місце на одну ліву сторінку: більший блок зсуне наступну частину чи зміст',
    page2: 'Копірайт — лише на с. 2 (зворот титулу) або в кінці книжки',
    noFree: 'Немає вільних сторінок',
  },
  notesTitle: 'Для нотаток',
  notesType: 'Нотатки',

  problem: (p: Problem): string => {
    switch (p.code) {
      case 'notBook': return 'Це не файл книжки .book.';
      case 'noBookJson': return 'У файлі .book немає опису книжки (book.json).';
      case 'badBookJson': return 'Опис книжки у файлі .book пошкоджений.';
      case 'newerVersion': return `Файл створено новішою версією FANCRAFTs (формат v${p.version}). Оновіть програму.`;
      case 'missingInArchive': return `У файлі .book бракує ${p.path}.`;
      case 'notDocx': return 'Це не документ Word (.docx).';
      case 'imageResize': return 'Не вдалося зменшити зображення.';
      case 'fontMissing': return `Не знайдено файл шрифту ${p.path}.`;
    }
  },
  warning: (w: Warning): string => {
    switch (w.code) {
      case 'manySignatures': return `${ukPlural(w.count, 'зошит', 'зошити', 'зошитів')} — близько до межі ручного шиття (${w.limit}).`;
      case 'tooManySignatures': return `${ukPlural(w.count, 'зошит', 'зошити', 'зошитів')} — більше ${w.limit}, рівно прошити вручну важко. Можна менший розмір шрифту, тонший папір або менший формат.`;
      case 'plateWithoutImage': return `Ілюстрація${w.title ? ` «${w.title}»` : ''} без зображення — надрукується лише підпис.`;
      case 'missingImage': return `Файлу ${w.path} немає в проєкті — сторінка вийде без зображення.`;
      case 'missingGlyphs': return `Знаків ${[...w.chars].join(' ')} немає в шрифті книжки — у PDF вони надрукуються квадратиками. У тексті вони підсвічені — замініть їх.`;
    }
  },
  failed: {
    open: 'Не вдалося відкрити файл.',
    save: 'Не вдалося зберегти файл.',
    import: 'Не вдалося прочитати текст із файлу.',
    image: 'Не вдалося прочитати зображення.',
    layout: 'Не вдалося порахувати сторінки.',
    export: 'Не вдалося підготувати файли для друку.',
  },
};

const en: typeof uk = {
  open: 'Open',
  save: 'Save',
  importTxt: 'Import text',
  export: 'Export',
  unsaved: 'Unsaved changes will be lost. Continue?',
  clearAll: 'Clear all',
  confirmClear: 'Clear everything? Text, plates, title page and colophon will be removed. Book settings (format, type size, paper) stay. The file on disk is not changed.',
  loading: 'Loading…',
  restored: 'Autosave restored — save to a file so you don’t depend on the browser.',

  book: 'Title',
  metaTitle: 'Title',
  metaAuthor: 'Author',
  metaYear: 'Year',
  titlePage: 'Title page',
  qrUrl: 'link for the QR',
  blockType: { part: 'Part', chapter: 'Chapter', plate: 'Plate', questions: 'Questions', toc: 'Contents', tabula_rasa: 'Blank' },
  add: 'Add',
  addAfterSelected: 'Add after the selected',
  removeWhat: {
    part: 'Remove part', chapter: 'Remove chapter', plate: 'Remove plate', questions: 'Remove questions',
    toc: 'Remove contents', tabula_rasa: 'Remove blank page', notes: 'Remove notes', copyright: 'Remove copyright',
  },
  untitled: '(untitled)',
  pageShort: 'p.',
  moveUp: 'Up',
  moveDown: 'Down',
  remove: 'Delete',
  confirmRemove: 'Delete this block?',
  pagesCount: (n: number) => enPlural(n, 'page', 'pages'),
  defaults: { questions: 'What to ask this book', toc: 'Contents' },

  chapterTitle: 'Chapter title',
  chapterText: 'Chapter text',
  addPlate: 'Add a plate to this chapter — a separate page facing the title',
  split: 'Split here',
  splitMarkers: 'Split at ###',
  splitMarkersHint: 'Put ### as a separate paragraph where a new chapter should start',
  splitBy: 'Split',
  splitModes: { headings: 'document headings', keywords: 'keywords (Chapter N, Part N…)' },
  splitFound: (chapters: number, parts: number) => `${enPlural(chapters, 'chapter', 'chapters')}${parts ? `, ${enPlural(parts, 'part', 'parts')}` : ''}`,
  splitParts: 'parts',
  splitImages: (n: number) => `illustrations as separate pages (${n})`,
  copy: 'Copy',
  cut: 'Cut',
  paste: 'Paste',
  pasteDenied: 'The browser did not allow clipboard access — press Ctrl+V.',
  driftGuard: {
    button: 'Guard: screen vs PDF check',
    title: 'Screen/print mismatches',
    empty: 'No mismatches: every page on screen sits in its own frame, and every chapter takes as many pages as in the PDF.',
    hint: 'The engine computes page numbers and the PDF — they are right; this is what did not match on screen. Copy the text below and send it to the developer.',
    row: (first: number, got: number, want: number) => `p. ${first}: ${got} pages on screen, ${want} in the PDF.`,
    copy: 'Copy for the developer',
    copied: 'Copied',
    shifted: (page: number, at: number | null, n: number) => `Canvas shift: p. ${page} sits ${at ? `in the frame of p. ${at}` : 'outside the frames'} (shifted spots: ${n}).`,
  },
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  upper: 'Upper case',
  lower: 'Lower case',
  emoji: 'Emoji — printed in black and white, as shown here',
  selectAll: 'Select the whole chapter text',
  colophonNote: 'Text at the top of the page (abstract, thanks…)',
  emojiGroups: { symbols: 'Symbols', faces: 'Faces', hands: 'Hands', nature: 'Nature', things: 'Things' },

  image: 'Image',
  chooseImage: 'Choose image',
  replaceImage: 'Replace image',
  removeImage: 'Remove',
  imageHere: 'image goes here',
  lowResShort: 'low resolution',
  notesTitleLabel: 'Title (optional)',
  chapterImage: 'Image under the title',
  replaceChapterImage: 'Replace image under the title',
  photoHere: 'photo can go here',
  partTitle: 'Part title',
  partDescription: 'Subtitle',
  partPhoto: 'Photo (optional)',
  coverPhoto: 'Cover photo (optional)',
  captionTitle: 'Caption title',
  caption: 'Description',
  side: 'Page',
  sides: { auto: 'next free', recto: 'right of the title', verso: 'left of the title' },
  sideHint: 'The plate faces the first page of the chapter above it: left or right of the title page',
  sideUnbound: 'No chapter above this plate — it goes on the next free page',
  lowRes: (mm: string, full: string) => `Low resolution: prints ${mm} mm wide instead of ${full} mm, centred on the page.`,

  items: 'Questions — one per line',
  url: 'Link for the QR code (book text for AI)',
  note: 'Note',
  tocHint: 'Contents are built automatically from part and chapter titles and their page numbers. Parts are bold.',
  count: 'Number of pages',

  sheet: 'Format',
  sheets: { A3: 'A3 → A4 book', A4: 'A4 → A5 book', A5: 'A5 → A6 book' },
  scheme: 'Type size',
  schemes: { large: 'large', medium: 'medium', small: 'small' },
  paper: 'Paper',
  paperOption: (grams: string, sheets: SheetsPerSignature) => `${grams} g/m² — ${enPlural(sheets, 'sheet', 'sheets')} per signature`,
  mode: 'Printing',
  modes: { duplex: 'Duplex — one file', twoPass: 'Two-pass — fronts and backs separately', draft: 'Draft — for proofreading, no imposition' },
  reverseBacks: 'Backs in reverse order',
  rotateBacks: 'Backs rotated 180°',
  splitColor: 'Colour sheets as a separate file',
  assembly: 'Assembly sheet (print it first)',
  doExport: 'Export',
  exporting: 'Preparing files…',
  printReminder: 'Print at actual size (100 %), not “fit to page”.',
  close: 'Close',
  files: 'Files',
  openFile: 'open',
  download: 'download',

  stats: {
    pages: (n: number) => enPlural(n, 'page', 'pages'),
    sheets: (n: number, mono: number, color: number) => `${enPlural(n, 'sheet', 'sheets')}${color ? ` (${mono} B/W + ${color} colour)` : ''}`,
    signatures: (n: number, sheets: number) => `${enPlural(n, 'signature', 'signatures')} of ${sheets}`,
    free: (n: number) => `${n} free`,
    blanks: (n: number, intentional: number) => `${n} blank${intentional ? ` (${intentional} intentional)` : ''}`,
    counting: 'counting…',
  },

  free: 'Free pages',
  colophon: 'Copyright',
  freeAddHint: 'Free pages — add a block here:',
  slotAddHint: 'This left page is empty — you can fill it with one page:',
  addItem: '+ Item',
  questionsLimit: (used: number, max: number) => `${used} / ${max} characters`,
  questionsLimitHint: 'Questions always take one page: this many characters fit into the list and note above the QR',
  questionsCut: 'Not everything fits — the rest will not be printed',
  autoBlank: 'Blank',
  autoBlankNote: 'by the layout',
  autoBlankHint: 'The layout inserted this blank page so that a part starts on a right-hand page',
  colophonHint: 'The last page of the book: title, author, © year — from the title page',
  freeHint: 'Signatures are always full. Free pages sit before the colophon — fill them with blocks or leave them blank.',
  fillQuestions: '+ Questions',
  fillBlank: '+ Notes',
  addReasons: {
    exists: 'Already in the book',
    rectoOnly: 'Right-hand pages only — this one is left',
    onePage: 'Room for one left page here: a bigger block would push the next part or contents',
    page2: 'Copyright goes on p. 2 (back of the title page) or at the end of the book',
    noFree: 'No free pages',
  },
  notesTitle: 'Notes',
  notesType: 'Notes',

  problem: (p: Problem): string => {
    switch (p.code) {
      case 'notBook': return 'This is not a .book file.';
      case 'noBookJson': return 'The .book file has no book description (book.json).';
      case 'badBookJson': return 'The book description in the .book file is damaged.';
      case 'newerVersion': return `The file was made by a newer FANCRAFTs (format v${p.version}). Please update.`;
      case 'missingInArchive': return `The .book file is missing ${p.path}.`;
      case 'notDocx': return 'This is not a Word document (.docx).';
      case 'imageResize': return 'Could not downscale the image.';
      case 'fontMissing': return `Font file ${p.path} not found.`;
    }
  },
  warning: (w: Warning): string => {
    switch (w.code) {
      case 'manySignatures': return `${enPlural(w.count, 'signature', 'signatures')} — close to the hand-sewing limit (${w.limit}).`;
      case 'tooManySignatures': return `${enPlural(w.count, 'signature', 'signatures')} — more than ${w.limit}, hard to sew evenly by hand. Try a smaller type size, thinner paper or a smaller format.`;
      case 'plateWithoutImage': return `Plate${w.title ? ` “${w.title}”` : ''} has no image — only the caption will print.`;
      case 'missingImage': return `File ${w.path} is missing from the project — the page will print without it.`;
      case 'missingGlyphs': return `The book font has no ${[...w.chars].join(' ')} — they will print as empty boxes. They are highlighted in the text; replace them.`;
    }
  },
  failed: {
    open: 'Could not open the file.',
    save: 'Could not save the file.',
    import: 'Could not read text from the file.',
    image: 'Could not read the image.',
    layout: 'Could not count the pages.',
    export: 'Could not prepare the print files.',
  },
};

export const DICTIONARIES: Record<UiLang, typeof uk> = { uk, en };
export type Dictionary = typeof uk;

export const LangContext = createContext<Dictionary>(uk);

// Текст помилки мовою інтерфейсу. Відома проблема — своїми словами; невідома (з бібліотеки,
// з браузера) — загальною фразою про дію. Технічний текст у консоль пише той, хто помилку зловив.
export function errorText(e: unknown, t: Dictionary, action: keyof Dictionary['failed']): string {
  return e instanceof AppError ? t.problem(e.problem) : t.failed[action];
}
export const useT = () => useContext(LangContext);
