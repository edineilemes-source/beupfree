---
name: HSL brand tokens + inline-style alpha
description: Brand color constants are hsl() strings; appending a hex alpha suffix makes invalid CSS that browsers drop silently.
---

Brand tokens in `client/src/lib/brand.ts` (NEON, DARK, DARK_NAV, GREEN_GLOW) are `hsl(H S% L%)` strings. To get a translucent variant inside an inline `style` or a gradient string, NEVER append a hex alpha suffix like `${NEON}33` / `${DARK}cc`. That yields `hsl(96 85% 55%)33`, which is invalid CSS and is silently dropped by the browser — the gradient/streak/glow simply does not render, with no console error.

**Why:** Hex alpha (`#rrggbbaa`) only works on hex colors, not on `hsl()` strings. The failure is silent and easy to miss in a screenshot when other dark layers look similar; it took an architect review to catch.

**How to apply:** Use the `alpha(color, a)` helper exported from `brand.ts`, which injects modern space-separated syntax `hsl(H S% L% / a)`, e.g. `alpha(NEON, 0.12)`. Applies to any inline-style color built from these tokens (header/hero diagonal streaks, glows, translucent button backgrounds).
