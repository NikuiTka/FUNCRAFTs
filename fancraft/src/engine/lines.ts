import { BOLD_ROLES, type Align, type Face, type Line, type Measure, type Mm, type Pt, type Run, type TextRole } from '../model/types';

const PT_PER_MM = 72 / 25.4;

export interface BreakOptions {
  width: Mm;
  indent: Mm;
  size: Pt;
  align: Align;
  role: TextRole;
}

interface Style { b: boolean; i: boolean; s: boolean }
interface Piece { text: string; style: Style }
// Слово може складатися з кількох фрагментів різного накреслення: сло**во**.
type Word = Piece[];

const styleOf = (r: Run): Style => ({ b: !!r.b, i: !!r.i, s: !!r.s });
const faceOf = (s: Style): Face => (s.b ? (s.i ? 'boldItalic' : 'bold') : s.i ? 'italic' : 'regular');
const sameStyle = (a: Style, b: Style) => a.b === b.b && a.i === b.i && a.s === b.s;
// Пробіл між словами бере лише спільне для обох сусідів накреслення.
const commonStyle = (a: Style, b: Style): Style => ({ b: a.b && b.b, i: a.i && b.i, s: a.s && b.s });

function toWords(runs: Run[]): Word[] {
  const words: Word[] = [];
  let word: Word = [];
  for (const run of runs) {
    const style = styleOf(run);
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (word.length) { words.push(word); word = []; }
      } else {
        word.push({ text: part, style });
      }
    }
  }
  if (word.length) words.push(word);
  return words;
}

function toRuns(words: Word[]): Run[] {
  const pieces: Piece[] = [];
  words.forEach((word, i) => {
    if (i > 0) pieces.push({ text: ' ', style: commonStyle(words[i - 1].at(-1)!.style, word[0].style) });
    pieces.push(...word);
  });

  const merged: Piece[] = [];
  for (const p of pieces) {
    const last = merged.at(-1);
    if (last && sameStyle(last.style, p.style)) last.text += p.text;
    else merged.push({ ...p });
  }

  return merged.map(({ text, style }) => ({
    text,
    ...(style.b && { b: true }),
    ...(style.i && { i: true }),
    ...(style.s && { s: true }),
  }));
}

// Рядки одного абзацу, без вертикальних позицій. Розрив — лише між словами.
// Назви (BOLD_ROLES) — жирні: так і міряються, і друкуються.
export function breakLines(source: Run[], opts: BreakOptions, measure: Measure): Omit<Line, 'row'>[] {
  const runs = BOLD_ROLES.has(opts.role) ? source.map((r) => ({ ...r, b: true })) : source;
  const { size } = opts;
  const width = opts.width * PT_PER_MM;
  const indent = opts.indent * PT_PER_MM;
  const wordWidth = (w: Word) => w.reduce((sum, p) => sum + measure(p.text, faceOf(p.style), size), 0);
  const spaceWidth = (a: Word, b: Word) => measure(' ', faceOf(commonStyle(a.at(-1)!.style, b[0].style)), size);

  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const word of toWords(runs)) {
    const w = wordWidth(word);
    if (!line.length) {
      // Задовге слово все одно стає в рядок — сам-один.
      line = [word];
      lineWidth = w;
      continue;
    }
    const avail = width - (lines.length === 0 ? indent : 0);
    const next = lineWidth + spaceWidth(line.at(-1)!, word) + w;
    if (next <= avail + 1e-9) {
      line.push(word);
      lineWidth = next;
    } else {
      lines.push(line);
      line = [word];
      lineWidth = w;
    }
  }
  if (line.length) lines.push(line);

  return lines.map((words, i) => ({
    runs: toRuns(words),
    indent: (i === 0 ? opts.indent : 0) as Mm,
    align: opts.align === 'justify' && i === lines.length - 1 ? 'left' : opts.align,
    role: opts.role,
  }));
}
