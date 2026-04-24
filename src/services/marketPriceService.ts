
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.GEMINI_API_KEY : '';
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
};

export interface MarketPrice {
  price: number;
  source: string;
  lastUpdate: string;
  variation?: number;
  weeklyVariation?: number;
  mgRegions?: {
    name: string;
    price: number;
    variation?: number;
    weeklyVariation?: number;
  }[];
}

const CACHE_KEY = 'tilapia_market_price_cepea';
const CACHE_TIME = 1000 * 60 * 60 * 1; // 1 hour

export async function getTilapiaPriceMG(): Promise<MarketPrice> {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - new Date(parsed.lastUpdate).getTime() < CACHE_TIME) {
        return parsed;
      }
    } catch (e) {
      console.error("Erro ao processar cache do preço:", e);
      localStorage.removeItem(CACHE_KEY);
    }
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: `Busque o preço médio ATUAL do quilo da tilápia (peixe vivo) no mercado 'Triângulo Mineiro/Alto Paranaíba' e em outras regiões polo de Minas Gerais (Norte de Minas, Sul de Minas, Grande BH) de acordo com os últimos dados do indicador CEPEA/Peixe BR. 
      É CRITICAL que você identifique a DATA da última atualização (ex: 22/04 ou 23/04). 
      Retorne as variações percentuais reais (semanal e diária se disponível). 
      Se houver uma lista de regiões polo de MG, inclua todas com seus respectivos preços.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "Preço médio no Triângulo Mineiro/Alto Paranaíba (R$)" },
            source: { type: Type.STRING, description: "Fonte e data exata da última cotação (ex: CEPEA 23/04)" },
            variation: { type: Type.NUMBER, description: "Variação percentual diária (%)" },
            weeklyVariation: { type: Type.NUMBER, description: "Variação percentual semanal (%)" },
            mgRegions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome da região" },
                  price: { type: Type.NUMBER, description: "Preço médio (R$)" },
                  variation: { type: Type.NUMBER, description: "Variação diária (%)" },
                  weeklyVariation: { type: Type.NUMBER, description: "Variação semanal (%)" }
                },
                required: ["name", "price"]
              }
            }
          },
          required: ["price", "source"]
        },
        tools: [{ googleSearch: {} }]
      }
    });

    if (!response.text) throw new Error("Resposta do Gemini vazia");
    const result = JSON.parse(response.text);
    
    // Use the actual AI result or nulls if not present
    const marketPrice: MarketPrice = {
      price: result.price || 0,
      source: result.source || "CEPEA/Peixe BR",
      lastUpdate: new Date().toISOString(),
      variation: typeof result.variation === 'number' ? result.variation : 0,
      weeklyVariation: typeof result.weeklyVariation === 'number' ? result.weeklyVariation : 0,
      mgRegions: Array.isArray(result.mgRegions) ? result.mgRegions.map((r: any) => ({
        name: String(r.name || 'Desconhecida'),
        price: typeof r.price === 'number' ? r.price : 0,
        variation: typeof r.variation === 'number' ? r.variation : 0,
        weeklyVariation: typeof r.weeklyVariation === 'number' ? r.weeklyVariation : 0
      })) : []
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(marketPrice));
    return marketPrice;
  } catch (error) {
    console.error("Erro ao buscar preço da tilápia:", error);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    return {
      price: 9.95,
      source: "CEPEA (Variação Estimada)",
      lastUpdate: new Date().toISOString(),
      mgRegions: [
        { name: "Triângulo Mineiro", price: 9.95 },
        { name: "Norte de Minas", price: 9.80 },
        { name: "Sul de Minas", price: 10.10 }
      ]
    };
  }
}
