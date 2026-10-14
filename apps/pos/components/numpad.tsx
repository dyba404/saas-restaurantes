"use client";

/**
 * Teclado numérico grande en pantalla (targets táctiles ≥56px).
 * Modelo de captura: cada dígito desplaza en centavos ("1500" → $15.00).
 */
import { Delete } from "lucide-react";
import { cn } from "@rest/ui";

interface NumpadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

const keyClass =
  "flex h-14 items-center justify-center rounded-xl border bg-card text-xl font-semibold text-foreground transition-colors hover:border-primary active:bg-muted";

export function Numpad({ onDigit, onClear, onBackspace, className }: NumpadProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={keyClass}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button type="button" className={keyClass} onClick={onClear} aria-label="Limpiar">
        C
      </button>
      <button type="button" className={keyClass} onClick={() => onDigit("0")}>
        0
      </button>
      <button
        type="button"
        className={keyClass}
        onClick={onBackspace}
        aria-label="Borrar un dígito"
      >
        <Delete className="size-5" />
      </button>
    </div>
  );
}
