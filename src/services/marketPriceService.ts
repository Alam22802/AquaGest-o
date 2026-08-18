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

const CACHE_KEY = 'tilapia_market_price_v7';
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
    const response = await fetch("/api/tilapia-price");
    if (!response.ok) {
      throw new Error(`Failed to fetch price from server: ${response.statusText}`);
    }
    const data = await response.json();
    
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Falha ao salvar cache de preços (Quota excedida)");
    }
    return data;
  } catch (error) {
    console.warn("Informação: Buscando preço da tilápia no cliente em modo offline/seguro:", error);
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }
    
    const now = new Date();
    const sourceRange = "CEPEA (10 - 14/08/2026)";

    return {
      price: 9.66,
      source: sourceRange,
      lastUpdate: now.toISOString(),
      variation: -1.46,
      weeklyVariation: -1.46,
      regions: [
        { name: "Triâng.Mineiro/Alto Paranaíba", price: 9.66, variation: -1.46, weeklyVariation: -1.46 },
        { name: "Grandes Lagos", price: 9.51, variation: -1.01, weeklyVariation: -1.01 },
        { name: "Norte do Paraná", price: 10.18, variation: -0.14, weeklyVariation: -0.14 },
        { name: "Morada Nova de Minas", price: 9.32, variation: -0.26, weeklyVariation: -0.26 },
        { name: "Oeste do Paraná", price: 8.67, variation: -0.16, weeklyVariation: -0.16 }
      ]
    };
  }
}
