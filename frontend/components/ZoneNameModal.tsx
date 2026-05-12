"use client";

import { useState } from "react";
import { ZoneType } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onCancel: () => void;
  onSubmit: (name: string, type: ZoneType) => void;
};

export default function ZoneNameModal({ open, onCancel, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ZoneType>("restricted");

  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), type);
    setName("");
    setType("restricted");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onCancel}
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-foreground/30 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-[400px] max-w-[92vw] rounded-2xl border border-border/60 bg-card p-6"
          >
            <div className="mb-1 flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                New geofence zone
              </h2>
            </div>
            <p className="mb-5 text-xs text-muted-foreground">
              Pick a name and choose how the dashboard should react when the device crosses
              this boundary.
            </p>

            <label className="mb-5 block">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </div>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Home, School, Office"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
            </label>

            <fieldset className="mb-6">
              <legend className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <ZoneTypeOption
                  active={type === "restricted"}
                  onClick={() => setType("restricted")}
                  icon={<ShieldAlert className="size-4" />}
                  title="Restricted"
                  description="Alert if inside"
                  tone="rose"
                />
                <ZoneTypeOption
                  active={type === "allowed"}
                  onClick={() => setType("allowed")}
                  icon={<ShieldCheck className="size-4" />}
                  title="Allowed"
                  description="Alert if outside"
                  tone="green"
                />
              </div>
            </fieldset>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!name.trim()}>
                Save zone
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ZoneTypeOption({
  active,
  onClick,
  icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "rose" | "green";
}) {
  const activeBg = tone === "rose" ? "bg-pastel-rose/70" : "bg-pastel-green/70";
  const activeRing = tone === "rose" ? "ring-on-rose/40" : "ring-on-green/40";
  const activeText = tone === "rose" ? "text-on-rose" : "text-on-green";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-all",
        active
          ? `${activeBg} border-transparent ring-2 ${activeRing}`
          : "border-border/60 bg-card hover:bg-accent/40"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            tone === "rose" ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
          )}
        >
          {icon}
        </span>
        <span className={cn("text-sm font-semibold", active && activeText)}>{title}</span>
      </div>
      <span className={cn("text-xs", active ? activeText : "text-muted-foreground")}>
        {description}
      </span>
    </button>
  );
}
