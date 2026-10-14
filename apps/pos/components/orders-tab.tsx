"use client";

/**
 * Pestaña Órdenes abiertas: locales (esta tablet) + remotas
 * (GET /api/orders?active=1 con fallback demo). Cobrar abre el flujo de pago.
 */
import { ClipboardList, RefreshCw, Store } from "lucide-react";
import { formatMoney } from "@rest/printer";
import { Badge, Button, cn } from "@rest/ui";
import { orderTicketNumber } from "@/lib/receipt";
import { localOrderToPayable, type LocalOrder, type PayableOrder } from "@/lib/pos-types";
import {
  remoteOrderToPayable,
  remoteOrderTotalCents,
  type RemoteOrder,
} from "@/lib/api";

export type RemoteState = "loading" | "live" | "demo";

interface OrdersTabProps {
  localOrders: LocalOrder[];
  remoteOrders: RemoteOrder[];
  remoteState: RemoteState;
  onRefresh: () => void;
  onCharge: (order: PayableOrder) => void;
}

function orderRowClasses() {
  return "flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between";
}

export function OrdersTab({
  localOrders,
  remoteOrders,
  remoteState,
  onRefresh,
  onCharge,
}: OrdersTabProps) {
  // Reconciliación: una orden local con folio definitivo que ya existe en el
  // servidor es LA MISMA orden — se muestra solo la copia del servidor (que
  // refleja el estado real de cocina) y se evita cobrarla dos veces.
  const remoteNumbers = new Set(
    remoteOrders.map((o) => o.number).filter((n): n is number => n != null),
  );
  const locals = localOrders.filter(
    (o) => o.number == null || !remoteNumbers.has(o.number),
  );
  const total = locals.length + remoteOrders.length;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ClipboardList className="size-5 text-primary" />
        <h2 className="font-semibold">Órdenes abiertas</h2>
        <Badge variant={total > 0 ? "warning" : "secondary"}>{total}</Badge>
        <Badge variant={remoteState === "live" ? "success" : "info"}>
          {remoteState === "loading"
            ? "Actualizando…"
            : remoteState === "live"
              ? "en vivo"
              : "demo"}
        </Badge>
        <Button
          size="icon"
          variant="outline"
          className="ml-auto size-11"
          aria-label="Refrescar órdenes"
          onClick={onRefresh}
          disabled={remoteState === "loading"}
        >
          <RefreshCw className={cn("size-4", remoteState === "loading" && "animate-spin")} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {total === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            No hay órdenes abiertas. Todo cobrado.
          </p>
        )}

        {/* Locales: enviadas a cocina desde esta tablet y sin pagar */}
        {locals.map((order) => (
          <div key={order.clientUuid} className={orderRowClasses()}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold">
                  {orderTicketNumber({ number: order.number, provisionalNumber: order.provisionalNumber })}
                </span>
                <Badge variant="secondary">
                  <Store className="size-3" /> esta tablet
                </Badge>
                {order.table && (
                  <span className="text-sm text-muted-foreground">{order.table}</span>
                )}
              </div>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    {item.quantity}× {item.name}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-bold tabular-nums">
                {formatMoney(order.totalCents)}
              </span>
              <Button className="h-11 px-5" onClick={() => onCharge(localOrderToPayable(order))}>
                Cobrar
              </Button>
            </div>
          </div>
        ))}

        {/* Remotas: de la API (o demo) */}
        {remoteOrders.map((order) => (
          <div key={`remote-${order.number}`} className={orderRowClasses()}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold">#{order.number}</span>
                <Badge variant="outline">{order.channel}</Badge>
                <Badge variant="secondary">{order.status}</Badge>
                <span className="text-sm text-muted-foreground">{order.target}</span>
                {order.staffName && (
                  <span className="text-xs text-muted-foreground">· {order.staffName}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  · hace {order.elapsedMinutes} min
                </span>
              </div>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {order.items.map((item, index) => (
                  <li key={`${item.name}-${index}`}>
                    {item.quantity}× {item.name}
                    {item.notes ? ` · ${item.notes}` : ""}
                    {item.modifiers && item.modifiers.length > 0
                      ? ` · ${item.modifiers.join(", ")}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-lg font-bold tabular-nums">
                {formatMoney(remoteOrderTotalCents(order))}
              </span>
              <Button className="h-11 px-5" onClick={() => onCharge(remoteOrderToPayable(order))}>
                Cobrar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
