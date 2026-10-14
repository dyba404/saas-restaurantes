"use client";

import { useEffect } from "react";

/**
 * Registra el service worker generado por Serwist (public/sw.js, desde app/sw.ts).
 * En dev no existe (disable en next.config) y el catch lo ignora: offline sigue
 * funcionando vía el outbox de @rest/sync, solo se pierde el precache.
 */
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW: offline sigue funcionando por la cola outbox (@rest/sync) */
      });
    }
  }, []);
  return null;
}
