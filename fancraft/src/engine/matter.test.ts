import { describe, expect, it } from 'vitest';
import { colophonPage, titlePage } from './matter';
import { COVER_PHOTO_RATIO } from '../config';
import type { Meta, Mm } from '../model/types';
import { COVER_AUTHOR_GAP, COVER_QR_SIZE, L, ROWS, THIRD, W, WIDE, WIDE_H, WIDE_W, measure, settings } from './testGrid';

const meta: Meta = { title: 'Книжка', author: 'Авторка', year: '2026' };
const text = (l: { runs: { text: string }[] }) => l.runs.map((r) => r.text).join('');

describe('титул', () => {
  it('автор жирним угорі смуги, назва на третині смуги; рік і копірайт на обкладинці не друкуються', () => {
    const page = titlePage(meta, settings, measure);
    expect(page).toMatchObject({ kind: 'title', folio: false });
    expect(page.lines.map((l) => [text(l), l.role, l.row])).toEqual([
      ['Авторка', 'body', COVER_AUTHOR_GAP], ['Книжка', 'chapterTitle', THIRD],
    ]);
    expect(page.lines.every((l) => l.align === 'center')).toBe(true);
    expect(page.lines[0].runs).toEqual([{ text: 'Авторка', b: true }]);
  });

  it('порожні поля пропускаються', () => {
    const page = titlePage({ title: 'Книжка', author: '', year: '' }, settings, measure);
    expect(page.lines.map(text)).toEqual(['Книжка']);
  });

  it('підзаголовок — через рядок під назвою, жирним, по центру', () => {
    const page = titlePage({ ...meta, description: 'Про папір.' }, settings, measure);
    expect(page.lines.map((l) => [text(l), l.row])).toEqual([['Авторка', COVER_AUTHOR_GAP], ['Книжка', THIRD], ['Про папір.', THIRD + 2]]);
    expect(page.lines[2].runs).toEqual([{ text: 'Про папір.', b: true }]);
  });
});

describe('обкладинка: назва на своєму місці, квадрат фото між підзаголовком і QR, місце QR унизу завжди', () => {
  const photo = { 'img/img_001.jpg': WIDE };
  const cover = (o: object = {}) => ({ qr: null, photo: 'img/img_001.jpg', ...o });
  // Квадрат фото — посередині між рядком підзаголовка (THIRD + 2) і місцем QR, з рівними відступами.
  const textBottom = (THIRD + 3) * L;
  const space = ROWS * L - COVER_QR_SIZE - textBottom;
  const side = Math.min(COVER_PHOTO_RATIO * W, space - 2 * L);
  const zone = { x: (W - side) / 2, y: textBottom + (space - side) / 2, width: side, height: side };
  const close = (o: object) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, expect.closeTo(v as number, 6)]));

  it('місце фото — квадрат по центру, з рівними відступами від підзаголовка й від QR; є й без фото', () => {
    const page = titlePage({ ...meta, description: 'Опис.' }, settings, measure);
    expect(page.photoZone).toEqual(close(zone));
    expect(side).toBeGreaterThan(0);
  });

  it('рядок підзаголовка резервується: без підзаголовка квадрат там само', () => {
    expect(titlePage(meta, settings, measure).photoZone).toEqual(titlePage({ ...meta, description: 'Опис.' }, settings, measure).photoZone);
  });

  it('з фото назва не рухається; широке фото вписане в квадрат по центру зі своїми пропорціями', () => {
    const page = titlePage({ ...meta, description: 'Опис.' }, settings, measure, cover(), photo);
    expect(page.lines.map((l) => [text(l), l.row])).toEqual([['Авторка', COVER_AUTHOR_GAP], ['Книжка', THIRD], ['Опис.', THIRD + 2]]);
    const f = page.figure!;
    expect(f.width).toBeLessThanOrEqual(side + 1e-9);
    expect(f.height).toBeLessThanOrEqual(side + 1e-9);
    expect(f.height / f.width).toBeCloseTo(WIDE_H / WIDE_W, 6);
    expect(f.x + f.width / 2).toBeCloseTo(zone.x + side / 2, 6);
    expect(f.y + f.height / 2).toBeCloseTo(zone.y + side / 2, 6);
  });

  it('без автора з фото назва — теж на третині смуги', () => {
    const page = titlePage({ ...meta, author: '' }, settings, measure, cover(), photo);
    expect(page.lines.map((l) => [text(l), l.row])).toEqual([['Книжка', THIRD]]);
  });

  it('високе фото — на всю висоту квадрата, по центру', () => {
    const tall = { 'img/img_001.jpg': { widthPx: 1000, heightPx: 3000 } };
    const f = titlePage({ ...meta, description: 'Опис.' }, settings, measure, cover(), tall).figure!;
    expect(f.y).toBeCloseTo(zone.y, 6);
    expect(f.height).toBeCloseTo(side, 6);
    expect(f.x + f.width / 2).toBeCloseTo(W / 2, 6);
  });

  it('QR книжки — по центру внизу смуги, розмір з конфігу (не з .book); фото — через рядок над QR', () => {
    const page = titlePage({ ...meta, description: 'Опис.' }, settings, measure, cover({ qr: { url: 'https://x', size: 99 as Mm } }), photo);
    expect(page.qr).toEqual({ url: 'https://x', size: COVER_QR_SIZE, x: expect.closeTo((W - COVER_QR_SIZE) / 2, 6), y: expect.closeTo(ROWS * L - COVER_QR_SIZE, 6) });
    expect(page.figure!.y + page.figure!.height).toBeLessThanOrEqual(page.qr!.y - L + 1e-9);
  });

  it('без посилання QR немає, а фото стоїть так само, як з QR (місце QR зарезервоване)', () => {
    const withQr = titlePage({ ...meta, description: 'Опис.' }, settings, measure, cover({ qr: { url: 'https://x', size: 20 as Mm } }), photo);
    const without = titlePage({ ...meta, description: 'Опис.' }, settings, measure, cover({ qr: { url: ' ', size: 20 as Mm } }), photo);
    expect(without.qr).toBeUndefined();
    expect(without.figure).toEqual(withQr.figure);
  });

  it('фото без розмірів — титул як без фото', () => {
    const page = titlePage(meta, settings, measure, cover({ photo: 'img/nope.jpg' }), {});
    expect(page.figure).toBeUndefined();
    expect(page.lines.find((l) => l.field === 'title')!.row).toBe(THIRD);
  });
});

describe('колофон', () => {
  it('назва, автор, © рік — унизу смуги, по лівому краю, в останніх рядках', () => {
    const page = colophonPage(meta, settings, measure);
    expect(page).toMatchObject({ kind: 'colophon', folio: false });
    expect(page.lines.map((l) => [text(l), l.row, l.align])).toEqual([
      ['Книжка', ROWS - 4, 'left'], ['Авторка', ROWS - 2.5, 'left'], ['© 2026', ROWS - 1, 'left'],
    ]);
  });

  it('текст угорі — з першого рядка, абзацами; порожній рядок лишається; не заходить на поля', () => {
    const page = colophonPage({ ...meta, colophon: 'Перший\n\nДругий' }, settings, measure);
    expect(page.lines.filter((l) => l.field === 'note').map((l) => [text(l), l.row])).toEqual([['Перший', 0], ['', 1], ['Другий', 2]]);
    const long = colophonPage({ ...meta, colophon: Array.from({ length: ROWS }, (_, i) => `р${i}`).join('\n') }, settings, measure);
    const title = long.lines.find((l) => l.field === 'title')!.row;
    expect(Math.max(...long.lines.filter((l) => l.field === 'note').map((l) => l.row))).toBeLessThan(title - 1);
  });

  it('знак копірайту, уписаний у рік, не подвоюється', () => {
    expect(colophonPage({ ...meta, year: '©2026' }, settings, measure).lines.at(-1)!.runs).toEqual([{ text: '© 2026' }]);
  });
});
