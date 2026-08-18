export const PUBLIC_DEMO_MODE =
  String(import.meta.env?.PUBLIC_DEMO_MODE).trim().toLowerCase() === "true";

export const DEMO_STORE_LABEL = "Loja demonstrativa";
export const DEMO_PRODUCT_LABEL = "Produto demonstrativo";
export const DEMO_PRICE_NOTICE =
  "Valores exibidos nesta versão são demonstrativos e podem não refletir as condições atuais da loja.";

export function publicOfferSource(
  marketplaceName?: string | null,
  sellerName?: string | null,
  demoMode = PUBLIC_DEMO_MODE,
): string {
  if (demoMode) return DEMO_STORE_LABEL;
  return [marketplaceName?.trim(), sellerName?.trim()].filter(Boolean).join(" · ");
}
