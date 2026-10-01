import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFName, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import qrcode from 'qrcode-generator';
import { FOLIO_ROWS_BELOW, SCHEMES, SHEET_MARK_TRACKING } from '../config';
import { geometry } from '../engine/geometry';
import { roman, sheetMark } from '../engine/signatures';
import type { Warning } from '../model/errors';
import { BOLD_ROLES, type Face, type Line, type Page, type PlacedQr, type Pt, type Run, type Settings, type TextRole } from '../model/types';
import { createMeasure, createShaper, FACES, type FontFaces } from './fonts';
import { patchSubsetPadding } from './fontkitPatch';

const PT_PER_MM = 72 / 25.4;
const BLACK = rgb(0, 0, 0);
// Лінії сторінки «Для нотаток»: тонкі й сірі — видно, але не заважають писати.
const RULE = rgb(0.6, 0.6, 0.6);
const RULE_WIDTH = 0.3;

export interface RenderInput {
  pages: Page[];
  settings: Settings;
  fonts: FontFaces;
  // Зображення за шляхами в архіві: img/img_001.jpg.
  files: Record<string, Uint8Array>;
  // План зошитів для римських позначок; null — чернетка, без позначок.
  plan: number[] | null;
  // Сюди складаються попередження: файлу бракує — сторінка малюється без нього.
  warnings?: Warning[];
}

const faceOf = (run: Run, role: TextRole): Face => {
  const bold = run.b || BOLD_ROLES.has(role);
  const italic = run.i || role === 'caption';
  return bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'regular';
};

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

// Сторінки книжки в порядку читання, кожна — окрема сторінка PDF розміру «половина аркуша».
// Усе відміряється від меж смуги; поля однакові з усіх боків.
export async function renderBook({ pages, settings, fonts, files, plan, warnings = [] }: RenderInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Друкувати у фактичному розмірі: драйвер не має «вписувати» сторінку.
  pdf.catalog.set(PDFName.of('ViewerPreferences'), pdf.context.obj({ PrintScaling: PDFName.of('None') }));

  patchSubsetPadding(fontkit.create(fonts.regular));
  const embedded = {} as Record<Face, PDFFont>;
  for (const face of FACES) embedded[face] = await pdf.embedFont(fonts[face], { subset: true });
  const measure = createMeasure(fonts);
  const shaper = createShaper(fonts);
  // Шрифт емодзі вбудовується, лише якщо в книжці є знаки, яких немає в гарнітурі.
  const needsEmoji = !!fonts.emoji && pages.some((p) => p.lines.some((line) =>
    line.runs.some((run) => shaper.segments(run.text, faceOf(run, line.role)).some((seg) => seg.emoji))));
  const emojiFont = needsEmoji ? await pdf.embedFont(fonts.emoji!, { subset: true }) : null;

  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const pageW = g.page.width * PT_PER_MM;
  const pageH = g.page.height * PT_PER_MM;
  const left = g.margin * PT_PER_MM;
  const top = g.margin * PT_PER_MM;
  const blockW = g.textBlock.width * PT_PER_MM;
  const L = g.leading;
  const ascent = embedded.regular.heightAtSize(scheme.body, { descender: false });
  // Базова лінія рядка сітки, у координатах PDF (знизу вгору).
  const baseline = (row: number) => pageH - (top + row * L + ascent);

  const sizeOf = (role: TextRole): Pt => ({
    body: scheme.body,
    partTitle: scheme.partTitle,
    chapterTitle: scheme.chapterTitle.size,
    captionTitle: scheme.captionTitle,
    caption: scheme.caption,
  })[role];

  // Кожен відсутній файл — одне попередження, хоч би скільки разів він траплявся.
  const missing = new Set<string>();
  const warnMissing = (path: string) => {
    if (missing.has(path)) return;
    missing.add(path);
    warnings.push({ code: 'missingImage', path });
  };

  const images = new Map<string, PDFImage | null>();
  const image = async (path: string) => {
    if (!images.has(path)) {
      const bytes = files[path];
      if (!bytes) warnMissing(path);
      images.set(path, !bytes ? null : isPng(bytes) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
    }
    return images.get(path)!;
  };

  const drawLine = (page: PDFPage, line: Line) => {
    const size = sizeOf(line.role);
    const y = baseline(line.row);
    const indent = line.indent * PT_PER_MM;
    const avail = blockW - indent;
    const runs = line.runs.map((run) => ({ run, face: faceOf(run, line.role) }));
    const natural = runs.reduce((w, { run, face }) => w + measure(run.text, face, size), 0);
    const spaces = runs.reduce((n, { run }) => n + (run.text.match(/ /g)?.length ?? 0), 0);

    let x = left + indent;
    let extra = 0;
    if (line.align === 'center') x += (avail - natural) / 2;
    else if (line.align === 'right') x = left + blockW - natural;
    else if (line.align === 'justify' && spaces) extra = Math.max(0, (avail - natural) / spaces);

    for (const { run, face } of runs) {
      const start = x;
      run.text.split(' ').forEach((word, i) => {
        if (i > 0) x += measure(' ', face, size) + extra;
        // Слово може складатися з фрагментів різних шрифтів: гарнітура й емодзі.
        for (const seg of word ? shaper.segments(word, face) : []) {
          const font = seg.emoji && emojiFont ? emojiFont : embedded[face];
          if (seg.text) page.drawText(seg.text, { x, y, size, font, color: BLACK });
          x += measure(seg.text, face, size);
        }
      });
      // Перекреслення — лінією, суцільною через пробіли всередині фрагмента.
      if (run.s) {
        const sy = y + size * 0.28;
        page.drawLine({ start: { x: start, y: sy }, end: { x, y: sy }, thickness: Math.max(0.4, size * 0.05), color: BLACK });
      }
    }
  };

  // QR — векторно, модулі як прямокутники одного контуру. Позицію від меж смуги рахує рушій.
  const drawQr = (page: PDFPage, qr: PlacedQr) => {
    const code = qrcode(0, 'M');
    code.addData(qr.url);
    code.make();
    const n = code.getModuleCount();
    const side = qr.size * PT_PER_MM;
    const m = side / n;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (code.isDark(r, c)) path += `M${c * m} ${r * m}h${m}v${m}h${-m}z`;
    }
    page.drawSvgPath(path, { x: left + qr.x * PT_PER_MM, y: pageH - (top + qr.y * PT_PER_MM), color: BLACK });
  };

  for (const p of pages) {
    const page = pdf.addPage([pageW, pageH]);
    const recto = p.number % 2 === 1;

    if (p.figure) {
      const img = await image(p.figure.asset);
      if (img) page.drawImage(img, {
        x: left + p.figure.x * PT_PER_MM,
        y: pageH - (top + (p.figure.y + p.figure.height) * PT_PER_MM),
        width: p.figure.width * PT_PER_MM,
        height: p.figure.height * PT_PER_MM,
      });
    }
    if (p.ruled !== undefined) {
      for (let row = p.ruled; row < g.textBlock.lines; row++) {
        const y = baseline(row);
        page.drawLine({ start: { x: left, y }, end: { x: left + blockW, y }, thickness: RULE_WIDTH, color: RULE });
      }
    }
    for (const line of p.lines) drawLine(page, line);
    if (p.qr) drawQr(page, p.qr);

    // Нижня лінія: колонцифра — по зовнішньому краю смуги, позначка аркуша — по внутрішньому.
    const y = baseline(g.textBlock.lines - 1 + FOLIO_ROWS_BELOW);
    if (p.folio) {
      const text = String(p.number);
      const w = measure(text, 'regular', scheme.folio);
      page.drawText(text, { x: recto ? left + blockW - w : left, y, size: scheme.folio, font: embedded.regular, color: BLACK });
    }
    const mark = plan && sheetMark(p.number, plan);
    if (mark) {
      // Номер зошита більшим кеглем, номер аркуша — меншим: I · II не сплутати з II · I.
      let x = left;
      const parts: [string, Pt][] = [[roman(mark.signature), scheme.sheetMark.signature], [' · ', scheme.sheetMark.sheet], [roman(mark.sheet), scheme.sheetMark.sheet]];
      for (const [text, size] of parts) {
        for (const ch of text) {
          page.drawText(ch, { x, y, size, font: embedded.regular, color: BLACK });
          x += measure(ch, 'regular', size) + size * SHEET_MARK_TRACKING;
        }
      }
    }
  }

  return pdf.save();
}
