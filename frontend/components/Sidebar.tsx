"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { History, MapPin, Satellite, Activity, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

const top: Item[] = [
  { href: "/dashboard", label: "Live tracker", icon: MapPin, hint: "Map" },
  { href: "/history", label: "History", icon: History, hint: "Audit log" },
];

function NavLink({
  href,
  label,
  icon: Icon,
  hint,
  active,
}: Item & { active?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group/link relative mx-2 flex h-9 items-center rounded-lg px-2.5"
    >
      {active && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg bg-accent/70"
          transition={{ type: "spring", stiffness: 480, damping: 36 }}
        />
      )}
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        <Icon
          className={cn(
            "size-4 transition-colors",
            active
              ? "text-foreground"
              : "text-muted-foreground/80 group-hover/link:text-foreground"
          )}
          strokeWidth={active ? 2.2 : 1.8}
        />
      </span>
      <span
        className={cn(
          "relative ml-3 flex min-w-0 flex-1 items-center justify-between gap-2 whitespace-nowrap text-[13px] font-medium opacity-0 transition-opacity duration-150 sidebar-label",
          active ? "text-foreground" : "text-muted-foreground group-hover/link:text-foreground"
        )}
      >
        <span>{label}</span>
        {hint && (
          <span className="text-[10px] font-normal uppercase tracking-wider text-muted-foreground/60">
            {hint}
          </span>
        )}
      </span>
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="group/sidebar relative flex h-full w-14 shrink-0 flex-col border-r border-border/50 bg-card/70 backdrop-blur transition-[width] duration-200 ease-out hover:w-52">
      <div className="flex h-14 shrink-0 items-center px-3">
        <Link
          href="/"
          aria-label="GPS Tracker home"
          className="flex h-8 items-center gap-2.5"
        >
          <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Satellite className="size-4 text-primary" strokeWidth={2.2} />
          </span>
          <span className="flex items-center whitespace-nowrap leading-tight opacity-0 transition-opacity duration-150 sidebar-label">
            <span className="text-[13px] font-semibold text-foreground">GPS Tracker</span>
          </span>
        </Link>
      </div>

      <div className="mx-3 h-px bg-border/40" />

      <nav className="flex-1 overflow-hidden py-2">
        <p className="mb-1 mt-1 px-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 opacity-0 transition-opacity duration-150 sidebar-label">
          Navigation
        </p>
        <div className="flex flex-col gap-0.5">
          {top.map((item) => (
            <NavLink
              key={item.label}
              {...item}
              active={pathname?.startsWith(item.href) ?? false}
            />
          ))}
        </div>
      </nav>

      <div className="mx-3 h-px bg-border/40" />

      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="flex flex-col whitespace-nowrap leading-tight opacity-0 transition-opacity duration-150 sidebar-label">
            <span className="text-[11px] font-medium text-foreground">1 device live</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Activity className="size-2.5" /> MQTT broker
            </span>
          </span>
        </div>
        <ThemeToggle />
      </div>

      <style jsx>{`
        aside:hover :global(.sidebar-label) {
          opacity: 1;
        }
      `}</style>
    </aside>
  );
}

export default memo(Sidebar);
