export type Tone = "indigo" | "sky" | "rose" | "amber" | "green" | "pink";

export const toneSurface: Record<Tone, string> = {
  indigo: "bg-pastel-indigo/70 text-on-indigo",
  sky: "bg-pastel-sky/70 text-on-sky",
  rose: "bg-pastel-rose/70 text-on-rose",
  amber: "bg-pastel-amber/70 text-on-amber",
  green: "bg-pastel-green/70 text-on-green",
  pink: "bg-pastel-pink/70 text-on-pink",
};

export const toneSurfaceSoft: Record<Tone, string> = {
  indigo: "bg-pastel-indigo/50",
  sky: "bg-pastel-sky/50",
  rose: "bg-pastel-rose/50",
  amber: "bg-pastel-amber/50",
  green: "bg-pastel-green/50",
  pink: "bg-pastel-pink/50",
};
