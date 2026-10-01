import { describe, expect, it } from 'vitest';
import { classify, splitUnits, textUnits, type ImportedBlock, type Unit } from './chapters';

const lines = (...texts: string[]): Unit[] => texts.map((text) => ({ runs: [{ text }] }));
const heading = (text: string): Unit => ({ runs: [{ text }], heading: 1 });
const keywords = (units: Unit[], parts = true) => splitUnits(units, { mode: 'keywords', parts, images: true });
const titles = (blocks: ImportedBlock[]) => blocks.map((b) => (b.type === 'plate' ? `І:${b.caption}` : `${b.type === 'part' ? 'Ч:' : ''}${b.title}`));
const text = (b: ImportedBlock) => (b.type === 'chapter' ? b.body.map((p) => p.runs.map((r) => r.text).join('')) : b.type === 'part' ? [b.description] : []);
const img = (n: number) => ({ bytes: new Uint8Array([n]), type: 'image/png' });
const picture = (n: number): Unit => ({ runs: [], image: img(n) });

describe('classify: ключові слова', () => {
  it.each([
    ['Глава 3', 'chapter', 3], ['ГЛАВА 12. Шторм', 'chapter', 12], ['Chapter IV', 'chapter', 4], ['Chapter One', 'chapter', 1],
    ['Перша глава', 'chapter', 1], ['Глава первая', 'chapter', 1], ['Гл. 7', 'chapter', 7],
    ['Частина II. Невидимі', 'part', 2], ['Часть 1', 'part', 1], ['Part Two', 'part', 2], ['Книга 1 — Третій шлях', 'part', 1], ['Том третій', 'part', 3],
    ['Розділ 5', 'section', 5], ['Раздел пятый', 'section', 5],
  ])('%s → %s %s', (line, level, num) => {
    expect(classify(line)).toMatchObject({ level, num });
  });

  it.each(['Пролог', 'Епілог. Після', 'Передмова', 'Prologue', 'Author’s note', 'Послесловие', 'От автора'])('%s — глава без номера', (line) => {
    expect(classify(line)).toMatchObject({ level: 'chapter', num: null, special: true });
  });

  it('частина — з назвою замість номера, якщо назва з великої літери чи в лапках', () => {
    expect(classify('Книга Буття')).toMatchObject({ level: 'part', num: null });
    expect(classify('Том «Зима»')).toMatchObject({ level: 'part', num: null });
  });

  it.each([
    'Частина людей пішла далі.', 'Глава 3 була найважча.', 'Главные новости', 'Томас 2', 'У главі 3 ми бачили',
    'Глава 3 ........ 27', 'Вступ до теми тут', '— Пролог? — перепитав він.',
    'Дуже довгий рядок, що починається зі слова Глава 3, але це звичайне речення посеред розповіді й далі.',
  ])('«%s» — не межа', (line) => {
    expect(classify(line)).toBeNull();
  });
});

describe('розбивка за ключовими словами', () => {
  it('глави; назва з наступного короткого рядка склеюється; текст до першої межі — на початок першої глави', () => {
    const blocks = keywords(lines('Моя книжка', 'Автор', 'Глава 1', 'Початок', 'Раз.', 'Глава 2. Шторм', 'Два.'));
    expect(titles(blocks)).toEqual(['Глава 1. Початок', 'Глава 2. Шторм']);
    expect(text(blocks[0])).toEqual(['Моя книжка', 'Автор', 'Раз.']);
  });

  it('пролог і епілог — глави', () => {
    expect(titles(keywords(lines('Пролог', 'А.', 'Глава 1', 'Б.', 'Епілог', 'В.')))).toEqual(['Пролог', 'Глава 1', 'Епілог']);
  });

  it('частини: окремі блоки, кілька підряд — норма; короткий текст після назви — опис', () => {
    const blocks = keywords(lines('Книга 1', 'Том 2', 'Частина 3. Дорога', 'Про дорогу.', 'Глава 1', 'Раз.'));
    expect(titles(blocks)).toEqual(['Ч:Книга 1', 'Ч:Том 2', 'Ч:Частина 3. Дорога', 'Глава 1']);
    expect(blocks[2]).toMatchObject({ type: 'part', description: 'Про дорогу.' });
  });

  it('довгий текст після назви частини — окрема глава з назвою частини', () => {
    const long = 'Слово '.repeat(80).trim() + '.';
    const blocks = keywords(lines('Частина 1', long, 'Глава 1', 'Раз.'));
    expect(titles(blocks)).toEqual(['Ч:Частина 1', 'Частина 1', 'Глава 1']);
  });

  it('частини вимкнено — межі частин стають главами', () => {
    expect(titles(keywords(lines('Частина 1', 'Глава 1', 'Раз.'), false))).toEqual(['Глава 1']);
  });

  it('«Розділ» — частина, якщо є глави; інакше — глава', () => {
    expect(titles(keywords(lines('Розділ 1', 'Глава 1', 'Раз.', 'Глава 2', 'Два.')))).toEqual(['Ч:Розділ 1', 'Глава 1', 'Глава 2']);
    expect(titles(keywords(lines('Розділ 1', 'Раз.', 'Розділ 2', 'Два.')))).toEqual(['Розділ 1', 'Розділ 2']);
  });

  it('номер не по порядку — не межа; після нової частини рахунок з 1', () => {
    const blocks = keywords(lines('Глава 1', 'А.', 'Глава 7', 'Б.', 'Глава 2', 'В.', 'Частина 2', 'Глава 1', 'Г.'));
    expect(titles(blocks)).toEqual(['Глава 1', 'Глава 2', 'Ч:Частина 2', 'Глава 1']);
    expect(text(blocks[0])).toEqual(['А.', 'Глава 7', 'Б.']);
  });

  it('зміст на початку документа не дає порожніх глав', () => {
    const blocks = keywords(lines('Зміст', 'Глава 1', 'Глава 2', 'Глава 3', 'Глава 1', 'Раз.', 'Глава 2', 'Два.', 'Глава 3', 'Три.'));
    expect(titles(blocks)).toEqual(['Глава 1', 'Глава 2', 'Глава 3']);
    expect(text(blocks[2])).toEqual(['Три.']);
  });

  it('нічого не знайдено — одна глава', () => {
    expect(keywords(lines('Раз.', 'Два.'))).toEqual([{ type: 'chapter', title: '', body: [
      { type: 'paragraph', runs: [{ text: 'Раз.' }] }, { type: 'paragraph', runs: [{ text: 'Два.' }] },
    ] }]);
  });
});

describe('розбивка за заголовками документа', () => {
  const headings = (units: Unit[]) => splitUnits(units, { mode: 'headings', parts: true, images: true });

  it('є ≥ 2 заголовки з «Глава» — межами стають лише заголовки з ключовими словами, решта — жирні абзаци', () => {
    const blocks = headings([heading('Глава 1'), ...lines('Раз.'), heading('NETFLIX'), ...lines('Два.'), heading('Частина 2'), heading('Глава 2'), ...lines('Три.')]);
    expect(titles(blocks)).toEqual(['Глава 1', 'Ч:Частина 2', 'Глава 2']);
    expect(blocks[0]).toMatchObject({ body: [
      { type: 'paragraph', runs: [{ text: 'Раз.' }] },
      { type: 'paragraph', runs: [{ text: 'NETFLIX', b: true }] },
      { type: 'paragraph', runs: [{ text: 'Два.' }] },
    ] });
  });

  it('заголовків з «Глава» немає — кожен заголовок глава; заголовок з «Частина» — частина', () => {
    const blocks = headings([heading('Частина 1'), heading('Вступ до всього'), ...lines('Раз.'), heading('Мастер-промпт'), ...lines('Два.')]);
    expect(titles(blocks)).toEqual(['Ч:Частина 1', 'Вступ до всього', 'Мастер-промпт']);
  });
});

describe('картинки з документа', () => {
  it('картинка одразу під назвою — зображення глави; решта — ілюстрації після глави; підпис переходить в ілюстрацію', () => {
    const blocks = keywords([
      ...lines('Глава 1'), picture(1), ...lines('Раз.'), picture(2), { runs: [{ text: 'Рис. 2. Причал' }] }, ...lines('Два.'), picture(3),
      ...lines('Глава 2', 'Три.'),
    ]);
    expect(titles(blocks)).toEqual(['Глава 1', 'І:Рис. 2. Причал', 'І:', 'Глава 2']);
    expect(blocks[0]).toMatchObject({ type: 'chapter', image: img(1) });
    expect(text(blocks[0])).toEqual(['Раз.', 'Два.']);
  });

  it('підпис за стилем документа (caption)', () => {
    const blocks = keywords([...lines('Глава 1', 'Раз.'), picture(1), { runs: [{ text: 'Човни на світанку' }], caption: true }, ...lines('Два.')]);
    expect(titles(blocks)).toEqual(['Глава 1', 'І:Човни на світанку']);
  });

  it('картинки до першої межі — після першої глави; картинки вимкнено — відкидаються', () => {
    const units = [picture(1), ...lines('Вступ.', 'Глава 1', 'Раз.')];
    expect(titles(keywords(units))).toEqual(['Глава 1', 'І:']);
    expect(titles(splitUnits(units, { mode: 'keywords', parts: true, images: false }))).toEqual(['Глава 1']);
  });
});

describe('textUnits: звичайний текст', () => {
  it('абзаци через порожній рядок; межа першим рядком абзацу відокремлюється', () => {
    expect(textUnits('Глава 1\nПерший рядок\nпродовження.\n\nДругий абзац.').map((u) => u.runs[0].text))
      .toEqual(['Глава 1', 'Перший рядок продовження.', 'Другий абзац.']);
  });

  it('без порожніх рядків — кожен рядок абзац', () => {
    expect(textUnits('Глава 1\nРаз.\nГлава 2\nДва.').map((u) => u.runs[0].text)).toEqual(['Глава 1', 'Раз.', 'Глава 2', 'Два.']);
  });
});
