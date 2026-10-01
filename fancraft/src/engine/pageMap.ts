import { COVER_QR_SIZE, SCHEMES } from '../config';
import type { Book, Figure, Measure, Page, TextField } from '../model/types';
import { geometry } from './geometry';
import { chapterPages } from './chapter';
import { colophonPage, titlePage } from './matter';
import { partPage } from './part';
import { platePage } from './plate';
import { questionsPages } from './questions';

// Де в тексті глави починається сторінка: абзац (індекс у block.body) і знак у тексті абзацу.
// blank — скільки рядків сітки лишилося порожніми внизу попередньої сторінки (висячі рядки,
// підзаголовок, що не лишається внизу): редактор ставить там проміжок такої самої висоти.
export interface PageStart {
  number: number;
  para: number;
  offset: number;
  blank: number;
}

// Розкладка глави по сторінках — для редактора, що показує сторінки книжки.
export interface ChapterLayout {
  // Номер першої сторінки глави (непарний — права).
  first: number;
  pages: number;
  // Скільки рядків сітки на першій сторінці займає назва разом із пропусками.
  lead: number;
  // Скільки рядків сітки займає сама назва (кілька рядків назви — кілька кроків по rowsFor).
  titleRows: number;
  // Початки другої й наступних сторінок.
  starts: PageStart[];
  // Сторінки всередині глави, зайняті не нею (ілюстрація при обтіканні): редактор лишає там порожню колонку.
  holes: number[];
  // Зображення під назвою (на першій сторінці) — щоб показати його там, де воно стоятиме.
  figure?: Figure;
}

// Заглушка в порожньому полі — лише щоб рушій показав, де стоятиме текст.
const PLACEHOLDER = '…';

// Одна сторінка книжки в полотні інтерфейсу: глава — суцільним шматком сторінок (редактор),
// решта — окремими сторінками-макетами (номер — ключ у pagePreviews). pages — скільки сторінок займає
// шматок глави разом із «дірками»: сторінками ілюстрацій, що стали всередину глави (обтікання), —
// редактор перестрибує через них, а самі вони — макетами поверх полотна.
export type SheetItem =
  | { kind: 'chapter'; id: string; first: number; pages: number; holes: number[] }
  | { kind: 'page'; number: number };

export function sheetSequence(pages: Page[]): SheetItem[] {
  const out: SheetItem[] = [];
  pages.forEach((page, i) => {
    const last = out.at(-1);
    if (page.kind === 'chapter' && page.source) {
      if (last?.kind === 'chapter' && last.id === page.source) last.pages++;
      else out.push({ kind: 'chapter', id: page.source, first: page.number, pages: 1, holes: [] });
    } else if (last?.kind === 'chapter' && pages[i + 1]?.kind === 'chapter' && pages[i + 1].source === last.id) {
      // Сторінка посеред глави (ілюстрація при обтіканні) — дірка в шматку глави.
      last.pages++;
      last.holes.push(page.number);
    } else {
      out.push({ kind: 'page', number: page.number });
    }
  });
  return out;
}

// Сторінки-макети — усе, крім сторінок глав, за номером сторінки. Порожнє поле розкладається з заглушкою,
// а його рядки позначаються placeholder і лишаються без тексту — так інтерфейс знає, де показати
// «стрічку з підписом». У PDF іде справжня розкладка, без них.
export function pagePreviews(pages: Page[], book: Book, measure: Measure): Record<number, Page> {
  const { settings, assets, template } = book;
  const empty = new Set<TextField>();
  const fill = (field: TextField, text: string | undefined) => {
    if (text?.trim()) return text;
    empty.add(field);
    return PLACEHOLDER;
  };
  const mark = (page: Omit<Page, 'number'>, number: number, source?: string): Page => {
    const lines = page.lines.map((l) => (l.field && empty.has(l.field) ? { ...l, placeholder: true, runs: [{ ...l.runs[0], text: '' }] } : l));
    return { ...page, number, lines, ...(source ? { source } : {}) };
  };

  const out: Record<number, Page> = {};
  const done = new Set<string>();
  for (const page of pages) {
    if (page.kind === 'chapter') continue;
    empty.clear();
    const block = page.source ? book.blocks.find((b) => b.id === page.source) : undefined;
    // Сторінки одного блоку (питання, порожні) розкладаються разом і стають на свої номери по порядку.
    const own = block ? pages.filter((p) => p.source === block.id) : [page];
    const place = (drafts: Omit<Page, 'number'>[]) => own.forEach((p, i) => { out[p.number] = mark(drafts[i] ?? p, p.number, block?.id); });
    if (block && done.has(block.id)) continue;
    if (block) done.add(block.id);

    if (block?.type === 'part') {
      place([partPage({ ...block, title: fill('title', block.title), description: fill('description', block.description) }, assets[block.asset], settings, measure)]);
    } else if (block?.type === 'plate') {
      place([platePage({ ...block, title: fill('title', block.title), caption: fill('caption', block.caption) }, assets[block.asset], settings, measure)]);
    } else if (block?.type === 'questions') {
      const items = block.items.some((q) => q.trim()) ? block.items : (empty.add('items'), [PLACEHOLDER]);
      // Посилання для QR ще немає — показуємо місце QR, щоб його можна було вписати на сторінці.
      const noQr = !block.url.trim();
      const drafts = questionsPages({ ...block, title: fill('title', block.title), items, url: noQr ? PLACEHOLDER : block.url }, settings, measure, { keepEmpty: true })
        .map((d) => (noQr && d.qr ? { ...d, qr: { ...d.qr, url: '', placeholder: true } } : d));
      place(drafts);
    } else if (block?.type === 'tabula_rasa') {
      // Назва — лише на першій сторінці; порожні сторінки лишаються порожніми.
      const title = block.title.trim()
        ? page.lines
        : chapterPages({ id: block.id, type: 'chapter', title: fill('title', block.title), body: [] }, settings, measure)[0].lines;
      place(own.map((p, i) => ({ ...p, lines: i === 0 ? title : [] })));
    } else if (page.kind === 'title') {
      const meta = { ...book.meta, title: fill('title', book.meta.title), author: fill('author', book.meta.author), description: fill('description', book.meta.description), year: fill('year', book.meta.year) };
      // Посилання для QR ще немає — показуємо місце QR над копірайтом.
      const noQr = !template.titlePage.qr?.url.trim();
      const cover = noQr ? { ...template.titlePage, qr: { url: PLACEHOLDER, size: template.titlePage.qr?.size ?? COVER_QR_SIZE } } : template.titlePage;
      const shown = mark(titlePage(meta, settings, measure, cover, assets), page.number);
      out[page.number] = noQr && shown.qr ? { ...shown, qr: { ...shown.qr, url: '', placeholder: true } } : shown;
    } else if (page.kind === 'colophon') {
      const meta = { ...book.meta, title: fill('title', book.meta.title), author: fill('author', book.meta.author), year: fill('year', book.meta.year), colophon: fill('note', book.meta.colophon) };
      out[page.number] = mark(colophonPage(meta, settings, measure), page.number);
    } else {
      // Зміст і порожні, вставлені версткою, — як є.
      place(own);
    }
  }
  return out;
}

const wordStarts =(text: string) => [...text.matchAll(/\S+/g)].map((m) => m.index);
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function chapterLayouts(pages: Page[], book: Book): Record<string, ChapterLayout> {
  const scheme = SCHEMES[book.settings.scheme];
  const rows = geometry(book.settings).textBlock.lines;
  const out: Record<string, ChapterLayout> = {};
  for (const block of book.blocks) {
    if (block.type !== 'chapter') continue;
    const own = pages.filter((p) => p.source === block.id);
    if (!own.length) continue;

    const title = own[0].lines.filter((l) => l.role === 'chapterTitle');
    // Назва з пропусками, а під нею зображення глави й рядок після нього.
    let lead = title.length ? Math.max(...title.map((l) => l.row)) + 1 + scheme.chapterTitle.spaceAfter : 0;
    const figure = own[0].figure;
    if (figure) lead = Math.ceil((figure.y + figure.height) / (geometry(book.settings).leading * 25.4 / 72) - 1e-9) + 1;

    // Слова абзацу рахуються так само, як їх ділить рушій, — за пробілами.
    const texts = block.body.map((p) => p.runs.map((r) => r.text).join(''));
    const starts: PageStart[] = [];
    let para = -1;
    let words = 0;
    own.forEach((page, i) => {
      let first = true;
      const prev = own[i - 1];
      const blank = prev?.lines.length ? rows - 1 - Math.max(...prev.lines.map((l) => l.row)) : 0;
      for (const line of page.lines) {
        if (line.para === undefined) continue;
        if (line.para !== para) { para = line.para; words = 0; }
        if (first && i > 0) starts.push({ number: page.number, para, offset: wordStarts(texts[para])[words] ?? 0, blank });
        first = false;
        words += wordCount(line.runs.map((r) => r.text).join(''));
      }
    });
    const titleRows = title.length ? Math.max(...title.map((l) => l.row)) + 1 - scheme.chapterTitle.spaceBefore : 0;
    const numbers = new Set(own.map((p) => p.number));
    const holes: number[] = [];
    for (let n = own[0].number; n < own.at(-1)!.number; n++) if (!numbers.has(n)) holes.push(n);
    out[block.id] = { first: own[0].number, pages: own.length, lead, titleRows, starts, holes, ...(figure ? { figure } : {}) };
  }
  return out;
}
