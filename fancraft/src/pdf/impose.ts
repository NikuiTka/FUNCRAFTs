import { PDFDocument, degrees } from 'pdf-lib';
import type { Mm } from '../model/types';

const PT_PER_MM = 72 / 25.4;

// Один бік аркуша: [ліва смуга, права смуга]. null — порожня смуга.
export type Side = [number | null, number | null];

// Порядок для шитих зошитів за планом (аркушів у кожному зошиті). Сторінки з 1.
// Аркуш i зошита з N сторінок: лице [N − 2i, 1 + 2i], зворот [2 + 2i, N − 1 − 2i].
export function bookletOrder(pageCount: number, plan: number[]): Side[] {
  const capacity = plan.reduce((s, n) => s + n * 4, 0);
  if (pageCount > capacity) throw new RangeError(`${pageCount} сторінок не влазять у зошити на ${capacity}`);

  const sides: Side[] = [];
  let start = 0;
  for (const sheets of plan) {
    const n = sheets * 4;
    const page = (i: number) => (start + i < pageCount ? start + i + 1 : null);
    for (let k = 0; k < n / 2; k++) {
      const outer = page(n - 1 - k);
      const inner = page(k);
      sides.push(k % 2 === 0 ? [outer, inner] : [inner, outer]);
    }
    start += n;
  }
  return sides;
}

export interface PlacedSide {
  side: Side;
  // Зворот, повернутий на 180°, — для двопрохідного друку з тумблером.
  rotate: boolean;
}

// Кладе сторінки на аркуші як є (embedPage). Смуги стикуються на лінії згину посередині аркуша.
export async function imposeSides(pdfBytes: Uint8Array, sheet: { width: Mm; height: Mm }, sides: PlacedSide[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(pdfBytes);
  const out = await PDFDocument.create();
  // Порожня сторінка не має вмісту — її не вкладаємо, на аркуші лишається порожня смуга.
  const embedded = await Promise.all(src.getPages().map((p) => (p.node.Contents() ? out.embedPage(p) : null)));

  const W = sheet.width * PT_PER_MM;
  const H = sheet.height * PT_PER_MM;

  for (const { side, rotate } of sides) {
    const page = out.addPage([W, H]);
    side.forEach((n, slot) => {
      const p = n === null ? null : embedded[n - 1];
      if (!p) return;
      const x = slot === 0 ? W / 2 - p.width : W / 2;
      const y = (H - p.height) / 2;
      if (rotate) {
        // Поворот навколо (x, y): ставимо в дзеркальну позицію відносно центру аркуша.
        page.drawPage(p, { x: W - x, y: H - y, rotate: degrees(180) });
      } else {
        page.drawPage(p, { x, y });
      }
    });
  }

  return out.save();
}

// Дуплекс: лице й зворот кожного аркуша по черзі, без поворотів.
export async function impose(pdfBytes: Uint8Array, sheet: { width: Mm; height: Mm }, plan: number[]): Promise<Uint8Array> {
  const count = (await PDFDocument.load(pdfBytes)).getPageCount();
  return imposeSides(pdfBytes, sheet, bookletOrder(count, plan).map((side) => ({ side, rotate: false })));
}
