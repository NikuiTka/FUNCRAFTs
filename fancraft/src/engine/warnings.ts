import { SIGNATURES_HARD_LIMIT, SIGNATURES_SOFT_LIMIT } from '../config';
import type { Warning } from '../model/errors';
import type { Book } from '../model/types';

// Що варто перевірити перед друком. Нічого з цього не зупиняє ні верстку, ні експорт.
export function bookWarnings(book: Book, plan: number[]): Warning[] {
  const warnings: Warning[] = [];
  const count = plan.length;
  if (count > SIGNATURES_HARD_LIMIT) warnings.push({ code: 'tooManySignatures', count, limit: SIGNATURES_HARD_LIMIT });
  else if (count >= SIGNATURES_SOFT_LIMIT) warnings.push({ code: 'manySignatures', count, limit: SIGNATURES_HARD_LIMIT });
  for (const block of book.blocks) {
    if (block.type === 'plate' && !(block.asset && book.assets[block.asset])) {
      warnings.push({ code: 'plateWithoutImage', title: block.title.trim() });
    }
  }
  return warnings;
}
