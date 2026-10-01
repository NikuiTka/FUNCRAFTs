import { describe, expect, it } from 'vitest';
import { fromEditor, toEditor } from './convert';
import type { Para } from '../model/types';

const body: Para[] = [
  { type: 'paragraph', runs: [{ text: 'Вечір', b: true }] },
  { type: 'paragraph', runs: [{ text: 'Звичайний ' }, { text: 'жирний', b: true }, { text: ' і ' }, { text: 'курсив закреслений', i: true, s: true }] },
];

describe('convert', () => {
  it('абзаци → Tiptap: лише абзаци, накреслення — marks', () => {
    expect(toEditor(body)).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Вечір', marks: [{ type: 'bold' }] }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Звичайний ' },
            { type: 'text', text: 'жирний', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' і ' },
            { type: 'text', text: 'курсив закреслений', marks: [{ type: 'italic' }, { type: 'strike' }] },
          ],
        },
      ],
    });
  });

  it('туди й назад без втрат', () => {
    expect(fromEditor(toEditor(body))).toEqual(body);
  });

  it('порожні абзаци відкидаються: відступи задає схема розмірів, не порожні рядки', () => {
    const json = {
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'text', text: '  ' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] }],
    };
    expect(fromEditor(json)).toEqual([{ type: 'paragraph', runs: [{ text: 'Текст' }] }]);
  });

  it('сусідні вузли з однаковими накресленнями зливаються', () => {
    const json = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Сло', marks: [{ type: 'bold' }] }, { type: 'text', text: 'во', marks: [{ type: 'bold' }] }] }],
    };
    expect(fromEditor(json)).toEqual([{ type: 'paragraph', runs: [{ text: 'Слово', b: true }] }]);
  });

  it('порожня глава — один порожній абзац у редакторі', () => {
    expect(toEditor([])).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });
});
