import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Italic from '@tiptap/extension-italic';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { useT } from '../app/i18n';
import { useObjectUrl } from '../app/useObjectUrl';
import type { ChapterLayout } from '../engine/pageMap';
import type { ChapterBlock } from '../model/types';
import { pastedImage } from './clipboard';
import { fromEditor, toEditor } from './convert';
import { LetterCase } from './letterCase';
import { MissingGlyphs, missingKey } from './missingGlyphs';
import { Pages, pagesKey } from './pages';

// Лише абзаци (підзаголовків немає) і три накреслення. Жодних розмірів і шрифтів:
// гарнітура й схема розмірів — одні на всю книжку. Pages — сторінки глави в полотні.
const extensions = [
  Document, Paragraph, Text,
  Bold, Italic, Strike, LetterCase, UndoRedo, Pages, MissingGlyphs,
];

// Глава в полотні книжки: текст сторінками, без власної панелі — панель одна на все полотно
// і працює з главою, де стоїть курсор (onActive).
// Редактор читає вміст лише під час монтування; главу монтують заново (key), коли її перебудовано
// ззовні — розділенням чи об'єднанням.
export function ChapterFlow({ block, layout, k, imageBytes, missing, onChange, onImage, onImageAfter, onActive }: {
  block: ChapterBlock;
  layout: ChapterLayout | undefined;
  k: number;
  imageBytes: Uint8Array | undefined;
  // Знаки, яких немає в шрифтах книжки (від рушія).
  missing: string;
  onChange: (b: ChapterBlock) => void;
  onImage: (file: File | null) => void;
  // Зображення, вставлене з буфера в текст глави, — ілюстрацією одразу після неї.
  onImageAfter: (file: File) => void;
  onActive: (editor: Editor) => void;
}) {
  const t = useT();
  const [initial] = useState(() => toEditor(block.body));
  // Найсвіжіша глава — для обробників, які редактор запам'ятав при створенні.
  const latest = useRef(block);
  const change = useRef(onChange);
  const activate = useRef(onActive);
  const imageAfter = useRef(onImageAfter);
  const imageSet = useRef(onImage);
  useLayoutEffect(() => {
    latest.current = block;
    change.current = onChange;
    activate.current = onActive;
    imageAfter.current = onImageAfter;
    imageSet.current = onImage;
  });
  const input = useRef<HTMLInputElement>(null);
  // Вибір файлу для нової сторінки-ілюстрації поруч із главою (іконка ліворуч від назви).
  const plateInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions,
    content: initial,
    // У текст глави картинки не вставляються: зображення з буфера — окремою ілюстрацією після глави.
    editorProps: {
      // Підказка в порожній главі (index.css): рядок «Текст глави», куди можна клікнути й писати.
      attributes: { style: `--text-placeholder: ${JSON.stringify(t.chapterText)}` },
      handlePaste: (_view, event) => {
        const file = pastedImage(event);
        if (!file) return false;
        imageAfter.current(file);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      activate.current(editor);
      change.current({ ...latest.current, body: fromEditor(editor.getJSON()) });
    },
    // Глава стає активною для спільної панелі — щойно в ній з'явився курсор.
    onFocus: ({ editor }) => activate.current(editor),
    onSelectionUpdate: ({ editor }) => activate.current(editor),
  });
  const imageUrl = useObjectUrl(imageBytes);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(pagesKey, layout ? {
      layout, k, imageUrl, title: block.title, titleLabel: t.chapterTitle,
      onTitle: (title: string) => change.current({ ...latest.current, title }),
      onImageClick: () => input.current?.click(),
      onImagePaste: (file: File) => imageSet.current(file),
      onAddPlate: () => plateInput.current?.click(),
      plateLabel: t.addPlate,
    } : null));
  }, [editor, layout, k, imageUrl, block.title, t.chapterTitle, t.addPlate]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(missingKey, new Set(missing)));
  }, [editor, missing]);

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onImage(file);
  };

  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      <input ref={plateInput} type="file" accept="image/*" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) imageAfter.current(file);
      }} />
      <EditorContent editor={editor} />
    </>
  );
}
