import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

// Знаки, яких немає в шрифтах книжки (перелік дає рушій). Браузер малює їх чужим шрифтом іншої ширини —
// рядки в редакторі розходилися б із PDF, і полотно з'їжджало б. Тут кожен такий знак займає рівно одну
// клітинку, як його міряє рушій (порожній гліф гарнітури), і підсвічений, щоб його замінили.
export const missingKey = new PluginKey<{ chars: Set<string>; deco: DecorationSet }>('missingGlyphs');

function build(doc: PMNode, chars: Set<string>): DecorationSet {
  if (!chars.size) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text!;
    // Слово зі знаком не розривається: рушій переносить лише по пробілах, а браузер дозволив би
    // перенос біля вставленого блоку.
    for (const word of text.matchAll(/\S+/g)) {
      let found = false;
      for (let i = 0; i < word[0].length; ) {
        const ch = String.fromCodePoint(word[0].codePointAt(i)!);
        const at = pos + word.index + i;
        if (chars.has(ch)) { decos.push(Decoration.inline(at, at + ch.length, { class: 'glyph-missing' })); found = true; }
        i += ch.length;
      }
      if (found) decos.push(Decoration.inline(pos + word.index, pos + word.index + word[0].length, { class: 'glyph-word' }));
    }
  });
  return DecorationSet.create(doc, decos);
}

export const MissingGlyphs = Extension.create({
  name: 'missingGlyphs',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: missingKey,
      state: {
        init: () => ({ chars: new Set<string>(), deco: DecorationSet.empty }),
        apply(tr, value, _old, state) {
          const chars = tr.getMeta(missingKey) as Set<string> | undefined;
          if (chars) return { chars, deco: build(state.doc, chars) };
          return tr.docChanged ? { chars: value.chars, deco: build(state.doc, value.chars) } : value;
        },
      },
      props: { decorations: (state) => missingKey.getState(state)?.deco },
    })];
  },
});
