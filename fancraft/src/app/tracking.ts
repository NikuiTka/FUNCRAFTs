import { useLayoutEffect, useState } from 'react';
import { FONT_ADVANCE } from '../pdf/fontFiles';

const SAMPLE = 200;

// Поправка ширини знака, px: на скільки браузер малює знак гарнітури вужчим (+) чи ширшим (−), ніж
// його міряє рушій. На дробовому масштабі екрана Windows округлює ширину гліфа до пікселя екрана —
// рядок у редакторі виходить довшим за рядок PDF, переноситься інакше, і глава «вилазить» зі своїх сторінок.
// Гарнітура моноширинна, тож одна поправка letter-spacing вирівнює всі знаки.
function measure(family: string, sizePx: number, weight: number): number {
  const span = document.createElement('span');
  Object.assign(span.style, {
    position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', left: '-9999px', top: '0',
    font: `${weight} ${sizePx}px ${family}`,
  });
  span.textContent = 'н'.repeat(SAMPLE);
  document.body.append(span);
  const range = document.createRange();
  range.selectNodeContents(span);
  // getBoundingClientRect на дробовому масштабі екрана іноді сам округлює субпіксельну ширину — тим самим
  // округленням, яке й мало виявити поправка, — тому міряємо через Range: він точніший на дробових DPI.
  const width = range.getClientRects()[0]?.width ?? span.getBoundingClientRect().width;
  span.remove();
  // Трохи менше за точну поправку: рядок, що рівно влазить у рушії, має влізти й тут.
  return (FONT_ADVANCE * sizePx * SAMPLE - width) / SAMPLE - 0.001;
}

// Поправки для основного тексту й назви; перемір — коли змінився кегль, масштаб екрана чи довантажився шрифт.
export function useTracking(family: string, bodyPx: number, titlePx: number): { body: number; title: number } {
  const [value, setValue] = useState({ body: 0, title: 0 });
  const [dpr, setDpr] = useState(() => window.devicePixelRatio);
  useLayoutEffect(() => {
    const query = matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [dpr]);
  useLayoutEffect(() => {
    let alive = true;
    const run = () => { if (alive) setValue({ body: measure(family, bodyPx, 400), title: measure(family, titlePx, 700) }); };
    run();
    void document.fonts.ready.then(run);
    document.fonts.addEventListener('loadingdone', run);
    return () => { alive = false; document.fonts.removeEventListener('loadingdone', run); };
  }, [family, bodyPx, titlePx, dpr]);
  return value;
}
