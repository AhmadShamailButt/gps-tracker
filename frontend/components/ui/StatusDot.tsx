import { cn } from "@/lib/utils";

const toneClass = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
  gray: "bg-muted-foreground/60",
  indigo: "bg-primary",
} as const;

type Tone = keyof typeof toneClass;

export function StatusDot({
  tone = "gray",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping",
            toneClass[tone]
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          toneClass[tone]
        )}
      />
    </span>
  );
}
