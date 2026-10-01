import fontkit from '@pdf-lib/fontkit';
import type { Face, Measure, Pt } from '../model/types';
import { FACES, type FontFaces } from './fontFiles';

export { EMOJI_FONT_FILE, FACES, FONT_FILES, padFont, type FontFaces } from './fontFiles';

type Font = ReturnType<typeof fontkit.create>;

export interface Segment {
  text: string;
  // true — малюється запасним шрифтом емодзі.
  emoji: boolean;
}

const VS15 = 0xfe0e;
const VS16 = 0xfe0f;
const ZWJ = 0x200d;
// Частини емодзі-послідовності, які самі нічого не значать: тон шкіри, keycap, теги прапорів.
const isJoiner = (cp: number) => (cp >= 0x1f3fb && cp <= 0x1f3ff) || cp === 0x20e3 || (cp >= 0xe0020 && cp <= 0xe007f);

// Ділить текст між основним шрифтом і запасним. Знак іде в запасний, лише коли в основному його
// немає, а в запасному є. Селектори варіанта, тони шкіри й ZWJ-послідовності лишаються в одному
// фрагменті з емодзі — запасний шрифт складає з них один гліф. Після знака основного шрифту
// селектор варіанта відкидається: він невидимий, а гліфа для нього в гарнітурі немає.
export function splitByFont(text: string, main: (cp: number) => boolean, fallback: ((cp: number) => boolean) | null): Segment[] {
  if (!fallback) return [{ text: text.replace(/[\uFE0E\uFE0F]/g, ''), emoji: false }];
  const out: Segment[] = [];
  let afterZwj = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const last = out.at(-1);
    const attach: boolean = !!last?.emoji && (cp === VS15 || cp === VS16 || cp === ZWJ || isJoiner(cp) || afterZwj);
    afterZwj = attach && cp === ZWJ;
    if (!attach && (cp === VS15 || cp === VS16)) continue;
    const emoji = attach || (!main(cp) && fallback(cp));
    if (last && last.emoji === emoji) last.text += ch;
    else out.push({ text: ch, emoji });
  }
  return out;
}

export interface Shaper {
  segments: (text: string, face: Face) => Segment[];
  // Знак є в гарнітурі чи в запасному шрифті емодзі; ні — у PDF надрукується порожнім квадратиком.
  covers: (cp: number) => boolean;
  // Ширина в кеглях (частках em), з урахуванням запасного шрифту.
  width: (text: string, face: Face) => number;
}

export function createShaper(fonts: FontFaces): Shaper {
  const parsed = Object.fromEntries(FACES.map((face) => [face, fontkit.create(fonts[face])])) as Record<Face, Font>;
  const emoji = fonts.emoji ? fontkit.create(fonts.emoji) : null;
  const units = (font: Font, text: string) => font.layout(text).glyphs.reduce((w, g) => w + g.advanceWidth, 0) / font.unitsPerEm;
  const segments = (text: string, face: Face) =>
    splitByFont(text, (cp) => parsed[face].hasGlyphForCodePoint(cp), emoji && ((cp) => emoji.hasGlyphForCodePoint(cp)));
  const cache = new Map<string, number>();
  return {
    segments,
    covers: (cp) => parsed.regular.hasGlyphForCodePoint(cp) || !!emoji?.hasGlyphForCodePoint(cp),
    width: (text, face) => {
      const key = `${face}\u0000${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        w = segments(text, face).reduce((s, seg) => s + units(seg.emoji ? emoji! : parsed[face], seg.text), 0);
        cache.set(key, w);
      }
      return w;
    },
  };
}

// Сума ширин гліфів — саме те, що pdf-lib потім малює (без кернінгу).
export function createMeasure(fonts: FontFaces): Measure {
  const { width } = createShaper(fonts);
  return (text, face, size) => (width(text, face) * size) as Pt;
}
