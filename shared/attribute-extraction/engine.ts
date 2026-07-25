import { colorExtractor } from "./extractors/colorExtractor";
import { tokenizeAttributeTitle } from "./tokenizer";
import type { AttributeExtractionResult, AttributeExtractor } from "./types";

const extractors: AttributeExtractor[] = [colorExtractor];

export function extractAttributesFromTitle(title: string | null | undefined): AttributeExtractionResult {
  const tokenized = tokenizeAttributeTitle(title);
  const context = { originalTitle: title ?? "", ...tokenized };
  const attributes: AttributeExtractionResult["attributes"] = {};
  for (const extractor of extractors) {
    const extracted = extractor.extract(context);
    if (extracted.length > 0) attributes[extractor.attribute] = extracted;
  }
  return { attributes };
}
