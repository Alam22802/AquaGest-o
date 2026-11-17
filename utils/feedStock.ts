import { FeedStockLog, FeedType, FeedingLog } from '../types';

/**
 * Converte gramas (unidade lançada no trato diário) para quilogramas (unidade do saldo de estoque).
 */
export const gramsToKg = (grams: number | string | undefined | null): number => {
  const n = typeof grams === 'number' ? grams : parseNumberInput(grams);
  return n / 1000;
};

/**
 * Converte quilogramas para gramas inteiras (unidade de armazenamento interno de totalStock).
 */
export const kgToGrams = (kg: number | string | undefined | null): number => {
  const n = typeof kg === 'number' ? kg : parseNumberInput(kg);
  return Math.round(n * 1000);
};

/**
 * Faz o parsing seguro de valores numéricos com ponto ou vírgula decimal.
 */
export const parseNumberInput = (value: number | string | undefined | null): number => {
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? 0 : value;
  }
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const normalized = raw.includes(',') && !raw.includes('.')
    ? raw.replace(',', '.')
    : raw.replace(/,/g, '');
  const parsed = Number(normalized);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
};

/**
 * Retorna o timestamp de criação efetivo do registro (em ms).
 * Logs antigos sem `createdAt` usam `updatedAt` ou `timestamp` apenas como fallback.
 */
export const getFeedLogCreatedAt = (log: { createdAt?: number; updatedAt?: number; timestamp?: string } | null | undefined): number => {
  if (!log) return 0;
  if (typeof log.createdAt === 'number' && !isNaN(log.createdAt) && log.createdAt > 0) {
    return log.createdAt;
  }
  if (typeof log.updatedAt === 'number' && !isNaN(log.updatedAt) && log.updatedAt > 0) {
    return log.updatedAt;
  }
  if (log.timestamp) {
    const parsed = new Date(log.timestamp).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

export interface FeedStockBreakdown {
  stockBaseline: number;
  stockBaselineAt: number;
  baselineKg: number;
  entriesAfterKg: number;
  feedingsAfterKg: number;
  currentStockKg: number;
  currentStockGrams: number;
  entriesCountAfter: number;
  feedingsCountAfter: number;
}

/**
 * Calcula o saldo real em kg e gramas de um tipo de ração a partir do último ajuste manual (baseline),
 * somando entradas posteriores (em kg) e subtraindo os tratos diários posteriores convertidos de gramas para kg.
 */
export const getFeedStockBreakdown = (
  feed: FeedType,
  feedingLogs: FeedingLog[] = [],
  feedStockLogs: FeedStockLog[] = []
): FeedStockBreakdown => {
  const hasBaseline =
    typeof feed.stockBaseline === 'number' &&
    !isNaN(feed.stockBaseline) &&
    typeof feed.stockBaselineAt === 'number' &&
    !isNaN(feed.stockBaselineAt) &&
    feed.stockBaselineAt > 0;

  const stockBaseline = hasBaseline ? Number(feed.stockBaseline) : (Number(feed.totalStock) || 0);
  const stockBaselineAt = hasBaseline
    ? Number(feed.stockBaselineAt)
    : (Number(feed.updatedAt) || Date.now());

  const baselineKg = gramsToKg(stockBaseline);

  let entriesAfterKg = 0;
  let entriesCountAfter = 0;
  for (let i = 0; i < (feedStockLogs || []).length; i++) {
    const log = feedStockLogs[i];
    if (!log || log.feedTypeId !== feed.id) continue;
    const createdAt = getFeedLogCreatedAt(log);
    if (createdAt > stockBaselineAt) {
      entriesAfterKg += gramsToKg(log.amount);
      entriesCountAfter++;
    }
  }

  let feedingsAfterKg = 0;
  let feedingsCountAfter = 0;
  for (let i = 0; i < (feedingLogs || []).length; i++) {
    const log = feedingLogs[i];
    if (!log || log.feedTypeId !== feed.id || log.skipStockDeduction) continue;
    const createdAt = getFeedLogCreatedAt(log);
    if (createdAt > stockBaselineAt) {
      // Conversão explícita de gramas (trato diário) para kg (saldo de estoque)
      feedingsAfterKg += gramsToKg(log.amount);
      feedingsCountAfter++;
    }
  }

  const currentStockKg = baselineKg + entriesAfterKg - feedingsAfterKg;
  const currentStockGrams = kgToGrams(currentStockKg);

  return {
    stockBaseline,
    stockBaselineAt,
    baselineKg,
    entriesAfterKg,
    feedingsAfterKg,
    currentStockKg,
    currentStockGrams,
    entriesCountAfter,
    feedingsCountAfter
  };
};

/**
 * Reconcilia todos os tipos de ração garantindo que `totalStock` reflita exatamente:
 *   baseline (kg) + entradas após baseline (kg) - tratos após baseline (gramas / 1000 -> kg)
 */
export const reconcileFeedTypes = (
  feedTypes: FeedType[] = [],
  feedingLogs: FeedingLog[] = [],
  feedStockLogs: FeedStockLog[] = []
): FeedType[] => {
  if (!Array.isArray(feedTypes)) return [];

  return feedTypes.map(feed => {
    if (!feed || !feed.id) return feed;
    const breakdown = getFeedStockBreakdown(feed, feedingLogs, feedStockLogs);

    if (
      feed.totalStock === breakdown.currentStockGrams &&
      feed.stockBaseline === breakdown.stockBaseline &&
      feed.stockBaselineAt === breakdown.stockBaselineAt
    ) {
      return feed;
    }

    return {
      ...feed,
      stockBaseline: breakdown.stockBaseline,
      stockBaselineAt: breakdown.stockBaselineAt,
      totalStock: breakdown.currentStockGrams
    };
  });
};

/**
 * Faz merge seguro de `feedTypes` entre dois estados (local/servidor ou cliente/remoto).
 * Garante que dispositivos desatualizados que lançaram tratos nunca sobrescrevam o `stockBaseline`
 * de um ajuste manual mais recente feito pelo administrador.
 */
export const mergeFeedTypesList = (
  baseList: FeedType[] = [],
  incomingList: FeedType[] = [],
  deletedIds: string[] | Set<string> = [],
  priority: 'local' | 'remote' = 'local'
): FeedType[] => {
  const deletedSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);
  const map = new Map<string, FeedType>();
  const now = Date.now();

  const getTime = (item: any): number => {
    if (!item || item.updatedAt === undefined || item.updatedAt === null) return 0;
    const t = typeof item.updatedAt === 'number' ? item.updatedAt : new Date(item.updatedAt).getTime();
    if (isNaN(t)) return 0;
    return t > now + 60000 ? now : t;
  };

  for (const item of baseList || []) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    map.set(item.id, item);
  }

  for (const item of incomingList || []) {
    if (!item || !item.id || deletedSet.has(item.id)) continue;
    const existing = map.get(item.id);
    if (!existing) {
      if (priority === 'remote') {
        const remoteTime = getTime(item);
        if (remoteTime === 0 || now - remoteTime > 15 * 60 * 1000) {
          continue;
        }
      }
      map.set(item.id, item);
      continue;
    }

    const existingUpdated = getTime(existing);
    const incomingUpdated = getTime(item);
    const metaWinner = incomingUpdated > existingUpdated ? item : existing;

    const existingHasBaseline = typeof existing.stockBaselineAt === 'number' && existing.stockBaselineAt > 0;
    const incomingHasBaseline = typeof item.stockBaselineAt === 'number' && item.stockBaselineAt > 0;

    let baselineSource: FeedType;
    if (existingHasBaseline && !incomingHasBaseline) {
      // Dispositivo antigo sem baseline não pode sobrescrever baseline já estabelecido
      baselineSource = existing;
    } else if (!existingHasBaseline && incomingHasBaseline) {
      baselineSource = item;
    } else if (existingHasBaseline && incomingHasBaseline) {
      if ((item.stockBaselineAt || 0) > (existing.stockBaselineAt || 0)) {
        baselineSource = item;
      } else if ((existing.stockBaselineAt || 0) > (item.stockBaselineAt || 0)) {
        baselineSource = existing;
      } else {
        baselineSource = incomingUpdated > existingUpdated ? item : existing;
      }
    } else {
      baselineSource = incomingUpdated > existingUpdated ? item : existing;
    }

    map.set(item.id, {
      ...metaWinner,
      stockBaseline: baselineSource.stockBaseline,
      stockBaselineAt: baselineSource.stockBaselineAt,
      totalStock: baselineSource.totalStock,
      updatedAt: Math.max(existingUpdated, incomingUpdated)
    });
  }

  return Array.from(map.values()).filter(f => f && f.id && !deletedSet.has(f.id));
};
