/**
 * Persistencia local del POS (localStorage) + hook de estado persistido.
 * Todo el estado que debe sobrevivir recargas/cierres de la tablet vive aquí:
 * toggle offline, pagos de la sesión, órdenes locales, folio provisional, etc.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado: el flujo local sigue en memoria */
  }
}

/**
 * useState que hidrata desde localStorage al montar (después del primer render,
 * para no romper SSR/hidratación) y persiste en cada cambio.
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
): readonly [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(fallback);
  const fallbackRef = useRef(fallback);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setValue(loadJson(key, fallbackRef.current));
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        saveJson(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}
