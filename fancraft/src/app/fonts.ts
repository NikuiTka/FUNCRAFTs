import { AppError } from '../model/errors';
import { EMOJI_FONT_FILE, FACES, FONT_FILES, padFont, type FontFaces } from '../pdf/fontFiles';

// URL-и файлів шрифтів після збирання Vite; самі байти завантажуються, лише коли потрібні.
const urls = import.meta.glob('../../node_modules/@expo-google-fonts/{ibm-plex-mono/{400Regular,700Bold,400Regular_Italic,700Bold_Italic},noto-emoji/400Regular}/*.ttf', {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>;

async function fetchFont(path: string): Promise<Uint8Array> {
  const url = urls[`../../node_modules/${path}`];
  if (!url) throw new AppError({ code: 'fontMissing', path });
  return padFont(new Uint8Array(await (await fetch(url)).arrayBuffer()));
}

// Гарнітура одна на всю програму — завантажується один раз, разом зі шрифтом емодзі.
let fonts: Promise<FontFaces> | null = null;

export function loadFonts(): Promise<FontFaces> {
  fonts ??= (async () => {
    const entries = await Promise.all(FACES.map(async (face) => [face, await fetchFont(FONT_FILES[face])] as const));
    return { ...Object.fromEntries(entries), emoji: await fetchFont(EMOJI_FONT_FILE) } as FontFaces;
  })();
  return fonts;
}

// CSS-назви для редактора — ті самі файли, що й у PDF. Емодзі — тим самим чорно-білим
// шрифтом, що й у PDF, а не кольоровими системними.
export const BOOK_FAMILY = 'FancraftBook';
export const EMOJI_FAMILY = 'FancraftEmoji';

let registered = false;
export async function registerEditorFonts() {
  if (registered) return;
  registered = true;
  const faces = await loadFonts();
  const descriptors: Record<string, FontFaceDescriptors> = {
    regular: {}, bold: { weight: '700' }, italic: { style: 'italic' }, boldItalic: { weight: '700', style: 'italic' },
  };
  const all = FACES.map((face) => new FontFace(BOOK_FAMILY, faces[face] as BufferSource, descriptors[face]));
  // Одне накреслення на всі: жирний і курсив емодзі браузер не підробляє.
  if (faces.emoji) all.push(new FontFace(EMOJI_FAMILY, faces.emoji as BufferSource, { weight: '100 900', style: 'normal' }));
  for (const f of all) {
    document.fonts.add(f);
    void f.load();
  }
}
