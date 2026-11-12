/** List of auditable technical attributes collected from source excerpts.
 * Keep this allowlist identical for extraction and the knowledge card.
 */
export const TECHNICAL_FIELDS = [
  "cabedal","entressola","solado","drop","peso","amortecimento","estabilidade",
  "indicacao_de_uso","tecnologia","material","altura_do_solado","modalidade",
  "pisada","terreno","placa","palmilha","forro","lingueta","amarracao",
  "tipo_corrida","distancia_indicada","respirabilidade","largura_forma",
  "numeracao","conforto","durabilidade","flexibilidade",
] as const;
export type TechnicalField = typeof TECHNICAL_FIELDS[number];
export const TECHNICAL_FIELD_SET:ReadOnlySet<string> = new Set(TECHNICAL_FIELDS);
