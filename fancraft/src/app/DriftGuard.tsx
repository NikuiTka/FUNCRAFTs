import { useState } from 'react';
import { useT } from './i18n';

// Одна глава: скільки колонок вона фактично зайняла в редакторі проти того, скільки сторінок їй
// дав рушій верстки (PDF). Розбіжність в обидва боки — довша чи коротша — однаково означає, що
// браузер переніс рядки не там, де порахував рушій.
export interface DriftReport {
  id: string;
  title: string;
  first: number;
  pages: number;
  got: number;
  debug: string;
}

// Сторінка полотна не у своїй рамці: page — номер від рушія (як у PDF), at — рамка, де вона опинилась.
export interface Shift { page: number; at: number | null }

const shiftText = (shifted: Shift[]) => shifted.map((x) => `${x.page}→${x.at ?? '—'}`).join(' ');

// Кнопка-«сторож» унизу екрана: завжди на місці, з лічильником знайдених розбіжностей. Відкриває
// панель зі списком — де саме розійшлося і з технічними даними виміру для розробника.
export function DriftGuard({ reports, shifted }: { reports: DriftReport[]; shifted: Shift[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = reports.length + (shifted.length ? 1 : 0);

  const text = () => [
    ...reports.map((r) => `«${r.title}» (с. ${r.first}): у редакторі ${r.got} с., у PDF ${r.pages} с. — ${r.debug}`),
    ...(shifted.length ? [`зсув: ${shiftText(shifted)} dpr=${window.devicePixelRatio.toFixed(3)}`] : []),
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* буфер недоступний — текст і так є на екрані, скопіюють виділенням */ }
  };

  return (
    <>
      <button
        type="button"
        className={['drift-guard-button', count > 0 && 'has-drift'].filter(Boolean).join(' ')}
        title={t.driftGuard.button}
        onClick={() => setOpen((o) => !o)}
      >
        ⚑{count > 0 && <span className="drift-count">{count}</span>}
      </button>
      {open && (
        <div className="drift-panel">
          <header>
            <h2>{t.driftGuard.title}</h2>
            <button type="button" className="icon" title={t.close} onClick={() => setOpen(false)}>✕</button>
          </header>
          {count === 0
            ? <p className="drift-empty">{t.driftGuard.empty}</p>
            : (
              <>
                <p className="drift-hint">{t.driftGuard.hint}</p>
                <ul className="drift-list">
                  {shifted.length > 0 && (
                    <li>
                      <div className="drift-item-title">{t.driftGuard.shifted(shifted[0].page, shifted[0].at, shifted.length)}</div>
                      <code className="drift-debug">{shiftText(shifted)}</code>
                    </li>
                  )}
                  {reports.map((r) => (
                    <li key={r.id}>
                      <div className="drift-item-title">«{r.title}» — {t.driftGuard.row(r.first, r.got, r.pages)}</div>
                      <code className="drift-debug">{r.debug}</code>
                    </li>
                  ))}
                </ul>
                <button type="button" className="button" onClick={copy}>{copied ? t.driftGuard.copied : t.driftGuard.copy}</button>
              </>
            )}
        </div>
      )}
    </>
  );
}
