import { normalizeAttributeText } from "./normalization";
import { isAttributeStopWord } from "./stopWords";

export interface TokenizedTitle {
  normalizedTitle: string;
  tokens: string[];
  meaningfulTokens: string[];
}

export function tokenizeAttributeTitle(title: string | null | undefined): TokenizedTitle {
  const normalizedTitle = normalizeAttributeText(title);
  const tokens = normalizedTitle ? normalizedTitle.split(" ") : [];
  return { normalizedTitle, tokens, meaningfulTokens: tokens.filter((token) => !isAttributeStopWord(token)) };
}

export function tokenNgrams(tokens: string[], maxLength: number): string[] {
  const ngrams: string[] = [];
  for (let size = Math.min(maxLength, tokens.length); size >= 1; size--) {
    for (let start = 0; start <= tokens.length - size; start++) {
      ngrams.push(tokens.slice(start, start + size).join(" "));
    }
  }
  return ngrams;
}
