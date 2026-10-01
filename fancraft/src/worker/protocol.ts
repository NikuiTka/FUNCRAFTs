import type { ChapterLayout, SheetItem } from '../engine/pageMap';
import type { BookStats } from '../engine/stats';
import type { Problem, Warning } from '../model/errors';
import type { Page, Project } from '../model/types';
import type { ExportFile, ExportOptions } from '../pdf/export';

export type WorkerRequest =
  | { id: number; kind: 'stats'; project: Project }
  | { id: number; kind: 'export'; project: Project; options: ExportOptions };

// problem — відома проблема з кодом для словника; без неї message — технічний текст для консолі.
export type WorkerResponse =
  | { id: number; kind: 'stats'; stats: BookStats; ranges: Record<string, [number, number]>; layouts: Record<string, ChapterLayout>; previews: Record<number, Page>; sequence: SheetItem[]; warnings: Warning[] }
  | { id: number; kind: 'export'; files: ExportFile[]; stats: BookStats; warnings: Warning[] }
  | { id: number; kind: 'error'; message: string; problem?: Problem };
