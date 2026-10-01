import { COLOPHON_FIELD_GAP, COVER_AUTHOR_GAP, COVER_PHOTO_RATIO, COVER_QR_SIZE, COVER_TITLE_BEFORE, SCHEMES } from '../config';
import type { Asset, Cover, Figure, Line, Lines, Measure, Meta, Mm, Page, PlacedQr, Settings, TextField } from '../model/types';
import { geometry, rowsFor } from './geometry';
import { breakLines } from './lines';
import { fitPhoto } from './part';

const MM_PER_PT = 25.4 / 72;

// Обкладинка — завжди перша сторінка. Згори вниз: автор жирним угорі смуги (з відривом
// COVER_AUTHOR_GAP), назва на третині смуги, підзаголовок жирним, під ними квадрат фото, унизу смуги —
// QR книжки по центру. Рік і копірайт на обкладинці не друкуються — лише на колофоні.
// Назва стоїть на своєму місці незалежно від фото. Квадрат фото (COVER_PHOTO_RATIO ширини смуги) —
// посередині між підзаголовком і QR, з рівними відступами; рядок підзаголовка резервується й без
// нього, тож квадрат не стрибає. Місце QR резервується завжди (є посилання чи ні) — фото в PDF стоїть
// там само, де на екрані. Фото вписується в квадрат зі своїми пропорціями, по центру.
export function titlePage(
  meta: Meta, settings: Settings, measure: Measure,
  cover: Cover = { qr: null }, assets: Record<string, Asset> = {},
): Omit<Page, 'number'> {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const width = g.textBlock.width;
  const L = g.leading * MM_PER_PT;
  const opts = { width, indent: 0 as Mm, align: 'center' as const };

  const tag = (field: TextField) => (lines: Omit<Line, 'row'>[]) => lines.map((line) => ({ ...line, field }));
  const titleRows = rowsFor(scheme.chapterTitle.size, g.leading);
  const title = tag('title')(meta.title.trim() ? breakLines([{ text: meta.title }], { ...opts, size: scheme.chapterTitle.size, role: 'chapterTitle' }, measure) : []);
  const author = tag('author')(meta.author.trim() ? breakLines([{ text: meta.author, b: true }], { ...opts, size: scheme.body, role: 'body' }, measure) : []);
  const description = tag('description')(meta.description?.trim()
    ? breakLines([{ text: meta.description.trim(), b: true }], { ...opts, size: scheme.body, role: 'body' }, measure)
    : []);

  // Низ сторінки: QR унизу смуги; його місце зарезервоване й без посилання.
  const bottom = g.textBlock.lines * L - COVER_QR_SIZE;
  const qr: PlacedQr | undefined = cover.qr?.url.trim()
    ? { url: cover.qr.url, size: COVER_QR_SIZE, x: ((width - COVER_QR_SIZE) / 2) as Mm, y: bottom as Mm }
    : undefined;

  const photo = cover.photo ? assets[cover.photo] : undefined;
  const lines: Line[] = [];
  // Автор — угорі смуги, прив'язаний до її верху.
  author.forEach((line, i) => lines.push({ ...line, align: 'center', row: (COVER_AUTHOR_GAP + i) as Lines }));
  const afterAuthor = author.length ? COVER_AUTHOR_GAP + author.length : 0;
  // row — базова лінія першого рядка назви (з пропуском COVER_TITLE_BEFORE); далі опис через рядок.
  const titleTop = Math.max(Math.floor(g.textBlock.lines / 3) - titleRows + 1, afterAuthor + COVER_TITLE_BEFORE - 1);
  let row = titleTop + titleRows - 1;
  title.forEach((line, i) => lines.push({ ...line, align: 'center', row: (row + i * titleRows) as Lines }));
  if (title.length) row += (title.length - 1) * titleRows + 2;
  const subtitleFirst = row;
  for (const line of description) lines.push({ ...line, align: 'center', row: (row++) as Lines });
  // Низ тексту — з рядком підзаголовка, навіть коли його немає: квадрат фото від нього не стрибає.
  const textBottom = Math.max(row, subtitleFirst + 1) * L;

  // Квадрат фото — посередині між текстом і QR, з рівними відступами (не менше рядка).
  const space = bottom - textBottom;
  const side = Math.max(0, Math.min(COVER_PHOTO_RATIO * width, space - 2 * L));
  const photoZone = { x: ((width - side) / 2) as Mm, y: (textBottom + (space - side) / 2) as Mm, width: side as Mm, height: side as Mm };

  // Фото вписується в квадрат зі своїми пропорціями, по центру.
  let figure: Figure | undefined;
  if (cover.photo && photo && side > 0) {
    const fit = fitPhoto(photo, cover.photo, side, 0, side);
    figure = { ...fit, x: (photoZone.x + (side - fit.width) / 2) as Mm, y: (photoZone.y + (side - fit.height) / 2) as Mm };
  }

  const text = lines.filter((l) => l.row < Math.floor(bottom / L + 1e-9));
  return { kind: 'title', folio: false, lines: text, ...(side > 0 && { photoZone }), ...(qr && { qr }), ...(figure && { figure }) };
}

// Рік друкується копірайтом: «© 2026». Знак, уписаний людиною, не подвоюється.
export const copyright = (year: string) => {
  const y = year.trim().replace(/^©\s*/, '');
  return y ? `© ${y}` : '';
};

// Колофон: назва, автор, © рік — притиснуті до низу смуги, по лівому краю, між полями — відступ
// COLOPHON_FIELD_GAP. Угорі смуги — довільний текст (meta.colophon): абзаци з нового рядка, порожній
// рядок лишається; що не влазить над полями (з порожнім рядком між ними), — не друкується.
export function colophonPage(meta: Meta, settings: Settings, measure: Measure): Omit<Page, 'number'> {
  const g = geometry(settings);
  const scheme = SCHEMES[settings.scheme];
  const opts = { width: g.textBlock.width, indent: 0 as Mm, size: scheme.body, align: 'left' as const, role: 'body' as const };
  const fields: [TextField, string][] = [['title', meta.title], ['author', meta.author], ['year', copyright(meta.year)]];
  const groups = fields
    .map(([field, text]) => [field, text.trim()] as const)
    .filter(([, text]) => text)
    .map(([field, text]) => breakLines([{ text }], opts, measure).map((line) => ({ ...line, field })));
  const lines: Line[] = [];
  let row = g.textBlock.lines - 1;
  for (const group of [...groups].reverse()) {
    for (const line of [...group].reverse()) lines.unshift({ ...line, row: (row--) as Lines });
    row -= COLOPHON_FIELD_GAP;
  }
  const top = lines.length ? lines[0].row - 1 : g.textBlock.lines;
  const note = (meta.colophon ?? '').replace(/\s+$/, '').split('\n')
    .flatMap((p) => (p.trim() ? breakLines([{ text: p.trim() }], opts, measure) : [{ runs: [{ text: '' }], indent: 0 as Mm, align: 'left' as const, role: 'body' as const }]))
    .map((line, i) => ({ ...line, field: 'note' as const, row: i as Lines }))
    .filter((line) => line.row < top);
  return { kind: 'colophon', folio: false, lines: [...(meta.colophon?.trim() ? note : []), ...lines] };
}
