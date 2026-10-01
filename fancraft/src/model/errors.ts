// Проблеми, про які програма каже людині. Код і параметри — тут, текст — у словнику інтерфейсу
// (app/i18n.ts), тож повідомлення завжди мовою інтерфейсу, а не мовою бібліотеки.
export type Problem =
  | { code: 'notBook' }
  | { code: 'noBookJson' }
  | { code: 'badBookJson' }
  | { code: 'newerVersion'; version: string }
  | { code: 'missingInArchive'; path: string }
  | { code: 'notDocx' }
  | { code: 'imageResize' }
  | { code: 'fontMissing'; path: string };

// Попередження не зупиняють експорт: книжка друкується, людина бачить, що перевірити.
export type Warning =
  | { code: 'manySignatures'; count: number; limit: number }
  | { code: 'tooManySignatures'; count: number; limit: number }
  | { code: 'plateWithoutImage'; title: string }
  | { code: 'missingImage'; path: string }
  // Знаки, яких немає в шрифтах книжки (усі разом, без роздільників).
  | { code: 'missingGlyphs'; chars: string };

// message — код і параметри, для консолі й тестів; людині показується текст зі словника.
export class AppError extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super([problem.code, ...Object.values(problem).slice(1)].join(' '));
    this.name = 'AppError';
    this.problem = problem;
  }
}
