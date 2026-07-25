export const ATTRIBUTE_STOP_WORDS = new Set([
  "nike", "adidas", "puma", "mizuno", "olympikus", "olimpikus", "asics", "fila", "reebok",
  "masculino", "masculina", "feminino", "feminina", "unissex", "infantil",
  "corrida", "caminhada", "tenis", "calcado", "calcados", "chuteira", "br",
  "numeracao", "numeracoes", "tamanho", "tam", "adulto", "adultos", "original", "novo", "nova",
]);

export function isAttributeStopWord(token: string): boolean {
  return ATTRIBUTE_STOP_WORDS.has(token) || /^\d+(?:[.,]\d+)?$/.test(token);
}
