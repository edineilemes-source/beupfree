export { extractAttributesFromTitle } from "./engine";
export { normalizeAttributeText, slugifyAttributeValue } from "./normalization";
export { tokenizeAttributeTitle, tokenNgrams } from "./tokenizer";
export { ATTRIBUTE_STOP_WORDS, isAttributeStopWord } from "./stopWords";
export { COLOR_DICTIONARY, findColorByAlias, normalizeColorExpression, translateColorExpression } from "./dictionaries/colors";
export type { AttributeExtractionResult, AttributeExtractor, AttributeName, AttributeSource, ExtractedAttribute, ExtractionContext } from "./types";
