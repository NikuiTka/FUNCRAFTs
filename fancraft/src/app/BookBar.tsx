import { PAPER, SIGNATURES_HARD_LIMIT, SIGNATURES_SOFT_LIMIT } from '../config';
import type { BookStats } from '../engine/stats';
import type { Warning } from '../model/errors';
import type { Settings, SheetFormat, SheetsPerSignature, SizeScheme } from '../model/types';
import { useT } from './i18n';

interface Props {
  settings: Settings;
  onSettings: (s: Settings) => void;
  stats: BookStats | null;
  warnings: Warning[];
  error: string | null;
  busy: boolean;
}

// Головне про книжку — угорі: налаштування, які її формують, і те, що з них вийшло.
export function BookBar({ settings, onSettings, stats, warnings, error, busy }: Props) {
  const t = useT();
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onSettings({ ...settings, [key]: value });

  const signatures = stats?.plan.length ?? 0;
  const level = signatures > SIGNATURES_HARD_LIMIT ? 'over' : signatures >= SIGNATURES_SOFT_LIMIT ? 'warn' : '';

  return (
    <section className="book-bar">
      <div className="settings">
        <label><span className="field-label">{t.sheet}</span>
          <select value={settings.sheet} onChange={(e) => set('sheet', e.target.value as SheetFormat)}>
            {(['A3', 'A4', 'A5'] as SheetFormat[]).map((s) => <option key={s} value={s}>{t.sheets[s]}</option>)}
          </select>
        </label>
        <label><span className="field-label">{t.scheme}</span>
          <select value={settings.scheme} onChange={(e) => set('scheme', e.target.value as SizeScheme)}>
            {(['large', 'medium', 'small'] as SizeScheme[]).map((s) => <option key={s} value={s}>{t.schemes[s]}</option>)}
          </select>
        </label>
        <label><span className="field-label">{t.paper}</span>
          <select value={settings.sheetsPerSignature} onChange={(e) => set('sheetsPerSignature', Number(e.target.value) as SheetsPerSignature)}>
            {([5, 4, 3] as SheetsPerSignature[]).map((n) => <option key={n} value={n}>{t.paperOption(PAPER[n], n)}</option>)}
          </select>
        </label>
      </div>

      <div className={['stats', level, busy && 'busy'].filter(Boolean).join(' ')}>
        {error ?? (stats
          ? [
            t.stats.pages(stats.pages),
            t.stats.sheets(stats.sheets, stats.sheets - stats.colorSheets, stats.colorSheets),
            t.stats.signatures(signatures, settings.sheetsPerSignature),
            t.stats.free(stats.free),
            t.stats.blanks(stats.blanks, stats.intentionalBlanks),
          ].join(' · ')
          : t.stats.counting)}
      </div>

      {warnings.length > 0 && (
        <ul className="warnings">
          {warnings.map((w, i) => <li key={i}>{t.warning(w)}</li>)}
        </ul>
      )}
    </section>
  );
}
