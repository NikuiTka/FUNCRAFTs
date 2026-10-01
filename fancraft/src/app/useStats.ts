import { useEffect, useState } from 'react';
import type { ChapterLayout, SheetItem } from '../engine/pageMap';
import type { BookStats } from '../engine/stats';
import type { Warning } from '../model/errors';
import type { Page, Project } from '../model/types';
import { statsInWorker } from '../worker/client';

const DEBOUNCE_MS = 300;

type Ranges = Record<string, [number, number]>;
type Layouts = Record<string, ChapterLayout>;
type Previews = Record<number, Page>;
interface Result {
  project: Project; stats: BookStats | null; ranges: Ranges; layouts: Layouts; previews: Previews; sequence: SheetItem[]; warnings: Warning[]; error: unknown;
}

// Статистика книжки після кожної зміни — у воркері, з затримкою, без рендеру PDF.
// busy — поки останній підрахунок зроблено не для поточної версії проєкту.
// layouts — де в тексті кожної глави починаються сторінки (для сторінок у редакторі);
// previews — сторінки-макети (усе, крім глав) за номером; sequence — порядок сторінок для полотна книжки.
// error — сама помилка; текст мовою інтерфейсу з неї робить errorText.
export function useStats(project: Project): {
  stats: BookStats | null; ranges: Ranges; layouts: Layouts; previews: Previews; sequence: SheetItem[]; warnings: Warning[]; error: unknown; busy: boolean;
} {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { stats, ranges, layouts, previews, sequence, warnings } = await statsInWorker(project);
        if (!cancelled) setResult({ project, stats, ranges, layouts, previews, sequence, warnings, error: null });
      } catch (e) {
        console.error(e);
        if (!cancelled) setResult({ project, stats: null, ranges: {}, layouts: {}, previews: {}, sequence: [], warnings: [], error: e });
      }
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [project]);

  return {
    stats: result?.stats ?? null,
    ranges: result?.ranges ?? {},
    layouts: result?.layouts ?? {},
    previews: result?.previews ?? {},
    sequence: result?.sequence ?? [],
    warnings: result?.warnings ?? [],
    error: result?.error ?? null,
    busy: result?.project !== project,
  };
}
