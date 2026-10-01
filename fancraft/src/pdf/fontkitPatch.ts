import fontkit from '@pdf-lib/fontkit';

// Підмножина TrueType у fontkit пише короткий loca (зміщення / 2), але не вирівнює гліфи до
// парної довжини. У Noto Emoji майже половина гліфів непарної довжини — після першого такого
// всі наступні гліфи підмножини зсуваються й не малюються. Латка доповнює кожен гліф нулем.
// Для шрифтів, де гліфи вже парні (Roboto, Lora, Plex Mono), нічого не змінюється.
interface SubsetInternals {
  glyf: Uint8Array[];
  offset: number;
  _addGlyph(gid: number): number;
}

let patched = false;

// font — будь-який розібраний TrueType: з нього береться клас підмножини.
export function patchSubsetPadding(font: ReturnType<typeof fontkit.create>) {
  if (patched) return;
  const proto = Object.getPrototypeOf((font as unknown as { createSubset(): object }).createSubset()) as SubsetInternals;
  if (typeof proto._addGlyph !== 'function') return;
  const original = proto._addGlyph;
  proto._addGlyph = function (this: SubsetInternals, gid: number) {
    const index = original.call(this, gid);
    const buffer = this.glyf[index];
    if (buffer.length % 2) {
      // Той самий клас Buffer, що всередині fontkit: потік запису приймає лише його.
      const padded = new (buffer.constructor as new (size: number) => Uint8Array)(buffer.length + 1);
      padded.fill(0);
      padded.set(buffer);
      this.glyf[index] = padded;
      this.offset += 1;
    }
    return index;
  };
  patched = true;
}
