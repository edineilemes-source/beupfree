interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }[];
  citations?: string[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface PerplexityOptions {
  model?: "llama-3.1-sonar-small-128k-online" | "llama-3.1-sonar-large-128k-online" | "llama-3.1-sonar-huge-128k-online";
  maxTokens?: number;
  temperature?: number;
  searchRecencyFilter?: "month" | "week" | "day" | "hour";
}

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

export async function askPerplexity(
  userMessage: string,
  systemPrompt?: string,
  options: PerplexityOptions = {}
): Promise<{ answer: string; citations: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY não configurada");
  }

  const messages: PerplexityMessage[] = [];
  
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  
  messages.push({ role: "user", content: userMessage });

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || "llama-3.1-sonar-small-128k-online",
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature ?? 0.2,
      search_recency_filter: options.searchRecencyFilter || "month",
      return_images: false,
      return_related_questions: false,
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na API Perplexity: ${response.status} - ${error}`);
  }

  const data: PerplexityResponse = await response.json();
  
  return {
    answer: data.choices[0]?.message?.content || "",
    citations: data.citations || [],
  };
}

export async function classifyProduct(productTitle: string, productDescription?: string): Promise<{
  categoria: string;
  modalidade: string[];
  genero: string;
  caracteristicas: Record<string, string>;
}> {
  const prompt = `Analise este produto esportivo e classifique:

Título: ${productTitle}
${productDescription ? `Descrição: ${productDescription}` : ""}

Retorne APENAS um JSON válido (sem markdown) com:
{
  "categoria": "tenis" | "meias" | "tornozeleiras" | "tensores" | "acessorios",
  "modalidade": ["corrida", "caminhada", "treino", "casual", "basquete", "futsal", "trilha", "crossfit", "society"],
  "genero": "masculino" | "feminino" | "unissex" | "infantil",
  "caracteristicas": {
    "pisada": "neutra" | "pronada" | "supinada" | null,
    "amortecimento": "maximo" | "moderado" | "responsivo" | "firme" | null,
    "peso": "leve" | "medio" | "pesado" | null,
    "estiloVisual": "minimalista" | "robusto" | "retro" | "chunky" | "performance" | null
  }
}`;

  const { answer } = await askPerplexity(prompt, "Você é um especialista em produtos esportivos. Responda apenas com JSON válido.");
  
  try {
    const cleanJson = answer.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch {
    throw new Error("Falha ao parsear resposta da IA: " + answer);
  }
}

export async function searchProductInfo(productName: string, brand: string): Promise<{
  specs: string;
  reviews: string;
  priceRange: string;
}> {
  const { answer, citations } = await askPerplexity(
    `Busque informações sobre "${productName}" da marca ${brand} no Brasil:
    1. Especificações técnicas principais
    2. Resumo das avaliações de usuários
    3. Faixa de preço atual em reais (R$)
    
    Seja conciso e factual.`,
    "Você é um assistente especializado em pesquisa de produtos esportivos no mercado brasileiro.",
    { searchRecencyFilter: "month" }
  );

  return {
    specs: answer,
    reviews: citations.length > 0 ? `Fontes: ${citations.slice(0, 3).join(", ")}` : "",
    priceRange: "",
  };
}
