import { describe, expect, it } from 'vitest';
import { importText } from './import';

const texts = (s: string) => importText(s).map((p) => p.runs[0].text);

describe('importText', () => {
  it('абзаци розділені порожнім рядком; переноси рядків усередині — пробіли', () => {
    expect(texts('Перший\nрядок.\n\nДругий абзац.\n\n\nТретій.')).toEqual(['Перший рядок.', 'Другий абзац.', 'Третій.']);
  });

  it('без порожніх рядків кожен рядок — абзац', () => {
    expect(texts('Один.\nДва.\nТри.')).toEqual(['Один.', 'Два.', 'Три.']);
  });

  it('Windows-переноси, BOM, табуляції, зайві пробіли', () => {
    expect(texts('﻿  Один   два. \r\n\r\n\tТри.\r\n')).toEqual(['Один два.', 'Три.']);
  });

  it('м\'які переноси прибираються — переноси рахує рушій', () => {
    expect(texts('пере­нос')).toEqual(['перенос']);
  });

  it('прямі лапки — ялинки, дефіс між пробілами — тире', () => {
    expect(texts('Він сказав "так" - і пішов -- далі.')).toEqual(['Він сказав «так» — і пішов — далі.']);
  });

  it('усі блоки — абзаци; порожній текст — нічого', () => {
    expect(importText('А\n\nБ').every((p) => p.type === 'paragraph')).toBe(true);
    expect(importText(' \n\n ')).toEqual([]);
  });
});
