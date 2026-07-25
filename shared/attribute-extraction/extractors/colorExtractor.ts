import { COLOR_DICTIONARY } from "../dictionaries/colors";
import type { AttributeExtractor, ExtractedAttribute } from "../types";

const MAX_COLOR_TOKENS = Math.max(...COLOR_DICTIONARY.flatMap((entry) =>
  entry.aliases.map((alias) => alias.split(" ").length),
));
const entriesByAlias = new Map(
  COLOR_DICTIONARY.flatMap((entry) => entry.aliases.map((alias) => [alias, entry] as const)),
);

export const colorExtractor: AttributeExtractor = {
  attribute: "color",
  extract(context): ExtractedAttribute[] {
    const colors = new Map<string, ExtractedAttribute>();
    for (let start = 0; start < context.meaningfulTokens.length;) {
      let matchedLength = 0;
      for (let size = Math.min(MAX_COLOR_TOKENS, context.meaningfulTokens.length - start); size >= 1; size--) {
        const term = context.meaningfulTokens.slice(start, start + size).join(" ");
        const entry = entriesByAlias.get(term);
        if (!entry) continue;
        if (!colors.has(entry.value)) {
          colors.set(entry.value, {
            attribute: "color",
            value: entry.value,
            label: entry.label,
            source: "title_inference",
            confidence: entry.confidence,
            matchedTerm: term,
          });
        }
        matchedLength = size;
        break;
      }
      start += matchedLength || 1;
    }
    return Array.from(colors.values());
  },
};
