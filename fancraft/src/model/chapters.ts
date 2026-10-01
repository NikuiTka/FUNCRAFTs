import { cleanText } from './import';
import type { Para, Run } from './types';

// Розбивка імпортованого тексту на частини й глави (docs/spec.md, «Імпорт тексту»).
// Глава — назва + текст (пролог, епілог — теж глави). Частина — вищий рівень: частина, розділ, книга, том.
// Способи: заголовки документа (.docx, .md) або ключові слова («Глава 3», «Частина II», «Пролог»).

// Абзац зі структурованого джерела (.docx, .md): накреслення вже є, заголовки позначені.
// Рівень заголовка не аналізується — у документах його ставлять як заманеться.
export interface Unit {
  runs: Run[];
  heading?: 1 | 2;
  pageBreak?: boolean;
  // Картинка з документа — окрема одиниця на своєму місці в потоці абзаців (runs порожні).
  image?: ImportedImage;
  // Підпис до картинки (стиль «Caption» чи «Рис. …»).
  caption?: boolean;
}

// Байти картинки як у документі; обробка (зменшення, відсів дрібних) — при додаванні в проєкт.
export interface ImportedImage { bytes: Uint8Array; type: string }

export type SplitMode = 'headings' | 'keywords';

export type ImportedBlock =
  | { type: 'chapter'; title: string; body: Para[]; image?: ImportedImage }
  | { type: 'part'; title: string; description: string }
  | { type: 'plate'; image: ImportedImage; caption: string };

export interface SplitOptions {
  mode: SplitMode;
  // Ділити на частини; ні — межі частин стають главами.
  parts: boolean;
  // Картинки з документа — окремими сторінками (ілюстраціями); ні — відкидаються.
  images: boolean;
}

// Межа — короткий окремий рядок.
const BOUNDARY_MAX = 80;
// Текст між назвою частини й першою главою, коротший за це, — опис частини; довший — окрема глава.
const PART_DESCRIPTION_MAX = 300;

// ── ключові слова ───────────────────────────────────────────────────────

const CHAPTER_WORDS = ['глава', 'гл.', 'гл', 'chapter', 'chap.', 'chap', 'ch.'];
// «Розділ» / «раздел» — частина, якщо в тексті є глави; інакше — глава.
const SECTION_WORDS = ['розділ', 'раздел'];
const PART_WORDS = ['частина', 'часть', 'книга', 'том', 'part', 'book', 'volume'];
// Глави без номера.
const SPECIAL = [
  'пролог', 'епілог', 'передмова', 'вступ', 'післямова', 'від автора', 'інтерлюдія', 'подяки',
  'prologue', 'epilogue', 'preface', 'foreword', 'introduction', 'afterword', "author's note", 'interlude', 'acknowledgements', 'acknowledgments',
  'эпилог', 'предисловие', 'введение', 'вступление', 'послесловие', 'от автора', 'интерлюдия', 'благодарности',
];

// Номер словом: 1–20 у жіночому й чоловічому роді (укр., рос.), англійською — кількісні й порядкові.
const ORDINALS: string[][] = [
  'перша друга третя четверта п\'ята шоста сьома восьма дев\'ята десята одинадцята дванадцята тринадцята чотирнадцята п\'ятнадцята шістнадцята сімнадцята вісімнадцята дев\'ятнадцята двадцята',
  'перший другий третій четвертий п\'ятий шостий сьомий восьмий дев\'ятий десятий одинадцятий дванадцятий тринадцятий чотирнадцятий п\'ятнадцятий шістнадцятий сімнадцятий вісімнадцятий дев\'ятнадцятий двадцятий',
  'первая вторая третья четвертая пятая шестая седьмая восьмая девятая десятая одиннадцатая двенадцатая тринадцатая четырнадцатая пятнадцатая шестнадцатая семнадцатая восемнадцатая девятнадцатая двадцатая',
  'первый второй третий четвертый пятый шестой седьмой восьмой девятый десятый одиннадцатый двенадцатый тринадцатый четырнадцатый пятнадцатый шестнадцатый семнадцатый восемнадцатый девятнадцатый двадцатый',
  'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
  'first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth',
].map((list) => list.split(' '));
const ORDINAL_VALUE = new Map<string, number>(ORDINALS.flatMap((list) => list.map((w, i) => [w, i + 1] as [string, number])));

// Апостроф і «ё» — до одного написання, регістр — нижній.
const norm = (s: string) => s.toLowerCase().replace(/[’ʼ`]/g, '\'').replace(/ё/g, 'е');

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanValue(s: string): number | null {
  if (!/^[IVXLCDM]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] ?? 0;
    total += v < next ? -v : v;
  }
  return total > 0 && total < 400 ? total : null;
}

// Номер: арабські, римські (великими), словом.
function numberValue(token: string): number | null {
  if (/^\d{1,3}$/.test(token)) return Number(token);
  return romanValue(token) ?? ORDINAL_VALUE.get(norm(token)) ?? null;
}

type Level = 'chapter' | 'section' | 'part';
interface Candidate { level: Level; num: number | null; special: boolean }

// Рядок змісту документа: номер сторінки після крапок-заповнювачів чи табуляції.
const TOC_LINE = /(\.{3,}|…|\t)\s*\d+\s*$/;
// Слово, номер і решта рядка: «Глава 12. Шторм» → «Глава», «12», «. Шторм».
const TWO_WORDS = /^([\p{L}.']+)\s*([\p{L}\d']+)(.*)$/u;
// Решта рядка після межі: нічого, розділовий знак або назва з великої літери. «Глава 3 була важка» — не межа.
// Регістр перевіряється на оригіналі: з прапорцем i \p{Lu} збігався б і з малими.
const restOk = (rest: string) => rest === '' || /^\s*[.:—–-]/.test(rest) || /^\s+[«"„“]?\p{Lu}/u.test(rest);

const levelOf = (word: string): Level | null => {
  const w = norm(word);
  if (CHAPTER_WORDS.includes(w)) return 'chapter';
  if (SECTION_WORDS.includes(w)) return 'section';
  if (PART_WORDS.includes(w)) return 'part';
  return null;
};

// Чи рядок — межа глави чи частини (за ключовим словом). null — звичайний текст.
export function classify(line: string): Candidate | null {
  const text = line.trim().replace(/[’ʼ`]/g, '\'');
  if (!text || text.length > BOUNDARY_MAX || TOC_LINE.test(text)) return null;
  const m = TWO_WORDS.exec(text);
  if (m && restOk(m[3])) {
    // Слово + номер: «Глава 3», «Chapter IV», «Частина перша».
    const level = levelOf(m[1]);
    const num = numberValue(m[2]);
    if (level && num !== null) return { level, num, special: false };
    // Номер + слово: «Перша глава», «Part One» — навпаки теж.
    const reverse = levelOf(m[2]);
    const first = numberValue(m[1]);
    if (reverse && first !== null) return { level: reverse, num: first, special: false };
  }
  // Частина може мати назву замість номера: «Книга Буття», «Том «Зима»». «Частина людей…» — ні: мала літера.
  const named = /^(\p{L}+)(\s+[«"„“]?\p{Lu}.*)$/u.exec(text);
  const namedLevel = named && levelOf(named[1]);
  if (namedLevel === 'part' || namedLevel === 'section') return { level: namedLevel, num: null, special: false };
  // Глави без номера: «Пролог», «Від автора», «Author's note».
  const lower = norm(text);
  const special = SPECIAL.find((w) => lower.startsWith(w) && restOk(text.slice(w.length)));
  if (special) return { level: 'chapter', num: null, special: true };
  return null;
}

// ── розбивка ────────────────────────────────────────────────────────────

const unitText = (u: Unit) => u.runs.map((r) => r.text).join('').trim();
const toPara = (runs: Run[]): Para => ({ type: 'paragraph', runs });
const bold = (runs: Run[]): Run[] => runs.map((r) => ({ ...r, b: true }));
// Короткий рядок без кінцевого розділового знака — схожий на назву (продовження «Глава 3» наступним рядком).
// Підпис картинки текстом: «Рис. 3», «Мал. 2», «Fig. 1», «Рисунок», «Figure».
const CAPTION_RE = /^(рис\.|рисунок|мал\.|малюнок|fig\.|figure)(\s|\d|$)/i;
const looksLikeTitle = (text: string) => text.length > 0 && text.length <= BOUNDARY_MAX && !/[.!?…:;,]$/.test(text);
// Межа — лише ключове слово з номером, без назви («Глава 3», «Частина перша.»): назву варто шукати в наступному рядку.
const bareKeyword = (text: string, cand: Candidate) => cand.num !== null && /^[\p{L}.']+\s*[\p{L}\d']+[.:]?$/u.test(text);

// Звичайний текст → абзаци-одиниці. Абзаци розділені порожнім рядком (або кожен рядок — абзац);
// межа, що стоїть першим рядком абзацу, відокремлюється від решти.
export function textUnits(text: string): Unit[] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\f/g, '\n\n');
  const chunks = /\n[ \t]*\n/.test(src) ? src.split(/\n[ \t]*\n/) : src.split('\n');
  const out: Unit[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.length > 1 && classify(lines[0])) {
      out.push({ runs: [{ text: cleanText(lines[0]) }] });
      lines.shift();
    }
    const joined = cleanText(lines.join(' '));
    if (joined) out.push({ runs: [{ text: joined }] });
  }
  return out;
}

interface Boundary { index: number; cand: Candidate }

// Межі за способом. Заголовки документа: з ключовим словом — за ним; якщо таких глав ≥ 2, межами стають
// лише вони, інакше кожен заголовок — глава. Ключові слова: будь-який окремий короткий абзац.
function findBoundaries(units: Unit[], mode: SplitMode): Boundary[] {
  const found: Boundary[] = [];
  units.forEach((u, index) => {
    if (u.image || (mode === 'headings' && !u.heading)) return;
    const cand = classify(unitText(u));
    if (cand) found.push({ index, cand });
    else if (mode === 'headings') found.push({ index, cand: { level: 'chapter', num: null, special: false } });
  });
  if (mode === 'headings') {
    const keyed = found.filter((b) => classify(unitText(units[b.index])));
    const chapters = keyed.filter((b) => b.cand.level === 'chapter');
    if (chapters.length >= 2) return keyed;
  }
  return found;
}

// Зміст самого документа: межа глави, одразу за якою (без тексту між ними) — ще одна межа, не межа.
function dropContents(units: Unit[], found: Boundary[]): Boundary[] {
  return found.filter((b, i) => {
    const next = found[i + 1];
    if (!next || b.cand.level === 'part') return true;
    for (let j = b.index + 1; j < next.index; j++) if (unitText(units[j])) return true;
    return false;
  });
}

// Номери глав ідуть по порядку; після нової частини рахунок може початися з 1. Номер не на своєму місці —
// не межа (цитата, перелік).
function keepSequence(found: Boundary[]): Boundary[] {
  let last: number | null = null;
  let afterPart = false;
  return found.filter(({ cand }) => {
    if (cand.level !== 'chapter') { afterPart = true; return true; }
    if (cand.num === null) return true;
    const ok = last === null || cand.num === last + 1 || (cand.num === 1 && afterPart);
    if (ok) { last = cand.num; afterPart = false; }
    return ok;
  });
}

// Ділить одиниці на частини й глави. Текст до першої межі — на початок першої глави.
// Нічого не знайдено — увесь текст одна глава.
export function splitUnits(source: Unit[], { mode, parts, images }: SplitOptions): ImportedBlock[] {
  const units = source.filter((u) => !u.pageBreak && (u.image ? images : unitText(u)));
  let found = findBoundaries(units, mode);
  // «Розділ»: частина, якщо є глави за словом «глава»; інакше глава.
  const hasChapters = found.some((b) => b.cand.level === 'chapter' && !b.cand.special);
  found = found.map((b) => (b.cand.level === 'section' ? { ...b, cand: { ...b.cand, level: hasChapters ? 'part' : 'chapter' } } : b));
  found = keepSequence(dropContents(units, found));
  // Частини вимкнено: якщо глави є — рядки частин лишаються текстом; якщо глав немає — частини стають главами.
  if (!parts) {
    found = hasChapters
      ? found.filter((b) => b.cand.level !== 'part')
      : found.map((b) => (b.cand.level === 'part' ? { ...b, cand: { ...b.cand, level: 'chapter' } } : b));
  }

  // Абзаци й картинки відрізка. Картинка одразу на початку (до тексту) — зображення під назвою глави;
  // решта — ілюстрації після глави, у тому ж порядку; підпис під картинкою переходить в ілюстрацію.
  const collect = (from: number, to: number) => {
    const body: Para[] = [];
    const plates: ImportedBlock[] = [];
    let image: ImportedImage | undefined;
    for (let j = from; j < to; j++) {
      const u = units[j];
      if (!u.image) { body.push(toPara(u.heading ? bold(u.runs) : u.runs)); continue; }
      const next = units[j + 1];
      const caption = next && j + 1 < to && !next.image && (next.caption || CAPTION_RE.test(unitText(next))) ? unitText(next) : '';
      if (!body.length && !plates.length && !image && !caption) { image = u.image; continue; }
      plates.push({ type: 'plate', image: u.image, caption });
      if (caption) j++;
    }
    return { body, plates, image };
  };

  const out: ImportedBlock[] = [];
  if (!found.length) {
    const all = collect(0, units.length);
    return [{ type: 'chapter', title: '', body: all.body }, ...(all.image ? [{ type: 'plate' as const, image: all.image, caption: '' }] : []), ...all.plates];
  }
  // Текст до першої межі — на початок першої глави (звідти його зручно перенести куди треба); картинки — після неї.
  const lead = collect(0, found[0].index);
  const leadPlates = lead.image ? [{ type: 'plate' as const, image: lead.image, caption: '' }, ...lead.plates] : lead.plates;

  found.forEach((b, i) => {
    const end = found[i + 1]?.index ?? units.length;
    let title = unitText(units[b.index]);
    let from = b.index + 1;
    // «Глава 3» + наступний короткий рядок — назва: «Глава 3. Шторм».
    const next = units[from];
    if (next && !next.image && from < end && bareKeyword(title, b.cand) && looksLikeTitle(unitText(next))) {
      title = `${title.replace(/[.:]$/, '')}. ${unitText(next)}`;
      from++;
    }
    const { body, plates, image } = collect(from, end);
    if (b.cand.level === 'part') {
      const text = body.map((p) => p.runs.map((r) => r.text).join('')).join(' ').trim();
      if (text.length <= PART_DESCRIPTION_MAX) out.push({ type: 'part', title, description: text });
      else out.push({ type: 'part', title, description: '' }, { type: 'chapter', title, body });
      if (image) out.push({ type: 'plate', image, caption: '' });
      out.push(...plates);
      return;
    }
    out.push({ type: 'chapter', title, body, ...(image ? { image } : {}) }, ...plates);
  });

  const first = out.findIndex((b) => b.type === 'chapter');
  if (first < 0) {
    out.push({ type: 'chapter', title: '', body: lead.body }, ...leadPlates);
  } else {
    const chapter = out[first] as Extract<ImportedBlock, { type: 'chapter' }>;
    chapter.body = [...lead.body, ...chapter.body];
    out.splice(first + 1, 0, ...leadPlates);
  }
  return out.filter((b) => b.type !== 'chapter' || b.body.length || b.title || b.image);
}

// Скільки глав і частин дає кожен спосіб — для рядка над текстом і автовибору.
export function countModes(units: Unit[], parts: boolean): Record<SplitMode, { chapters: number; parts: number }> {
  const count = (mode: SplitMode) => {
    const blocks = splitUnits(units, { mode, parts, images: false });
    const found = mode === 'headings' ? units.some((u) => u.heading) : blocks.length > 1 || blocks.some((b) => b.type !== 'plate' && b.title);
    return found
      ? { chapters: blocks.filter((b) => b.type === 'chapter').length, parts: blocks.filter((b) => b.type === 'part').length }
      : { chapters: 0, parts: 0 };
  };
  return { headings: count('headings'), keywords: count('keywords') };
}

// Автовибір: є заголовки документа — їх; інакше ключові слова (одна глава, якщо нічого не знайдено).
export const chooseMode = (units: Unit[]): SplitMode => (units.some((u) => u.heading) ? 'headings' : 'keywords');
