
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
      model: "gemini-1.5-flash",
      contents: "Qual o preço médio atual do quilo da tilápia (peixe vivo) no Triângulo Mineiro e demais regiões de Minas Gerais (MG) de acordo com o indicador CEPEA/Peixe BR? Retorne o preço específico para o Triângulo Mineiro como valor principal, a fonte com data, a variação percentual diária E a variação semanal (7 dias). Também retorne uma lista para as outras regiões polo de MG (Norte de Minas, Sul de Minas, Grande BH, etc) incluindo preços e variações semanais.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "Preço médio no Triângulo Mineiro por kg (R$)" },
            source: { type: Type.STRING, description: "Fonte e data da informação" },
            variation: { type: Type.NUMBER, description: "Variação percentual diária em MG" },
            weeklyVariation: { type: Type.NUMBER, description: "Variação percentual semanal (7 dias) em MG" },
            mgRegions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Nome da região polo" },
                  price: { type: Type.NUMBER, description: "Preço médio na região (R$)" },
                  variation: { type: Type.NUMBER, description: "Variação diária na região" },
                  weeklyVariation: { type: Type.NUMBER, description: "Variação semanal na região" }
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
    
    // Safety check for numerical values
    const safePrice = typeof result.price === 'number' ? result.price : 9.95;
    
    const marketPrice: MarketPrice = {
      price: safePrice,
      source: result.source || "Fonte Indisponível",
      lastUpdate: new Date().toISOString(),
      variation: typeof result.variation === 'number' ? result.variation : undefined,
      weeklyVariation: typeof result.weeklyVariation === 'number' ? result.weeklyVariation : undefined,
      mgRegions: Array.isArray(result.mgRegions) ? result.mgRegions.map((r: any) => ({
        name: String(r.name || 'Desconhecida'),
        price: typeof r.price === 'number' ? r.price : safePrice,
        variation: typeof r.variation === 'number' ? r.variation : undefined,
        weeklyVariation: typeof r.weeklyVariation === 'number' ? r.weeklyVariation : undefined
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
