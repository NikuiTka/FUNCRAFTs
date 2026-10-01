import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import qrcode from 'qrcode-generator';
import { CAPTION_MIN_WIDTH_RATIO, SCHEMES } from '../config';
import { geometry, rowsFor } from '../engine/geometry';
import { BOLD_ROLES, type Figure, type Line, type Page, type PlacedQr, type Project, type Pt, type Settings, type TextField, type TextRole } from '../model/types';
import { FONT_ASCENT, FONT_DESCENT } from '../pdf/fontFiles';
import { useT } from './i18n';
import { pastedImage } from '../editor/clipboard';
import { useObjectUrl } from './useObjectUrl';

const MM_PER_PT = 25.4 / 72;

const sizeOf = (role: TextRole, settings: Settings): Pt => {
  const s = SCHEMES[settings.scheme];
  return ({ body: s.body, partTitle: s.partTitle, chapterTitle: s.chapterTitle.size, captionTitle: s.captionTitle, caption: s.caption })[role];
};
const boldRole = (role: TextRole) => BOLD_ROLES.has(role);

// Текстове поле просто на сторінці: «стрічка з підписом» на місці, де стоїть текст.
// multiline — у полі можна переходити на новий рядок (перелік питань: одне питання — один рядок).
export interface EditableField { value: string; label: string; onChange: (value: string) => void; multiline?: boolean }
// Місце зображення: клік — вибрати файл; якщо є — «Прибрати».
export interface ImageSlot { label: string; accept: string; onPick: (file: File) => void; onRemove?: () => void }

// Рядки поля без пробілів по краях і без подвійних пробілів; у багаторядковому — ще й без порожніх рядків по краях.
const tidy = (value: string, multiline: boolean) => {
  const lines = value.split('\n').map((l) => l.replace(/[^\S\n]+/g, ' ').trim());
  return multiline ? lines.join('\n').replace(/^\n+|\n+$/g, '') : lines.join(' ').trim();
};

// Символ ілюстрації (рамка, гори, сонце) — на порожньому місці зображення, замість пунктирної рамки.
function ImagePlaceholderIcon() {
  return (
    <svg className="pv-upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4" width="19" height="16" rx="1.5" />
      <circle cx="8" cy="9.5" r="1.6" />
      <path d="m4 17 5.5-6 4 4.2 2.3-2.5L21 17" />
    </svg>
  );
}

function Picture({ figure, bytes, type, k, slot, fallback }: {
  figure: Figure; bytes: Uint8Array | undefined; type?: string; k: number; slot?: ImageSlot; fallback: string;
}) {
  const t = useT();
  const url = useObjectUrl(bytes, type);
  const input = useRef<HTMLInputElement>(null);
  const style = { left: figure.x * k, top: figure.y * k, width: figure.width * k, height: figure.height * k };
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) slot?.onPick(file);
  };
  return (
    <div className={slot ? 'pv-slot editable' : 'pv-slot'} style={style} onClick={() => slot && input.current?.click()} title={slot?.label ?? fallback}
      // Місце зображення можна виділити (Tab) і вставити в нього зображення з буфера (Ctrl+V).
      tabIndex={slot ? 0 : undefined}
      onPaste={(e) => {
        const file = slot && pastedImage(e.nativeEvent);
        if (!file) return;
        e.preventDefault();
        slot.onPick(file);
      }}>
      {url ? <img src={url} alt="" /> : <ImagePlaceholderIcon />}
      {slot && (
        <>
          <input ref={input} type="file" accept={slot.accept} hidden onChange={pick} />
          {url && (
            <span className="pv-slot-actions" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => input.current?.click()}>{t.replaceImage}</button>
              {slot.onRemove && <button type="button" onClick={slot.onRemove}>{t.removeImage}</button>}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// QR так, як його надрукує експорт: модулі — квадрати на всю рамку.
function QrCode({ url }: { url: string }) {
  const path = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    const n = code.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [url]);
  return <svg viewBox={`0 0 ${path.n} ${path.n}`} shapeRendering="crispEdges"><path d={path.d} fill="currentColor" /></svg>;
}

// QR на своєму місці. Немає посилання — стрічка посилання над порожнім місцем (без підпису «QR»).
// Поле редагується, поки в фокусі; коли посилання є і фокус іде — замість поля сам QR. Клік по QR —
// знову редагувати посилання; очищене поле прибирає QR.
function QrSlot({ qr, edit, L, W, k }: { qr: PlacedQr; edit?: EditableField; L: number; W: number; k: number }) {
  const [editing, setEditing] = useState(false);
  const shown = !qr.placeholder && !editing;
  const showField = !!edit && (editing || !!qr.placeholder);
  return (
    <>
      <div
        className={shown ? (edit ? 'pv-qr editable' : 'pv-qr') : 'pv-slot pv-qr'}
        style={{ left: qr.x * k, top: qr.y * k, width: qr.size * k, height: qr.size * k }}
        title={edit?.label}
        onClick={() => edit && setEditing(true)}
      >
        {shown && <QrCode url={qr.url} />}
      </div>
      {showField && (
        <input
          className={qr.placeholder ? 'pv-field pv-link empty' : 'pv-field pv-link'}
          value={edit.value}
          placeholder={edit.label}
          title={edit.label}
          spellCheck={false}
          autoFocus={editing}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          onChange={(e) => edit.onChange(e.target.value.replace(/\s+/g, ''))}
          style={{
            // На обкладинці (QR по центру) поле стоїть на місці самого QR — нижче, з відступом від фото;
            // на питаннях — у рядку над QR.
            top: (qr.x > 0 ? qr.y + (qr.size - L) / 2 : qr.y - L) * k,
            left: 0,
            width: W * k,
            height: L * k,
            // Посилання — по краю QR: по центру на обкладинці, від лівого краю на питаннях.
            textAlign: qr.x > 0 ? 'center' : 'left',
          }}
        />
      )}
    </>
  );
}

// Одна сторінка книжки так, як її розклав рушій верстки: рядки на своїх місцях, базова лінія —
// там само, де в PDF. Зображення, лого й QR — у пунктирних рамках на своїх місцях.
// fields — текст редагується просто на сторінці; slots — рамки зображень відкривають вибір файлу;
// qr — посилання для QR: стрічка в рядку над рамкою QR; після введення — сам QR (QrSlot).
// placeholder — підпис рамки там, де зображення ще немає (без slot — пунктир лише показує місце).
// Малює лише смугу набору (px на мм — k); папір, поля й номер сторінки малює полотно книжки.
export function PageView({ page, project, k, placeholder, fields = {}, slots = {}, qr }: {
  page: Page;
  project: Project;
  k: number;
  placeholder?: string;
  fields?: Partial<Record<TextField, EditableField>>;
  slots?: { figure?: ImageSlot };
  qr?: EditableField;
}) {
  const t = useT();
  const { settings } = project.book;
  const g = geometry(settings);
  const body = SCHEMES[settings.scheme].body;
  const L = g.leading * MM_PER_PT;
  const W = g.textBlock.width;
  const baseline = (line: Line) => line.row * L + FONT_ASCENT * body * MM_PER_PT;
  const topOf = (line: Line) => baseline(line) - FONT_ASCENT * sizeOf(line.role, settings) * MM_PER_PT;
  // Підпис ілюстрації тримає ширину зображення (не вужчий за частку смуги); решта — уся смуга.
  const widthOf = (line: Line) => (page.kind === 'plate'
    ? Math.max(page.figure?.width ?? W, W * CAPTION_MIN_WIDTH_RATIO)
    : W - line.indent);

  const lineStyle = (line: Line): CSSProperties => {
    const size = sizeOf(line.role, settings) * MM_PER_PT;
    return {
      top: topOf(line) * k,
      left: line.indent * k,
      width: (W - line.indent) * k,
      fontSize: size * k,
      lineHeight: FONT_ASCENT + FONT_DESCENT,
      textAlign: line.align,
      textAlignLast: line.align === 'justify' ? 'justify' : undefined,
      fontWeight: boldRole(line.role) ? 700 : undefined,
      fontStyle: line.role === 'caption' ? 'italic' : undefined,
    };
  };

  // Рядки редагованих полів збираються в одну «стрічку»: від верху першого рядка до низу останнього.
  const groups = new Map<TextField, Line[]>();
  for (const line of page.lines) {
    if (line.field && fields[line.field]) groups.set(line.field, [...(groups.get(line.field) ?? []), line]);
  }

  // Де стоятиме зображення, якого ще немає. Ілюстрація — над підписом; обкладинка й частина — під
  // назвою й описом, до рядка над копірайтом / QR.
  let slot: Figure | null = null;
  if (placeholder && !page.figure && page.photoZone) {
    // Місце, яке відвів рушій (обкладинка), — те саме, куди стане зображення.
    slot = { asset: '', ...page.photoZone };
  } else if (placeholder && !page.figure) {
    const H = g.textBlock.lines * L;
    const text = page.lines.filter((l) => l.field !== 'year');
    const year = page.lines.find((l) => l.field === 'year');
    let top: number;
    let bottom: number;
    if (page.kind === 'plate') {
      top = 0;
      bottom = (text.length ? Math.min(...text.map(topOf)) : H) - L;
    } else {
      top = text.length ? Math.max(...text.map((l) => (l.row + 1) * L)) + L : 0;
      bottom = (year ? topOf(year) : page.qr ? page.qr.y : H) - L;
    }
    if (bottom - top >= L) slot = { asset: '', x: 0 as Figure['x'], y: top as Figure['y'], width: W, height: (bottom - top) as Figure['height'] };
  }

  return (
    <div className="pv-block" style={{ width: W * k, height: g.textBlock.lines * L * k }}>
            {/* «Для нотаток»: лінії там само, де в PDF, — по базових лініях рядків сітки. */}
            {page.ruled !== undefined && Array.from({ length: g.textBlock.lines - page.ruled }, (_, i) => (
              <div key={`rule${i}`} className="pv-rule" style={{ top: ((page.ruled! + i) * L + FONT_ASCENT * body * MM_PER_PT) * k }} />
            ))}
            {page.figure && <Picture figure={page.figure} bytes={project.files[page.figure.asset]} k={k} slot={slots.figure} fallback={t.image} />}
            {slot && <Picture figure={slot} bytes={undefined} k={k} slot={slots.figure} fallback={placeholder!} />}
            {page.qr && <QrSlot qr={page.qr} edit={qr} L={L} W={W} k={k} />}
            {page.lines.filter((line) => !(line.field && fields[line.field])).map((line, i) => (
              <div key={i} className="pv-line" style={lineStyle(line)}>
                {line.runs.map((run, j) => (
                  <span key={j} style={{ fontWeight: run.b ? 700 : undefined, fontStyle: run.i ? 'italic' : undefined, textDecoration: run.s ? 'line-through' : undefined }}>
                    {run.text}
                  </span>
                ))}
              </div>
            ))}
            {[...groups].map(([field, lines]) => {
              const edit = fields[field]!;
              const first = lines[0];
              const size = sizeOf(first.role, settings) * MM_PER_PT;
              const rows = rowsFor(sizeOf(first.role, settings), g.leading);
              const top = (first.row - rows + 1) * L;
              const height = (lines.at(-1)!.row - first.row + rows) * L;
              return (
                <textarea
                  key={field}
                  className={first.placeholder ? 'pv-field empty' : 'pv-field'}
                  value={edit.value}
                  placeholder={edit.label}
                  title={edit.label}
                  rows={1}
                  spellCheck={false}
                  onChange={(e) => edit.onChange(edit.multiline ? e.target.value : e.target.value.replace(/\n/g, ' '))}
                  // Пробіли на початку й у кінці рядка та подвійні — геть, коли поле втрачає фокус (під час
                  // набору пробіл між словами потрібен): інакше рядок по центру стоїть криво.
                  onBlur={(e) => { const clean = tidy(e.target.value, !!edit.multiline); if (clean !== edit.value) edit.onChange(clean); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !edit.multiline) e.preventDefault(); }}
                  style={{
                    top: top * k,
                    left: first.indent * k,
                    width: widthOf(first) * k,
                    height: height * k,
                    fontSize: size * k,
                    lineHeight: `${rows * L * k}px`,
                    textAlign: first.align === 'justify' ? 'left' : first.align,
                    fontWeight: boldRole(first.role) || first.runs.some((r) => r.b) ? 700 : undefined,
                    fontStyle: first.role === 'caption' || first.runs.some((r) => r.i) ? 'italic' : undefined,
                  }}
                />
              );
            })}
    </div>
  );
}
