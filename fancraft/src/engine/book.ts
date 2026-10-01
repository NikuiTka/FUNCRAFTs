import { SCHEMES } from '../config';
import { geometry, rowsFor } from './geometry';
import type { Block, Book, Line, Measure, Page, Settings, Side, TabulaRasaBlock } from '../model/types';
import { chapterPages } from './chapter';
import { colophonPage, titlePage } from './matter';
import { partPage } from './part';
import { platePage } from './plate';
import { questionsPages } from './questions';
import { tocPages } from './toc';

type Draft = Omit<Page, 'number'>;

const blankPage: Draft = { kind: 'blank', folio: false, lines: [] };

// Назва, якщо є, — лише на першій сторінці, там само, де назва глави. Колонцифри немає: тут пишуть.
// «Для нотаток» (ruled) — лінії по рядках сітки під місцем назви (місце назви — і без назви).
function tabulaRasaPages(block: TabulaRasaBlock, settings: Settings, measure: Measure): Draft[] {
  const title: Line[] = block.title.trim()
    ? chapterPages({ id: block.id, type: 'chapter', title: block.title, body: [] }, settings, measure)[0].lines
    : [];
  const scheme = SCHEMES[settings.scheme];
  const textTop = scheme.chapterTitle.spaceBefore + rowsFor(scheme.chapterTitle.size, geometry(settings).leading) + scheme.chapterTitle.spaceAfter;
  return Array.from({ length: Math.max(1, block.count) }, (_, i) => ({
    kind: 'tabula_rasa', folio: false, lines: i === 0 ? title : [], ...(block.ruled && { ruled: i === 0 ? textTop : 0 }),
  }));
}

// Один прохід по списку блоків. Кожен блок починається з нової сторінки; рішення про порожню
// сторінку приймається лише за парністю наступного номера і ніколи не переглядається.
// starts — з попереднього проходу: де почалася кожна частина й глава (для змісту).
function pass(book: Book, measure: Measure, starts: Map<Block, number> | null) {
  const { settings } = book;
  const pages: Page[] = [];
  const chapterStarts = new Map<Block, number>();
  const push = (page: Draft) => { pages.push({ ...page, number: pages.length + 1 }); };
  // Непарні номери — праві сторінки.
  const nextIsRecto = () => pages.length % 2 === 0;
  const startOn = (side: Side) => {
    if (side === 'recto' && !nextIsRecto()) push(blankPage);
    if (side === 'verso' && nextIsRecto()) push(blankPage);
  };

  push(titlePage(book.meta, settings, measure, book.template.titlePage, book.assets));
  const copyright = book.copyright ?? 'back';
  if (copyright === 'front') push(colophonPage(book.meta, settings, measure));

  book.blocks.forEach((block, index) => {
    switch (block.type) {
      case 'part':
        // Частина — завжди з правої сторінки; наступна глава з назвою теж почнеться з правої.
        startOn('recto');
        chapterStarts.set(block, pages.length + 1);
        push({ ...partPage(block, book.assets[block.asset], settings, measure), source: block.id });
        break;
      case 'chapter': {
        const drafts = chapterPages(block, settings, measure, { asset: block.asset ? book.assets[block.asset] : undefined });
        if (!drafts.length) break;
        // Кожна глава — з наступної сторінки, лівої чи правої: книжка без зайвих порожніх.
        startOn('auto');
        const [first, ...rest] = drafts.map((d) => ({ ...d, source: block.id }));
        const titleFirst = () => { chapterStarts.set(block, pages.length + 1); push(first); };
        // Ілюстрація одразу під главою в списку — прив'язана до неї: розворот із першою сторінкою глави
        // (з назвою). «Ліворуч» — ілюстрація, потім назва; «праворуч» — назва, потім ілюстрація; «найближча» —
        // одразу після сторінки з назвою. Розворот не складається — порожня перед ними (її можна зайняти).
        const next = book.blocks[index + 1];
        if (next?.type !== 'plate') {
          titleFirst();
        } else {
          const plate: Draft = { ...platePage(next, book.assets[next.asset], settings, measure), source: next.id };
          if (next.side === 'verso') {
            startOn('verso');
            push(plate);
            titleFirst();
          } else {
            if (next.side === 'recto') startOn('verso');
            titleFirst();
            push(plate);
          }
        }
        rest.forEach(push);
        break;
      }
      case 'plate':
        // Прив'язана до глави над нею — уже стоїть поруч з її першою сторінкою. Інша — на найближчій сторінці.
        if (book.blocks[index - 1]?.type === 'chapter') break;
        push({ ...platePage(block, book.assets[block.asset], settings, measure), source: block.id });
        break;
      case 'questions':
        questionsPages(block, settings, measure).forEach((d) => push({ ...d, source: block.id }));
        break;
      case 'tabula_rasa':
        startOn(block.side);
        tabulaRasaPages(block, settings, measure).forEach((d) => push({ ...d, source: block.id }));
        break;
      case 'toc': {
        const entries = book.blocks
          .filter((b) => (b.type === 'chapter' || b.type === 'part') && b.title.trim() !== '')
          .map((b) => ({ title: b.title, page: starts?.get(b) ?? null, part: b.type === 'part' }));
        startOn('recto');
        tocPages(block, entries, settings, measure).forEach((d) => push({ ...d, source: block.id }));
        break;
      }
    }
  });

  if (copyright === 'back') push(colophonPage(book.meta, settings, measure));
  return { pages, chapterStarts };
}

// Зміст займає сторінки й тим зсуває нумерацію, яку показує, тож проходів два:
// перший — із зарезервованим місцем під номери, другий — із підставленими номерами.
export function paginate(book: Book, measure: Measure): Page[] {
  const first = pass(book, measure, null);
  if (!book.blocks.some((b) => b.type === 'toc')) return first.pages;
  return pass(book, measure, first.chapterStarts).pages;
}
