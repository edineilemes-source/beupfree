// UpPulse brand tokens shared across the public site.
// The green/yellow palette already lives in index.css as the primary/accent
// tokens; NEON and the dark nav/hero surfaces are brand-specific accents used
// only on dark surfaces (header nav + catalog hero).
export const NEON = "hsl(96 85% 55%)";
export const DARK = "hsl(150 30% 8%)";
export const DARK_NAV = "hsl(150 32% 11%)";
export const GREEN_GLOW = "hsl(145 70% 35%)";

// Returns a brand color with the given alpha (0–1), using modern
// space-separated hsl syntax: hsl(H S% L%) -> hsl(H S% L% / a).
export function alpha(color: string, a: number): string {
  return color.replace(/^hsl\((.*)\)$/, (_match, inner) => `hsl(${inner} / ${a})`);
}

// Runner mascot used in the UpPulse logo.
export const RUNNER_PATH =
  "M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z";
