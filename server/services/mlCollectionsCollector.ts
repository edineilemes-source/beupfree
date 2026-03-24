import * as cheerio from "cheerio";

const AFFILIATE_CODE = "14610626";

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
}

function addAffiliateCode(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=&matt_campaign_id=&matt_ad_group_id=&matt_match_type=&matt_network=&matt_device=&matt_creative=&matt_keyword=&matt_ad_position=&matt_ad_type=&matt_merchant_id=&matt_product_id=&matt_product_partition_id=&matt_target_id=`;
}

function extractExternalId(url: string): string | null {
  // Match MLB123, MLB-123, MLBU123 (universal product URLs), etc.
  const match = url.match(/MLB[A-Z]?-?\d+/i);
  if (!match) return null;
  // Normalize: strip country letters after MLB and dashes → MLB12345
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

export async function scrapeCollectionUrl(
  sourceUrl: string,
  sourceName: string
): Promise<{ items: CollectedItem[]; errors: string[] }> {
  const errors: string[] = [];

  let html: string;
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao acessar ${sourceUrl}`);
    }
    html = await response.text();
  } catch (err: any) {
    errors.push(err.message);
    return { items: [], errors };
  }

  const $ = cheerio.load(html);
  const items: CollectedItem[] = [];
  const seen = new Set<string>();

  $("div.poly-card").each((_i, el) => {
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
    // If no discount label, calculate from original vs current price
    if (!desconto_percent && preco_original && preco_original > preco_atual) {
      desconto_percent = Math.round((1 - preco_atual / preco_original) * 100);
    }

    const brand = card.find(".poly-component__brand").text().trim();
    const ratingText = card.find(".poly-reviews__rating").text().trim();
    const reviewsText = card.find(".poly-reviews__total").text().trim();
    const avaliacao_media = parseRating(ratingText);
    const qtd_avaliacoes = parseReviewCount(reviewsText);

    const shippingText = card.find(".poly-component__shipping").text().trim();
    const frete_gratis = shippingText.toLowerCase().includes("grátis") || shippingText.toLowerCase().includes("gratis");
    const parcelas = card.find(".poly-price__installments").text().trim();

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
    });
  });

  items.sort((a, b) => {
    const dA = a.desconto_percent || 0;
    const dB = b.desconto_percent || 0;
    if (dB !== dA) return dB - dA;
    return (b.qtd_avaliacoes || 0) - (a.qtd_avaliacoes || 0);
  });

  return { items, errors };
}
