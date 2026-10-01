import { strFromU8, unzipSync } from 'fflate';
import type { ImportedImage, Unit } from '../model/chapters';
import type { Run } from '../model/types';
import { normalizeRuns } from './runs';
import { AppError } from '../model/errors';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m);

// <w:b/>, <w:b w:val="1"/> — увімкнено; <w:b w:val="0"/> чи "false" — вимкнено.
const flag = (props: string, tag: string) => {
  const m = new RegExp(`<w:${tag}(?:\\s+w:val="([^"]*)")?\\s*/>`).exec(props);
  return !!m && !['0', 'false', 'none'].includes(m[1] ?? '');
};

// Картинки, які браузер уміє показати; EMF/WMF (векторні з Office) пропускаються.
const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
// Стиль підпису до картинки.
const CAPTION_STYLE = /^(caption|название ?объекта|назва ?об'?єкта|підпис|подпись)$/i;

// Посилання документа на файли картинок: rId → байти й тип.
function imageRels(zip: Record<string, Uint8Array>): Map<string, ImportedImage> {
  const out = new Map<string, ImportedImage>();
  const rels = zip['word/_rels/document.xml.rels'];
  if (!rels) return out;
  for (const [, attrs] of strFromU8(rels).matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (!id || !target || !/\/image"/.test(attrs)) continue;
    const path = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^\.\//, '')}`;
    const type = IMAGE_TYPES[path.split('.').pop()!.toLowerCase()];
    if (type && zip[path]) out.set(id, { bytes: zip[path], type });
  }
  return out;
}

// Заголовок (Heading N, Title, «Заголовок N»). Рівень при розбивці не аналізується.
function headingLevel(style: string | undefined): 1 | 2 | undefined {
  if (!style) return undefined;
  if (/^(title|назва)$/i.test(style)) return 1;
  const m = /^(?:heading|заголовок)\s*(\d)$/i.exec(style);
  if (!m) return undefined;
  return m[1] === '1' ? 1 : 2;
}

// Текст і структура з word/document.xml. Усі інлайнові стилі, крім жирного, курсиву й
// перекреслення, відкидаються; ручні розриви рядків стають пробілами. Картинки абзацу — окремими
// одиницями одразу після його тексту.
export function parseDocx(bytes: Uint8Array): Unit[] {
  let xml: string | undefined;
  let images = new Map<string, ImportedImage>();
  try {
    const zip = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels' || f.name.startsWith('word/media/') });
    xml = zip['word/document.xml'] && strFromU8(zip['word/document.xml']);
    images = imageRels(zip);
  } catch { /* нижче — одна помилка на обидва випадки */ }
  if (!xml) throw new AppError({ code: 'notDocx' });

  const units: Unit[] = [];
  for (const [, body = ''] of xml.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(body)?.[1];
    let pageBreak = /<w:pageBreakBefore(?:\s+w:val="(?:1|true)")?\s*\/>/.test(body);
    const runs: Run[] = [];

    for (const [, run] of body.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
      const props = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? '';
      const style: Omit<Run, 'text'> = {};
      if (flag(props, 'b')) style.b = true;
      if (flag(props, 'i')) style.i = true;
      if (flag(props, 'strike') || flag(props, 'dstrike')) style.s = true;
      let text = '';
      for (const [token, t, br = ''] of run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\b([^>]*)\/>|<w:tab\/>|<w:cr\/>/g)) {
        if (t !== undefined) text += decode(t);
        else if (token.startsWith('<w:br') && /w:type="page"/.test(br)) pageBreak = true;
        else text += ' ';
      }
      runs.push({ text, ...style });
    }

    if (pageBreak) units.push({ runs: [], pageBreak: true });
    const clean = normalizeRuns(runs);
    if (clean.length) {
      const level = headingLevel(style);
      const caption = !!style && CAPTION_STYLE.test(style);
      units.push({ runs: clean, ...(level ? { heading: level } : {}), ...(caption ? { caption } : {}) });
    }
    // <a:blip r:embed="rId5"/> (DrawingML) і <v:imagedata r:id="rId5"/> (старий VML).
    for (const [, id] of body.matchAll(/<(?:a:blip\b[^>]*?r:embed|v:imagedata\b[^>]*?r:id)="([^"]+)"/g)) {
      const image = images.get(id);
      if (image) units.push({ runs: [], image });
    }
  }
  return units;
}
