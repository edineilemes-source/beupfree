export type AttributeName = "color" | "material" | "sport" | "technology" | "gender" | "usage";
export type AttributeSource = "title_inference";

export interface ExtractionContext {
  originalTitle: string;
  normalizedTitle: string;
  tokens: string[];
  meaningfulTokens: string[];
}

export interface ExtractedAttribute {
  attribute: AttributeName;
  value: string;
  label: string;
  source: AttributeSource;
  confidence: number;
  matchedTerm: string;
}

export interface AttributeExtractor {
  attribute: AttributeName;
  extract(context: ExtractionContext): ExtractedAttribute[];
}

export interface AttributeExtractionResult {
  attributes: Partial<Record<AttributeName, ExtractedAttribute[]>>;
}
