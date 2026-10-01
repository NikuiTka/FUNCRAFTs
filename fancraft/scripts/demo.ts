// Запуск: npm run demo → out-*.pdf, out-book.txt і out.book у корені проєкту.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packProject } from '../src/archive/project';
import type { Block, Mm, Para, Project } from '../src/model/types';
import { exportBook } from '../src/pdf/export';
import { EMOJI_FONT_FILE, FACES, FONT_FILES, padFont, type FontFaces } from '../src/pdf/fonts';

const texts = [
  'Книжкова сторінка тримається на сітці. Кожен рядок стоїть на своєму місці, і сусідні сторінки розвороту збігаються рядок у рядок: якщо подивитися аркуш на світло, рядки зворотного боку сховаються за рядками лицьового.',
  'Тому вертикальні відступи вимірюються в рядках, а не в міліметрах. Заголовок займає цілу кількість рядків, пропуск перед ним і після нього — теж. Сітка не зсувається, хоч би скільки заголовків було на сторінці.',
  'Поля сторінки не відміряються від краю аркуша. Спершу визначається полоса набору, а вільне місце довкола неї однакове з усіх боків — дванадцять відсотків ширини сторінки.',
  'Книжку складають руками: аркуші вкладаються один в одний, зошити шиються й зводяться за римськими позначками внизу правої сторінки.',
];

const para = (i: number): Para => ({
  type: 'paragraph',
  runs: i % 5 === 0
    ? [{ text: 'Тут є ' }, { text: 'жирний', b: true }, { text: ', ' }, { text: 'курсив', i: true }, { text: ' і ' }, { text: 'перекреслене', s: true }, { text: '. ' + texts[i % texts.length] }]
    : [{ text: texts[i % texts.length] }],
});

const chapters: Block[] = Array.from({ length: 5 }, (_, ch) => ({
  id: `c${ch}`, type: 'chapter', title: `${ch === 0 ? '☀ ' : ''}День ${['перший', 'другий', 'третій', 'четвертий', 'п’ятий'][ch]}`,
  body: [
    ...Array.from({ length: 6 }, (_, i) => para(ch + i)),
    { type: 'heading', runs: [{ text: 'Вечір' }] },
    ...Array.from({ length: 5 }, (_, i) => para(ch + i + 2)),
  ],
}));

const project: Project = {
  book: {
    version: 1,
    meta: { title: 'Книжка з паперу', author: 'FANCRAFTs', year: '2026', description: 'Як скласти, надрукувати й зшити книжку на офісному принтері.' },
    settings: { sheet: 'A4', scheme: 'medium', sheetsPerSignature: 5 },
    blocks: [
      { id: 'toc', type: 'toc', title: 'Зміст' },
      { id: 'p1', type: 'part', title: 'Частина перша. Сітка', description: 'Про те, як рядки тримаються на своїх місцях і чому поля не відміряються від краю аркуша.', asset: 'img/img_001.png' },
      ...chapters.slice(0, 3),
      { id: 'p2', type: 'part', title: 'Частина друга. Руки', description: 'Складання й шиття.', asset: '' },
      ...chapters.slice(3),
      { id: 'blank', type: 'tabula_rasa', title: 'Для нотаток', count: 2, side: 'auto' },
      { id: 'q', type: 'questions', title: 'Що спитати в цієї книжки', items: ['Чому сітка важливіша за поля?', 'Що зміниться, якщо зошит буде на 3 аркуші?'], url: 'https://example.com/book.txt', note: 'Текст книжки для ШІ — за посиланням у QR.' },
    ],
    template: { titlePage: { qr: { url: 'https://example.com/book.txt', size: 20 as Mm }, photo: 'img/img_001.png' } },
    assets: { 'img/img_001.png': { widthPx: 512, heightPx: 512 } },
  },
  files: { 'img/img_001.png': new Uint8Array(readFileSync('public/pwa-512.png')) },
};

const fonts = Object.fromEntries(
  FACES.map((f) => [f, padFont(new Uint8Array(readFileSync(resolve('node_modules', FONT_FILES[f]))))]),
) as FontFaces;
fonts.emoji = padFont(new Uint8Array(readFileSync(resolve('node_modules', EMOJI_FONT_FILE))));

const options = { mode: 'duplex', reverseBacks: false, rotateBacks: false, splitColor: false } as const;
const duplex = await exportBook(project, fonts, { ...options, draft: false, assembly: true, lang: 'uk' });
const draft = await exportBook(project, fonts, { ...options, draft: true });

writeFileSync('out-booklet.pdf', duplex.files.find((f) => f.name === 'book.pdf')!.bytes);
writeFileSync('out-assembly.pdf', duplex.files.find((f) => f.name === 'assembly.pdf')!.bytes);
writeFileSync('out-draft.pdf', draft.files.find((f) => f.name === 'book-draft.pdf')!.bytes);
writeFileSync('out-book.txt', duplex.files.find((f) => f.name === 'book.txt')!.bytes);
writeFileSync('out.book', packProject(project));

const s = duplex.stats;
console.log(`${s.pages} сторінок · ${s.sheets} аркушів · зошити ${s.plan.join('+')} · ${s.blanks} порожніх (${s.intentionalBlanks} навмисні)`);
console.log('out-draft.pdf, out-booklet.pdf, out-assembly.pdf, out-book.txt, out.book');
