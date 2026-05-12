"use client";

import { useMap } from "react-leaflet";
import { Plus, Minus, Locate, Pentagon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { startDrawingZone } from "@/components/MapView";
import { cn } from "@/lib/utils";

type Props = {
  centerOn: [number, number] | null;
  isDrawing: boolean;
};

export default function MapControls({ centerOn, isDrawing }: Props) {
  const map = useMap();

  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-4 z-[400] -translate-x-1/2">
        <AnimatePresence mode="wait">
          {isDrawing ? (
            <motion.div
              key="drawing"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-pastel-indigo/80 bg-pastel-indigo/60 px-4 py-2 text-on-indigo backdrop-blur"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-on-indigo opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-on-indigo" />
              </span>
              <span className="text-xs font-semibold">Drawing zone</span>
              <span className="text-[11px] opacity-80">
                Click points · click first point to finish
              </span>
            </motion.div>
          ) : (
            <motion.button
              key="idle"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onClick={startDrawingZone}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-4 py-2 text-foreground backdrop-blur transition-colors hover:bg-accent/60"
            >
              <Pentagon className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">Draw zone</span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Outline a Restricted or Allowed area
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="pointer-events-auto absolute right-4 bottom-10 z-[500] flex flex-col gap-1 rounded-xl border border-border/60 bg-card/85 p-1 backdrop-blur">
        <FabButton onClick={() => map.zoomIn()} aria-label="Zoom in">
          <Plus className="size-4" />
        </FabButton>
        <FabButton onClick={() => map.zoomOut()} aria-label="Zoom out">
          <Minus className="size-4" />
        </FabButton>
        <span className="my-0.5 h-px bg-border/60" />
        <FabButton
          onClick={() => centerOn && map.setView(centerOn, 16)}
          disabled={!centerOn}
          aria-label="Center on device"
          title="Center on device"
        >
          <Locate className="size-4" />
        </FabButton>
      </div>
    </>
  );
}

function FabButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  );
}
