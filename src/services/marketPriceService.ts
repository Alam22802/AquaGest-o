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

const CACHE_KEY = 'tilapia_market_price_v13';
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
    const sourceRange = "CEPEA (12 - 16/10/2026)";

    return {
      price: 9.32,
      source: sourceRange,
      lastUpdate: now.toISOString(),
      variation: -0.04,
      weeklyVariation: -0.04,
      regions: [
        { name: "Grandes Lagos", price: 9.45, variation: -0.01, weeklyVariation: -0.01 },
        { name: "Morada Nova de Minas", price: 9.23, variation: 0.15, weeklyVariation: 0.15 },
        { name: "Norte do Paraná", price: 10.05, variation: -0.35, weeklyVariation: -0.35 },
        { name: "Oeste do Paraná", price: 8.72, variation: 0.00, weeklyVariation: 0.00 },
        { name: "Triâng.Mineiro/Alto Paranaíba", price: 9.32, variation: -0.04, weeklyVariation: -0.04 }
      ]
    };
  }
}
