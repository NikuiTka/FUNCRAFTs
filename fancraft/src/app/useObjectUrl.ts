import { useEffect, useMemo } from 'react';

// Відкликання, відкладені до наступного такту: React (StrictMode) у розробці знімає й одразу
// знову ставить ефекти — повторний ефект скасовує відкликання, і прев'ю не зникає.
const pending = new Map<string, ReturnType<typeof setTimeout>>();

// Адреса blob: для прев'ю байтів; відкликається, коли байти змінилися або компонент зник.
export function useObjectUrl(bytes: Uint8Array | undefined, type?: string): string | null {
  const url = useMemo(() => (bytes ? URL.createObjectURL(new Blob([bytes as BlobPart], type ? { type } : {})) : null), [bytes, type]);
  useEffect(() => {
    if (!url) return;
    clearTimeout(pending.get(url));
    pending.delete(url);
    return () => {
      pending.set(url, setTimeout(() => { URL.revokeObjectURL(url); pending.delete(url); }, 0));
    };
  }, [url]);
  return url;
}
