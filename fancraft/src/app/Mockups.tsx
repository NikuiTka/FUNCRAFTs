import { COVER_QR_SIZE, PLATE_MIN_DPI } from '../config';
import { geometry } from '../engine/geometry';
import { copyright } from '../engine/matter';
import type { Block, Meta, Page, Project, Side, Template } from '../model/types';
import { useT } from './i18n';
import { PageView } from './PageView';
import { AddButtons } from './AddButtons';
import type { AddKind } from './adders';

const SIDES: Side[] = ['auto', 'recto', 'verso'];
const IMAGES = 'image/*';

export interface MockupHandlers {
  onMeta: (m: Meta) => void;
  onTemplate: (t: Template) => void;
  onCover: (file: File | null) => void;
  onBlock: (b: Block) => void;
  onImage: (block: Block) => (file: File | null) => void;
  // Зображення з буфера в тексті глави — нова ілюстрація одразу після неї.
  onImageAfter: (block: Block) => (file: File) => void;
  // Кнопки «Додати» на першій вільній сторінці: у кінець книжки (копірайт — на останню сторінку).
  onAddEnd: (kind: AddKind) => void;
  // Кнопки «Додати» на порожній лівій від верстки: блок — рівно сюди, перед блоком before (копірайт — на с. 2).
  onAddBefore: (kind: AddKind, before: string) => void;
}

// Бік ілюстрації відносно першої сторінки глави над нею (розворот із назвою). Над ілюстрацією не глава —
// вибору немає: ілюстрація на найближчій сторінці.
function SidePicker({ value, bound, onChange }: { value: Side; bound: boolean; onChange: (s: Side) => void }) {
  const t = useT();
  return (
    <label className="inline-field" title={bound ? t.sideHint : t.sideUnbound}>
      <span>{t.side}</span>
      <select value={bound ? value : 'auto'} disabled={!bound} onChange={(e) => onChange(e.target.value as Side)}>
        {SIDES.map((s) => <option key={s} value={s}>{t.sides[s]}</option>)}
      </select>
    </label>
  );
}

// Мало пікселів: при 150 dpi зображення вужче за смугу.
function LowRes({ project, path }: { project: Project; path: string | null | undefined }) {
  const t = useT();
  const asset = path ? project.book.assets[path] : undefined;
  const full = geometry(project.book.settings).textBlock.width;
  const printable = asset ? (asset.widthPx / PLATE_MIN_DPI) * 25.4 : Infinity;
  return printable < full ? <span className="page-warning" title={t.lowRes(printable.toFixed(1), full.toFixed(1))}>⚠ {t.lowResShort}</span> : null;
}

// Сторінка книжки, що не глава, — просто на своєму місці в полотні: текст у «стрічках з підписом»,
// зображення — клік по пунктирній рамці, посилання для QR — у стрічці над рамкою QR. Над сторінкою (у полі) —
// кілька налаштувань блоку: бік сторінки, кількість порожніх сторінок, попередження про роздільність.
// adder — сторінка з кнопками «Додати»: перша вільна (free) чи порожня ліва від верстки перед блоком before (slot).
export type Adder = { place: 'free' } | { place: 'slot'; before: string };
export function MockupPage({ page, adder, project, k, handlers }: { page: Page; adder?: Adder; project: Project; k: number; handlers: MockupHandlers }) {
  const t = useT();
  const { meta, template, blocks } = project.book;
  const block = page.source ? blocks.find((b) => b.id === page.source) : undefined;
  const setMeta = (key: keyof Meta) => (value: string) => handlers.onMeta({ ...meta, [key]: value });
  const common = { page, project, k };
  // Рік показується так, як друкується, — зі знаком копірайту; у модель іде лише рік.
  const shownYear = copyright(meta.year);
  const yearField = { value: shownYear, label: t.metaYear, onChange: (v: string) => setMeta('year')(v.replace(/^\s*©?\s*/, '')) };

  let content: React.ReactNode = null;
  let controls: React.ReactNode = null;

  if (page.kind === 'title') {
    const cover = template.titlePage;
    content = (
      <PageView
        {...common} placeholder={t.photoHere}
        fields={{
          title: { value: meta.title, label: t.metaTitle, onChange: setMeta('title') },
          author: { value: meta.author, label: t.metaAuthor, onChange: setMeta('author') },
          description: { value: meta.description ?? '', label: t.partDescription, onChange: setMeta('description') },
        }}
        slots={{ figure: { label: t.coverPhoto, accept: IMAGES, onPick: handlers.onCover, onRemove: () => handlers.onCover(null) } }}
        qr={{
          value: cover.qr?.url ?? '', label: t.qrUrl,
          onChange: (url) => handlers.onTemplate({ ...template, titlePage: { ...cover, qr: url ? { url, size: cover.qr?.size ?? COVER_QR_SIZE } : null } }),
        }}
      />
    );
    controls = <LowRes project={project} path={cover.photo} />;
  } else if (page.kind === 'colophon') {
    content = (
      <PageView
        {...common}
        fields={{
          title: { value: meta.title, label: t.metaTitle, onChange: setMeta('title') },
          author: { value: meta.author, label: t.metaAuthor, onChange: setMeta('author') },
          year: yearField,
          note: { value: meta.colophon ?? '', label: t.colophonNote, multiline: true, onChange: setMeta('colophon') },
        }}
      />
    );
  } else if (block?.type === 'part') {
    content = (
      <PageView
        {...common} placeholder={t.photoHere}
        fields={{
          title: { value: block.title, label: t.partTitle, onChange: (title) => handlers.onBlock({ ...block, title }) },
          description: { value: block.description, label: t.partDescription, onChange: (description) => handlers.onBlock({ ...block, description }) },
        }}
        slots={{ figure: { label: t.partPhoto, accept: IMAGES, onPick: handlers.onImage(block), onRemove: () => handlers.onImage(block)(null) } }}
      />
    );
    controls = <LowRes project={project} path={block.asset} />;
  } else if (block?.type === 'plate') {
    content = (
      <PageView
        {...common} placeholder={t.imageHere}
        fields={{
          title: { value: block.title, label: t.captionTitle, onChange: (title) => handlers.onBlock({ ...block, title }) },
          caption: { value: block.caption, label: t.caption, onChange: (caption) => handlers.onBlock({ ...block, caption }) },
        }}
        slots={{ figure: { label: t.chooseImage, accept: IMAGES, onPick: handlers.onImage(block), onRemove: () => handlers.onImage(block)(null) } }}
      />
    );
    controls = (
      <>
        <SidePicker value={block.side} bound={blocks[blocks.findIndex((b) => b.id === block.id) - 1]?.type === 'chapter'}
          onChange={(side) => handlers.onBlock({ ...block, side })} />
        <LowRes project={project} path={block.asset} />
      </>
    );
  } else if (block?.type === 'questions') {
    // Питання — одна сторінка: знаків не більше, ніж влазить (page.limit від рушія); довше — не набирається.
    const max = page.limit?.max ?? Infinity;
    const count = (items: string[], note: string) => items.reduce((s, q) => s + q.trim().length, 0) + note.trim().length;
    const used = count(block.items, block.note);
    const accept = (next: typeof block) => {
      const n = count(next.items, next.note);
      if (n > max && n > used) return;
      handlers.onBlock(next);
    };
    content = (
      <PageView
        {...common}
        fields={{
          title: { value: block.title, label: t.metaTitle, onChange: (title) => handlers.onBlock({ ...block, title }) },
          items: { value: block.items.join('\n'), label: t.items, multiline: true, onChange: (v) => accept({ ...block, items: v.split('\n') }) },
          note: { value: block.note, label: t.note, onChange: (note) => accept({ ...block, note }) },
        }}
        qr={{ value: block.url, label: t.qrUrl, onChange: (url) => handlers.onBlock({ ...block, url }) }}
      />
    );
    const full = used >= max || !!page.limit?.cut;
    controls = (
      <>
        <button type="button" className="button" disabled={full}
          onClick={() => handlers.onBlock({ ...block, items: [...block.items.filter((q, i, a) => q.trim() || i < a.length - 1), ''] })}>
          {t.addItem}
        </button>
        <span className={full ? 'limit full' : 'limit'} title={t.questionsLimitHint}>{t.questionsLimit(used, max)}</span>
        {page.limit?.cut && <span className="limit full">{t.questionsCut}</span>}
      </>
    );
  } else if (block?.type === 'toc') {
    content = (
      <PageView {...common} fields={{ title: { value: block.title, label: t.metaTitle, onChange: (title) => handlers.onBlock({ ...block, title }) } }} />
    );
  } else if (block?.type === 'tabula_rasa') {
    // Порожня — одна сторінка на найближчому місці; лише необов'язкова назва.
    content = (
      <PageView {...common} fields={{ title: { value: block.title, label: t.notesTitleLabel, onChange: (title) => handlers.onBlock({ ...block, title }) } }} />
    );
  } else if (adder?.place === 'free') {
    // Перша вільна сторінка: тут додаються нові блоки — у кінець книжки, на вільне місце.
    content = (
      <div className="free-add">
        <p className="free-add-hint">{t.freeAddHint}</p>
        <div className="free-add-buttons">
          <AddButtons ctx={{ place: 'free', page: page.number, front: false, hasFree: true }} book={project.book} onAdd={handlers.onAddEnd} />
        </div>
      </div>
    );
  } else if (adder?.place === 'slot') {
    // Порожня ліва, яку вставила верстка (перед частиною чи змістом): сюди — лише те, що займе одну ліву сторінку.
    const before = adder.before;
    content = (
      <div className="free-add">
        <p className="free-add-hint">{t.slotAddHint}</p>
        <div className="free-add-buttons">
          <AddButtons ctx={{ place: 'slot', page: page.number, front: page.number === 2, hasFree: false }} book={project.book} onAdd={(kind) => handlers.onAddBefore(kind, before)} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flow-page ${page.kind}`}>
      {controls && <div className="page-controls">{controls}</div>}
      {content}
    </div>
  );
}
