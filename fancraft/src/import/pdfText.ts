// Мітка місця картинки в тексті сторінки: окремий абзац, який потім заміняє одиниця-картинка.
export const IMAGE_MARK = /^\uE000(\d+)\uE000$/;
export const imageMark = (n: number) => `\uE000${n}\uE000`;

// Рядок, що повторюється на стількох сторінках, — колонтитул.
const REPEAT_SHARE = 0.5;
const REPEAT_MIN_PAGES = 3;
// Короткий рядок без розділового знака, за яким іде велика літера, — окремий абзац (назва).
const SHORT_LINE = 40;

const LONE_NUMBER = /^(?:\d{1,4}|[ivxlcdm]{1,6}|[—–-]\s*\d{1,4}\s*[—–-])$/iu;
const SENTENCE_END = /[.!?…»"”:]$/u;

// Рядки сторінок PDF → текст з абзацами через порожній рядок, далі — звичайний шлях .txt.
// PDF однаково вимагатиме ручної правки: це лише найгрубше прибирання.
export function pdfLinesToText(pages: string[][]): string {
  const trimmed = pages.map((lines) => lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));

  const onPages = new Map<string, number>();
  for (const lines of trimmed) for (const l of new Set(lines)) onPages.set(l, (onPages.get(l) ?? 0) + 1);
  const repeated = (l: string) =>
    trimmed.length >= REPEAT_MIN_PAGES && (onPages.get(l) ?? 0) >= Math.max(REPEAT_MIN_PAGES, trimmed.length * REPEAT_SHARE);

  const lines = trimmed.flat().filter((l) => !repeated(l) && !LONE_NUMBER.test(l));

  const paragraphs: string[] = [];
  for (const line of lines) {
    const prev = paragraphs.at(-1);
    const last = prev?.split(' ').at(-1) ?? '';
    // Мітка картинки — завжди окремий абзац, і текст після неї — теж.
    if (prev === undefined || IMAGE_MARK.test(line) || IMAGE_MARK.test(prev)) { paragraphs.push(line); continue; }
    if (/\p{L}-$/u.test(prev) && /^\p{Ll}/u.test(line)) {
      // Перенос на кінці рядка: «дов-» + «гий» → «довгий».
      paragraphs[paragraphs.length - 1] = prev.slice(0, -1) + line;
    } else if (SENTENCE_END.test(last) || (/^\p{Lu}/u.test(line) && prev.length <= SHORT_LINE)) {
      paragraphs.push(line);
    } else {
      paragraphs[paragraphs.length - 1] = `${prev} ${line}`;
    }
  }
  return paragraphs.join('\n\n');
}
