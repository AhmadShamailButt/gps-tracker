import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        indigo: "bg-pastel-indigo/60 text-on-indigo",
        green: "bg-pastel-green/60 text-on-green",
        amber: "bg-pastel-amber/60 text-on-amber",
        sky: "bg-pastel-sky/60 text-on-sky",
        rose: "bg-pastel-rose/60 text-on-rose",
        danger: "bg-pastel-rose/70 text-on-rose",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, className }))} {...props} />;
}
