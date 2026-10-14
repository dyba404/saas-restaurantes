"use client";

import { ChevronDown, ChevronUp, MessageCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Input, cn } from "@rest/ui";
import { ORG_SLUG } from "@/lib/use-api";

// ── Contrato del API real ───────────────────────────────────────────────────
// GET  /api/whatsapp/messages → { conversations: [{ waId, messages }] }
// POST /api/whatsapp/webhook  → { ok, orderNumber, reply }

interface WaApiMessage {
  direction: "in" | "out";
  body: string;
  orderNumber?: number | null;
  createdAt: string;
}

interface WaApiConversation {
  waId: string;
  messages: WaApiMessage[];
}

interface WaWebhookResponse {
  ok?: boolean;
  orderNumber?: number | null;
  reply?: string;
  error?: string;
}

const ORG_HEADERS = { "X-Org-Slug": ORG_SLUG } as const;

const DEMO_NUMBER = "+51 91234 5678";

const SUGGESTED_MESSAGES = [
  "2 ceviches de pescado y 1 chicha morada",
  "hola",
  "1 gringa sin gluten x2",
] as const;

// ── Guardas defensivas: si la API responde con otra forma, caemos al mock ───

function isWaMessage(value: unknown): value is WaApiMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Partial<WaApiMessage>;
  return (
    (m.direction === "in" || m.direction === "out") &&
    typeof m.body === "string" &&
    typeof m.createdAt === "string"
  );
}

function parseConversations(value: unknown): WaApiConversation[] | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = (value as { conversations?: unknown }).conversations;
  if (!Array.isArray(raw)) return null;
  const conversations: WaApiConversation[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const c = entry as { waId?: unknown; messages?: unknown };
    if (typeof c.waId !== "string" || !Array.isArray(c.messages)) return null;
    const messages: WaApiMessage[] = [];
    for (const m of c.messages) {
      if (!isWaMessage(m)) return null;
      messages.push(m);
    }
    conversations.push({ waId: c.waId, messages });
  }
  return conversations;
}

// ── Mock local (fallback offline) — misma forma que el API ──────────────────

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const MOCK_CONVERSATIONS: WaApiConversation[] = [
  {
    waId: "+51 98080 2020",
    messages: [
      { direction: "out", body: "¡Hola! Bienvenido a Cevichería El Muelle 🌮 Escribe tu pedido con cantidad y producto.", createdAt: minutesAgo(21) },
      { direction: "in", body: "Buenas, quiero 2 ceviches de pescado y 1 chicha morada", createdAt: minutesAgo(9) },
      {
        direction: "out",
        body: "✅ Pedido #515 confirmado:\n2× Ceviche de pescado\n1× Chicha morada\nTotal: $65.00\nTe avisamos cuando esté listo.",
        orderNumber: 515,
        createdAt: minutesAgo(9),
      },
    ],
  },
  {
    waId: "+51 93131 9090",
    messages: [
      { direction: "in", body: "hola", createdAt: minutesAgo(34) },
      { direction: "out", body: "¡Hola! 👋 Soy el asistente de Cevichería El Muelle. Para pedir, escribe cantidad y producto, por ejemplo: \"2 ceviches de pescado y 1 chicha morada\".", createdAt: minutesAgo(33) },
    ],
  },
  {
    waId: "+51 94040 7070",
    messages: [
      { direction: "in", body: "1 gringa sin gluten x2", createdAt: minutesAgo(52) },
      {
        direction: "out",
        body: "✅ Pedido #512 confirmado:\n2× Ceviche mixto\nTotal: $90.00\nTe avisamos cuando esté listo.",
        orderNumber: 512,
        createdAt: minutesAgo(51),
      },
    ],
  },
];

// ── Helpers de presentación ─────────────────────────────────────────────────

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

/** Primer renglón del último mensaje para la lista de conversaciones. */
function preview(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}…` : firstLine;
}

/** Punto no-leído: el último mensaje es del cliente y el hilo no se ha abierto. */
function isUnread(conversation: WaApiConversation, seen: Set<string>): boolean {
  const last = conversation.messages[conversation.messages.length - 1];
  return last?.direction === "in" && !seen.has(conversation.waId);
}

// ── Página ──────────────────────────────────────────────────────────────────

function VerifiedChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
      <span className="size-2 rounded-full bg-success" aria-hidden />
      Número conectado (simulador) · <span className="font-medium text-foreground">{DEMO_NUMBER}</span>
    </span>
  );
}

function ConversationRow({
  conversation,
  active,
  unread,
  onSelect,
}: {
  conversation: WaApiConversation;
  active: boolean;
  unread: boolean;
  onSelect: () => void;
}) {
  const last = conversation.messages[conversation.messages.length - 1];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full border-b px-4 py-3 text-left transition-colors last:border-0",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
          aria-hidden
        />
        <span className={cn("truncate text-sm tabular-nums", unread ? "font-semibold" : "font-medium")}>
          {conversation.waId}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {last ? timeOf(last.createdAt) : ""}
        </span>
      </div>
      <p className={cn("mt-0.5 truncate pl-4 text-xs", unread ? "text-foreground" : "text-muted-foreground")}>
        {last ? `${last.direction === "out" ? "Bot: " : ""}${preview(last.body)}` : "Sin mensajes"}
      </p>
    </button>
  );
}

function ChatBubble({ message }: { message: WaApiMessage }) {
  const isBusiness = message.direction === "out";
  return (
    <li className={cn("flex", isBusiness ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
          isBusiness ? "rounded-br-md border border-primary/10 bg-primary/10" : "rounded-bl-md bg-muted",
        )}
      >
        {isBusiness && (
          <span className="mb-1 flex items-center gap-1">
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              <Sparkles className="size-2.5" aria-hidden />
              bot
            </Badge>
            {message.orderNumber != null && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                #{message.orderNumber}
              </Badge>
            )}
          </span>
        )}
        <p className="whitespace-pre-line">{message.body}</p>
        <p className="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
          {timeOf(message.createdAt)}
        </p>
      </div>
    </li>
  );
}

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<WaApiConversation[]>(MOCK_CONVERSATIONS);
  const [source, setSource] = useState<"loading" | "live" | "demo">("loading");
  const [activeWaId, setActiveWaId] = useState<string>(MOCK_CONVERSATIONS[0]?.waId ?? "");
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [banner, setBanner] = useState<{ kind: "success" | "danger"; text: string } | null>(null);

  // Simulador de cliente
  const [simOpen, setSimOpen] = useState(true);
  const [fromWaId, setFromWaId] = useState<string>(MOCK_CONVERSATIONS[0]?.waId ?? "");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async (silent: boolean) => {
    if (!silent) setSource("loading");
    try {
      const res = await fetch("/api/whatsapp/messages", { headers: ORG_HEADERS, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseConversations(await res.json());
      if (!parsed) throw new Error("Formato inesperado");
      setConversations(parsed);
      setSource("live");
      setActiveWaId((prev) => (parsed.some((c) => c.waId === prev) ? prev : (parsed[0]?.waId ?? "")));
    } catch {
      setConversations(MOCK_CONVERSATIONS);
      setSource("demo");
      setActiveWaId((prev) =>
        MOCK_CONVERSATIONS.some((c) => c.waId === prev) ? prev : (MOCK_CONVERSATIONS[0]?.waId ?? ""),
      );
    }
  }, []);

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  // Al cambiar de conversación, el campo "de:" del simulador la sigue.
  useEffect(() => {
    if (activeWaId) setFromWaId(activeWaId);
  }, [activeWaId]);

  const active = conversations.find((c) => c.waId === activeWaId) ?? null;
  const unreadCount = conversations.filter((c) => isUnread(c, seen)).length;

  // Auto-scroll del chat al llegar mensajes nuevos.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length, activeWaId]);

  const selectConversation = (waId: string) => {
    setActiveWaId(waId);
    setSeen((prev) => new Set(prev).add(waId));
  };

  /** Enviar como cliente al webhook real; la respuesta del bot llega al refrescar. */
  const sendAsCustomer = async () => {
    const text = draft.trim();
    const from = fromWaId.trim();
    if (!text || !from || sending) return;
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch("/api/whatsapp/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug: ORG_SLUG, from, text }),
      });
      const data = (await res.json()) as WaWebhookResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDraft("");
      setBanner({
        kind: "success",
        text:
          data.orderNumber != null
            ? `Pedido #${data.orderNumber} creado por el bot — la respuesta ya está en el chat.`
            : "El bot respondió — el mensaje ya está en el chat.",
      });
      setSeen((prev) => new Set(prev).add(from));
      setActiveWaId(from);
      await refresh(true);
    } catch (error) {
      setBanner({
        kind: "danger",
        text: `No se pudo enviar el mensaje: ${error instanceof Error ? error.message : "error de red"}.`,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Bandeja de pedidos ·{" "}
            {unreadCount === 1 ? "1 conversación sin leer" : `${unreadCount} conversaciones sin leer`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source === "live" && (
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden /> en vivo
            </Badge>
          )}
          {source === "demo" && (
            <Badge variant="warning">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden /> demo
            </Badge>
          )}
          <VerifiedChip />
          <Button variant="outline" size="icon" onClick={() => void refresh(false)} aria-label="Refrescar conversaciones">
            <RefreshCw className={cn("size-4", source === "loading" && "animate-spin")} />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Producción: WhatsApp Cloud API de Meta — mismo webhook, mismas respuestas.
      </p>

      {banner && (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            banner.kind === "success"
              ? "border-success/20 bg-success/10 text-success-text"
              : "border-destructive/20 bg-destructive/10 text-danger-text",
          )}
        >
          {banner.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Lista de conversaciones */}
        <Card className="max-h-[520px] overflow-hidden self-start">
          <div className="flex items-center gap-2 border-b p-4">
            <MessageCircle className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Conversaciones</h2>
          </div>
          <div className="max-h-[456px] overflow-y-auto">
            {conversations.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                Sin conversaciones todavía — envía el primer mensaje desde el simulador.
              </p>
            )}
            {conversations.map((c) => (
              <ConversationRow
                key={c.waId}
                conversation={c}
                active={c.waId === activeWaId}
                unread={isUnread(c, seen)}
                onSelect={() => selectConversation(c.waId)}
              />
            ))}
          </div>
        </Card>

        {/* Panel de chat */}
        {active ? (
          <Card className="flex min-h-[420px] flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                {active.waId.replace(/\D/g, "").slice(-2) || "??"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tabular-nums">{active.waId}</p>
                <p className="text-xs text-muted-foreground">
                  {active.messages.length} mensajes · respuestas automáticas del bot
                </p>
              </div>
            </div>
            <ul className="flex max-h-[440px] flex-1 flex-col justify-end gap-2 overflow-y-auto p-4">
              {active.messages.map((m, i) => (
                <ChatBubble key={`${active.waId}-${i}`} message={m} />
              ))}
              <div ref={chatEndRef} />
            </ul>
          </Card>
        ) : (
          <Card className="flex min-h-[420px] items-center justify-center p-6 text-sm text-muted-foreground">
            Selecciona una conversación o usa el simulador para empezar un chat.
          </Card>
        )}
      </div>

      {/* Simulador de cliente — panel colapsable abajo */}
      <Card>
        <button
          type="button"
          onClick={() => setSimOpen((v) => !v)}
          aria-expanded={simOpen}
          className="flex w-full items-center gap-2 p-4 text-left"
        >
          <Send className="size-4 text-primary" aria-hidden />
          <span className="text-sm font-semibold">Simulador de cliente</span>
          <span className="text-xs text-muted-foreground">
            Prueba el bot con el mismo contrato del webhook de Meta
          </span>
          {simOpen ? (
            <ChevronUp className="ml-auto size-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="ml-auto size-4 text-muted-foreground" aria-hidden />
          )}
        </button>
        {simOpen && (
          <div className="space-y-3 border-t p-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Número del cliente (de)</span>
                <Input
                  value={fromWaId}
                  onChange={(e) => setFromWaId(e.target.value)}
                  placeholder="+51 90000 0000"
                  className="tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Mensaje</span>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendAsCustomer();
                  }}
                  placeholder="Ej. 2 ceviches de pescado y 1 chicha morada"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SUGGESTED_MESSAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setDraft(s)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => void sendAsCustomer()} disabled={sending || draft.trim() === "" || fromWaId.trim() === ""}>
                <Send aria-hidden />
                {sending ? "Enviando…" : "Enviar como cliente"}
              </Button>
              <p className="text-xs text-muted-foreground">
                POST /api/whatsapp/webhook — el bot responde y la orden entra a cocina.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
