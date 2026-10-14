/**
 * Staff — mock local de empleados y matriz de permisos por rol. Al conectar
 * DB (F1) los permisos se guardan por rol en la organización y el PIN se
 * sustituye por su hash.
 */

export interface Empleado {
  id: string;
  nombre: string;
  rol: string;
  /** Turno en curso ahora mismo (punto verde/gris). */
  enTurno: boolean;
  ventasHoyCents: number;
}

export const EMPLEADOS: Empleado[] = [
  { id: "e1", nombre: "Ana", rol: "Mesera", enTurno: true, ventasHoyCents: 246_500 },
  { id: "e2", nombre: "Luis", rol: "Mesero", enTurno: true, ventasHoyCents: 198_200 },
  { id: "e3", nombre: "Sofía", rol: "Cajera", enTurno: false, ventasHoyCents: 512_800 },
];

export const PERMISOS = [
  { id: "cobrar", label: "Cobrar" },
  { id: "anular", label: "Anular órdenes" },
  { id: "descuentos", label: "Descuentos" },
  { id: "editarMenu", label: "Editar menú" },
  { id: "verReportes", label: "Ver reportes" },
] as const;

export type PermisoId = (typeof PERMISOS)[number]["id"];

export const ROLES = ["Mesero", "Cajera", "Gerente"] as const;
export type Rol = (typeof ROLES)[number];

export type PermisosPorRol = Record<Rol, Record<PermisoId, boolean>>;

export const PERMISOS_INICIALES: PermisosPorRol = {
  Mesero: { cobrar: true, anular: false, descuentos: false, editarMenu: false, verReportes: false },
  Cajera: { cobrar: true, anular: true, descuentos: true, editarMenu: false, verReportes: false },
  Gerente: { cobrar: true, anular: true, descuentos: true, editarMenu: true, verReportes: true },
};
