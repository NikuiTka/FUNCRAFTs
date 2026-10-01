import { Extension, type CommandProps } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    letterCase: {
      upperCase: () => ReturnType;
      lowerCase: () => ReturnType;
    };
  }
}

// Замінює виділений текст перетвореним; накреслення (жирний тощо) зберігаються.
const transform = (fn: (s: string) => string) => ({ state, tr, dispatch }: CommandProps) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (!dispatch) return true;

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.text.length);
    const part = node.text.slice(start - pos, end - pos);
    const next = fn(part);
    if (next !== part) {
      tr.replaceWith(tr.mapping.map(start), tr.mapping.map(end), state.schema.text(next, node.marks));
    }
  });
  return true;
};

// Регістр — не накреслення, а зміна самого тексту.
export const LetterCase = Extension.create({
  name: 'letterCase',

  addCommands() {
    return {
      upperCase: () => transform((s) => s.toUpperCase()),
      lowerCase: () => transform((s) => s.toLowerCase()),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-u': () => this.editor.commands.upperCase(),
      'Mod-Shift-l': () => this.editor.commands.lowerCase(),
    };
  },
});
