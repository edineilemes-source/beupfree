import * as cheerio from "cheerio";

const AFFILIATE_CODE = "14610626";

const SOURCES = [
  {
    name: "Ofertas Calçados Esportivos",
    url: "https://www.mercadolivre.com.br/ofertas?category=MLB23332",
  },
];

export interface ScrapedProduct {
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
}

function addAffiliateCode(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=14610626&matt_word=&matt_source=&matt_campaign_id=&matt_ad_group_id=&matt_match_type=&matt_network=&matt_device=&matt_creative=&matt_keyword=&matt_ad_position=&matt_ad_type=&matt_merchant_id=&matt_product_id=&matt_product_partition_id=&matt_target_id=`;
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

async function scrapeUrl(source: { name: string; url: string }): Promise<ScrapedProduct[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao acessar ${source.url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];

  $("div.poly-card--grid-card").each((_i, el) => {
    const card = $(el);

    const title = card.find(".poly-component__title").first().text().trim();
    if (!title) return;

    const rawLink = card.find("a").first().attr("href") || "";
    const cleanLink = rawLink.split("#")[0];
    const affiliateLink = addAffiliateCode(cleanLink);

    const img = card.find(".poly-component__picture").first().attr("src") || "";

    const currentFraction = card
      .find(".poly-price__current .andes-money-amount__fraction")
      .first()
      .text()
      .trim()
      .replace(".", "");
    const currentCents = card
      .find(".poly-price__current .andes-money-amount__cents")
      .first()
      .text()
      .trim();
    const currentPrice = currentFraction
      ? parseFloat(`${currentFraction}.${currentCents || "00"}`)
      : 0;

    const origFraction = card
      .find(
        ".andes-money-amount--previous .andes-money-amount__fraction"
      )
      .first()
      .text()
      .trim()
      .replace(".", "");
    const origCents = card
      .find(".andes-money-amount--previous .andes-money-amount__cents")
      .first()
      .text()
      .trim();
    const originalPrice = origFraction
      ? parseFloat(`${origFraction}.${origCents || "00"}`)
      : null;

    const discountText = card.find(".poly-price__disc_label").text().trim();
    const discountPercent = parseDiscount(discountText);

    const brand = card.find(".poly-component__brand").text().trim();

    const ratingText = card.find(".poly-reviews__rating").text().trim();
    const reviewsText = card.find(".poly-reviews__total").text().trim();
    const rating = parseRating(ratingText);
    const reviewCount = parseReviewCount(reviewsText);

    const shippingText = card.find(".poly-component__shipping").text().trim();
    const freeShipping =
      shippingText.toLowerCase().includes("grátis") ||
      shippingText.toLowerCase().includes("gratis");

    const installments = card
      .find(".poly-price__installments")
      .text()
      .trim();

    products.push({
      nome: title,
      marca: brand || "N/A",
      preco_atual: currentPrice,
      preco_original: originalPrice,
      desconto_percent: discountPercent,
      link_afiliado: affiliateLink,
      url: cleanLink,
      imagens: img ? [img] : [],
      avaliacao_media: rating,
      qtd_avaliacoes: reviewCount,
      frete_gratis: freeShipping,
      parcelas: installments,
      fonte: source.name,
    });
  });

  return products;
}

export async function scrapeAllSources(): Promise<{
  produtos: ScrapedProduct[];
  fontes: string[];
  total: number;
  erros: string[];
}> {
  const allProducts: ScrapedProduct[] = [];
  const erros: string[] = [];
  const fontes: string[] = [];

  for (const source of SOURCES) {
    try {
      const products = await scrapeUrl(source);
      allProducts.push(...products);
      fontes.push(`${source.name} (${products.length})`);
    } catch (err: any) {
      erros.push(`${source.name}: ${err.message}`);
    }
  }

  const seen = new Set<string>();
  const unique = allProducts.filter((p) => {
    const key = p.url || p.nome;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const dA = a.desconto_percent || 0;
    const dB = b.desconto_percent || 0;
    if (dB !== dA) return dB - dA;
    return (b.qtd_avaliacoes || 0) - (a.qtd_avaliacoes || 0);
  });

  return {
    produtos: unique,
    fontes,
    total: unique.length,
    erros,
  };
}

export function getSources() {
  return SOURCES;
}

export function addSource(name: string, url: string) {
  SOURCES.push({ name, url });
}
