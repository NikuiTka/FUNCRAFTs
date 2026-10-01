import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Book, Project } from '../model/types';
import { AppError } from '../model/errors';
import { withTitle } from '../model/ops';

const VERSION = 1;
const BOOK = 'book.json';
const FOLDERS = ['img/'];

// Архів .book:
//   book.json — модель (version, meta, settings, blocks, template, assets)
//   img/      — зображення, байти як є
// Вбудовані шрифти не копіюються: вони йдуть разом із програмою.
export function packProject({ book, files }: Project): Uint8Array {
  const entries: Zippable = { [BOOK]: strToU8(JSON.stringify(book, null, 2)) };
  for (const [path, data] of Object.entries(files)) {
    // Зображення вже стиснені — кладуться без компресії.
    entries[path] = path.startsWith('img/') ? [data, { level: 0 }] : data;
  }
  return zipSync(entries);
}

export function unpackProject(bytes: Uint8Array): Project {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new AppError({ code: 'notBook' });
  }
  if (!zip[BOOK]) throw new AppError({ code: 'noBookJson' });

  let book: Book;
  try {
    book = JSON.parse(strFromU8(zip[BOOK])) as Book;
  } catch {
    throw new AppError({ code: 'badBookJson' });
  }
  if (typeof book.version !== 'number' || book.version > VERSION) {
    throw new AppError({ code: 'newerVersion', version: String(book.version) });
  }
  // Старі книжки мали вибір гарнітури; тепер гарнітура одна — поле просто відкидається.
  if (book.settings && 'font' in book.settings) {
    const { font: _font, ...settings } = book.settings as Book['settings'] & { font?: string };
    book = { ...book, settings };
  }
  // Старі книжки мали лого (vec/) на титулі й колофоні та QR на колофоні — лого більше немає,
  // колофон складається сам: лишається лише обкладинка з фото й QR.
  const oldTitle = (book.template?.titlePage ?? {}) as Book['template']['titlePage'] & { logo?: unknown };
  book = { ...book, template: { titlePage: { qr: oldTitle.qr ?? null, ...(oldTitle.photo ? { photo: oldTitle.photo } : {}) } } };
  for (const path of Object.keys(book.assets ?? {})) {
    if (path.startsWith('vec/')) {
      const { [path]: _drop, ...assets } = book.assets;
      book = { ...book, assets };
    }
  }

  // Кожна глава починається з назви: глава без назви зі старих книжок бере назвою перше речення.
  book = { ...book, blocks: book.blocks.map((b) => (b.type === 'chapter' ? withTitle(b) : b)) };
  // Поля обкладинки й назви блоків — без пробілів по краях і подвійних (як після редагування поля).
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  book = {
    ...book,
    meta: { ...book.meta, title: clean(book.meta.title), author: clean(book.meta.author), year: clean(book.meta.year), ...(book.meta.description !== undefined && { description: clean(book.meta.description) }) },
    // Текст угорі копірайту — багаторядковий: чистяться лише пробіли по краях рядків.
    ...(book.meta.colophon !== undefined && { colophon: book.meta.colophon.split('\n').map(clean).join('\n').trim() }),
    blocks: book.blocks.map((b) => ('title' in b && typeof b.title === 'string' ? { ...b, title: clean(b.title) } : b)),
  };

  const files: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(zip)) {
    if (FOLDERS.some((f) => path.startsWith(f)) && !path.endsWith('/')) files[path] = data;
  }

  const expectFile = (path: string) => {
    if (!(path in files)) throw new AppError({ code: 'missingInArchive', path });
  };
  for (const block of book.blocks) if ((block.type === 'plate' || block.type === 'part' || block.type === 'chapter') && block.asset) expectFile(block.asset);
  if (book.template.titlePage.photo) expectFile(book.template.titlePage.photo);

  return { book, files };
}

// Зображення називаються по порядку додавання: img/img_001.jpg, img/img_002.png…
export function nextImageName(files: Record<string, Uint8Array>, ext: string): string {
  const used = Object.keys(files)
    .map((p) => /^img\/img_(\d+)\./.exec(p)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `img/img_${String(next).padStart(3, '0')}.${ext}`;
}
