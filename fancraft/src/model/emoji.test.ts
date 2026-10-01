import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { describe, expect, it } from 'vitest';
import { EMOJI_GROUPS, EMOJI_REPLACE } from '../emojiConfig';
import { EMOJI_FONT_FILE } from '../pdf/fontFiles';
import { cleanEmoji, usedEmoji } from './emoji';
import type { Book } from './types';

describe('cleanEmoji', () => {
  it('основні лишаються, варіанти стають основними', () => {
    expect(cleanEmoji('💙 Предисловие')).toBe('❤ Предисловие');
    expect(cleanEmoji('Так 👍🏽 і ❤\uFE0F')).toBe('Так 👍 і ❤');
    expect(cleanEmoji('✅ готово')).toBe('✔ готово');
  });

  it('решта емодзі прибирається разом із зайвим пробілом; рядки не зливаються', () => {
    expect(cleanEmoji('Кінь 🦄 летить')).toBe('Кінь летить');
    expect(cleanEmoji('Сім\'я 👨\u200D👩\u200D👧\nДругий рядок')).toBe('Сім\'я \nДругий рядок');
    expect(cleanEmoji('🦄🦄')).toBe('');
  });

  it('знаки без гліфа ні в IBM Plex Mono, ні в Noto Emoji замінюються, хоч за Unicode вони й не емодзі; ✓ є в Plex — лишається', () => {
    expect(cleanEmoji('★ ☆ ✦ ♪ ♡ ✓')).toBe('⭐ ⭐ ✨ 🎵 ♥ ✓');
  });

  it('типографські знаки — не емодзі', () => {
    const text = '© 2024 FANCRAFTs™ — «лапки», ↔, №5, § 3, … ← →';
    expect(cleanEmoji(text)).toBe(text);
  });
});

describe('usedEmoji', () => {
  it('усі емодзі книжки, найчастіші першими, без селекторів варіанта', () => {
    const book = {
      meta: { title: 'Книжка ☀', author: '', year: '' },
      blocks: [
        { id: 'a', type: 'chapter', title: '❤ Передмова', body: [{ type: 'paragraph', runs: [{ text: 'Раз ❤\uFE0F два 🌸 три ❤' }] }] },
        { id: 'q', type: 'questions', title: '', items: ['Чому 🌸?'], url: '', note: '' },
      ],
    } as unknown as Book;
    expect(usedEmoji(book)).toEqual(['❤', '🌸', '☀']);
  });
});

describe('emojiConfig', () => {
  const font = fontkit.create(new Uint8Array(readFileSync(resolve('node_modules', EMOJI_FONT_FILE))));
  const allowed = EMOJI_GROUPS.flatMap((g) => g.emoji);

  it('кожен основний знак є в шрифті Noto Emoji і не повторюється', () => {
    for (const e of allowed) expect(font.layout(e).glyphs.every((g) => g.id !== 0), e).toBe(true);
    expect(new Set(allowed).size).toBe(allowed.length);
  });

  it('заміни ведуть лише на основні знаки й не перекривають їх', () => {
    for (const [from, to] of Object.entries(EMOJI_REPLACE)) {
      expect(allowed, `${from} → ${to}`).toContain(to);
      expect(allowed, from).not.toContain(from);
    }
  });
});
