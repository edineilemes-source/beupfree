import * as cheerio from "cheerio";

const AFFILIATE_CODE = "14610626";

export interface BrandCollectedItem {
  externalItemId: string | null;
  nome: string;
  preco_atual: number;
  preco_original: number | null;
  desconto_percent: number | null;
  link_afiliado: string;
  url: string;
  imagens: string[];
  avaliacao_media: number | null;
  qtd_avaliacoes: number | null;
  frete_gratis: boolean;
  fonte: string;
  contentHash: string;
}

function addAffiliateCode(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=${AFFILIATE_CODE}`;
}

function extractExternalId(url: string): string | null {
  const match = url.match(/MLB-?\d+/i);
  if (!match) return null;
  return match[0].replace(/-/g, "");
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

export async function scrapeBrandShopUrl(
  sourceUrl: string,
  sourceName: string
): Promise<{ items: BrandCollectedItem[]; errors: string[] }> {
  const errors: string[] = [];

  let html: string;
  try {
    // Add timeout and multiple retry headers
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      timeout: 20000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao acessar ${sourceUrl}`);
    }
    html = await response.text();
  } catch (err: any) {
    errors.push(`[Fetch] ${err.message || String(err)}`);
    // Don't return yet - log to help debugging
    console.log(`[mlBrandCollector] Erro ao acessar ${sourceName}: ${err.message}`);
    console.log(`[mlBrandCollector] URL: ${sourceUrl}`);
    return { items: [], errors };
  }

  const items: BrandCollectedItem[] = [];
  const seen = new Set<string>();

  console.log(`[mlBrandCollector] HTML length for ${sourceName}: ${html.length} bytes`);

  // Try to extract JSON data from window.__PRELOADED_STATE__ (common in modern SPAs)
  const jsonMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const preloadedState = JSON.parse(jsonMatch[1]);
      console.log(`[mlBrandCollector] Found __PRELOADED_STATE__ for ${sourceName}`);
      // Try to extract items from preloaded state
      // (ML structure varies, so we look for common patterns)
      const searchItems = preloadedState?.searchState?.itemsResponse?.results?.filter(
        (item: any) => item.id && item.title
      ) || [];
      if (searchItems.length > 0) {
        console.log(`[mlBrandCollector] Extracted ${searchItems.length} items from preloaded state`);
        for (const item of searchItems) {
          if (!item.title || !item.prices || item.prices.id < 0) continue;
          const currentPrice = parseFloat(item.prices.prices?.currentPrice || "0");
          if (currentPrice <= 0) continue;

          const contentHash = makeContentHash(item.title, currentPrice);
          if (seen.has(contentHash)) continue;
          seen.add(contentHash);

          items.push({
            externalItemId: item.id || null,
            nome: item.title,
            preco_atual: currentPrice,
            preco_original: parseFloat(item.prices?.prices?.originalPrice || currentPrice),
            desconto_percent: item.prices?.prices?.discountPercent || null,
            link_afiliado: addAffiliateCode(item.url || ""),
            url: item.url || "",
            imagens: item.images?.map((img: any) => img.url) || [],
            avaliacao_media: item.rating?.average || null,
            qtd_avaliacoes: item.rating?.count || null,
            frete_gratis: item.freeShipping || false,
            fonte: sourceName,
            contentHash,
          });
        }
      }
      if (items.length > 0) {
        return { items, errors };
      }
    } catch (e: any) {
      console.log(`[mlBrandCollector] Failed to parse __PRELOADED_STATE__: ${e.message}`);
    }
  }

  // Fallback to CSS selector approach
  const $ = cheerio.load(html);
  const selectors = [
    "div.poly-card--grid-card",
    "a[data-component-type='product-card']",
    "div[data-test='productGrid'] article",
    "article.ui-search-result",
    "li.ui-search-layout__item",
    "div.item",
    "div.s-result-item",
    "div[class*='product-card']",
  ];

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`[mlBrandCollector] Found ${elements.length} elements with selector: ${selector}`);
    }
    if (elements.length === 0) continue;

    elements.each((_i, el) => {
      try {
        const card = $(el);
        const title = card
          .find(".poly-component__title, .ui-search-result__title, h2")
          .first()
          .text()
          .trim();

        if (!title || title.length < 5) return;

        const rawLink =
          card.find("a").first().attr("href") ||
          card.attr("href") ||
          "";
        const cleanLink = rawLink.split("#")[0];
        if (!cleanLink) return;

        const affiliateLink = addAffiliateCode(cleanLink);
        const externalItemId = extractExternalId(cleanLink);

        const img =
          card.find(".poly-component__picture, img.ui-search-result__image")
            .first()
            .attr("src") || "";

        // Price extraction (try multiple selectors)
        let preco_atual = 0;
        const priceSelectors = [
          ".poly-price__current .andes-money-amount__fraction",
          ".ui-search-price__second-line .price-tag",
          ".price-tag-fraction",
        ];

        for (const ps of priceSelectors) {
          const frac = card.find(ps).first().text().trim().replace(".", "");
          if (frac) {
            preco_atual = parseFloat(frac);
            break;
          }
        }

        if (preco_atual <= 0) return;

        let preco_original: number | null = null;
        const origSelectors = [
          ".andes-money-amount--previous .andes-money-amount__fraction",
          ".ui-search-price__third-line .price-tag-fraction",
        ];

        for (const os of origSelectors) {
          const frac = card.find(os).first().text().trim().replace(".", "");
          if (frac) {
            preco_original = parseFloat(frac);
            break;
          }
        }

        // Discount
        let desconto_percent: number | null = null;
        const discountText = card
          .find(".poly-price__disc_label, .discount")
          .text()
          .trim();
        const match = discountText.match(/(\d+)%/);
        if (match) {
          desconto_percent = parseInt(match[1]);
        }

        // If no discount found but we have original price, calculate it
        if (!desconto_percent && preco_original && preco_original > preco_atual) {
          desconto_percent = Math.round(
            ((preco_original - preco_atual) / preco_original) * 100
          );
        }

        // Rating
        let avaliacao_media: number | null = null;
        const ratingText = card.find(".poly-reviews__rating").text().trim();
        const ratingMatch = ratingText.match(/([\d.,]+)/);
        if (ratingMatch) {
          avaliacao_media = parseFloat(ratingMatch[1].replace(",", "."));
        }

        // Reviews count
        let qtd_avaliacoes: number | null = null;
        const reviewsText = card.find(".poly-reviews__total").text().trim();
        const reviewsMatch = reviewsText.match(/\((\d+[\d.]*)\)/);
        if (reviewsMatch) {
          qtd_avaliacoes = parseInt(reviewsMatch[1].replace(".", ""));
        }

        // Shipping
        const cardTextNormalized = card
          .text()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const shippingText = card
          .find(".poly-component__shipping")
          .text()
          .trim();
        const frete_gratis =
          shippingText.toLowerCase().includes("grátis") ||
          shippingText.toLowerCase().includes("gratis") ||
          cardTextNormalized.includes("frete gratis") ||
          cardTextNormalized.includes("envio gratis") ||
          cardTextNormalized.includes("chegara gratis");

        const contentHash = makeContentHash(title, preco_atual);
        const dedupeKey = externalItemId || contentHash;

        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        items.push({
          externalItemId,
          nome: title,
          preco_atual,
          preco_original,
          desconto_percent,
          link_afiliado: affiliateLink,
          url: cleanLink,
          imagens: img ? [img] : [],
          avaliacao_media,
          qtd_avaliacoes,
          frete_gratis,
          fonte: sourceName,
          contentHash,
        });
      } catch (itemErr: any) {
        // Skip problematic items, don't break entire scrape
      }
    });

    // If we found items with this selector, stop trying others
    if (items.length > 0) break;
  }

  // Sort by discount descending, then by reviews
  items.sort((a, b) => {
    const dA = a.desconto_percent || 0;
    const dB = b.desconto_percent || 0;
    if (dB !== dA) return dB - dA;
    return (b.qtd_avaliacoes || 0) - (a.qtd_avaliacoes || 0);
  });

  return { items, errors };
}
