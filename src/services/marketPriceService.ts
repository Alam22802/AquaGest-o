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

const CACHE_KEY = 'tilapia_market_price_v12';
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
    const sourceRange = "CEPEA (28 - 02/10/2026)";

    return {
      price: 9.31,
      source: sourceRange,
      lastUpdate: now.toISOString(),
      variation: -0.82,
      weeklyVariation: -0.82,
      regions: [
        { name: "Grandes Lagos", price: 9.45, variation: -0.22, weeklyVariation: -0.22 },
        { name: "Morada Nova de Minas", price: 9.22, variation: -0.16, weeklyVariation: -0.16 },
        { name: "Norte do Paraná", price: 10.08, variation: -0.20, weeklyVariation: -0.20 },
        { name: "Oeste do Paraná", price: 8.73, variation: 0.04, weeklyVariation: 0.04 },
        { name: "Triâng.Mineiro/Alto Paranaíba", price: 9.31, variation: -0.82, weeklyVariation: -0.82 }
      ]
    };
  }
}
