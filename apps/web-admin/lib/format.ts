/** Formateo de dinero para el panel — es-PE / PEN en todas las vistas. */
export const money = (cents: number) =>
  (cents / 100).toLocaleString("es-PE", { style: "currency", currency: "PEN" });

export const moneyExact = money;
