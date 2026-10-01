import { describe, expect, it } from 'vitest';
import { moveBlock, splitByMarkers, splitChapter, withTitle } from './ops';
import type { Block, ChapterBlock, Para } from './types';

const p = (text: string): Para => ({ type: 'paragraph', runs: [{ text }] });
const chapter = (title: string, body: Para[]): ChapterBlock => ({ id: 'a', type: 'chapter', title, body });

describe('splitChapter', () => {
  it('ріже главу перед абзацом; короткий окремий рядок стає назвою другої половини', () => {
    const [a, b] = splitChapter(chapter('Перша', [p('Раз.'), p('День другий'), p('Текст.')]), 1, 'b');
    expect(a).toEqual(chapter('Перша', [p('Раз.')]));
    expect(b).toEqual({ id: 'b', type: 'chapter', title: 'День другий', body: [p('Текст.')] });
  });

  it('звичайне речення — не схоже на назву, але стає нею як перше речення глави', () => {
    const [, b] = splitChapter(chapter('', [p('Раз.'), p('Звичайне речення з крапкою. Далі текст.')]), 1, 'b');
    expect(b.title).toBe('Звичайне речення з крапкою.');
    expect(b.body).toEqual([p('Далі текст.')]);
  });

  it('довгий рядок без крапки стає назвою цілком; абзац іде з тексту', () => {
    const long = 'а'.repeat(61);
    const [, b] = splitChapter(chapter('', [p('Раз.'), p(long), p('Два.')]), 1, 'b');
    expect(b.title).toBe(long);
    expect(b.body).toEqual([p('Два.')]);
  });
});

describe('withTitle', () => {
  it('глава з назвою не змінюється', () => {
    const c = chapter('Назва', [p('Раз. Два.')]);
    expect(withTitle(c)).toBe(c);
  });

  it('перше речення першого непорожнього абзацу — назвою; накреслення решти зберігаються', () => {
    const c = chapter('', [p('  '), { type: 'paragraph', runs: [{ text: 'Книга 1 — Третій шлях! ' }, { text: 'Далі', b: true }, { text: ' текст.' }] }]);
    const t = withTitle(c);
    expect(t.title).toBe('Книга 1 — Третій шлях!');
    expect(t.body).toEqual([p('  '), { type: 'paragraph', runs: [{ text: 'Далі', b: true }, { text: ' текст.' }] }]);
  });

  it('скорочення всередині речення без пробілу після крапки не рвуть назву', () => {
    expect(withTitle(chapter('', [p('Версія 2.5 вийшла. Потім.')])).title).toBe('Версія 2.5 вийшла.');
  });

  it('глава без тексту лишається без назви', () => {
    const c = chapter('', [p('')]);
    expect(withTitle(c)).toBe(c);
  });
});

describe('splitByMarkers', () => {
  it('ріже главу за абзацами ###; назва — після ### або наступний короткий абзац; накреслення зберігаються', () => {
    const bold: Para = { type: 'paragraph', runs: [{ text: 'Раз ' }, { text: 'жирно', b: true }, { text: '.' }] };
    const parts = splitByMarkers(chapter('Перша', [bold, p('### Друга'), p('Два.'), p('###'), p('Третя'), p('Три.')]), () => 'n');
    expect(parts.map((c) => [c.title, c.body])).toEqual([
      ['Перша', [bold]],
      ['Друга', [p('Два.')]],
      ['Третя', [p('Три.')]],
    ]);
    expect(parts[0].id).toBe('a');
  });

  it('без міток — глава без змін', () => {
    const c = chapter('Перша', [p('Раз.')]);
    expect(splitByMarkers(c, () => 'n')).toEqual([c]);
  });
});

describe('moveBlock', () => {
  const blocks = ['a', 'b', 'c'].map((id): Block => ({ id, type: 'toc', title: id }));
  it('пересуває блок на нове місце', () => {
    expect(moveBlock(blocks, 0, 2).map((b) => b.id)).toEqual(['b', 'c', 'a']);
    expect(moveBlock(blocks, 2, 0).map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });
});
