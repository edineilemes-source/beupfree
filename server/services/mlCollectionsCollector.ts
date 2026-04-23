import * as cheerio from "cheerio";

const AFFILIATE_CODE = "14610626";

// ============ CONFIG ============
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

const MAX_PAGES = 25;            // hard cap to avoid runaway loops
const MAX_RETRIES = 3;
const MIN_DISCOUNT_PERCENT = 25; // filter at collection
const SLEEP_MIN_MS = 1500;
const SLEEP_MAX_MS = 3000;
const HTTP_TIMEOUT_MS = 20000;

export type PromotionType = "lightning" | "deal_of_day" | "general";

export interface CollectedItem {
  externalItemId: string | null;
  nome: string;
  marca: string;
  preco_atual: number;
  preco_original: number | null;
  desconto_percent: number | null;
  link_afiliado: string;
  url: string;
  imagens: string[];
  avaliacao_media: number | null;
  qtd_avaliacoes: number | null;
  frete_gratis: boolean;
  parcelas: string;
  fonte: string;
  contentHash: string;
  promotionType: PromotionType;
}

// ============ HELPERS ============
function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isBlocked(html: string): boolean {
  if (!html || html.length < 5000) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("access denied") ||
    lower.includes("pardon our interruption") ||
    lower.includes("captcha") && lower.includes("verify")
  );
}

function addAffiliateCode(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=&matt_campaign_id=&matt_ad_group_id=&matt_match_type=&matt_network=&matt_device=&matt_creative=&matt_keyword=&matt_ad_position=&matt_ad_type=&matt_merchant_id=&matt_product_id=&matt_product_partition_id=&matt_target_id=`;
}

function extractExternalId(url: string): string | null {
  const match = url.match(/MLB[A-Z]?-?\d+/i);
  if (!match) return null;
  return match[0].replace(/-/g, "").replace(/^MLB[A-Z]/i, (m) => "MLB" + m.slice(4));
}

function parseDiscount(text: string): number | null {
  const match = text.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

function parseRating(text: string): number | null {
  const match = text.match(/([\d.,]+)/);
  if (!match) return null;
  return parseFloat(match[1].replace(",", "."));
}

function parseReviewCount(text: string): number | null {
  const match = text.match(/\((\d+[\d.]*)\)/);
  if (!match) return null;
  return parseInt(match[1].replace(".", ""));
}

function makeContentHash(title: string, price: number): string {
  const raw = `${title.toLowerCase().trim()}::${price.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// ============ HTTP CLIENT ============
async function fetchWithRetry(url: string, attempt = 1): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUA(),
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    if (isBlocked(html)) throw new Error("Blocked or empty response from ML");

    return html;
  } catch (err: any) {
    clearTimeout(timeout);
    if (attempt < MAX_RETRIES) {
      const backoff = 1000 * attempt + randomBetween(200, 800);
      console.log(`[MLCollector] Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms → ${err.message}`);
      await sleep(backoff);
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

// ============ PARSER ============
function detectPromotionType(card: cheerio.Cheerio<any>): PromotionType {
  // Lightning: countdown timer present
  if (card.find(".poly-component__highlight-countdown, .poly-highlight-countdown__text").length > 0) {
    return "lightning";
  }
  // Deal of the day: highlight badge text
  const highlightText = card.find(".poly-component__highlight").first().text().trim().toUpperCase();
  if (highlightText.includes("OFERTA DO DIA")) return "deal_of_day";
  if (highlightText.includes("OFERTA RELÂMPAGO") || highlightText.includes("RELAMPAGO")) {
    return "lightning";
  }
  return "general";
}

function buildPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  // Strip any existing &page=N or ?page=N
  const cleaned = baseUrl.replace(/([?&])page=\d+&?/i, "$1").replace(/[?&]$/, "");
  const sep = cleaned.includes("?") ? "&" : "?";
  return `${cleaned}${sep}page=${page}`;
}

function parsePage(
  html: string,
  sourceName: string
): { items: CollectedItem[]; hasNextPage: boolean; totalCards: number } {
  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];
  const seen = new Set<string>();
  const allCards = $("div.poly-card");
  const totalCards = allCards.length;

  allCards.each((_i, el) => {
    const card = $(el);
    const title = card.find(".poly-component__title").first().text().trim();
    if (!title) return;

    const rawLink = card.find("a").first().attr("href") || "";
    const cleanLink = rawLink.split("#")[0];
    const affiliateLink = addAffiliateCode(cleanLink);
    const externalItemId = extractExternalId(cleanLink);

    const img = card.find(".poly-component__picture").first().attr("src") || "";

    const currentFraction = card
      .find(".poly-price__current .andes-money-amount__fraction")
      .first().text().trim().replace(".", "");
    const currentCents = card
      .find(".poly-price__current .andes-money-amount__cents")
      .first().text().trim();
    const preco_atual = currentFraction
      ? parseFloat(`${currentFraction}.${currentCents || "00"}`)
      : 0;

    if (preco_atual <= 0) return;

    const origFraction = card
      .find(".andes-money-amount--previous .andes-money-amount__fraction")
      .first().text().trim().replace(".", "");
    const origCents = card
      .find(".andes-money-amount--previous .andes-money-amount__cents")
      .first().text().trim();
    const preco_original = origFraction
      ? parseFloat(`${origFraction}.${origCents || "00"}`)
      : null;

    const discountText = card.find(".poly-price__disc_label").text().trim();
    let desconto_percent = parseDiscount(discountText);
    if (!desconto_percent && preco_original && preco_original > preco_atual) {
      desconto_percent = Math.round((1 - preco_atual / preco_original) * 100);
    }

    // Apply minimum discount filter at parse time
    if (!desconto_percent || desconto_percent < MIN_DISCOUNT_PERCENT) return;

    const brand = card.find(".poly-component__brand").text().trim();
    const ratingText = card.find(".poly-reviews__rating").text().trim();
    const reviewsText = card.find(".poly-reviews__total").text().trim();
    const avaliacao_media = parseRating(ratingText);
    const qtd_avaliacoes = parseReviewCount(reviewsText);

    const shippingText = card.find(".poly-component__shipping").text().trim();
    const frete_gratis =
      shippingText.toLowerCase().includes("grátis") ||
      shippingText.toLowerCase().includes("gratis");
    const parcelas = card.find(".poly-price__installments").text().trim();

    const promotionType = detectPromotionType(card);
    const contentHash = makeContentHash(title, preco_atual);
    const dedupeKey = externalItemId || contentHash;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    items.push({
      externalItemId,
      nome: title,
      marca: brand || "N/A",
      preco_atual,
      preco_original,
      desconto_percent,
      link_afiliado: affiliateLink,
      url: cleanLink,
      imagens: img ? [img] : [],
      avaliacao_media,
      qtd_avaliacoes,
      frete_gratis,
      parcelas,
      fonte: sourceName,
      contentHash,
      promotionType,
    });
  });

  // Check for any next-page link in pagination. ML uses andes-pagination links
  // labelled "Vá para a página N" — there is also a "next" arrow button.
  // We accept any pagination link whose href contains page=N.
  let hasNextPage = false;
  $('a.andes-pagination__link, a[aria-label*="página"], a[aria-label="Seguinte"], a[aria-label="Próximo"]').each((_i, el) => {
    const href = $(el).attr("href") || "";
    if (/page=\d+/i.test(href)) {
      hasNextPage = true;
      return false; // break
    }
  });

  return { items, hasNextPage, totalCards };
}

// ============ MAIN: paginated scraper ============
export async function scrapeCollectionUrl(
  sourceUrl: string,
  sourceName: string
): Promise<{ items: CollectedItem[]; errors: string[] }> {
  const errors: string[] = [];
  const allItems: CollectedItem[] = [];
  const globalSeen = new Set<string>();
  let previousPageHash = "";

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildPageUrl(sourceUrl, page);

    let html: string;
    try {
      html = await fetchWithRetry(url);
    } catch (err: any) {
      errors.push(`Página ${page}: ${err.message}`);
      break; // can't continue paginating if a page fails
    }

    const { items, hasNextPage, totalCards } = parsePage(html, sourceName);

    // Hard stop only when the page itself has no product cards at all (real end of list)
    if (totalCards === 0) {
      console.log(`[MLCollector] ${sourceName} page ${page}: no cards on page → stop`);
      break;
    }

    // Anti-loop: if first 5 items repeat from previous page, stop
    if (items.length > 0) {
      const currentHash = JSON.stringify(items.slice(0, 5).map((i) => i.contentHash));
      if (currentHash === previousPageHash) {
        console.log(`[MLCollector] ${sourceName} page ${page}: repeated content → stop`);
        break;
      }
      previousPageHash = currentHash;
    }

    // Dedupe across pages
    let added = 0;
    for (const item of items) {
      const key = item.externalItemId || item.contentHash;
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);
      allItems.push(item);
      added++;
    }

    console.log(
      `[MLCollector] ${sourceName} page ${page}: ${totalCards} cards, ${items.length} passed filter, ${added} new (total: ${allItems.length})`
    );

    if (!hasNextPage) {
      console.log(`[MLCollector] ${sourceName}: no next-page link → stop at page ${page}`);
      break;
    }

    // Respectful delay between pages
    await sleep(randomBetween(SLEEP_MIN_MS, SLEEP_MAX_MS));
  }

  // Sort by discount DESC then by reviews DESC
  allItems.sort((a, b) => {
    const dA = a.desconto_percent || 0;
    const dB = b.desconto_percent || 0;
    if (dB !== dA) return dB - dA;
    return (b.qtd_avaliacoes || 0) - (a.qtd_avaliacoes || 0);
  });

  return { items: allItems, errors };
}
