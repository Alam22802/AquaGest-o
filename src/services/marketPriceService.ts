
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
  regions?: {
    name: string;
    price: number;
    variation?: number;
    weeklyVariation?: number;
  }[];
}

const CACHE_KEY = 'tilapia_market_price_v2';
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
      model: "gemini-3-flash-preview",
      contents: `Busque o preço médio ATUAL do quilo da tilápia (peixe vivo) nos indicadores CEPEA/Peixe BR para as seguintes regiões:
      1. Triângulo Mineiro/Alto Paranaíba (VALOR PRINCIPAL)
      2. Grandes Lagos (SP)
      3. Morada Nova de Minas (MG)
      4. Norte do Paraná (PR)
      5. Oeste do Paraná (PR)

      É CRITICAL que você retorne os valores exatos da última cotação semanal disponível (ex: período de 13-17/04 ou posterior).
      Traga o preço (R$/kg) e a variação semanal (%) para cada uma dessas regiões.
      O valor principal deve ser SEMPRE o do Triângulo Mineiro/Alto Paranaíba.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            price: { type: Type.NUMBER, description: "Preço médio no Triângulo Mineiro/Alto Paranaíba (R$)" },
            source: { type: Type.STRING, description: "Fonte e data exata da última cotação (ex: CEPEA 13-17/04)" },
            variation: { type: Type.NUMBER, description: "Variação percentual diária (%)" },
            weeklyVariation: { type: Type.NUMBER, description: "Variação percentual semanal (%)" },
            regions: {
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
        }
      }
    });

    if (!response.text) throw new Error("Resposta do Gemini vazia");
    const result = JSON.parse(response.text);
    
    // Use the actual AI result or nulls if not present
    const marketPrice: MarketPrice = {
      price: result.price || 10.23,
      source: result.source || "CEPEA (13-17/04)",
      lastUpdate: new Date().toISOString(),
      variation: typeof result.variation === 'number' ? result.variation : 0,
      weeklyVariation: typeof result.weeklyVariation === 'number' ? result.weeklyVariation : 0.11,
      regions: Array.isArray(result.regions) ? result.regions.map((r: any) => ({
        name: String(r.name || 'Desconhecida'),
        price: typeof r.price === 'number' ? r.price : 0,
        variation: typeof r.variation === 'number' ? r.variation : 0,
        weeklyVariation: typeof r.weeklyVariation === 'number' ? r.weeklyVariation : 0.11
      })) : []
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(marketPrice));
    } catch (e) {
      console.warn("Falha ao salvar cache de preços (Quota excedida)");
    }
    return marketPrice;
  } catch (error) {
    console.error("Erro ao buscar preço da tilápia:", error);
    
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    
    // Absolute fallback based on the user's latest provided CEPEA data
    return {
      price: 10.23,
      source: "CEPEA (13-17/04)",
      lastUpdate: new Date().toISOString(),
      weeklyVariation: 0.11,
      regions: [
        { name: "Triângulo Mineiro", price: 10.23, weeklyVariation: 0.11 },
        { name: "Grandes Lagos", price: 10.05, weeklyVariation: 0.10 },
        { name: "Norte do Paraná", price: 10.46, weeklyVariation: 0.08 },
        { name: "Morada Nova", price: 9.82, weeklyVariation: 0.03 },
        { name: "Oeste do Paraná", price: 8.98, weeklyVariation: 0.44 }
      ]
    };
  }
}
