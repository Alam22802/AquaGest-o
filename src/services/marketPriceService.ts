
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '';
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
const CACHE_TIME = 1000 * 60 * 60 * 4; // 4 hours

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
      model: "gemini-3-flash-preview",
      contents: "Qual o preço médio atual do quilo da tilápia (peixe vivo) no Triângulo Mineiro/Alto Paranaíba e demais regiões de Minas Gerais (MG) de acordo com o indicador CEPEA/Peixe BR? Retorne como valor principal o mercado 'Triângulo Mineiro/Alto Paranaíba'. Para cada região (incluindo a principal e secundárias como Norte, Sul, Grande BH), traga APENAS o preço em R$ e a variação semanal (7 dias). Ignore variações diárias.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "Preço médio no Triângulo Mineiro/Alto Paranaíba (R$)" },
            source: { type: Type.STRING, description: "Fonte e data da informação (Ex: CEPEA 17/04)" },
            weeklyVariation: { type: Type.NUMBER, description: "Variação semanal percentual" },
            mgRegions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome da região" },
                  price: { type: Type.NUMBER, description: "Preço médio (R$)" },
                  weeklyVariation: { type: Type.NUMBER, description: "Variação semanal percentual" }
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
    
    // Fallback values provided by user for context
    const safePrice = typeof result.price === 'number' ? result.price : 10.23;
    
    const marketPrice: MarketPrice = {
      price: safePrice,
      source: result.source || "CEPEA (17/04)",
      lastUpdate: new Date().toISOString(),
      variation: 0,
      weeklyVariation: typeof result.weeklyVariation === 'number' ? result.weeklyVariation : 0.11,
      mgRegions: Array.isArray(result.mgRegions) ? result.mgRegions.map((r: any) => ({
        name: String(r.name || 'Desconhecida'),
        price: typeof r.price === 'number' ? r.price : safePrice,
        variation: 0,
        weeklyVariation: typeof r.weeklyVariation === 'number' ? r.weeklyVariation : 0.11
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
