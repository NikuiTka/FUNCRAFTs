import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { nextImageName, packProject, unpackProject } from './project';
import type { Mm, Project } from '../model/types';

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);

const project: Project = {
  book: {
    version: 1,
    meta: { title: 'Книжка', author: 'Авторка', year: '2026' },
    settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 },
    blocks: [
      { id: 'c', type: 'chapter', title: 'Розділ', body: [{ type: 'paragraph', runs: [{ text: 'Текст ' }, { text: 'жирний', b: true }] }] },
      { id: 'p', type: 'plate', asset: 'img/img_001.jpg', title: '', caption: '', side: 'auto' },
    ],
    template: { titlePage: { qr: { url: 'https://x', size: 20 as Mm } } },
    assets: { 'img/img_001.jpg': { widthPx: 1200, heightPx: 800 } },
  },
  files: {
    'img/img_001.jpg': bytes(3000, 7),
  },
};

const contains = (haystack: Uint8Array, needle: Uint8Array) => {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
};

describe('.book', () => {
  it('збереження й відкриття без втрат, накреслення теж', () => {
    expect(unpackProject(packProject(project))).toEqual(project);
  });

  it('усередині: book.json і img/ — і жодного шрифту', () => {
    expect(Object.keys(unzipSync(packProject(project))).sort()).toEqual(['book.json', 'img/img_001.jpg']);
  });

  it('зображення лежать байт у байт, без стиснення', () => {
    expect(contains(packProject(project), project.files['img/img_001.jpg'])).toBe(true);
  });

  it('не zip, без book.json, новіша версія — коди помилок для словника', () => {
    expect(() => unpackProject(strToU8('текст'))).toThrow(/^notBook$/);
    expect(() => unpackProject(zipSync({ 'x.txt': strToU8('') }))).toThrow(/^noBookJson$/);
    const future = zipSync({ 'book.json': strToU8(JSON.stringify({ ...project.book, version: 99 })) });
    expect(() => unpackProject(future)).toThrow(/^newerVersion 99$/);
  });

  it('стара книжка з вибором гарнітури відкривається, поле font відкидається', () => {
    const old = zipSync({ ...unzipSync(packProject(project)), 'book.json': strToU8(JSON.stringify({ ...project.book, settings: { ...project.book.settings, font: 'lora' } })) });
    expect(unpackProject(old).book.settings).toEqual(project.book.settings);
  });

  it('стара книжка з лого й QR на колофоні: лого й vec/ відкидаються, QR обкладинки лишається', () => {
    const oldBook = {
      ...project.book,
      template: {
        titlePage: { logo: 'vec/logo.svg', qr: { url: 'https://x', size: 20 } },
        colophon: { logo: null, qr: { url: 'https://y', size: 20 } },
      },
      assets: { ...project.book.assets, 'vec/logo.svg': { widthPx: 10, heightPx: 10 } },
    };
    const zip = zipSync({ ...unzipSync(packProject(project)), 'book.json': strToU8(JSON.stringify(oldBook)), 'vec/logo.svg': strToU8('<svg/>') });
    expect(unpackProject(zip)).toEqual(project);
  });

  it('ілюстрація без файлу — помилка з назвою файлу', () => {
    const zip = unzipSync(packProject(project));
    delete zip['img/img_001.jpg'];
    expect(() => unpackProject(zipSync(zip))).toThrow(/^missingInArchive img\/img_001\.jpg$/);
  });
});

describe('nextImageName', () => {
  it('img_001, img_002… — наступний вільний номер', () => {
    expect(nextImageName({}, 'jpg')).toBe('img/img_001.jpg');
    expect(nextImageName({ 'img/img_001.jpg': new Uint8Array(), 'img/img_007.png': new Uint8Array() }, 'png')).toBe('img/img_008.png');
  });
});
