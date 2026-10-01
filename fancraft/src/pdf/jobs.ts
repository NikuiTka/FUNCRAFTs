import { isColor, sheetPages } from '../engine/stats';
import type { Page } from '../model/types';
import { bookletOrder, type PlacedSide } from './impose';

export interface PrintOptions {
  // Дуплекс — один файл; двопрохідний — лиця й звороти окремо.
  mode: 'duplex' | 'twoPass';
  // Лише для двопрохідного: залежать від того, як принтер складає стос і перевертає аркуш.
  reverseBacks: boolean;
  rotateBacks: boolean;
  // Аркуші з полосами — окремим файлом для кольорового принтера.
  splitColor: boolean;
}

export interface PrintJob {
  name: string;
  sides: PlacedSide[];
}

// Порядок сторінок рахується один раз; режими відрізняються лише групуванням сторін аркушів.
export function printJobs(pages: Page[], plan: number[], opts: PrintOptions): PrintJob[] {
  const order = bookletOrder(pages.length, plan);
  const sheets = order.reduce<[PlacedSide['side'], PlacedSide['side']][]>((acc, side, i) => {
    if (i % 2 === 0) acc.push([side, order[i + 1]]);
    return acc;
  }, []);
  const color = sheetPages(plan).map((nums) => nums.some((n) => isColor(pages[n - 1])));

  const groups: { name: string; sheets: typeof sheets }[] = opts.splitColor
    ? [
      { name: 'book-mono', sheets: sheets.filter((_, i) => !color[i]) },
      { name: 'book-color', sheets: sheets.filter((_, i) => color[i]) },
    ].filter((g) => g.sheets.length)
    : [{ name: 'book', sheets }];

  return groups.flatMap(({ name, sheets: group }): PrintJob[] => {
    if (opts.mode === 'duplex') {
      return [{ name: `${name}.pdf`, sides: group.flatMap(([front, back]) => [{ side: front, rotate: false }, { side: back, rotate: false }]) }];
    }
    const backs = group.map(([, back]) => ({ side: back, rotate: opts.rotateBacks }));
    return [
      { name: `${name}-fronts.pdf`, sides: group.map(([front]) => ({ side: front, rotate: false })) },
      { name: `${name}-backs.pdf`, sides: opts.reverseBacks ? backs.reverse() : backs },
    ];
  });
}
