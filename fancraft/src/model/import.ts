import type { Para } from './types';

// Типографські лапки й тире; м'які переноси прибираються — переноси рахує рушій.
export function cleanText(text: string): string {
  return text
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"([^"]*)"/g, '«$1»')
    .replace(/ -{1,2} /g, ' — ');
}

// Абзаци розділені порожнім рядком; якщо порожніх рядків немає — кожен рядок абзац.
export function importText(text: string): Para[] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const chunks = /\n[ \t]*\n/.test(src) ? src.split(/\n[ \t]*\n/) : src.split('\n');
  return chunks
    .map(cleanText)
    .filter(Boolean)
    .map((t) => ({ type: 'paragraph', runs: [{ text: t }] }));
}
