// Інструмент розробки: node tools/icons.mjs — іконки PWA в public/ (літера F гарнітурою Lora на теракотовому тлі).
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

GlobalFonts.registerFromPath('node_modules/@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf', 'LoraBold');

function icon(size, { maskable = false } = {}) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const r = maskable ? 0 : size * 0.18;
  ctx.fillStyle = '#8a3b12';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();
  // Для maskable лишаємо безпечне поле: літера в центральних 60 %.
  const scale = maskable ? 0.5 : 0.62;
  ctx.fillStyle = '#f6f5f2';
  ctx.font = `${size * scale}px LoraBold`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText('F');
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillText('F', size / 2, size / 2 + h / 2 - m.actualBoundingBoxDescent);
  return c.toBuffer('image/png');
}

writeFileSync('public/pwa-192.png', icon(192));
writeFileSync('public/pwa-512.png', icon(512));
writeFileSync('public/pwa-maskable-512.png', icon(512, { maskable: true }));
writeFileSync('public/apple-touch-icon.png', icon(180, { maskable: true }));
console.log('public/pwa-192.png, pwa-512.png, pwa-maskable-512.png, apple-touch-icon.png');
