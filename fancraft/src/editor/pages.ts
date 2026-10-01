import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { ChapterLayout } from '../engine/pageMap';
import { pastedImage } from './clipboard';

// Сторінки глави в полотні книжки. Межі сторінок бере лише рушій верстки (ChapterLayout) — примусовим
// розривом колонки там, де починається кожна сторінка PDF; переноси рядків усередині сторінки —
// справа браузера (другорядні). Згори — зона назви (назва вводиться просто на сторінці, під нею зображення).
// Наступний блок починається з нової сторінки сам — примусовим розривом колонки (index.css).
export interface PagesData {
  layout: ChapterLayout;
  title: string;
  // Підпис порожньої назви.
  titleLabel: string;
  // px на мм — щоб поставити зображення під назвою там, де воно стоятиме.
  k: number;
  imageUrl: string | null;
  onTitle: (title: string) => void;
  onImageClick: () => void;
  // Зображення з буфера у виділене місце зображення під назвою.
  onImagePaste: (file: File) => void;
  // Іконка ліворуч від назви: нова сторінка-ілюстрація поруч із главою (на розвороті з назвою).
  onAddPlate: () => void;
  plateLabel: string;
}

// Браузер уміє переносити колонки в нові ряди (CSS multicol, column-wrap) — тоді показуємо сторінки;
// інакше редактор лишається суцільним текстом.
export const pagesSupported = typeof CSS !== 'undefined' && CSS.supports('column-wrap', 'wrap');

interface PagesState { data: PagesData | null; deco: DecorationSet }

export const pagesKey = new PluginKey<PagesState>('pages');

const el = (tag: string, className: string) => {
  const node = document.createElement(tag);
  node.className = className;
  return node;
};

// Зона назви створюється один раз (стабільний key) і далі лише оновлюється — щоб поле назви не
// втрачало фокус, коли назва переходить на другий рядок і зона стає вищою. Назва може займати кілька
// рядків: поле переносить її так само, як рушій (та сама ширина й гарнітура), Enter — перехід до тексту.
function titleZone(view: EditorView): HTMLElement {
  const zone = el('div', 'page-title');
  zone.contentEditable = 'false';
  const input = el('textarea', 'page-title-input') as HTMLTextAreaElement;
  input.rows = 1;
  input.spellcheck = false;
  input.addEventListener('input', () => pagesKey.getState(view.state)?.data?.onTitle(input.value.replace(/\n/g, ' ')));
  // Пробіли по краях і подвійні — геть, коли назва втрачає фокус (як у полях сторінок).
  input.addEventListener('blur', () => {
    const clean = input.value.replace(/\s+/g, ' ').trim();
    if (clean !== input.value) { input.value = clean; pagesKey.getState(view.state)?.data?.onTitle(clean); }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); view.focus(); } });
  const image = el('div', 'page-title-image');
  image.addEventListener('click', () => pagesKey.getState(view.state)?.data?.onImageClick());
  // Місце зображення можна виділити (Tab чи клік) і вставити в нього зображення з буфера.
  image.tabIndex = 0;
  image.addEventListener('paste', (e) => {
    const file = pastedImage(e);
    if (!file) return;
    e.preventDefault();
    e.stopPropagation();
    pagesKey.getState(view.state)?.data?.onImagePaste(file);
  });
  image.append(el('img', ''));
  // Іконка ілюстрації ліворуч від назви — додає поруч сторінку з ілюстрацією (у PDF не друкується).
  const plate = el('button', 'page-title-plate') as HTMLButtonElement;
  plate.type = 'button';
  plate.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="1.5"/><circle cx="8" cy="9.5" r="1.6"/><path d="m4 17 5.5-6 4 4.2 2.3-2.5L21 17"/></svg>';
  plate.addEventListener('mousedown', (e) => e.preventDefault());
  plate.addEventListener('click', () => pagesKey.getState(view.state)?.data?.onAddPlate());
  zone.append(input, image, plate);
  syncZone(zone, pagesKey.getState(view.state)?.data ?? null);
  return zone;
}

function syncZone(zone: HTMLElement, data: PagesData | null) {
  if (!data) return;
  const { layout, k } = data;
  zone.style.setProperty('--lead', String(layout.lead));
  zone.style.setProperty('--title-rows', String(Math.max(1, layout.titleRows)));
  zone.classList.toggle('untitled', !data.title.trim());
  const input = zone.querySelector<HTMLTextAreaElement>('.page-title-input')!;
  if (document.activeElement !== input && input.value !== data.title) input.value = data.title;
  input.placeholder = data.titleLabel;
  zone.querySelector<HTMLButtonElement>('.page-title-plate')!.title = data.plateLabel;
  const image = zone.querySelector<HTMLElement>('.page-title-image')!;
  const f = layout.figure;
  image.hidden = !f;
  if (f) {
    Object.assign(image.style, { left: `${f.x * k}px`, top: `${f.y * k}px`, width: `${f.width * k}px`, height: `${f.height * k}px` });
    const img = image.querySelector('img')!;
    if (data.imageUrl && img.getAttribute('src') !== data.imageUrl) img.src = data.imageUrl;
    img.hidden = !data.imageUrl;
  }
}

function build(doc: PMNode, data: PagesData): DecorationSet {
  const decos: Decoration[] = [];
  const { layout } = data;
  decos.push(Decoration.widget(0, titleZone, { side: -1, key: 'title', stopEvent: () => true, ignoreSelection: true }));

  // Абзаци рушія — непорожні вузли редактора: порожні абзаци в книжку не йдуть.
  const nodes: number[] = [];
  doc.forEach((node, offset) => { if (node.textContent.trim()) nodes.push(offset); });
  for (const start of layout.starts) {
    const at = nodes[start.para];
    if (at === undefined) continue;
    const node = doc.nodeAt(at)!;
    // Попередня сторінка — чужа (ілюстрація при обтіканні): спершу порожня колонка під неї.
    if (layout.holes?.includes(start.number - 1)) {
      const pos = start.offset === 0 ? at : at + 1 + Math.min(start.offset, node.content.size);
      decos.push(Decoration.widget(pos, () => el('span', 'page-hole'), { side: -2, key: `hole:${start.number - 1}:${pos}` }));
    }
    // Межі сторінок — лише з рушія (як у PDF), і всі примусові: браузер сам сторінку не розриває
    // ніколи (колонка полотна не нижча за будь-яку сторінку — BookSheet). Сторінка з нового абзацу —
    // абзац з нової колонки; посеред абзацу — розрив перед знаком, з якого рушій почав сторінку.
    if (start.offset === 0) {
      decos.push(Decoration.node(at, at + node.nodeSize, { class: 'page-start' }));
      continue;
    }
    const pos = at + 1 + Math.min(start.offset, node.content.size);
    decos.push(Decoration.widget(pos, () => el('span', 'page-break'), { side: -1, key: `break:${start.number}:${pos}` }));
  }
  return DecorationSet.create(doc, decos);
}

export const Pages = Extension.create({
  name: 'pages',
  addProseMirrorPlugins() {
    return [new Plugin<PagesState>({
      key: pagesKey,
      state: {
        init: (): PagesState => ({ data: null, deco: DecorationSet.empty }),
        // Нова розкладка приходить із воркера із затримкою; між тим позначки їдуть разом із текстом.
        apply(tr, value, _old, state) {
          const data = tr.getMeta(pagesKey) as PagesData | null | undefined;
          if (data !== undefined) return { data, deco: data ? build(state.doc, data) : DecorationSet.empty };
          return tr.docChanged ? { data: value.data, deco: value.deco.map(tr.mapping, tr.doc) } : value;
        },
      },
      props: { decorations: (state) => pagesKey.getState(state)?.deco },
      view: () => ({
        update: (view) => {
          const zone = view.dom.querySelector<HTMLElement>('.page-title');
          if (zone) syncZone(zone, pagesKey.getState(view.state)?.data ?? null);
        },
      }),
    })];
  },
});
