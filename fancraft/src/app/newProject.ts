import { DEFAULT_SETTINGS } from '../config';
import { newId } from '../model/ops';
import type { Block, Project } from '../model/types';
import type { Dictionary } from './i18n';

export const newBlock = (type: Block['type'], t: Dictionary): Block => {
  const id = newId();
  switch (type) {
    case 'part': return { id, type, title: '', description: '', asset: '' };
    // Назва нової глави порожня — на сторінці підказка «Назва глави», людина пише свою.
    case 'chapter': return { id, type, title: '', body: [] };
    case 'plate': return { id, type, asset: '', title: '', caption: '', side: 'auto' };
    case 'questions': return { id, type, title: t.defaults.questions, items: [], url: '', note: '' };
    case 'toc': return { id, type, title: t.defaults.toc };
    // Порожня — одна сторінка на найближчому місці.
    case 'tabula_rasa': return { id, type, title: '', count: 1, side: 'auto' };
  }
};

export const newProject = (): Project => ({
  book: {
    version: 1,
    meta: { title: '', author: '', year: String(new Date().getFullYear()) },
    settings: DEFAULT_SETTINGS,
    blocks: [],
    template: { titlePage: { qr: null } },
    assets: {},
    // Копірайт додає автор за потреби (самвидав: автор і так на обкладинці).
    copyright: 'none',
  },
  files: {},
});
