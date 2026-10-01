import { useState, type DragEvent, type ReactNode } from 'react';
import type { Block, CopyrightPlace } from '../model/types';
import { copyright } from '../engine/matter';
import { useT } from './i18n';


export const BOOK_ID = 'book';
// Останній аркуш книжки — копірайт (колофон): назва, автор, © рік.
export const COLOPHON_ID = 'colophon';
// Вільні сторінки в кінці останнього зошита — клік веде на першу з них (там кнопки «Додати»).
export const FREE_ID = 'free';

interface Props {
  blocks: Block[];
  // Діапазони сторінок блоків з останнього перерахунку.
  ranges: Record<string, [number, number]>;
  // Вільні сторінки в кінці останнього зошита, перед колофоном; null — зошити заповнені.
  free: { count: number; from: number; to: number } | null;
  // Номер останньої сторінки — копірайту (колофону); null — ще не пораховано.
  last: number | null;
  // Назва книжки й рік — у рядках титульної й копірайту.
  bookTitle: string;
  year: string;
  // Порожні сторінки, які пагінація вставила сама (щоб частина почалася з правої тощо), — номери.
  blanks: number[];
  selected: string;
  onSelect: (id: string) => void;
  // Кнопки «Додати» для панелі (AddButtons): блок стає після вибраного.
  add: ReactNode;
  // Де копірайт: немає, с. 2, остання сторінка; прибирається хрестиком.
  copyrightAt: CopyrightPlace;
  onRemoveCopyright: () => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}

// Структура книжки — усі сторінки по порядку: титульна, блоки, порожні, які вставила пагінація, вільні
// сторінки, копірайт. Порядок рядків блоків і є порядком у книжці. Перетягування або ↑ ↓.
// Праворуч у рядку — перша сторінка блоку; при наведенні її місце займають дії.
// Під час перетягування риска між рядками показує, куди стане блок (slot — місце вставки 0…n).
export function Structure({ blocks, ranges, free, last, bookTitle, year, blanks, selected, onSelect, add, copyrightAt, onRemoveCopyright, onMove, onRemove }: Props) {
  const t = useT();
  const [dragged, setDragged] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  // Верхня половина рядка — вставити перед ним, нижня — після.
  const over = (i: number) => (e: DragEvent<HTMLLIElement>) => {
    if (dragged === null) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setSlot(e.clientY < r.top + r.height / 2 ? i : i + 1);
  };
  const drop = () => {
    if (dragged !== null && slot !== null) {
      const to = slot > dragged ? slot - 1 : slot;
      if (to !== dragged) onMove(dragged, to);
    }
    setDragged(null);
    setSlot(null);
  };
  // Риска там, де блок справді переміститься: не над і не під самим перетягуваним рядком.
  const shown = slot !== null && dragged !== null && slot !== dragged && slot !== dragged + 1 ? slot : null;

  // Порожні сторінки пагінації — рядками там, де вони стоять у книжці: перед першим блоком, чия перша
  // сторінка далі за них (кожна — один раз).
  const shownBlanks = new Set<number>();
  const blanksBefore = (page: number | undefined) => (page === undefined ? [] : blanks.filter((n) => {
    if (n >= page || shownBlanks.has(n)) return false;
    shownBlanks.add(n);
    return true;
  }));
  const blankRow = (n: number) => (
    <li key={`blank${n}`} className={selected === `blank:${n}` ? 'row blank selected' : 'row blank'} title={t.autoBlankHint} onClick={() => onSelect(`blank:${n}`)}>
      <span className="type">{t.autoBlank}</span>
      <span className="title muted">{t.autoBlankNote}</span>
      <span className="pages">{t.pageShort} {n}</span>
    </li>
  );

  const copyrightRow = (page: number | null) => (
    <li className={selected === COLOPHON_ID ? 'row colophon selected' : 'row colophon'} title={t.colophonHint} onClick={() => onSelect(COLOPHON_ID)}>
      <span className="type">{t.colophon}</span>
      <span className="title muted">{copyright(year)}</span>
      <span className="pages">{page ? `${t.pageShort} ${page}` : ''}</span>
      <span className="actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" title={t.remove} onClick={() => confirm(t.confirmRemove) && onRemoveCopyright()}>✕</button>
      </span>
    </li>
  );

  // Вибрана ілюстрація під главою — глава над нею підсвічується: ілюстрація прив'язана до неї.
  const selectedIndex = blocks.findIndex((b) => b.id === selected);
  const linked = blocks[selectedIndex]?.type === 'plate' && blocks[selectedIndex - 1]?.type === 'chapter' ? blocks[selectedIndex - 1].id : null;

  const label = (b: Block) => {
    switch (b.type) {
      case 'part':
      case 'chapter': return b.title.trim() || t.untitled;
      case 'plate': return b.title.trim() || b.asset.replace(/^img\//, '') || t.untitled;
      case 'questions':
      case 'toc': return b.title.trim() || t.untitled;
      // Порожня — одна сторінка; «Для нотаток» — на кілька, тоді кількість видно.
      case 'tabula_rasa': return b.title.trim() || (b.count > 1 ? t.pagesCount(b.count) : t.untitled);
    }
  };

  return (
    <nav className="structure">
      <ul>
        <li className={selected === BOOK_ID ? 'row selected' : 'row'} onClick={() => onSelect(BOOK_ID)}>
          <span className="type">{t.book}</span>
          <span className={bookTitle.trim() ? 'title' : 'title muted'}>{bookTitle.trim() || t.untitled}</span>
          <span className="pages">{t.pageShort} 1</span>
        </li>
        {copyrightAt === 'front' && copyrightRow(2)}
        {blocks.map((b, i) => [
          ...blanksBefore(ranges[b.id]?.[0]).map(blankRow),
          <li
            key={b.id}
            className={['row', selected === b.id && 'selected', linked === b.id && 'linked', dragged === i && 'dragged', shown === i && 'drop-before', shown === blocks.length && i === blocks.length - 1 && 'drop-after'].filter(Boolean).join(' ')}
            draggable
            onDragStart={() => setDragged(i)}
            onDragEnd={() => { setDragged(null); setSlot(null); }}
            onDragOver={over(i)}
            onDrop={drop}
            onClick={() => onSelect(b.id)}
          >
            <span className="type">{b.type === 'tabula_rasa' && b.ruled ? t.notesType : t.blockType[b.type]}</span>
            <span className={b.type === 'chapter' && !b.title.trim() ? 'title muted' : 'title'}>{label(b)}</span>
            <span className="pages">{ranges[b.id] ? `${t.pageShort} ${ranges[b.id][0]}` : ''}</span>
            <span className="actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" title={t.moveUp} disabled={i === 0} onClick={() => onMove(i, i - 1)}>↑</button>
              <button type="button" title={t.moveDown} disabled={i === blocks.length - 1} onClick={() => onMove(i, i + 1)}>↓</button>
              <button type="button" title={t.remove} onClick={() => confirm(t.confirmRemove) && onRemove(b.id)}>✕</button>
            </span>
          </li>,
        ])}
        {blanksBefore(free?.from ?? last ?? Infinity).map(blankRow)}
        {free && (
          <li className={selected === FREE_ID ? 'row free selected' : 'row free'} title={t.freeHint} onClick={() => onSelect(FREE_ID)}>
            <span className="type">{t.free}</span>
            <span className="title muted">{t.pagesCount(free.count)}</span>
            <span className="pages">{t.pageShort} {free.from}</span>
          </li>
        )}
        {copyrightAt === 'back' && copyrightRow(last)}
      </ul>
      {/* «Додати» — і тут (після вибраного блоку), і на першій вільній сторінці полотна (у кінець). */}
      <div className="add">
        <span className="add-label">{t.addAfterSelected}:</span>
        {add}
      </div>
    </nav>
  );
}
