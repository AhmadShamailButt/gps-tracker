import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("bg-card transition-colors", {
  variants: {
    variant: {
      default: "border border-border/60",
      ghost: "border border-transparent",
      pastel: "border border-transparent",
    },
    tone: {
      none: "",
      indigo: "bg-pastel-indigo/40",
      green: "bg-pastel-green/40",
      amber: "bg-pastel-amber/40",
      sky: "bg-pastel-sky/40",
      rose: "bg-pastel-rose/40",
      pink: "bg-pastel-pink/40",
    },
    size: {
      sm: "p-3 rounded-md",
      md: "p-4 rounded-lg",
      lg: "p-6 rounded-xl",
    },
    interactive: {
      true: "cursor-pointer hover:border-border hover:bg-accent/40",
      false: "",
    },
  },
  defaultVariants: { variant: "default", tone: "none", size: "md", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, tone, size, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, tone, size, interactive, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";
