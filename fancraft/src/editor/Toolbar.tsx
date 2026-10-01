import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { useState } from 'react';
import { useT } from '../app/i18n';
import { EmojiPanel } from './EmojiPanel';

// Швидкі емодзі поруч із кнопкою панелі: три найчастіші в книжці, бракує — ці.
const QUICK_EMOJI = ['❤', '🔥', '😊'];
const QUICK_COUNT = 3;

// Емодзі — у поле, де стоїть курсор (назва глави, стрічки на сторінках-макетах), зберігаючи
// позицію курсора; React дізнається про зміну через подію input.
function insertIntoField(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const from = field.selectionStart ?? field.value.length;
  const to = field.selectionEnd ?? from;
  const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, field.value.slice(0, from) + text + field.value.slice(to));
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(from + text.length, from + text.length);
}

const isField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'file');

// «Вставити» з кнопки: буфер читається через Clipboard API (браузер питає дозволу) і віддається туди,
// де стоїть курсор, так само як Ctrl+V: у поле — текст; решті (глава, місце зображення) — подією paste
// з тим самим вмістом, тож її обробляють ті самі обробники. false — буфер прочитати не вдалося.
async function pasteFromClipboard(): Promise<boolean> {
  let items: ClipboardItems;
  try { items = await navigator.clipboard.read(); } catch { return false; }
  const data = new DataTransfer();
  for (const item of items) {
    for (const type of item.types) {
      const blob = await item.getType(type);
      if (type.startsWith('image/')) data.items.add(new File([blob], `clipboard.${type.slice(6)}`, { type }));
      else if (type === 'text/plain' || type === 'text/html') data.setData(type, await blob.text());
    }
  }
  const target = document.activeElement;
  if (isField(target)) {
    const text = data.getData('text/plain');
    if (text) insertIntoField(target, target instanceof HTMLInputElement ? text.replace(/\s*\n\s*/g, ' ') : text);
    return true;
  }
  (target ?? document.body).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  return true;
}

// Кнопки буфера — іконками з підказками. Натиск не забирає фокус (mousedown), тож діють на виділення там, де воно є.
const CopyIcon = () => <svg viewBox="0 0 24 24" aria-hidden><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" /></svg>;
const CutIcon = () => <svg viewBox="0 0 24 24" aria-hidden><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M8.1 15.9 19 4M15.9 15.9 5 4" /></svg>;
const SelectAllIcon = () => <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2.5" /><path d="M7 9h10M7 12h10M7 15h6" /></svg>;
const PasteIcon = () => <svg viewBox="0 0 24 24" aria-hidden><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 11h6M9 15h6" /></svg>;

// Одна панель на все полотно книжки. Накреслення, регістр, розділення — для глави,
// де стоїть курсор (editor); без неї кнопки неактивні. Емодзі й буфер — також у будь-яке поле на сторінці.
export function Toolbar({ editor, hasMarkers, hasImage, usedEmoji, onSplit, onSplitMarkers, onPickImage, onRemoveImage, onInfo }: {
  editor: Editor | null;
  hasMarkers: boolean;
  hasImage: boolean;
  usedEmoji: string[];
  onSplit: (index: number) => void;
  onSplitMarkers: () => void;
  onPickImage: () => void;
  onRemoveImage: () => void;
  // Коротке повідомлення людині (браузер не дав доступу до буфера).
  onInfo: (text: string) => void;
}) {
  const t = useT();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive('bold') ?? false,
      italic: editor?.isActive('italic') ?? false,
      strike: editor?.isActive('strike') ?? false,
      hasSelection: editor ? !editor.state.selection.empty : false,
      canSplit: editor ? editor.state.selection.$from.index(0) > 0 : false,
    }),
  });
  const chain = () => editor?.chain().focus();
  const none = !editor;

  const pickEmoji = (emoji: string) => {
    const focused = document.activeElement;
    if (isField(focused)) insertIntoField(focused, emoji);
    else chain()?.insertContent(emoji).run();
    setEmojiOpen(false);
  };
  const quick = [...new Set([...usedEmoji, ...QUICK_EMOJI])].slice(0, QUICK_COUNT);

  return (
    <>
      <div className="toolbar" role="toolbar">
        <button type="button" className="icon" title={`${t.copy} (Ctrl+C)`} onMouseDown={(e) => e.preventDefault()}
          onClick={() => document.execCommand('copy')}><CopyIcon /></button>
        <button type="button" className="icon" title={`${t.cut} (Ctrl+X)`} onMouseDown={(e) => e.preventDefault()}
          onClick={() => document.execCommand('cut')}><CutIcon /></button>
        <button type="button" className="icon" title={`${t.paste} (Ctrl+V)`} onMouseDown={(e) => e.preventDefault()}
          onClick={async () => { if (!(await pasteFromClipboard())) onInfo(t.pasteDenied); }}><PasteIcon /></button>
        <button type="button" className="icon" title={`${t.selectAll} (Ctrl+A)`} disabled={none} onMouseDown={(e) => e.preventDefault()}
          onClick={() => chain()?.selectAll().run()}><SelectAllIcon /></button>
        <span className="sep" />
        <button type="button" className="mark bold" title={`${t.bold} (Ctrl+B)`} aria-pressed={active?.bold} disabled={none}
          onClick={() => chain()?.toggleBold().run()}>Ж</button>
        <button type="button" className="mark italic" title={`${t.italic} (Ctrl+I)`} aria-pressed={active?.italic} disabled={none}
          onClick={() => chain()?.toggleItalic().run()}>К</button>
        <button type="button" className="mark strike" title={`${t.strike} (Ctrl+Shift+S)`} aria-pressed={active?.strike} disabled={none}
          onClick={() => chain()?.toggleStrike().run()}>З</button>
        <span className="sep" />
        <button type="button" className="mark" title={`${t.upper} (Ctrl+Shift+U)`} disabled={!active?.hasSelection}
          onClick={() => chain()?.upperCase().run()}>АА</button>
        <button type="button" className="mark" title={`${t.lower} (Ctrl+Shift+L)`} disabled={!active?.hasSelection}
          onClick={() => chain()?.lowerCase().run()}>аа</button>
        <span className="sep" />
        <button type="button" disabled={!active?.canSplit}
          onClick={() => editor && onSplit(editor.state.selection.$from.index(0))}>{t.split}</button>
        <button type="button" title={t.splitMarkersHint} disabled={none || !hasMarkers} onClick={onSplitMarkers}>{t.splitMarkers}</button>
        <span className="sep" />
        <button type="button" disabled={none} onClick={onPickImage}>{hasImage ? t.replaceChapterImage : t.chapterImage}</button>
        {hasImage && <button type="button" disabled={none} onClick={onRemoveImage}>{t.removeImage}</button>}
        <span className="sep" />
        <button type="button" className="mark emoji-toggle" title={t.emoji} aria-pressed={emojiOpen}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setEmojiOpen((o) => !o)}>☺</button>
        {quick.map((e) => (
          <button key={e} type="button" className="quick-emoji" title={t.emoji} onMouseDown={(ev) => ev.preventDefault()} onClick={() => pickEmoji(e)}>{e}</button>
        ))}
      </div>
      {emojiOpen && <EmojiPanel onPick={pickEmoji} />}
    </>
  );
}
