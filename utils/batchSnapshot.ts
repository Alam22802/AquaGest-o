import { AppState, Batch, ClosedBatchRecord, FeedingLog, MortalityLog, BiometryLog, HarvestLog, SlaughterLog, BatchExpense, BatchRevenue, Cage, FeedType } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { formatNumber } from './formatters';

const safeDateFormat = (dateStr: string | undefined, formatStr: string) => {
  if (!dateStr) return '---';
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return '---';
    return format(date, formatStr);
  } catch (e) {
    return '---';
  }
};

export const isBatchMatch = (targetIdOrName: string | undefined, batch: any): boolean => {
  if (!targetIdOrName || !batch) return false;
  const tid = targetIdOrName.trim().toLowerCase();
  if (tid === batch.id?.toLowerCase()) return true;

  const bn = (batch.name || '').trim().toLowerCase();
  if (tid === bn) return true;

  const tidNorm = tid.replace(/[^a-z0-9]/g, '');
  const bnNorm = bn.replace(/[^a-z0-9]/g, '');
  if (tidNorm.length > 0 && tidNorm === bnNorm) return true;

  const tidNoLote = tid.replace(/^lote\s*/i, '').trim();
  const bnNoLote = bn.replace(/^lote\s*/i, '').trim();
  if (tidNoLote.length > 0 && tidNoLote === bnNoLote) return true;

  const tidNum = tidNoLote.replace(/^0+/, '');
  const bnNum = bnNoLote.replace(/^0+/, '');
  if (tidNum.length > 0 && tidNum === bnNum) return true;

  return false;
};

export const checkIsFeedingLogForBatch = (f: FeedingLog, batch: Batch, harvestLogs: HarvestLog[] = [], cages: Cage[] = [], allBatches: Batch[] = []) => {
  if (!batch || !f) return false;
  
  if (f.batchId && isBatchMatch(f.batchId, batch)) {
    return true;
  }

  if (f.batchId && allBatches.some(b => b.id !== batch.id && isBatchMatch(f.batchId, b))) {
    return false;
  }

  const fDate = (f.timestamp || '').split('T')[0];
  if (batch.isClosed && batch.closedAt) {
    const closedDate = batch.closedAt.split('T')[0];
    if (fDate > closedDate) return false;
  }
  if (batch.harvestDate && fDate > batch.harvestDate) return false;
  if (batch.settlementDate && fDate < batch.settlementDate) return false;

  const harvestsByBatch = (harvestLogs || []).filter(h => h.batchId === batch.id || isBatchMatch(h.batchId, batch));
  const harvestCages = new Set(harvestsByBatch.map(h => h.cageId));
  if (f.cageId && harvestCages.has(f.cageId)) {
    const harvest = harvestsByBatch.find(h => h.cageId === f.cageId);
    if (harvest && fDate > harvest.date) return false;
    return true;
  }

  if (f.cageId) {
    const cage = (cages || []).find(c => c.id === f.cageId);
    if (cage && (cage.batchId === batch.id || isBatchMatch(cage.batchId, batch))) {
      return true;
    }
    if (batch.cageIds && batch.cageIds.includes(f.cageId)) {
      return true;
    }
  }

  return false;
};

export const isCostDeductionRevenue = (r: any): boolean => {
  if (r?.isCostDeduction === true) return true;
  if (r?.isCostDeduction === false) return false;
  const cat = (r?.category || '').toLowerCase();
  const desc = (r?.description || '').toLowerCase();
  return (
    cat.includes('bonifica') ||
    cat.includes('crédito') ||
    cat.includes('credito') ||
    cat.includes('desconto') ||
    cat.includes('ressarcimento') ||
    desc.includes('bonifica') ||
    desc.includes('crédito') ||
    desc.includes('credito') ||
    desc.includes('desconto') ||
    desc.includes('ressarcimento')
  );
};

export function buildBatchSnapshot(batch: Batch, state: AppState): ClosedBatchRecord {
  const harvestsByBatch: HarvestLog[] = (state.harvestLogs || []).filter((h: HarvestLog) => h.batchId === batch.id || isBatchMatch(h.batchId, batch));
  const harvestCages = new Set(harvestsByBatch.map((h: HarvestLog) => h.cageId));
  const cageMap = new Map<string, Cage>((state.cages || []).map((c: Cage) => [c.id, c]));

  // Mortality
  const mortalityLogs: MortalityLog[] = (state.mortalityLogs || []).filter((m: MortalityLog) => {
    if (m.batchId === batch.id || isBatchMatch(m.batchId, batch)) return true;
    if (m.cageId) {
      if (harvestCages.has(m.cageId)) {
        const harvest = harvestsByBatch.find((h: HarvestLog) => h.cageId === m.cageId);
        return harvest && m.date <= harvest.date;
      }
      const cage = cageMap.get(m.cageId);
      return cage?.batchId === batch.id && m.date >= batch.settlementDate;
    }
    return false;
  });
  const mortality = mortalityLogs.reduce((acc: number, curr: MortalityLog) => acc + curr.count, 0);

  // Feeding
  const feedingLogs: FeedingLog[] = (state.feedingLogs || []).filter((f: FeedingLog) => 
    checkIsFeedingLogForBatch(f, batch, state.harvestLogs, state.cages, state.batches)
  );
  const feeding = feedingLogs.reduce((acc: number, curr: FeedingLog) => acc + curr.amount, 0);

  const feedingByType: Record<string, number> = {};
  feedingLogs.forEach((curr: FeedingLog) => {
    const feedType = state.feedTypes?.find((t: FeedType) => t.id === curr.feedTypeId);
    const typeName = feedType?.name || 'Não especificado';
    feedingByType[typeName] = (feedingByType[typeName] || 0) + curr.amount;
  });

  const rawHarvestedFish = harvestsByBatch.reduce((acc: number, curr: HarvestLog) => acc + curr.fishCount, 0);
  const harvestedWeight = harvestsByBatch.reduce((acc: number, curr: HarvestLog) => acc + curr.totalWeight, 0);

  const firstHarvestDate = harvestsByBatch.length > 0 
    ? harvestsByBatch.reduce((min: string, h: HarvestLog) => h.date < min ? h.date : min, harvestsByBatch[0].date)
    : null;

  let avgWeightBeforeHarvest = batch.initialUnitWeight;
  let expectedFish = batch.initialQuantity - mortality;

  const batchBiometries: BiometryLog[] = (state.biometryLogs || []).filter((b: BiometryLog) => {
    if (b.batchId === batch.id || isBatchMatch(b.batchId, batch)) return true;
    if (b.cageId) {
      if (harvestCages.has(b.cageId)) return true;
      const cage = cageMap.get(b.cageId);
      return cage?.batchId === batch.id;
    }
    return false;
  });

  if (firstHarvestDate) {
    const mortalityBeforeHarvest = mortalityLogs
      .filter((m: MortalityLog) => m.date < firstHarvestDate)
      .reduce((acc: number, curr: MortalityLog) => acc + curr.count, 0);
    
    const liveFishBeforeHarvest = batch.initialQuantity - mortalityBeforeHarvest;
    expectedFish = liveFishBeforeHarvest;
    
    const biometriesBeforeHarvest = batchBiometries.filter((b: BiometryLog) => b.date <= firstHarvestDate);

    if (biometriesBeforeHarvest.length > 0) {
      const harvestDayLogs = biometriesBeforeHarvest.filter((log: BiometryLog) => log.date === firstHarvestDate);
      if (harvestDayLogs.length > 0) {
        avgWeightBeforeHarvest = harvestDayLogs.reduce((acc: number, log: BiometryLog) => acc + log.averageWeight, 0) / harvestDayLogs.length;
      } else {
        const lastDate = biometriesBeforeHarvest.reduce((max: string, log: BiometryLog) => log.date > max ? log.date : max, "");
        const lastDayLogs = biometriesBeforeHarvest.filter((log: BiometryLog) => log.date === lastDate);
        if (lastDayLogs.length > 0) {
          avgWeightBeforeHarvest = lastDayLogs.reduce((acc: number, log: BiometryLog) => acc + log.averageWeight, 0) / lastDayLogs.length;
        }
      }
    }
  }

  let currentAvgWeight = batch.initialUnitWeight;
  if (batchBiometries.length > 0) {
    const lastDate = batchBiometries.reduce((max: string, log: BiometryLog) => log.date > max ? log.date : max, "");
    const lastDayLogs = batchBiometries.filter((log: BiometryLog) => log.date === lastDate);
    if (lastDayLogs.length > 0) {
      currentAvgWeight = lastDayLogs.reduce((acc: number, log: BiometryLog) => acc + log.averageWeight, 0) / lastDayLogs.length;
    }
  }

  // Slaughters
  const slaughters: SlaughterLog[] = (state.slaughterLogs || []).filter((s: SlaughterLog) => {
    if (s.batchId === batch.id || isBatchMatch(s.batchId, batch)) return true;
    if (s.slaughterBatch && isBatchMatch(s.slaughterBatch, batch)) return true;
    return false;
  });
  
  const slaughteredReceptionWeight = slaughters.reduce((acc: number, curr: SlaughterLog) => acc + (curr.receptionWeight || 0), 0);

  const expenses: BatchExpense[] = (state.batchExpenses || []).filter((e: BatchExpense) => e.batchId === batch.id || isBatchMatch(e.batchId, batch));
  const revenues: BatchRevenue[] = (state.batchRevenues || []).filter((r: BatchRevenue) => r.batchId === batch.id || isBatchMatch(r.batchId, batch));
  
  const supplierInvoiceVal = batch.invoices && batch.invoices.length > 0
    ? batch.invoices.reduce((sum: number, inv: any) => sum + inv.invoiceValue, 0)
    : (batch.invoiceValue || 0);

  // Feed costs
  const feedTypePrices = new Map<string, number>();
  (state.feedTypes || []).forEach((feedType: FeedType) => {
    const entries = (state.feedStockLogs || []).filter(
      (log: any) => log.feedTypeId === feedType.id && 
             log.type === 'Entrada' && 
             log.unitPrice !== undefined && 
             log.unitPrice > 0
    );
    if (entries.length === 0) {
      feedTypePrices.set(feedType.id, feedType.pricePerKg || 0);
      return;
    }
    let totalCost = 0;
    let totalKg = 0;
    entries.forEach((log: any) => {
      const amountKg = log.amount / 1000;
      totalCost += (log.unitPrice || 0) * amountKg;
      totalKg += amountKg;
    });
    const avgPrice = totalKg > 0 ? (totalCost / totalKg) : (entries.reduce((acc: number, log: any) => acc + (log.unitPrice || 0), 0) / entries.length);
    feedTypePrices.set(feedType.id, avgPrice);
  });

  const feedBreakdown: { name: string; amountKg: number; cost: number }[] = [];
  let totalFeedCost = 0;

  Object.entries(feedingByType).forEach(([typeName, amountGrams]) => {
    const feedType = (state.feedTypes || []).find((t: FeedType) => t.name === typeName);
    const pricePerKg = feedType ? (feedTypePrices.get(feedType.id) || feedType.pricePerKg || 0) : 0;
    const amountKg = amountGrams / 1000;
    const cost = amountKg * pricePerKg;
    totalFeedCost += cost;

    feedBreakdown.push({
      name: typeName,
      amountKg,
      cost
    });
  });

  const grossExpenses = expenses.reduce((acc: number, curr: BatchExpense) => acc + curr.value, 0) + supplierInvoiceVal + totalFeedCost;
  
  const bonusDeductions = revenues.filter(r => isCostDeductionRevenue(r)).reduce((acc: number, curr: BatchRevenue) => {
    const val = curr.value !== undefined ? curr.value : ((curr.receptionWeight || 0) * (curr.unitPrice || 0));
    return acc + val;
  }, 0);

  const totalExpenses = Math.max(0, grossExpenses - bonusDeductions);
  
  const totalRevenueReceptionWeight = revenues.reduce((acc: number, curr: BatchRevenue) => acc + (curr.receptionWeight || 0), 0);
  const totalReceptionWeight = slaughteredReceptionWeight > 0 
    ? slaughteredReceptionWeight 
    : (totalRevenueReceptionWeight > 0 ? totalRevenueReceptionWeight : harvestedWeight);

  const harvestBiometricsAvgWeight = (avgWeightBeforeHarvest && avgWeightBeforeHarvest > 0) ? avgWeightBeforeHarvest : currentAvgWeight;
  const harvestedFish = (totalReceptionWeight > 0 && harvestBiometricsAvgWeight > 0)
    ? Math.round((totalReceptionWeight * 1000) / harvestBiometricsAvgWeight)
    : rawHarvestedFish;

  const slaughteredTotalRevenue = slaughters.reduce((acc: number, s: SlaughterLog) => {
    if (s.invoiceValue && s.invoiceValue > 0) return acc + s.invoiceValue;
    if (s.receptionWeight && s.receptionWeight > 0) {
      const unitP = harvestsByBatch[0]?.unitPrice || 0;
      return acc + (s.receptionWeight * unitP);
    }
    return acc;
  }, 0);

  const standardRevenues = revenues.filter(r => !isCostDeductionRevenue(r));
  const standardRevenueVal = standardRevenues.reduce((acc: number, curr: BatchRevenue) => {
    const val = curr.value !== undefined ? curr.value : ((curr.receptionWeight || 0) * (curr.unitPrice || 0));
    return acc + val;
  }, 0);

  const totalRevenue = (standardRevenues.length > 0 || slaughteredTotalRevenue > 0) 
    ? (standardRevenueVal + slaughteredTotalRevenue)
    : harvestsByBatch.reduce((acc: number, curr: HarvestLog) => acc + (curr.totalWeight * (curr.unitPrice || 0)), 0);

  const totalProfit = (totalRevenue + bonusDeductions) - grossExpenses;

  // Timeline
  const startDate = parseISO(batch.settlementDate);
  const endDate = harvestsByBatch.length > 0 
    ? parseISO(harvestsByBatch.reduce((max: string, h: HarvestLog) => h.date > max ? h.date : max, batch.settlementDate))
    : (batch.closedAt ? parseISO(batch.closedAt) : new Date());
  const totalDays = isNaN(differenceInDays(endDate, startDate)) ? 0 : differenceInDays(endDate, startDate);

  const survivalRate = batch.initialQuantity > 0 ? (expectedFish / batch.initialQuantity) * 100 : 0;
  const initialBatchWeightKg = ((batch.initialQuantity || 0) * (batch.initialUnitWeight || 0)) / 1000;
  const expectedWeight = expectedFish * (avgWeightBeforeHarvest / 1000);
  const biomassBeforeHarvest = expectedWeight;

  const weightGainTheoretical = Math.max(0, expectedWeight - initialBatchWeightKg);
  const fcaTheoretical = weightGainTheoretical > 0 ? (feeding / 1000) / weightGainTheoretical : 0;

  const finalWeight = totalReceptionWeight > 0 ? totalReceptionWeight : harvestedWeight;
  const weightGainReal = Math.max(0, finalWeight - initialBatchWeightKg);
  const fcaReal = weightGainReal > 0 ? (feeding / 1000) / weightGainReal : 0;

  const finalAvgWeight = harvestedFish > 0 ? (finalWeight / harvestedFish) * 1000 : currentAvgWeight;
  const gpd = totalDays > 0 ? (finalAvgWeight - batch.initialUnitWeight) / totalDays : 0;

  const costPerKg = totalReceptionWeight > 0 ? totalExpenses / totalReceptionWeight : 0;
  const realDeliveredWeight = totalReceptionWeight > 0 ? totalReceptionWeight : harvestedWeight;
  const accuracy = expectedWeight > 0 ? (realDeliveredWeight / expectedWeight) * 100 : 0;
  const survivalRateReal = batch.initialQuantity > 0 ? (harvestedFish / batch.initialQuantity) * 100 : 0;

  // Biometry evolution data
  const biometryDateMap = new Map<string, { weights: number[]; count: number }>();
  batchBiometries.forEach((b: BiometryLog) => {
    if (b.date && b.averageWeight && b.averageWeight > 0) {
      const d = b.date.split('T')[0];
      const existing = biometryDateMap.get(d) || { weights: [], count: 0 };
      existing.weights.push(b.averageWeight);
      existing.count += (b.sampleCount || 1);
      biometryDateMap.set(d, existing);
    }
  });

  const startDateStr = batch.settlementDate ? batch.settlementDate.split('T')[0] : '';
  const biometryTimeline: {
    date: string;
    fullDate: string;
    weight: number;
    standardWeight?: number;
    days: number;
    dailyGain?: number;
    isHarvestDate?: boolean;
  }[] = [];

  if (startDateStr) {
    biometryTimeline.push({
      date: safeDateFormat(startDateStr, 'dd/MM'),
      fullDate: startDateStr,
      weight: batch.initialUnitWeight || 0,
      standardWeight: batch.initialUnitWeight || 0,
      days: 0
    });
  }

  const protocol = (state.protocols || []).find((p: any) => p.id === batch.protocolId);
  const sortedBiometryDates = Array.from(biometryDateMap.keys()).sort();
  sortedBiometryDates.forEach(d => {
    if (d === startDateStr) return;
    const bInfo = biometryDateMap.get(d)!;
    const avgW = bInfo.weights.reduce((sum, w) => sum + w, 0) / bInfo.weights.length;
    const daysPassed = startDateStr ? Math.max(0, differenceInDays(parseISO(d), parseISO(startDateStr))) : 0;

    let stdW: number | undefined = undefined;
    if (protocol && startDateStr) {
      const activePhase = (protocol.phases || []).find((p: any) => daysPassed >= p.startDay && daysPassed <= p.endDay);
      if (activePhase) {
        const phaseDuration = Math.max(1, activePhase.endDay - activePhase.startDay);
        const progress = Math.min(1, Math.max(0, (daysPassed - activePhase.startDay) / phaseDuration));
        stdW = Math.round(activePhase.startWeight + progress * (activePhase.endWeight - activePhase.startWeight));
      }
    }

    biometryTimeline.push({
      date: safeDateFormat(d, 'dd/MM'),
      fullDate: d,
      weight: Math.round(avgW * 10) / 10,
      standardWeight: stdW,
      days: daysPassed
    });
  });

  if (firstHarvestDate && harvestBiometricsAvgWeight > 0 && !biometryDateMap.has(firstHarvestDate)) {
    const daysPassed = startDateStr ? Math.max(0, differenceInDays(parseISO(firstHarvestDate), parseISO(startDateStr))) : 0;
    biometryTimeline.push({
      date: safeDateFormat(firstHarvestDate, 'dd/MM'),
      fullDate: firstHarvestDate,
      weight: Math.round(harvestBiometricsAvgWeight * 10) / 10,
      isHarvestDate: true,
      days: daysPassed
    });
  }

  biometryTimeline.sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  // Mortality evolution
  const mortalityByDateMap = new Map<string, number>();
  mortalityLogs.forEach((m: MortalityLog) => {
    if (m.date && m.count > 0) {
      const d = m.date.split('T')[0];
      mortalityByDateMap.set(d, (mortalityByDateMap.get(d) || 0) + m.count);
    }
  });

  const sortedMortalityDates = Array.from(mortalityByDateMap.keys()).sort();
  let cumulativeMort = 0;
  const mortalityTimeline = sortedMortalityDates.map(d => {
    const count = mortalityByDateMap.get(d) || 0;
    cumulativeMort += count;
    return {
      date: safeDateFormat(d, 'dd/MM'),
      fullDate: d,
      count,
      cumulative: cumulativeMort,
      cumulativeRate: batch.initialQuantity > 0 ? Number(((cumulativeMort / batch.initialQuantity) * 100).toFixed(2)) : 0
    };
  });

  // Entries
  const settlementEntries = batch.invoices && batch.invoices.length > 0 
    ? batch.invoices.map((inv: any, idx: number) => ({
        id: `settlement-invoice-${inv.id || idx}`,
        type: 'expense' as const,
        date: batch.settlementDate,
        category: 'Alevinos/Povoamento',
        description: `Aquisição de Juvenis/Alevinos - ${inv.supplierName || 'Povoamento'}${inv.invoiceNumber ? ' (Nº: ' + inv.invoiceNumber + ')' : ''}`,
        value: inv.invoiceValue
      }))
    : (supplierInvoiceVal > 0 ? [{
        id: 'settlement-invoice-legacy',
        type: 'expense' as const,
        date: batch.settlementDate,
        category: 'Alevinos/Povoamento',
        description: `Aquisição de Juvenis/Alevinos - ${batch.supplierName || 'Povoamento'}`,
        value: supplierInvoiceVal
      }] : []);

  const feedEntries = feedBreakdown.map((fe, idx) => ({
    id: `feed-expense-${idx}`,
    type: 'expense' as const,
    date: batch.settlementDate,
    category: 'Ração / Alimentação',
    description: `Consumo de Ração - ${fe.name} (${formatNumber(fe.amountKg, 1)}kg)`,
    value: fe.cost
  }));

  const expenseEntries = expenses.map((e: BatchExpense) => ({
    id: e.id,
    type: 'expense' as const,
    date: e.date,
    category: e.category,
    description: e.description,
    value: e.value
  }));

  const revenueEntries = revenues.map((r: BatchRevenue) => {
    const isBonus = isCostDeductionRevenue(r);
    const val = r.value !== undefined ? r.value : ((r.receptionWeight || 0) * (r.unitPrice || 0));
    const desc = r.description || (r.receptionWeight ? `Peso Recepção Frigorífico: ${formatNumber(r.receptionWeight, 1)}kg` : (r.category || 'Receita'));
    return {
      id: r.id,
      type: 'revenue' as const,
      date: r.date,
      category: r.category || (isBonus ? 'Bonificação de juvenis' : 'Receita'),
      description: desc,
      receptionWeight: r.receptionWeight,
      unitPrice: r.unitPrice,
      value: val,
      isCostDeduction: isBonus
    };
  });

  const slaughterEntries = slaughters.map((s: SlaughterLog, idx: number) => {
    const unitP = harvestsByBatch[0]?.unitPrice || (s.invoiceValue && s.packedQuantity ? s.invoiceValue / s.packedQuantity : 0);
    const estimatedVal = s.invoiceValue && s.invoiceValue > 0 ? s.invoiceValue : ((s.receptionWeight || 0) * unitP);
    return {
      id: `slaughter-${s.id || idx}`,
      type: 'revenue' as const,
      date: s.date || batch.settlementDate,
      category: 'Receita Frigorífico',
      description: `Recepção Frigorífico: Lote Abate ${s.slaughterBatch || batch.name} ${s.producer ? `(${s.producer})` : ''} - ${formatNumber(s.receptionWeight || 0, 1)}kg`,
      receptionWeight: s.receptionWeight || 0,
      unitPrice: unitP,
      value: estimatedVal
    };
  });

  const entries = [
    ...settlementEntries,
    ...feedEntries,
    ...expenseEntries,
    ...revenueEntries,
    ...slaughterEntries
  ].sort((a, b) => b.date.localeCompare(a.date));

  const cleanBatchId = (batch.id || '').replace(/^hist-/, '').replace(/^history-/, '');
  const historyId = (batch.id && (batch.id.startsWith('hist-') || batch.id.startsWith('history-')))
    ? batch.id
    : `hist-${cleanBatchId}`;

  return {
    id: historyId,
    batchId: cleanBatchId,
    batchName: batch.name,
    settlementDate: batch.settlementDate,
    closedAt: batch.closedAt || new Date().toISOString(),
    initialQuantity: batch.initialQuantity,
    initialUnitWeight: batch.initialUnitWeight,
    protocolName: protocol?.name,
    expectedHarvestDate: batch.expectedHarvestDate,
    totalDays,
    expectedFish,
    harvestedFish,
    mortality,
    survivalRate,
    survivalRateReal,
    biomassBeforeHarvest,
    harvestedWeight,
    totalReceptionWeight,
    accuracy,
    initialAvgWeight: batch.initialUnitWeight,
    currentAvgWeight,
    gpd,
    totalFeedKg: feeding / 1000,
    fcaTheoretical,
    fcaReal,
    totalExpenses,
    totalRevenue,
    totalProfit,
    costPerKg,
    profitMarginPercent: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : undefined,
    feedBreakdown,
    biometryTimeline,
    mortalityTimeline,
    entries,
    userId: batch.userId,
    updatedAt: Date.now()
  };
}
