/**
 * Canal de soporte único del SaaS (SUPPORT_CONTACT en .env, ej. "WhatsApp +51 987 654 321").
 * Se inyecta en los mensajes que el POS/KDS/carta reciben del API (suspensión,
 * dispositivo no autorizado) y en las páginas de ayuda.
 */
export function supportContact(): string | null {
  const c = process.env.SUPPORT_CONTACT?.trim();
  return c ? c : null;
}

/** Mensaje de suspensión con canal real si está configurado. */
export function suspendedMessage(): string {
  const c = supportContact();
  return c
    ? `Servicio suspendido. Contacta a soporte (${c}).`
    : "Servicio suspendido. Contacta a soporte.";
}
