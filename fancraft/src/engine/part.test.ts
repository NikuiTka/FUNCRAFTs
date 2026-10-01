import { describe, expect, it } from 'vitest';
import { partPage } from './part';
import type { Asset, PartBlock } from '../model/types';
import { COVER_PHOTO_RATIO } from '../config';
import { H, L, THIRD, W, WIDE, WIDE_H, WIDE_W, measure, settings } from './testGrid';

const part = (o: Partial<PartBlock> = {}): PartBlock => ({
  id: 'x', type: 'part', title: 'Частина перша', description: 'Короткий опис.', asset: '', ...o,
});
const px = (widthPx: number, heightPx: number): Asset => ({ widthPx, heightPx });
// Як обкладинка: назва на третині, підзаголовок через рядок; квадрат фото посередині між рядком
// підзаголовка й низом смуги, з рівними відступами.
const textBottom = (THIRD + 3) * L;
const side = Math.min(COVER_PHOTO_RATIO * W, H - textBottom - 2 * L);
const zone = { x: (W - side) / 2, y: textBottom + (H - textBottom - side) / 2, width: side, height: side };

describe('partPage', () => {
  it('назва на третині смуги по центру, через рядок — опис жирним; без колонцифри; квадрат фото є й без фото', () => {
    const page = partPage(part(), undefined, settings, measure);
    expect(page).toMatchObject({ kind: 'part', folio: false });
    expect(page.figure).toBeUndefined();
    expect(page.lines.map((l) => [l.role, l.align, l.row])).toEqual([['partTitle', 'center', THIRD], ['body', 'center', THIRD + 2]]);
    expect(page.lines[1].runs).toEqual([{ text: 'Короткий опис.', b: true }]);
    for (const [k, v] of Object.entries(zone)) expect(page.photoZone![k as keyof typeof zone]).toBeCloseTo(v, 6);
  });

  it('з фото назва не рухається; широке фото вписане в квадрат по центру', () => {
    const page = partPage(part({ asset: 'img/img_001.jpg' }), WIDE, settings, measure);
    expect(page.lines.map((l) => l.row)).toEqual([THIRD, THIRD + 2]);
    const f = page.figure!;
    expect(f).toMatchObject({ asset: 'img/img_001.jpg' });
    expect(f.width).toBeLessThanOrEqual(side + 1e-9);
    expect(f.height / f.width).toBeCloseTo(WIDE_H / WIDE_W, 6);
    expect(f.x + f.width / 2).toBeCloseTo(W / 2, 6);
    expect(f.y + f.height / 2).toBeCloseTo(zone.y + side / 2, 6);
  });

  it('високе фото — на всю висоту квадрата, по центру', () => {
    const f = partPage(part({ asset: 'img/img_001.jpg' }), px(1000, 3000), settings, measure).figure!;
    expect(f.height).toBeCloseTo(side, 6);
    expect(f.width).toBeCloseTo(side / 3, 6);
    expect(f.x).toBeCloseTo((W - side / 3) / 2, 6);
  });

  it('без назви й опису — лише фото; порожня частина — порожня сторінка', () => {
    expect(partPage(part({ title: '', description: '', asset: 'a' }), WIDE, settings, measure).lines).toEqual([]);
    expect(partPage(part({ title: ' ', description: '' }), undefined, settings, measure)).toMatchObject({ kind: 'part', lines: [] });
  });
});
