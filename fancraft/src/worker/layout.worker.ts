/// <reference lib="webworker" />
// Важкі обчислення поза інтерфейсом: верстка для статистики й повний експорт.
import { loadFonts } from '../app/fonts';
import { AppError } from '../model/errors';
import type { Project } from '../model/types';
import { exportBook, type ExportOptions } from '../pdf/export';
import { layoutBook } from '../pdf/layoutBook';
import type { WorkerRequest, WorkerResponse } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  const reply = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);
  try {
    const project: Project = data.project;
    const fonts = await loadFonts();
    if (data.kind === 'stats') {
      const { stats, ranges, layouts, previews, sequence, warnings } = layoutBook(project, fonts);
      reply({ id: data.id, kind: 'stats', stats, ranges, layouts, previews, sequence, warnings });
    } else {
      const { files, stats, warnings } = await exportBook(project, fonts, data.options as ExportOptions);
      reply({ id: data.id, kind: 'export', files, stats, warnings }, files.map((f) => f.bytes.buffer as ArrayBuffer));
    }
  } catch (e) {
    reply({ id: data.id, kind: 'error', message: e instanceof Error ? e.message : String(e), ...(e instanceof AppError && { problem: e.problem }) });
  }
};
