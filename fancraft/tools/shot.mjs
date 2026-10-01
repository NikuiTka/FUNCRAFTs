// Інструмент розробки: node tools/shot.mjs <url> <out.png> [вираз] [очікування, мс] [ширина вікна, px] [масштаб екрана, напр. 1.9]
// Відкриває сторінку в headless Edge (окремий тимчасовий профіль, порт 9334), виконує вираз JS,
// чекає і знімає екран (типово 1400×900). Консоль сторінки й воркерів — у stdout.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, expr = '', waitMs = '6000', widthArg = '1400', scaleArg = '1'] = process.argv.slice(2);
const width = Number(widthArg);
const profile = mkdtempSync(join(tmpdir(), 'cdp-shot-'));
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ['--headless=new', '--disable-gpu', '--remote-debugging-port=9334', `--user-data-dir=${profile}`, `--window-size=${width},900`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9334/json')).json(); break; } catch { await sleep(250); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));

let id = 0;
const waiters = new Map();
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const i = ++id;
  waiters.set(i, resolve);
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
ws.addEventListener('message', async ({ data }) => {
  const m = JSON.parse(data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result ?? m.error); waiters.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') console.log(`[console.${m.params.type}]`, m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') console.log('[exception]', m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Target.attachedToTarget') {
    const s = m.params.sessionId;
    await send('Runtime.enable', {}, s);
    await send('Runtime.runIfWaitingForDebugger', {}, s);
  }
});

await send('Runtime.enable');
await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: Number(scaleArg), mobile: false });
await send('Page.navigate', { url });
await sleep(4000);
if (expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log('[result]', JSON.stringify(r.result?.value ?? r));
}
await sleep(Number(waitMs));
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));

const version = await (await fetch('http://127.0.0.1:9334/json/version')).json();
const bws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => bws.addEventListener('open', r));
bws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
await sleep(1000);
edge.kill();
process.exit(0);
