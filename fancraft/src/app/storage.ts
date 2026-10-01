// Де проєкт живе між сеансами:
//   File System Access API — «Зберегти» у той самий файл .book на диску (Chrome, Edge);
//   OPFS — приватне сховище браузера для автозбереження: страхування, а не носій;
//   звичайне завантаження — запасний шлях (Safari, Firefox, мобільні).

interface PickerOptions {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}
interface FilePickerWindow {
  showOpenFilePicker?: (o?: PickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o?: PickerOptions) => Promise<FileSystemFileHandle>;
}

const picker = () => window as unknown as FilePickerWindow;
const TYPES = [{ description: 'FANCRAFTs', accept: { 'application/zip': ['.book'] } }];

export const canUseFileHandles = () => typeof picker().showOpenFilePicker === 'function';

// null — користувач закрив вікно вибору.
export async function pickBookFile(): Promise<{ file: File; handle: FileSystemFileHandle } | null> {
  try {
    const [handle] = await picker().showOpenFilePicker!({ types: TYPES });
    return { file: await handle.getFile(), handle };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

export async function pickSaveHandle(suggestedName: string): Promise<FileSystemFileHandle | null> {
  try {
    return await picker().showSaveFilePicker!({ suggestedName, types: TYPES });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

export async function writeHandle(handle: FileSystemFileHandle, bytes: Uint8Array) {
  const stream = await handle.createWritable();
  await stream.write(bytes as BlobPart);
  await stream.close();
}

// ── автозбереження в OPFS ───────────────────────────────────────────────

const AUTOSAVE = 'autosave.book';
const AUTOSAVE_META = 'autosave.json';

const opfs = async () => (navigator.storage?.getDirectory ? navigator.storage.getDirectory() : null);

export async function writeAutosave(bytes: Uint8Array, fileName: string): Promise<void> {
  const dir = await opfs();
  if (!dir) return;
  const write = async (name: string, data: BlobPart) => {
    const stream = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await stream.write(data);
    await stream.close();
  };
  await write(AUTOSAVE, bytes as BlobPart);
  await write(AUTOSAVE_META, JSON.stringify({ fileName, savedAt: Date.now() }));
}

export async function readAutosave(): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  try {
    const dir = await opfs();
    if (!dir) return null;
    const bytes = new Uint8Array(await (await (await dir.getFileHandle(AUTOSAVE)).getFile()).arrayBuffer());
    const meta = JSON.parse(await (await (await dir.getFileHandle(AUTOSAVE_META)).getFile()).text()) as { fileName?: string };
    return { bytes, fileName: meta.fileName ?? 'fancraft.book' };
  } catch {
    return null;
  }
}
