import type { Book } from '../model/types';
import { ADD_KINDS, addRule, type AddContext, type AddKind } from './adders';
import { useT } from './i18n';

// Кнопки «Додати» — однакові всюди (вільна сторінка, порожня ліва, бічна панель). Неактивні — з
// підказкою, чому тут не можна; «Для нотаток» показується лише там, де є вільні сторінки.
export function AddButtons({ ctx, book, onAdd, className = 'button' }: {
  ctx: AddContext; book: Book; onAdd: (kind: AddKind) => void; className?: string;
}) {
  const t = useT();
  const label = (kind: AddKind) => (kind === 'copyright' ? t.colophon : kind === 'notes' ? t.notesTitle : t.blockType[kind]);
  return (
    <>
      {ADD_KINDS.map((kind) => {
        const reason = addRule(kind, ctx, book);
        if (reason === 'noFree') return null;
        return (
          <button type="button" key={kind} className={className} disabled={!!reason}
            title={reason ? t.addReasons[reason] : undefined} onClick={() => onAdd(kind)}>
            + {label(kind)}
          </button>
        );
      })}
    </>
  );
}
