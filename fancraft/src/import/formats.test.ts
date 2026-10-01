import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { chooseMode, splitUnits } from '../model/chapters';
import { parseDocx } from './docx';
import { parseMarkdown } from './markdown';

const docx = (body: string) => zipSync({
  'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`),
});
const p = (inner: string, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${inner}</w:p>`;
const r = (text: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;

describe('parseDocx', () => {
  it('абзаци, накреслення, заголовки, розрив сторінки; сміття прибирається', () => {
    const units = parseDocx(docx([
      p(r('Глава перша'), 'Heading1'),
      p(r('Звичайний ') + r('жирний', '<w:b/>') + r(' і ') + r('курсив', '<w:i/>') + r(', ') + r('не жирний', '<w:b w:val="0"/>') + r(' та ') + r('закреслений', '<w:strike/>')),
      p(r('Вечір'), 'Heading2'),
      p(r('A &amp; B — «лапки»') + '<w:r><w:tab/></w:r>' + r('  кінець  ')),
      p(''),
      p('<w:r><w:br w:type="page"/></w:r>'),
      p(r('Після розриву.')),
    ].join('')));
    expect(units).toEqual([
      { runs: [{ text: 'Глава перша' }], heading: 1 },
      { runs: [{ text: 'Звичайний ' }, { text: 'жирний', b: true }, { text: ' і ' }, { text: 'курсив', i: true }, { text: ', не жирний та ' }, { text: 'закреслений', s: true }] },
      { runs: [{ text: 'Вечір' }], heading: 2 },
      { runs: [{ text: 'A & B — «лапки» кінець' }] },
      { runs: [], pageBreak: true },
      { runs: [{ text: 'Після розриву.' }] },
    ]);
  });

  it('картинки — окремими одиницями після тексту абзацу, з байтами з word/media; стиль Caption — підпис', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const bytes = zipSync({
      'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${
        p(r('Текст.') + '<w:r><w:drawing><a:graphic><a:blip r:embed="rId7"/></a:graphic></w:drawing></w:r>')
      }${p(r('Причал'), 'Caption')}</w:body></w:document>`),
      'word/_rels/document.xml.rels': strToU8('<Relationships><Relationship Id="rId7" Type="http://schemas/image" Target="media/image1.png"/></Relationships>'),
      'word/media/image1.png': png,
    });
    expect(parseDocx(bytes)).toEqual([
      { runs: [{ text: 'Текст.' }] },
      { runs: [], image: { bytes: png, type: 'image/png' } },
      { runs: [{ text: 'Причал' }], caption: true },
    ]);
  });

  it('не docx — зрозуміла помилка', () => {
    expect(() => parseDocx(strToU8('текст'))).toThrow(/^notDocx$/);
  });
});

describe('parseMarkdown', () => {
  it('# — заголовок глави, ## — підзаголовок, **жирний**, *курсив*, ~~закреслений~~', () => {
    const units = parseMarkdown('# Глава\n\nТекст **жирний** і *курсив*,\nщо ~~ні~~ продовжується.\n\n## Вечір\n\nКінець.');
    expect(units).toEqual([
      { runs: [{ text: 'Глава' }], heading: 1 },
      { runs: [{ text: 'Текст ' }, { text: 'жирний', b: true }, { text: ' і ' }, { text: 'курсив', i: true }, { text: ', що ' }, { text: 'ні', s: true }, { text: ' продовжується.' }] },
      { runs: [{ text: 'Вечір' }], heading: 2 },
      { runs: [{ text: 'Кінець.' }] },
    ]);
  });
});

describe('картинки в markdown', () => {
  it('вбудована картинка окремим рядком — одиниця-картинка, alt — підпис; посилання на файл пропускається', () => {
    const units = parseMarkdown('Текст.\n\n![Причал](data:image/png;base64,iVBORw==)\n\n![](img/файл.png)\n\nДалі.');
    expect(units).toEqual([
      { runs: [{ text: 'Текст.' }] },
      { runs: [], image: { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), type: 'image/png' } },
      { runs: [{ text: 'Причал' }], caption: true },
      { runs: [{ text: 'Далі.' }] },
    ]);
  });
});

describe('розбивка для docx/md', () => {
  const units = () => parseMarkdown('Вступ.\n\n# Перша\n\nРаз **жирно**.\n\n## Підрозділ\n\nДва.\n\n# Друга\n\nТри.');

  it('є заголовки — розбивка за ними', () => {
    expect(chooseMode(units())).toBe('headings');
  });

  it('рівень заголовка не важить: кожен заголовок — глава; текст до першої — на початок першої глави; накреслення зберігаються', () => {
    const para = (text: string) => ({ type: 'paragraph', runs: [{ text }] });
    expect(splitUnits(units(), { mode: 'headings', parts: true, images: true })).toEqual([
      { type: 'chapter', title: 'Перша', body: [para('Вступ.'), { type: 'paragraph', runs: [{ text: 'Раз ' }, { text: 'жирно', b: true }, { text: '.' }] }] },
      { type: 'chapter', title: 'Підрозділ', body: [para('Два.')] },
      { type: 'chapter', title: 'Друга', body: [para('Три.')] },
    ]);
  });

  it('«Глава N» працює і на абзацах docx', () => {
    const numbered = ['Глава 1', 'Текст.', 'Глава 2', 'Ще.'].map((text) => ({ runs: [{ text }] }));
    expect(splitUnits(numbered, { mode: 'keywords', parts: true, images: true }).map((c) => (c.type === 'plate' ? '' : c.title))).toEqual(['Глава 1', 'Глава 2']);
  });
});
