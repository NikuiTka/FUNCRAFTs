import { EMOJI_GROUPS } from '../emojiConfig';
import { useT } from '../app/i18n';

// Основні емодзі з emojiConfig.ts групами (найчастіші в книжці — кнопками поруч із панеллю, Toolbar).
// Показуються тим самим чорно-білим шрифтом, яким надрукуються.
export function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const t = useT();
  const row = (emoji: string[]) => (
    <div className="emoji-row">
      {emoji.map((e) => (
        // mousedown не забирає фокус із тексту — вставка йде туди, де стоїть курсор.
        <button key={e} type="button" className="emoji" onMouseDown={(ev) => ev.preventDefault()} onClick={() => onPick(e)}>{e}</button>
      ))}
    </div>
  );
  return (
    <div className="emoji-panel">
      {EMOJI_GROUPS.map((g) => (
        <section key={g.id}>
          <span className="field-label">{t.emojiGroups[g.id]}</span>
          {row(g.emoji)}
        </section>
      ))}
    </div>
  );
}
