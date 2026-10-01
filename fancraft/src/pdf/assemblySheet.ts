import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import type { FontFaces } from './fonts';

const PT_PER_MM = 72 / 25.4;
const A4 = { width: 210 * PT_PER_MM, height: 297 * PT_PER_MM };
const MARGIN = 20 * PT_PER_MM;
const SIZE = 11;
const TITLE_SIZE = 16;
const LEADING = SIZE * 1.5;

// Складальний аркуш — одна сторінка A4 поза книжкою; перший рядок — заголовок.
export async function renderAssemblySheet(lines: string[], fonts: FontFaces): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const page = pdf.addPage([A4.width, A4.height]);
  const width = A4.width - 2 * MARGIN;

  let y = A4.height - MARGIN - TITLE_SIZE;
  lines.forEach((text, i) => {
    const font = i === 0 ? bold : regular;
    const size = i === 0 ? TITLE_SIZE : SIZE;
    // Довгі рядки переносяться по словах у межах поля.
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        page.drawText(line, { x: MARGIN, y, size, font, color: rgb(0, 0, 0) });
        y -= LEADING;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) page.drawText(line, { x: MARGIN, y, size, font, color: rgb(0, 0, 0) });
    y -= i === 0 ? TITLE_SIZE : LEADING;
  });
  return pdf.save();
}
