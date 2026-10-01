import type { Book, Block } from '../model/types';

// Що можна додати кнопками «Додати»: блоки, копірайт і «Для нотаток» (одна розлінована сторінка).
export type AddKind = Block['type'] | 'copyright' | 'notes';

export const ADD_KINDS: AddKind[] = ['part', 'chapter', 'plate', 'toc', 'copyright', 'tabula_rasa', 'notes', 'questions'];

// Де стоять кнопки:
// free  — перша вільна сторінка в кінці книжки: блок стає в кінець;
// panel — бічна панель (коли вільних сторінок немає): блок стає після вибраного;
// slot  — порожня ліва сторінка, яку верстка вставила перед частиною чи змістом: блок стає рівно на неї.
export interface AddContext {
  place: 'free' | 'panel' | 'slot';
  // Номер сторінки, на яку стане новий блок (для слота й для копірайту на с. 2).
  page: number | null;
  // Копірайт піде на с. 2 (зворот титулу), а не в кінець книжки.
  front: boolean;
  // Є вільні сторінки (для «Для нотаток»).
  hasFree: boolean;
}

export type AddReason = 'exists' | 'rectoOnly' | 'onePage' | 'page2' | 'noFree';

// Чи можна додати kind у цьому місці; якщо ні — чому (підказка на неактивній кнопці).
export function addRule(kind: AddKind, ctx: AddContext, book: Book): AddReason | null {
  const copyrightThere = (book.copyright ?? 'back') !== 'none';
  if (kind === 'copyright') {
    if (copyrightThere) return 'exists';
    if (ctx.place === 'slot' && ctx.page !== 2) return 'page2';
    return null;
  }
  if (kind === 'toc' && book.blocks.some((b) => b.type === 'toc')) return 'exists';
  // Заброньована порожня ліва — лише на одну сторінку й не праворуч: інакше частина чи зміст зсунуться.
  if (ctx.place === 'slot') {
    if (kind === 'part' || kind === 'toc') return 'rectoOnly';
    if (kind === 'chapter') return 'onePage';
  }
  return null;
}
