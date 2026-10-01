// Зображення з буфера в події paste; null — зображення немає або поряд є текст (тоді вставляється текст).
export function pastedImage(e: ClipboardEvent): File | null {
  const data = e.clipboardData;
  if (!data || data.getData('text/plain')) return null;
  return [...data.files].find((f) => f.type.startsWith('image/')) ?? null;
}
