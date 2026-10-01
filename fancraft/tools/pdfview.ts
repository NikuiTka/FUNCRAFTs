import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = worker;
const params = new URLSearchParams(location.search);
const doc = await pdfjs.getDocument({ url: params.get('file') ?? '/out-draft.pdf' }).promise;
const from = Number(params.get('from') ?? 1);
const to = Math.min(Number(params.get('to') ?? doc.numPages), doc.numPages);
const scale = Number(params.get('scale') ?? 1);
for (let n = from; n <= to; n++) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  document.body.append(canvas);
  await page.render({ canvas, viewport }).promise;
}
document.body.dataset.done = '1';
