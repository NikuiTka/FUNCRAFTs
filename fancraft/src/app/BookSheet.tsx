import type { Editor } from '@tiptap/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { LEADING_RATIO, PARAGRAPH_INDENT_EM, PARAGRAPH_SPACE, SCHEMES } from '../config';
import { ChapterFlow } from '../editor/ChapterFlow';
import { pagesSupported } from '../editor/pages';
import { DriftGuard, type DriftReport, type Shift } from './DriftGuard';
import { BOOK_FAMILY } from './fonts';
import { useT } from './i18n';
import { useTracking } from './tracking';
import { Toolbar } from '../editor/Toolbar';
import { geometry, rowsFor } from '../engine/geometry';
import type { ChapterLayout, SheetItem } from '../engine/pageMap';
import { usedEmoji } from '../model/emoji';
import type { Block, ChapterBlock, Page, Project } from '../model/types';
import { MockupPage, type Adder, type MockupHandlers } from './Mockups';
import { BOOK_ID, COLOPHON_ID, FREE_ID } from './Structure';


const PT_PER_MM = 72 / 25.4;
const MM_PER_PT = 25.4 / 72;
// Кегль основного тексту на екрані, px: не більше за MAX; розворот — лише якщо кегль не менший за MIN_SPREAD.
const MAX_PX = 17;
const MIN_SPREAD_PX = 11;
// Проміжок між рядами сторінок, у кеглях.
const ROW_GAP_EM = 1.5;
// Глава монтується, коли до неї лишилося менше за стільки пікселів прокрутки, і більше не знімається.
const MOUNT_MARGIN = '1500px';
// Найбільший приріст висоти сторінки на екрані, у рядках, — лише запобіжник від нескінченного росту;
// якщо й цього мало, розбіжність показує сторож.
const MAX_GROW_LINES = 20;
// Перевірка глави сторожем: одразу після показу чи зміни висоти сторінок — і після набору, коли рушій перерахував.
const FAST_CHECK_MS = 800;
const SETTLE_MS = 3000;

const hasMarkers = (block: ChapterBlock) =>
  block.body.some((p) => p.type === 'paragraph' && /^#{3,}/.test(p.runs.map((r) => r.text).join('').trim()));

// Поки глава далеко від видимої частини — замість редактора місце точно на її сторінки.
// Сторож: глава в редакторі має займати рівно стільки колонок, скільки сторінок їй дав рушій.
// Інша кількість — браузер переносить рядки не там, де порахував рушій (пор. app/tracking.ts);
// onDrift повідомляє про кожен перерахунок (і про повернення в норму — null знімає запис зі списку).
function ChapterBox({ first, pages, colH, onFocus, onDrift, children }: {
  first: number; pages: number; colH: number; onFocus: () => void; onDrift: (got: number | null, el: HTMLDivElement | null) => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reported = useRef(-1);
  const drift = useRef(onDrift);
  useEffect(() => { drift.current = onDrift; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    // Перша перевірка (глава щойно показалась або сторінки стали вищими) — швидка; після набору рушій
    // перераховує із затримкою — тоді чекаємо, доки все вляжеться.
    let fast = true;
    reported.current = -1;
    const check = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        fast = false;
        const got = [...el.getClientRects()].filter((r) => r.height > 0).length;
        if (got === reported.current) return;
        reported.current = got;
        drift.current(got === pages ? null : got, el);
      }, fast ? FAST_CHECK_MS : SETTLE_MS);
    };
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => { ro.disconnect(); window.clearTimeout(timer); };
  }, [pages, colH]);
  return <div ref={ref} className="flow-chapter" data-page={first} onFocusCapture={onFocus}>{children}</div>;
}

// Заглушка — окремий блок на кожну сторінку, рівно на колонку: один високий блок на всі сторінки
// браузер ділить на колонки неточно (на дробовому розмірі колонки — на одну більше), і полотно з'їжджає.
function Lazy({ root, pages, page, children }: { root: HTMLElement | null; pages: number; page: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown || !root) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setShown(true); }, { root, rootMargin: MOUNT_MARGIN });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, [shown, root]);
  if (shown) return <>{children}</>;
  return (
    <div ref={ref} className="flow-placeholder" data-page={page}>
      {Array.from({ length: pages }, (_, i) => <div key={i} className="flow-placeholder-page" />)}
    </div>
  );
}

// Уся книжка одним полотном — так, як буде надрукована: сторінки по порядку, розворотами (ліва й права
// через згин), коли вистачає ширини, інакше по одній. Колонка полотна — смуга набору сторінки; глави —
// редактори, що течуть колонками, решта — сторінки-макети. Межі сторінок, порожні сторінки й місця
// блоків дає рушій верстки (sequence, layouts, previews), полотно їх лише показує.
export function BookSheet({ project, sequence, layouts, previews, missing, version, selected, scrollTo, onSelect, handlers, onSplit, onSplitMarkers, onInfo, onRemove }: {
  project: Project;
  sequence: SheetItem[];
  layouts: Record<string, ChapterLayout>;
  previews: Record<number, Page>;
  // Знаки, яких немає в шрифтах книжки — редактор ставить їм ширину клітинки й підсвічує.
  missing: string;
  version: number;
  selected: string;
  scrollTo: { id: string; at: number } | null;
  onSelect: (id: string) => void;
  handlers: MockupHandlers;
  onSplit: (block: ChapterBlock) => (index: number) => void;
  onSplitMarkers: (block: ChapterBlock) => () => void;
  onInfo: (text: string) => void;
  // Кнопка «Видалити …» у верхньому правому куті першої сторінки вибраного блоку (чи копірайту).
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current!;
    setRoot(el);
    const ro = new ResizeObserver(([entry]) => setAvail(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { book } = project;
  const emoji = useMemo(() => usedEmoji(book), [book]);
  const [active, setActive] = useState<{ id: string; editor: Editor } | null>(null);
  // Розбіжності екрана з друком, зібрані сторожем (ChapterBox) по кожній главі; порожній got знімає запис.
  const [drift, setDrift] = useState<Record<string, DriftReport>>({});
  // Сторінки полотна, що стоять не у своїй рамці (номер від рушія ≠ номер рамки під ними).
  const [shifted, setShifted] = useState<Shift[]>([]);
  // Приріст висоти сторінки на екрані, px: розбивку на сторінки дає лише рушій, і якщо текст сторінки
  // на цьому екрані не влазить у висоту PDF-сторінки (шрифт, масштаб, ОС), сторінки стають вищими на
  // пів-рядка, доки не влізе, — а не переносять рядок на наступну. Скидається, коли змінився кегль на екрані.
  const [grow, setGrow] = useState({ key: '', px: 0 });
  const onDrift = (block: ChapterBlock, first: number, pages: number) => (got: number | null, el: HTMLDivElement | null) => {
    // Глава зайняла більше колонок, ніж сторінок у рушії, — текст якоїсь сторінки не вліз: сторінки вищі
    // на пів-рядка (один раз на висоту — інші глави, що повідомили те саме, чекають перевірки з новою).
    // Звіти скидаються: глави перевіряють себе заново вже з новою висотою.
    if (got !== null && got > pages && growPx < MAX_GROW_LINES * lh) {
      setGrow((g) => ((g.key === growKey ? g.px : 0) === growPx ? { key: growKey, px: growPx + lh / 2 } : g));
      setDrift({});
      return;
    }
    setDrift((d) => {
      if (got === null) {
        if (!(block.id in d)) return d;
        const { [block.id]: _drop, ...rest } = d;
        return rest;
      }
      const cs = getComputedStyle(document.querySelector('.book-flow')!);
      const para = el?.querySelector<HTMLElement>('.tiptap p');
      const lhInfo = para ? `offsetH=${para.offsetHeight} declaredLh=${parseFloat(cs.getPropertyValue('--lh')).toFixed(4)}` : 'no-para';
      const debug = `dpr=${window.devicePixelRatio.toFixed(3)} track=${cs.getPropertyValue('--track')} title-track=${cs.getPropertyValue('--title-track')} s=${cs.getPropertyValue('--s')} lh=${cs.getPropertyValue('--lh')} ${lhInfo}`;
      return { ...d, [block.id]: { id: block.id, title: block.title.trim() || t.untitled, first, pages, got, debug } };
    });
  };
  const activeBlock = active ? book.blocks.find((b): b is ChapterBlock => b.id === active.id && b.type === 'chapter') : undefined;
  const imageInput = useRef<HTMLInputElement>(null);

  // Геометрія в кеглях основного тексту; s — кегль на екрані, px.
  const g = geometry(book.settings);
  const scheme = SCHEMES[book.settings.scheme];
  const body = scheme.body;
  const w = (g.textBlock.width * PT_PER_MM) / body;
  const m = (g.margin * PT_PER_MM) / body;
  const h = g.textBlock.lines * LEADING_RATIO;
  const page = w + 2 * m;
  const spreadPx = (avail - 32) / (2 * page);
  const spread = spreadPx >= MIN_SPREAD_PX;
  const s = Math.max(8, Math.min(MAX_PX, spread ? spreadPx : (avail - 32) / page));
  const cols = spread ? 2 : 1;
  const k = s / (body * MM_PER_PT);
  const lh = s * LEADING_RATIO;
  const px = (n: number) => `${n}px`;
  const growKey = `${s}:${spread}:${book.settings.sheet}:${book.settings.scheme}`;
  const growPx = grow.key === growKey ? grow.px : 0;
  const colH = h * s + growPx;
  const titleRows = rowsFor(scheme.chapterTitle.size, g.leading);
  const titleSize = (s * scheme.chapterTitle.size) / body;
  const track = useTracking(`'${BOOK_FAMILY}'`, s, titleSize);
  const vars = {
    '--cols': cols,
    '--s': px(s),
    '--mm': px(k), // px на 1 мм екрана — для довжини штриха лінії перегину
    '--lh': px(lh),
    '--w': px(w * s),
    '--m': px(m * s),
    '--h': px(h * s),
    '--col-h': px(colH),
    '--inner': px(cols * w * s + (cols - 1) * 2 * m * s),
    '--row-gap': px(2 * m * s + ROW_GAP_EM * s),
    '--indent': px(PARAGRAPH_INDENT_EM * s),
    '--para-space': PARAGRAPH_SPACE,
    '--title-size': px(titleSize),
    '--track': px(track.body),
    '--title-track': px(track.title),
    '--title-lh': px(titleRows * lh),
    '--title-before': px(scheme.chapterTitle.spaceBefore * lh),
  } as CSSProperties;

  // Чия сторінка: для підсвічування вибраного блоку й для «фокус на сторінці → вибрати блок».
  const owner = useMemo(() => {
    const out: Record<number, string> = {};
    for (const item of sequence) {
      if (item.kind === 'chapter') {
        for (let n = item.first; n < item.first + item.pages; n++) out[n] = item.id;
        // Ілюстрація посеред глави (обтікання) — сторінка свого блоку.
        for (const n of item.holes) out[n] = previews[n]?.source ?? '';
      }
      else {
        const p = previews[item.number];
        out[item.number] = p?.kind === 'title' ? BOOK_ID : p?.kind === 'colophon' ? COLOPHON_ID : p?.source ?? '';
      }
    }
    // Вільні сторінки — порожні без блоку підряд у кінці книжки (перед копірайтом, якщо він останній).
    const numbers = Object.keys(out).map(Number).sort((a, b) => a - b);
    let n = numbers.at(-1) ?? 0;
    if (out[n] === COLOPHON_ID) n--;
    for (; n > 1 && previews[n]?.kind === 'blank' && !previews[n]?.source; n--) out[n] = FREE_ID;
    // Решта порожніх від верстки — кожна сама своя (клік у структурі веде до неї).
    for (const m of numbers) if (!out[m] && previews[m]?.kind === 'blank' && !previews[m]?.source) out[m] = `blank:${m}`;
    return out;
  }, [sequence, previews]);
  const total = sequence.length ? Math.max(...sequence.map((i) => (i.kind === 'chapter' ? i.first + i.pages - 1 : i.number))) : 0;

  // Сторінка n — у рамці з індексом n (у розвороті с. 1 — права, ліворуч від неї порожньо) або n − 1.
  const indexOf = (n: number) => (spread ? n : n - 1);
  const pageW = page * s;
  const pageH = colH + 2 * m * s;
  const pitch = pageH + ROW_GAP_EM * s;
  const frameTop = (n: number) => Math.floor(indexOf(n) / cols) * pitch;

  useEffect(() => {
    if (!scrollTo || !scroller.current) return;
    const first = Object.keys(owner).map(Number).filter((n) => owner[n] === scrollTo.id).sort((a, b) => a - b)[0];
    if (first) scroller.current.scrollTo({ top: frameTop(first) });
  }, [scrollTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file && activeBlock) handlers.onImage(activeBlock)(file);
  };

  const firstOf = new Set<number>();
  for (const [n, id] of Object.entries(owner)) {
    if (!id) continue;
    const min = Math.min(...Object.keys(owner).map(Number).filter((x) => owner[x] === id));
    if (min === Number(n)) firstOf.add(min);
  }

  // Сторож положення: кожна сторінка полотна (data-page — номер від рушія) має стояти у рамці з тим самим
  // номером. Перевірка — коли полотно змінило розмір (набір, монтування глави, масштаб), із затримкою.
  const flowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;
    let timer = 0;
    const check = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const frames = [...document.querySelectorAll<HTMLElement>('.frame[data-n]')].map((f) => ({ r: f.getBoundingClientRect(), n: Number(f.dataset.n) }));
        const out: Shift[] = [];
        for (const el of flow.querySelectorAll<HTMLElement>(':scope > [data-page], :scope > * > [data-page]')) {
          const r = [...el.getClientRects()].find((x) => x.height > 0);
          if (!r) continue;
          const cx = r.left + r.width / 2, cy = r.top + 2;
          const at = frames.find((f) => cx >= f.r.left && cx <= f.r.right && cy >= f.r.top && cy <= f.r.bottom)?.n ?? null;
          const page = Number(el.dataset.page);
          if (at !== page) out.push({ page, at });
        }
        setShifted((prev) => (JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
      }, 2000);
    };
    const ro = new ResizeObserver(check);
    ro.observe(flow);
    check();
    return () => { ro.disconnect(); window.clearTimeout(timer); };
  }, [sequence, s, spread]);

  // Вибраний блок (чи копірайт) — кнопка «Видалити …» на його першій сторінці.
  const removeAt = (() => {
    const pages = Object.keys(owner).map(Number).filter((n) => owner[n] === selected).sort((a, b) => a - b);
    if (!pages.length) return null;
    if (selected === COLOPHON_ID) return { id: selected, page: pages[0], label: t.removeWhat.copyright };
    const block = book.blocks.find((b) => b.id === selected);
    if (!block) return null;
    const kind = block.type === 'tabula_rasa' && block.ruled ? 'notes' : block.type;
    const title = 'title' in block && block.title.trim() ? ` «${block.title.trim()}»` : '';
    return { id: selected, page: pages[0], label: `${t.removeWhat[kind]}${title}` };
  })();

  // Кнопки «Додати»: на першій вільній сторінці; на порожній від верстки — якщо за нею блок книжки.
  const blockIds = new Set(book.blocks.map((b) => b.id));
  const adderFor = (n: number): Adder | undefined => {
    if (owner[n] === FREE_ID) return firstOf.has(n) ? { place: 'free' } : undefined;
    if (owner[n]?.startsWith('blank:') && blockIds.has(owner[n + 1])) return { place: 'slot', before: owner[n + 1] };
    return undefined;
  };

  if (!pagesSupported) return <p className="hint">Column wrap is not supported in this browser.</p>;

  return (
    <div className="book-view">
      <Toolbar
        editor={active?.editor ?? null}
        hasMarkers={!!activeBlock && hasMarkers(activeBlock)}
        hasImage={!!activeBlock?.asset}
        usedEmoji={emoji}
        onSplit={(index) => activeBlock && onSplit(activeBlock)(index)}
        onSplitMarkers={() => activeBlock && onSplitMarkers(activeBlock)()}
        onPickImage={() => imageInput.current?.click()}
        onRemoveImage={() => activeBlock && handlers.onImage(activeBlock)(null)}
        onInfo={onInfo}
      />
      <input ref={imageInput} type="file" accept="image/*" hidden onChange={pickImage} />
      <div ref={scroller} className="book-scroll">
        <div className={`sheet ${spread ? 'spread' : 'single'}`} style={vars}>
          <div className="frames" aria-hidden>
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                data-n={n}
                className={['frame', n % 2 === 1 ? 'recto' : 'verso', owner[n] && owner[n] === selected && 'selected'].filter(Boolean).join(' ')}
                style={{ left: px((indexOf(n) % cols) * pageW), top: px(frameTop(n)), width: px(pageW), height: px(pageH) }}
              >
                <span className="folio">{n}</span>
              </div>
            ))}
          </div>
          <div ref={flowRef} className="book-flow">
            {spread && <div className="flow-page ghost" />}
            {sequence.map((item) => {
              if (item.kind === 'page') {
                const p = previews[item.number];
                if (!p) return <div key={`p${item.number}`} className="flow-page" data-page={item.number} />;
                // data-page — номер сторінки від рушія: за ним видно, чи полотно не з'їхало від рамок.
                return (
                  <div key={`p${item.number}`} data-page={item.number} onFocusCapture={() => onSelect(owner[item.number] || BOOK_ID)}>
                    <MockupPage page={p} adder={adderFor(item.number)} project={project} k={k} handlers={handlers} />
                  </div>
                );
              }
              const block = book.blocks.find((b): b is ChapterBlock => b.id === item.id && b.type === 'chapter');
              if (!block) return null;
              return (
                <Lazy key={`${item.id}:${version}`} root={root} pages={item.pages} page={item.first}>
                  <ChapterBox first={item.first} pages={item.pages} colH={colH} onFocus={() => onSelect(block.id)}
                    onDrift={onDrift(block, item.first, item.pages)}>
                    <ChapterFlow
                      block={block}
                      layout={layouts[block.id]}
                      k={k}
                      imageBytes={block.asset ? project.files[block.asset] : undefined}
                      missing={missing}
                      onChange={handlers.onBlock as (b: Block) => void}
                      onImage={handlers.onImage(block)}
                      onImageAfter={handlers.onImageAfter(block)}
                      onActive={(editor) => setActive((a) => (a?.editor === editor ? a : { id: block.id, editor }))}
                    />
                  </ChapterBox>
                </Lazy>
              );
            })}
          </div>
          {removeAt && (
            <button type="button" className="page-remove" aria-label={removeAt.label}
              style={{ left: px((indexOf(removeAt.page) % cols) * pageW + m * s * 0.3), top: px(frameTop(removeAt.page) + m * s * 0.2) }}
              onClick={() => confirm(t.confirmRemove) && onRemove(removeAt.id)}>
              <span className="page-remove-x">✕</span>
              <span className="page-remove-label">{removeAt.label}</span>
            </button>
          )}
          {/* Ілюстрації посеред глави (обтікання): редактор лишив під них порожню колонку, сторінка — поверх неї. */}
          {sequence.flatMap((item) => (item.kind === 'chapter' ? item.holes : [])).map((n) => previews[n] && (
            <div key={`hole${n}`} className="hole-page" data-page={n} onFocusCapture={() => onSelect(owner[n] || BOOK_ID)}
              style={{ left: px((indexOf(n) % cols) * pageW + m * s), top: px(frameTop(n) + m * s), width: px(w * s) }}>
              <MockupPage page={previews[n]} project={project} k={k} handlers={handlers} />
            </div>
          ))}
        </div>
      </div>
      <DriftGuard reports={Object.values(drift)} shifted={shifted} />
    </div>
  );
}
