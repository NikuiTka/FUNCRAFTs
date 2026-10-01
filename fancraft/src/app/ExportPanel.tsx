import { useEffect, useState } from 'react';
import type { Warning } from '../model/errors';
import type { Project } from '../model/types';
import { exportInWorker } from '../worker/client';
import { errorText, useT, type UiLang } from './i18n';

type Mode = 'duplex' | 'twoPass' | 'draft';

interface Result { name: string; url: string }

// Лише те, як друкувати. Налаштування книжки — угорі, у панелі книжки.
// Експорт не блокується нічим: що варто перевірити — попередження під кнопкою.
export function ExportPanel({ project, lang, onClose }: { project: Project; lang: UiLang; onClose: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('duplex');
  const [reverseBacks, setReverseBacks] = useState(false);
  const [rotateBacks, setRotateBacks] = useState(false);
  const [splitColor, setSplitColor] = useState(false);
  const [assembly, setAssembly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => () => results.forEach((r) => URL.revokeObjectURL(r.url)), [results]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    setResults([]);
    try {
      const { files, warnings } = await exportInWorker(project, {
        draft: mode === 'draft', mode: mode === 'twoPass' ? 'twoPass' : 'duplex', reverseBacks, rotateBacks, splitColor, assembly, lang,
      });
      setWarnings(warnings);
      setResults(files.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain;charset=utf-8' })),
      })));
    } catch (e) {
      console.error(e);
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="export-panel">
      <header>
        <h2>{t.export}</h2>
        <button type="button" className="icon" onClick={onClose} title={t.close}>✕</button>
      </header>

      <fieldset className="field">
        <legend className="field-label">{t.mode}</legend>
        {(['duplex', 'twoPass', 'draft'] as Mode[]).map((m) => (
          <label key={m} className="radio">
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {t.modes[m]}
          </label>
        ))}
        {mode === 'twoPass' && (
          <>
            <label className="check"><input type="checkbox" checked={reverseBacks} onChange={(e) => setReverseBacks(e.target.checked)} /> {t.reverseBacks}</label>
            <label className="check"><input type="checkbox" checked={rotateBacks} onChange={(e) => setRotateBacks(e.target.checked)} /> {t.rotateBacks}</label>
          </>
        )}
        {mode !== 'draft' && (
          <>
            <label className="check"><input type="checkbox" checked={splitColor} onChange={(e) => setSplitColor(e.target.checked)} /> {t.splitColor}</label>
            <label className="check"><input type="checkbox" checked={assembly} onChange={(e) => setAssembly(e.target.checked)} /> {t.assembly}</label>
          </>
        )}
      </fieldset>

      <button type="button" className="primary" disabled={busy} onClick={run}>{busy ? t.exporting : t.doExport}</button>
      <p className="hint">{t.printReminder}</p>
      {error !== null && <p className="error">{errorText(error, t, 'export')}</p>}
      {warnings.map((w, i) => <p key={i} className="warning">{t.warning(w)}</p>)}

      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <a href={r.url} target="_blank" rel="noreferrer">{t.openFile}</a>
              <a href={r.url} download={r.name}>{t.download}</a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
