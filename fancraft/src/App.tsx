import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BookSheet } from './app/BookSheet';
import { BookBar } from './app/BookBar';
import { ExportPanel } from './app/ExportPanel';
import { BOOK_FAMILY, EMOJI_FAMILY, registerEditorFonts } from './app/fonts';
import { DICTIONARIES, errorText, LangContext, useT, type Dictionary, type UiLang } from './app/i18n';
import { importImage } from './app/image';
import { IMPORT_IMAGE_MIN_PX } from './config';
import { newBlock, newProject } from './app/newProject';
import { canUseFileHandles, pickBookFile, pickSaveHandle, readAutosave, writeAutosave, writeHandle } from './app/storage';
import { BOOK_ID, COLOPHON_ID, Structure } from './app/Structure';
import { AddButtons } from './app/AddButtons';
import type { AddKind } from './app/adders';
import { useStats } from './app/useStats';
import { nextImageName, packProject, unpackProject } from './archive/project';
import { parseDocx } from './import/docx';
import { parseMarkdown } from './import/markdown';
import { normalizeRuns } from './import/runs';
import { cleanEmoji } from './model/emoji';
import { chooseMode, countModes, splitUnits, textUnits, type ImportedImage, type SplitMode, type SplitOptions, type Unit } from './model/chapters';
import { moveBlock, newId, splitByMarkers, splitChapter, withTitle } from './model/ops';
import type { Block, ChapterBlock, Project } from './model/types';

const LANG_KEY = 'fancraft.uiLang';
const AUTOSAVE_MS = 1500;

const MODES: SplitMode[] = ['headings', 'keywords'];

// Картинки з документа після обробки: null — пропущена (дрібна чи не читається).
type PreparedImages = Map<ImportedImage, ImportedFile | null>;
interface Imported { units: Unit[]; images: PreparedImages; options: SplitOptions; ids: string[] }
type ImportedFile = Awaited<ReturnType<typeof importImage>>;

// Картинки з документа обробляються один раз — так само, як при виборі файлу (зменшення); дрібні пропускаються.
async function prepareImages(units: Unit[]): Promise<PreparedImages> {
  const out: PreparedImages = new Map();
  for (const u of units) {
    if (!u.image || out.has(u.image)) continue;
    try {
      const img = await importImage(new File([u.image.bytes as Uint8Array<ArrayBuffer>], 'image', { type: u.image.type }));
      out.set(u.image, img.widthPx < IMPORT_IMAGE_MIN_PX ? null : img);
    } catch {
      out.set(u.image, null);
    }
  }
  return out;
}
const countImages = (images: PreparedImages) => [...images.values()].filter(Boolean).length;

// UTF-8, а якщо файл у ній не читається — Windows-1251 (старі українські й російські .txt).
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1251').decode(buf);
  }
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type FailedAction = keyof Dictionary['failed'];

function readLang(): UiLang {
  try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'uk'; } catch { return 'uk'; }
}

export default function App() {
  const [lang, setLang] = useState<UiLang>(readLang);
  const changeLang = (next: UiLang) => {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* приватне вікно — не страшно */ }
  };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return (
    <LangContext.Provider value={DICTIONARIES[lang]}>
      <Workspace lang={lang} onLang={changeLang} />
    </LangContext.Provider>
  );
}

function Workspace({ lang, onLang }: { lang: UiLang; onLang: (l: UiLang) => void }) {
  const t = useT();
  const [project, setProject] = useState<Project>(() => newProject());
  // null — проєкт відновлено з автозбереження, у файл він ще не записаний.
  const [saved, setSaved] = useState<Project | null>(project);
  const [fileName, setFileName] = useState('fancraft.book');
  // Файл на диску, куди «Зберегти» пише без запитань (лише там, де браузер це вміє).
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  // Автозбереження вмикається, щойно зрозуміло, чи є що відновлювати.
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const openInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string>(project.book.blocks[0]?.id ?? BOOK_ID);
  // Прокрутка стрічки до блоку — коли його вибрано в структурі чи щойно додано (at — щоб повторний клік теж прокручував).
  const [scrollTo, setScrollTo] = useState<{ id: string; at: number } | null>(null);
  const goTo = (id: string) => {
    setSelected(id);
    setScrollTo({ id, at: Date.now() });
  };
  // Лічильник перебудов глави ззовні (розділення, об'єднання) — редактор монтується заново.
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<{ error: unknown; action: FailedAction } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  // Останній імпорт: джерело, оброблені картинки, спосіб розбивки й блоки, які він дав (щоб перерозбити на місці).
  const [imported, setImported] = useState<Imported | null>(null);
  const { stats, ranges, layouts, previews, sequence, warnings, error: statsError, busy } = useStats(project);
  const dirty = project !== saved;
  const { book } = project;

  useEffect(() => { void registerEditorFonts(); }, []);

  // Відновлення: закрита вкладка чи розряджений ноутбук нічого не коштують.
  useEffect(() => {
    let cancelled = false;
    readAutosave().then((auto) => {
      if (cancelled) return;
      if (auto) {
        try {
          const restored = unpackProject(auto.bytes);
          setProject(restored);
          setSaved(null);
          setFileName(auto.fileName);
          setSelected(restored.book.blocks[0]?.id ?? BOOK_ID);
          setVersion((v) => v + 1);
          setInfo(t.restored);
        } catch { /* пошкоджене автозбереження — починаємо з нового проєкту */ }
      }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { writeAutosave(packProject(project), fileName).catch(() => {}); }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [project, fileName, ready]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setBook = (fn: (b: Project['book']) => Project['book']) => setProject((p) => ({ ...p, book: fn(p.book) }));
  const setBlocks = (fn: (blocks: Block[]) => Block[]) => setBook((b) => ({ ...b, blocks: fn(b.blocks) }));
  const updateBlock = (next: Block) => setBlocks((blocks) => blocks.map((b) => (b.id === next.id ? next : b)));
  // Після вибраного блоку; вибрана титульна (чи копірайт на с. 2) — на початок, решта технічних — у кінець.
  const insertAfterSelected = (block: Block) => {
    setBlocks((blocks) => {
      const front = selected === BOOK_ID || (selected === COLOPHON_ID && book.copyright === 'front');
      const at = front ? -1 : blocks.findIndex((b) => b.id === selected);
      const next = [...blocks];
      next.splice(!front && at < 0 ? blocks.length : at + 1, 0, block);
      return next;
    });
    goTo(block.id);
  };

  // Помилка зберігається як є, а текст робиться під час показу — тож він мовою інтерфейсу навіть після перемикання.
  const fail = (err: unknown, action: FailedAction) => {
    console.error(err);
    setNotice({ error: err, action });
  };

  const pickFile = (action: FailedAction, handler: (file: File) => Promise<void>) => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await handler(file);
      setNotice(null);
    } catch (err) {
      fail(err, action);
    }
  };

  const openFile = async (file: File, fileHandle: FileSystemFileHandle | null) => {
    const next = unpackProject(new Uint8Array(await file.arrayBuffer()));
    setProject(next);
    setSaved(next);
    setFileName(file.name);
    setHandle(fileHandle);
    setSelected(next.book.blocks[0]?.id ?? BOOK_ID);
    setVersion((v) => v + 1);
    setInfo(null);
  };

  const onOpen = async () => {
    if (dirty && !confirm(t.unsaved)) return;
    if (!canUseFileHandles()) { openInput.current?.click(); return; }
    try {
      const picked = await pickBookFile();
      if (picked) await openFile(picked.file, picked.handle);
      setNotice(null);
    } catch (err) {
      fail(err, 'open');
    }
  };
  const onOpenInput = pickFile('open', (file) => openFile(file, null));

  // Порожня книжка з тими самими налаштуваннями. Зв'язок із файлом на диску рветься,
  // щоб «Зберегти» не записало порожнечу поверх відкритої книжки.
  const onClear = () => {
    if (!confirm(t.confirmClear)) return;
    const fresh = newProject();
    const next = { ...fresh, book: { ...fresh.book, settings: book.settings } };
    setProject(next);
    setSaved(next);
    setFileName('fancraft.book');
    setHandle(null);
    setSelected(next.book.blocks[0]?.id ?? BOOK_ID);
    setVersion((v) => v + 1);
    setImported(null);
    setInfo(null);
    setNotice(null);
  };

  // Імпорт: частини й глави за заголовками документа чи ключовими словами (model/chapters.ts), картинки —
  // ілюстраціями після своєї глави. Рядок над текстом дозволяє перемкнути спосіб, частини й картинки.
  // Блоки ставляться на місце попередніх блоків цього імпорту (replace) або після вибраного блоку;
  // файли картинок попереднього розкладу прибираються, нові отримують імена по порядку.
  const placeImport = (units: Unit[], images: PreparedImages, options: SplitOptions, replace: string[] | null) => {
    const made = splitUnits(units, options).flatMap((b): { block: Block; image?: ImportedImage }[] => {
      if (b.type === 'part') return [{ block: { id: newId(), type: 'part', title: b.title, description: b.description, asset: '' } }];
      if (b.type === 'plate') return images.get(b.image) ? [{ block: { id: newId(), type: 'plate', asset: '', title: '', caption: b.caption, side: 'auto' }, image: b.image }] : [];
      return [{ block: withTitle({ id: newId(), type: 'chapter', title: b.title, body: b.body }), image: images.get(b.image!) ? b.image : undefined }];
    });
    setProject((p) => {
      const files = { ...p.files };
      const assets = { ...p.book.assets };
      let blocks = p.book.blocks;
      let at: number;
      if (replace) {
        at = blocks.findIndex((b) => replace.includes(b.id));
        for (const b of blocks) {
          if (replace.includes(b.id) && 'asset' in b && b.asset) { delete files[b.asset]; delete assets[b.asset]; }
        }
        blocks = blocks.filter((b) => !replace.includes(b.id));
        if (at < 0) at = blocks.length;
      } else {
        const sel = blocks.findIndex((b) => b.id === selected);
        at = sel < 0 ? blocks.length : sel + 1;
      }
      const added = made.map(({ block, image }) => {
        const img = image && images.get(image);
        if (!img) return block;
        const path = nextImageName(files, img.ext);
        files[path] = img.bytes;
        assets[path] = { widthPx: img.widthPx, heightPx: img.heightPx };
        return { ...block, asset: path } as Block;
      });
      return { files, book: { ...p.book, assets, blocks: [...blocks.slice(0, at), ...added, ...blocks.slice(at)] } };
    });
    return made.map((m) => m.block.id);
  };

  const onImport = pickFile('import', async (file) => {
    const name = file.name.toLowerCase();
    const raw: Unit[] = name.endsWith('.pdf')
      ? await (await import('./import/pdf')).readPdfUnits(new Uint8Array(await file.arrayBuffer()))
      : name.endsWith('.docx')
      ? parseDocx(new Uint8Array(await file.arrayBuffer()))
      : /\.(md|markdown)$/.test(name)
        ? parseMarkdown(await readText(file))
        : textUnits(await readText(file));
    // Основні емодзі лишаються, варіанти стають основними, решта прибирається (emojiConfig.ts).
    const units = raw.map((u) => ({ ...u, runs: normalizeRuns(u.runs.map((r) => ({ ...r, text: cleanEmoji(r.text) }))) }));
    const images = await prepareImages(units);
    const options: SplitOptions = { mode: chooseMode(units), parts: true, images: true };
    const ids = placeImport(units, images, options, null);
    if (!ids.length) return;
    setSelected(ids[0]);
    setImported({ units, images, options, ids });
  });

  // Перерозбити останній імпорт іншим способом — на тому самому місці в книжці.
  const onSplitOptions = (options: SplitOptions) => {
    if (!imported) return;
    const ids = placeImport(imported.units, imported.images, options, imported.ids);
    setSelected(ids[0] ?? BOOK_ID);
    setImported({ ...imported, options, ids });
    setVersion((v) => v + 1);
  };

  const onSplitMarkers = (block: ChapterBlock) => () => {
    const parts = splitByMarkers(block, newId);
    setBlocks((blocks) => blocks.flatMap((x) => (x.id === block.id ? parts : [x])));
    setVersion((v) => v + 1);
  };

  // У той самий файл, якщо браузер це вміє; інакше — звичайне завантаження.
  const onSave = async () => {
    try {
      const bytes = packProject(project);
      if (canUseFileHandles()) {
        const target = handle ?? await pickSaveHandle(fileName);
        if (!target) return;
        await writeHandle(target, bytes);
        setHandle(target);
        setFileName(target.name);
      } else {
        download(bytes, fileName);
      }
      setSaved(project);
      setInfo(null);
      setNotice(null);
    } catch (err) {
      fail(err, 'save');
    }
  };

  const onSplit = (block: ChapterBlock) => (index: number) => {
    const [a, b] = splitChapter(block, index, newId());
    setBlocks((blocks) => blocks.flatMap((x) => (x.id === block.id ? [a, b] : [x])));
    setSelected(b.id);
    setVersion((v) => v + 1);
  };

  // Зображення ілюстрації чи фото частини; null — прибрати. Старий файл видаляється з проєкту.
  const onImage = (block: Block) => async (file: File | null) => {
    try {
      const image = file ? await importImage(file) : null;
      setProject((p) => {
        const files = { ...p.files };
        const assets = { ...p.book.assets };
        const current = p.book.blocks.find((b) => b.id === block.id);
        if (current && 'asset' in current && current.asset) { delete files[current.asset]; delete assets[current.asset]; }
        let path = '';
        if (image) {
          path = nextImageName(files, image.ext);
          files[path] = image.bytes;
          assets[path] = { widthPx: image.widthPx, heightPx: image.heightPx };
        }
        const blocks = p.book.blocks.map((b) => (b.id === block.id && (b.type === 'plate' || b.type === 'part' || b.type === 'chapter') ? { ...b, asset: path } : b));
        return { files, book: { ...p.book, assets, blocks } };
      });
    } catch (err) {
      fail(err, 'image');
    }
  };

  // Лого: SVG кладеться в vec/ як є; розмір береться з viewBox. Старе лого прибирається, якщо більше ніде не вжите.
  // Фото обкладинки (на титулі); null — прибрати. Старий файл видаляється з проєкту.
  const onCover = async (file: File | null) => {
    try {
      const image = file ? await importImage(file) : null;
      setProject((p) => {
        const files = { ...p.files };
        const assets = { ...p.book.assets };
        const old = p.book.template.titlePage.photo;
        if (old) { delete files[old]; delete assets[old]; }
        let photo: string | null = null;
        if (image) {
          photo = nextImageName(files, image.ext);
          files[photo] = image.bytes;
          assets[photo] = { widthPx: image.widthPx, heightPx: image.heightPx };
        }
        const template = { ...p.book.template, titlePage: { ...p.book.template.titlePage, photo } };
        return { files, book: { ...p.book, assets, template } };
      });
      setNotice(null);
    } catch (err) {
      fail(err, 'image');
    }
  };

  // Вільні сторінки заповнюються з кінця книжки — там, де вони стоять, перед колофоном.
  // Зображення, вставлене з буфера в текст глави, — нова ілюстрація одразу після неї.
  const onImageAfter = (after: Block) => (file: File) => {
    const plate = newBlock('plate', t);
    setBlocks((blocks) => blocks.flatMap((b) => (b.id === after.id ? [b, plate] : [b])));
    onImage(plate)(file);
    goTo(plate.id);
  };

  const appendBlock = (block: Block) => {
    setBlocks((blocks) => [...blocks, block]);
    goTo(block.id);
  };
  // Прибрати блок (чи копірайт) — зі структури чи кнопкою на його сторінці.
  const removeBlock = (id: string) => {
    if (id === COLOPHON_ID) setBook((b) => ({ ...b, copyright: 'none' }));
    else setBlocks((blocks) => blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(BOOK_ID);
  };
  // Кнопки «Додати»: блок — у кінець книжки чи після вибраного; копірайт — на с. 2, якщо додають одразу
  // після титульної, інакше в кінець; «Для нотаток» — tabula_rasa рівно на всі вільні сторінки.
  const addBlock = (kind: AddKind, where: 'end' | 'selected' | { before: string }) => {
    if (kind === 'copyright') {
      const front = where === 'selected' ? selected === BOOK_ID : typeof where === 'object' && book.blocks[0]?.id === where.before;
      setBook((b) => ({ ...b, copyright: front ? 'front' : 'back' }));
      goTo(COLOPHON_ID);
      return;
    }
    // «Для нотаток» — одна розлінована сторінка з назвою.
    const block: Block = kind === 'notes'
      ? { id: newId(), type: 'tabula_rasa', title: t.notesTitle, count: 1, side: 'auto', ruled: true }
      : newBlock(kind, t);
    if (where === 'end') appendBlock(block);
    else if (where === 'selected') insertAfterSelected(block);
    else {
      setBlocks((blocks) => {
        const at = blocks.findIndex((b) => b.id === where.before);
        const next = [...blocks];
        next.splice(at < 0 ? blocks.length : at, 0, block);
        return next;
      });
      goTo(block.id);
    }
  };
  // Вільні сторінки — у кінці книжки, перед копірайтом, якщо він останній.
  const freeEnd = stats ? stats.pages - ((book.copyright ?? 'back') === 'back' ? 1 : 0) : 0;
  const free = stats && stats.free > 0 ? { count: stats.free, from: freeEnd - stats.free + 1, to: freeEnd } : null;
  // Порожні сторінки, які пагінація вставила сама (без блоку), — крім вільних сторінок у кінці.
  const autoBlanks = Object.values(previews)
    .filter((p) => p.kind === 'blank' && !p.source && !(free && p.number >= free.from && p.number <= free.to))
    .map((p) => p.number)
    .sort((a, b) => a - b);

  return (
    <div className="app" style={{ '--book': `'${BOOK_FAMILY}', '${EMOJI_FAMILY}', monospace` } as React.CSSProperties}>
      <header className="bar">
        <strong className="brand">FANCRAFTs</strong>
        <button type="button" className="button" onClick={onOpen}>{t.open}</button>
        <input ref={openInput} type="file" accept=".book" hidden onChange={onOpenInput} />
        <button type="button" className="button" onClick={onSave}>{t.save}</button>
        <label className="button">{t.importTxt}<input type="file" accept=".txt,.md,.markdown,.docx,.pdf,text/plain" hidden onChange={onImport} /></label>
        <button type="button" className="button" onClick={onClear}>{t.clearAll}</button>
        <span className="file">{fileName}{dirty ? ' •' : ''}</span>
        {notice && <span className="notice">{errorText(notice.error, t, notice.action)}</span>}
        {info && !notice && <span className="info">{info}</span>}
        <span className="spacer" />
        <select value={lang} aria-label="Language" onChange={(e) => onLang(e.target.value as UiLang)}>
          <option value="uk">УКР</option>
          <option value="en">ENG</option>
        </select>
        <button type="button" className="button primary" onClick={() => setExportOpen((o) => !o)}>{t.export}</button>
      </header>

      <BookBar
        settings={book.settings}
        onSettings={(settings) => setBook((b) => ({ ...b, settings }))}
        stats={stats}
        warnings={warnings}
        error={statsError ? errorText(statsError, t, 'layout') : null}
        busy={busy}
      />

      <main className="workspace">
        <Structure
          blocks={book.blocks}
          ranges={ranges}
          free={free}
          last={stats?.pages ?? null}
          bookTitle={book.meta.title}
          year={book.meta.year}
          blanks={autoBlanks}
          selected={selected}
          onSelect={goTo}
          add={<AddButtons className="" book={book} onAdd={(kind) => addBlock(kind, 'selected')}
            ctx={{ place: 'panel', page: null, front: selected === BOOK_ID, hasFree: false }} />}
          copyrightAt={book.copyright ?? 'back'}
          onRemoveCopyright={() => removeBlock(COLOPHON_ID)}
          onMove={(from, to) => setBlocks((blocks) => moveBlock(blocks, from, to))}
          onRemove={removeBlock}
        />
        <section className="content">
          {imported && (
            <div className="import-banner">
              <span>{t.splitBy}:</span>
              <select value={imported.options.mode} onChange={(e) => onSplitOptions({ ...imported.options, mode: e.target.value as SplitMode })}>
                {MODES.map((mode) => {
                  const n = countModes(imported.units, imported.options.parts)[mode];
                  return <option key={mode} value={mode}>{t.splitModes[mode]} ({t.splitFound(n.chapters, n.parts)})</option>;
                })}
              </select>
              <label className="check">
                <input type="checkbox" checked={imported.options.parts} onChange={(e) => onSplitOptions({ ...imported.options, parts: e.target.checked })} />
                {t.splitParts}
              </label>
              {imported.images.size > 0 && (
                <label className="check">
                  <input type="checkbox" checked={imported.options.images} onChange={(e) => onSplitOptions({ ...imported.options, images: e.target.checked })} />
                  {t.splitImages(countImages(imported.images))}
                </label>
              )}
              <button type="button" className="icon" title={t.close} onClick={() => setImported(null)}>✕</button>
            </div>
          )}
          <BookSheet
            project={project}
            sequence={sequence}
            layouts={layouts}
            previews={previews}
            missing={warnings.find((w) => w.code === 'missingGlyphs')?.chars ?? ''}
            version={version}
            selected={selected}
            scrollTo={scrollTo}
            onSelect={setSelected}
            onSplit={onSplit}
            onSplitMarkers={onSplitMarkers}
            handlers={{
              onMeta: (meta) => setBook((b) => ({ ...b, meta })),
              onTemplate: (template) => setBook((b) => ({ ...b, template })),
              onCover,
              onBlock: updateBlock,
              onImage,
              onImageAfter,
              onAddEnd: (kind) => addBlock(kind, 'end'),
              onAddBefore: (kind, before) => addBlock(kind, { before }),
            }}
            onInfo={setInfo}
            onRemove={removeBlock}
          />
        </section>
        {exportOpen && (
          <ExportPanel
            project={project}
            lang={lang}
            onClose={() => setExportOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
