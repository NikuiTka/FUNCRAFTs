import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createMeasure, EMOJI_FONT_FILE, FACES, FONT_FILES, padFont, splitByFont, type FontFaces } from './fonts';

const read = (path: string) => padFont(new Uint8Array(readFileSync(resolve('node_modules', path))));
const fonts = { ...Object.fromEntries(FACES.map((f) => [f, read(FONT_FILES[f])])), emoji: read(EMOJI_FONT_FILE) } as FontFaces;

describe('splitByFont', () => {
  // Основний шрифт знає лише латиницю й пробіл; запасний — усе, крім латиниці.
  const main = (cp: number) => cp < 0x80;
  const fallback = (cp: number) => cp >= 0x80;

  it('емодзі — окремим фрагментом, решта — основним шрифтом', () => {
    expect(splitByFont('a ❤ b', main, fallback)).toEqual([{ text: 'a ', emoji: false }, { text: '❤', emoji: true }, { text: ' b', emoji: false }]);
  });

  it('селектор варіанта, тон шкіри, ZWJ-послідовність і прапор лишаються в одному фрагменті', () => {
    expect(splitByFont('❤\uFE0F👍🏽👨\u200D👩\u200D👧🇺🇦x', main, fallback)).toEqual([
      { text: '❤\uFE0F👍🏽👨\u200D👩\u200D👧🇺🇦', emoji: true }, { text: 'x', emoji: false },
    ]);
  });

  it('селектор варіанта після знака основного шрифту відкидається', () => {
    expect(splitByFont('a\uFE0Fb', main, fallback)).toEqual([{ text: 'ab', emoji: false }]);
  });

  it('без запасного шрифту — усе основним', () => {
    expect(splitByFont('a❤b', main, null)).toEqual([{ text: 'a❤b', emoji: false }]);
  });
});

describe('createMeasure з емодзі', () => {
  it('ширина емодзі — з Noto Emoji (2600 / 2048 кегля)', () => {
    const measure = createMeasure(fonts);
    expect(measure('❤', 'regular', 10 as never)).toBeCloseTo((2600 / 2048) * 10, 5);
    expect(measure('a❤', 'regular', 10 as never)).toBeCloseTo(measure('a', 'regular', 10 as never) + (2600 / 2048) * 10, 5);
  });
});
