import { SHEETS } from '../config';
import { assemblyLines } from '../engine/assembly';
import { bookText, colorSheetNumbers, type BookStats } from '../engine/stats';
import type { Warning } from '../model/errors';
import type { Project } from '../model/types';
import { renderAssemblySheet } from './assemblySheet';
import type { FontFaces } from './fonts';
import { imposeSides } from './impose';
import { printJobs, type PrintOptions } from './jobs';
import { layoutBook } from './layoutBook';
import { renderBook } from './renderBook';

export interface ExportOptions extends PrintOptions {
  // Чернетка: спуск вимкнено, сторінки в порядку читання, без римських позначок.
  draft: boolean;
  // Складальний аркуш — окремий PDF поза книжкою; мова його тексту.
  assembly?: boolean;
  lang?: 'uk' | 'en';
}

export interface ExportFile {
  name: string;
  bytes: Uint8Array;
}

// Експорт ніколи не зупиняється через зміст книжки: що не так — повертається попередженнями.
export async function exportBook(project: Project, fonts: FontFaces, opts: ExportOptions): Promise<{ files: ExportFile[]; stats: BookStats; warnings: Warning[] }> {
  const { book } = project;
  const { pages, plan, stats, warnings } = layoutBook(project, fonts);

  const text: ExportFile = { name: 'book.txt', bytes: new TextEncoder().encode(bookText(book)) };

  if (opts.draft) {
    const reading = pages.slice(0, stats.pages);
    const pdf = await renderBook({ pages: reading, settings: book.settings, fonts, files: project.files, plan: null, warnings });
    return { files: [{ name: 'book-draft.pdf', bytes: pdf }, text], stats, warnings };
  }

  const pdf = await renderBook({ pages, settings: book.settings, fonts, files: project.files, plan, warnings });
  const sheet = SHEETS[book.settings.sheet];
  const files: ExportFile[] = [];
  if (opts.assembly) {
    const lines = assemblyLines(stats, book.settings, colorSheetNumbers(pages, plan), opts.lang ?? 'uk');
    files.push({ name: 'assembly.pdf', bytes: await renderAssemblySheet(lines, fonts) });
  }
  for (const job of printJobs(pages, plan, opts)) {
    files.push({ name: job.name, bytes: await imposeSides(pdf, sheet, job.sides) });
  }
  return { files: [...files, text], stats, warnings };
}
