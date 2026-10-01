import type { ChapterLayout, SheetItem } from '../engine/pageMap';
import type { BookStats } from '../engine/stats';
import { AppError, type Warning } from '../model/errors';
import type { Page, Project } from '../model/types';
import type { ExportFile, ExportOptions } from '../pdf/export';
import type { WorkerRequest, WorkerResponse } from './protocol';

type RequestBody = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void }>();

// Воркер упав цілком (наприклад, не завантажився модуль) — відхиляємо всі запити й створимо новий наступного разу.
function fail(message: string) {
  for (const { reject } of pending.values()) reject(new Error(message));
  pending.clear();
  worker?.terminate();
  worker = null;
}

function call(request: RequestBody): Promise<WorkerResponse> {
  if (!worker) {
    worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      pending.get(data.id)?.resolve(data);
      pending.delete(data.id);
    };
    worker.onerror = (e) => { e.preventDefault(); fail(e.message || 'layout worker failed to start'); };
    worker.onmessageerror = () => fail('layout worker returned corrupted data');
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ ...request, id });
  });
}

const unwrap = <K extends WorkerResponse['kind']>(r: WorkerResponse, kind: K): Extract<WorkerResponse, { kind: K }> => {
  if (r.kind === 'error') throw r.problem ? new AppError(r.problem) : new Error(r.message);
  if (r.kind !== kind) throw new Error(`unexpected worker reply: ${r.kind}`);
  return r as Extract<WorkerResponse, { kind: K }>;
};

// Статистиці байти зображень не потрібні — лише розміри з assets.
export async function statsInWorker(project: Project): Promise<{
  stats: BookStats; ranges: Record<string, [number, number]>; layouts: Record<string, ChapterLayout>;
  previews: Record<number, Page>; sequence: SheetItem[]; warnings: Warning[];
}> {
  const r = unwrap(await call({ kind: 'stats', project: { book: project.book, files: {} } }), 'stats');
  return { stats: r.stats, ranges: r.ranges, layouts: r.layouts, previews: r.previews, sequence: r.sequence, warnings: r.warnings };
}

export async function exportInWorker(project: Project, options: ExportOptions): Promise<{ files: ExportFile[]; stats: BookStats; warnings: Warning[] }> {
  const r = unwrap(await call({ kind: 'export', project, options }), 'export');
  return { files: r.files, stats: r.stats, warnings: r.warnings };
}
