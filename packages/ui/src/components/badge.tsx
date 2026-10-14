import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../cn";

/**
 * Estados "suaves": fondo tintado al 10% + borde al 20% + texto en tono calmado.
 * La variante sólida queda reservada para la marca (default) — todo lo demás es
 * neutro o suave para no competir con las acciones primarias.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-success/20 bg-success/10 text-success-text",
        warning: "border-warning/20 bg-warning/10 text-warning-text",
        danger: "border-destructive/20 bg-destructive/10 text-danger-text",
        info: "border-info/20 bg-info/10 text-info-text",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
