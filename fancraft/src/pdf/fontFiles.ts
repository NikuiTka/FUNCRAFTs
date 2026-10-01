import type { Face } from '../model/types';

// Чотири накреслення гарнітури книжки; emoji — запасний шрифт для знаків, яких у гарнітурі немає.
export type FontFaces = Record<Face, Uint8Array> & { emoji?: Uint8Array };

// Гарнітура книжки одна — IBM Plex Mono (друкарська машинка). Файли в node_modules;
// один і той самий TTF — і для вимірів, і для вбудовування в PDF.
export const FONT_NAME = 'IBM Plex Mono';
export const FONT_FILES: Record<Face, string> = {
  regular: '@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf',
  bold: '@expo-google-fonts/ibm-plex-mono/700Bold/IBMPlexMono_700Bold.ttf',
  italic: '@expo-google-fonts/ibm-plex-mono/400Regular_Italic/IBMPlexMono_400Regular_Italic.ttf',
  boldItalic: '@expo-google-fonts/ibm-plex-mono/700Bold_Italic/IBMPlexMono_700Bold_Italic.ttf',
};

export const FACES: Face[] = ['regular', 'bold', 'italic', 'boldItalic'];

// Вертикальні метрики IBM Plex Mono, у кеглях (hhea = typo = win: 1025 / 275 на 1000).
// Потрібні показу сторінки в інтерфейсі, щоб базова лінія стояла там само, де в PDF.
export const FONT_ASCENT = 1.025;
export const FONT_DESCENT = 0.275;
// Ширина кожного знака гарнітури (моноширинна), у кеглях: 600 / 1000.
export const FONT_ADVANCE = 0.6;

// Запасний шрифт для емодзі — монохромний Noto Emoji, одне накреслення на всі.
export const EMOJI_FONT_FILE = '@expo-google-fonts/noto-emoji/400Regular/NotoEmoji_400Regular.ttf';

// У IBM Plex Mono порожні гліфи (пробіл, нерозривний пробіл) стоять у самому кінці файлу, а fontkit
// читає заголовок гліфа навіть для порожнього — на 10 байтів за кінець буфера. Нулі в кінці файлу
// таблиць не зачіпають, а порожній гліф так читається як рамка 0×0.
const TAIL_PADDING = 16;

export function padFont(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length + TAIL_PADDING);
  out.set(bytes);
  return out;
}
