import { normalizeAttributeText, slugifyAttributeValue } from "../normalization";

export interface ColorDictionaryEntry {
  label: string;
  value: string;
  aliases: string[];
  confidence: number;
}

const definitions: Array<Omit<ColorDictionaryEntry, "value">> = [
  { label: "Off-white", aliases: ["off white", "off-white"], confidence: 0.98 },
  { label: "Azul-marinho", aliases: ["azul marinho", "azul-marinho", "marinho", "navy"], confidence: 0.98 },
  { label: "Preto", aliases: ["preto", "preta", "black"], confidence: 0.98 },
  { label: "Branco", aliases: ["branco", "branca", "white"], confidence: 0.98 },
  { label: "Azul", aliases: ["azul", "blue"], confidence: 0.98 },
  { label: "Vermelho", aliases: ["vermelho", "vermelha", "red"], confidence: 0.98 },
  { label: "Verde", aliases: ["verde", "green"], confidence: 0.98 },
  { label: "Amarelo", aliases: ["amarelo", "amarela", "yellow"], confidence: 0.98 },
  { label: "Laranja", aliases: ["laranja", "orange"], confidence: 0.98 },
  { label: "Rosa", aliases: ["rosa", "pink"], confidence: 0.98 },
  { label: "Magenta", aliases: ["magenta"], confidence: 0.98 },
  { label: "Roxo", aliases: ["roxo", "roxa", "purple"], confidence: 0.98 },
  { label: "Cinza", aliases: ["cinza", "grey", "gray"], confidence: 0.98 },
  { label: "Chumbo", aliases: ["chumbo"], confidence: 0.98 },
  { label: "Grafite", aliases: ["grafite"], confidence: 0.98 },
  { label: "Marrom", aliases: ["marrom", "brown"], confidence: 0.98 },
  { label: "Bege", aliases: ["bege", "beige"], confidence: 0.98 },
  { label: "Dourado", aliases: ["dourado", "dourada", "gold"], confidence: 0.98 },
  { label: "Prata", aliases: ["prata", "prateado", "prateada", "silver"], confidence: 0.98 },
  { label: "Vinho", aliases: ["vinho"], confidence: 0.96 },
  { label: "Bordô", aliases: ["bordo", "bordô"], confidence: 0.96 },
  { label: "Nude", aliases: ["nude"], confidence: 0.96 },
  { label: "Caramelo", aliases: ["caramelo"], confidence: 0.96 },
];

export const COLOR_DICTIONARY: ColorDictionaryEntry[] = definitions.map((entry) => ({
  ...entry,
  value: slugifyAttributeValue(entry.label)!,
  aliases: Array.from(new Set(entry.aliases.map(normalizeAttributeText))),
}));

const aliasToEntry = new Map<string, ColorDictionaryEntry>();
for (const entry of COLOR_DICTIONARY) {
  for (const alias of entry.aliases) aliasToEntry.set(alias, entry);
}

export function findColorByAlias(value: string): ColorDictionaryEntry | null {
  return aliasToEntry.get(normalizeAttributeText(value)) ?? null;
}

export function translateColorExpression(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const translated = value.trim().split(/([/+,&])/).map((part) => {
    if (/^[\/+, &]$/.test(part)) return part;
    return findColorByAlias(part)?.label ?? part.trim();
  }).join("");
  return translated.charAt(0).toLocaleUpperCase("pt-BR") + translated.slice(1);
}

export function normalizeColorExpression(value: string | null | undefined): string | null {
  return slugifyAttributeValue(translateColorExpression(value));
}
