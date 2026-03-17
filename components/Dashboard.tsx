
import React, { useMemo, useState, useEffect } from 'react';
import { AppState } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { Fish, Utensils, Scale, TrendingUp, FishOff, Calendar, Layers, Download, Info, AlertTriangle, PackageSearch } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, subDays } from 'date-fns';

interface Props {
  state: AppState;
}

const MiniStat = ({ label, value, icon, color, subtext }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md h-full">
    <div className={`p-3 rounded-xl bg-slate-50 shadow-sm ${color} shrink-0`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-slate-800">{value}</div>
      {subtext && <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{subtext}</div>}
    </div>
  </div>
);

const Dashboard: React.FC<Props> = ({ state }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (state.batches && state.batches.length > 0) {
      if (!selectedBatchId) setSelectedBatchId(state.batches[0].id);
    }
  }, [state.batches]);

  const lowStockFeeds = useMemo(() => {
    return (state.feedTypes || []).filter(feed => {
      const stockKg = feed.totalStock / 1000;
      const limitKg = (feed.maxCapacity * feed.minStockPercentage) / 100;
      return stockKg <= limitKg;
    });
  }, [state.feedTypes]);

  const batchStats = useMemo(() => {
    const cagesByBatch = new Map<string, typeof state.cages>();
    (state.cages || []).forEach(c => {
      if (c.batchId) {
        const list = cagesByBatch.get(c.batchId) || [];
        list.push(c);
        cagesByBatch.set(c.batchId, list);
      }
    });

    const mortalityByBatch = new Map<string, number>();
    (state.mortalityLogs || []).forEach(m => {
      let bId = m.batchId;
      if (!bId && m.cageId) {
        const cage = (state.cages || []).find(c => c.id === m.cageId);
        if (cage?.batchId) {
          const batch = (state.batches || []).find(b => b.id === cage.batchId);
          if (batch && m.date >= batch.settlementDate) {
            bId = cage.batchId;
          }
        } else {
          // Fallback for harvested cages: find the first harvest after the mortality date
          const harvest = (state.harvestLogs || []).find(h => h.cageId === m.cageId && h.date >= m.date);
          if (harvest) bId = harvest.batchId;
        }
      }
      
      if (bId) {
        mortalityByBatch.set(bId, (mortalityByBatch.get(bId) || 0) + m.count);
      }
    });

    const feedingByBatch = new Map<string, number>();
    const feedBreakdownByBatch = new Map<string, { [name: string]: number }>();
    (state.feedingLogs || []).forEach(f => {
      let bId = f.batchId;
      if (!bId && f.cageId) {
        const cage = (state.cages || []).find(c => c.id === f.cageId);
        if (cage?.batchId) {
          const batch = (state.batches || []).find(b => b.id === cage.batchId);
          const fDate = (f.timestamp || '').split('T')[0];
          if (batch && fDate >= batch.settlementDate) {
            bId = cage.batchId;
          }
        } else {
          // Fallback for harvested cages
          const fDate = (f.timestamp || '').split('T')[0];
          const harvest = (state.harvestLogs || []).find(h => h.cageId === f.cageId && h.date >= fDate);
          if (harvest) bId = harvest.batchId;
        }
      }
      
      if (bId) {
        feedingByBatch.set(bId, (feedingByBatch.get(bId) || 0) + f.amount);
        
        const breakdown = feedBreakdownByBatch.get(bId) || {};
        const feedType = (state.feedTypes || []).find(ft => ft.id === f.feedTypeId);
        const name = feedType ? feedType.name : 'Ração S/ Ident.';
        breakdown[name] = (breakdown[name] || 0) + f.amount;
        feedBreakdownByBatch.set(bId, breakdown);
      }
    });

    const harvestsByBatch = new Map<string, { fishCount: number, weight: number }>();
    (state.harvestLogs || []).forEach(h => {
      const current = harvestsByBatch.get(h.batchId) || { fishCount: 0, weight: 0 };
      harvestsByBatch.set(h.batchId, {
        fishCount: current.fishCount + h.fishCount,
        weight: current.weight + h.weight
      });
    });

    return (state.batches || []).map(batch => {
      const batchCages = cagesByBatch.get(batch.id) || [];
      
      const totalInitial = batch.initialQuantity;
      const harvestData = harvestsByBatch.get(batch.id) || { fishCount: 0, weight: 0 };
      const totalHarvested = harvestData.fishCount;
      const totalHarvestedWeight = harvestData.weight;
      const totalMortality = mortalityByBatch.get(batch.id) || 0;

      const currentTotalStock = Math.max(0, totalInitial - totalMortality - totalHarvested);

      // Filter biometries for this batch
      const batchBiometries = (state.biometryLogs || []).filter(b => {
        if (b.batchId) return b.batchId === batch.id;
        // Fallback: check if cage is currently in this batch and date is after settlement
        const cage = (state.cages || []).find(c => c.id === b.cageId);
        if (cage?.batchId === batch.id && b.date >= batch.settlementDate) return true;
        
        // Fallback for harvested cages
        const harvest = (state.harvestLogs || []).find(h => h.cageId === b.cageId && h.date >= b.date);
        return harvest?.batchId === batch.id;
      });

      let currentAvgWeight = batch.initialUnitWeight;
      let samplingInfo = "Peso Inicial";

      if (batchBiometries.length > 0) {
        const lastDate = batchBiometries.reduce((max, log) => log.date > max ? log.date : max, "");
        const lastDayLogs = batchBiometries.filter(log => log.date === lastDate);
        if (lastDayLogs.length > 0) {
          const sumWeights = lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0);
          currentAvgWeight = sumWeights / lastDayLogs.length;
          try {
            samplingInfo = `Média de ${lastDayLogs.length} gaiolas (Dia: ${format(parseISO(lastDate), 'dd/MM')})`;
          } catch {
            samplingInfo = `Média de ${lastDayLogs.length} gaiolas`;
          }
        }
      }

      const totalBiomassKg = (currentTotalStock * currentAvgWeight) / 1000;
      
      const totalFeedAmount = feedingByBatch.get(batch.id) || 0;
      const feedBreakdownObj = feedBreakdownByBatch.get(batch.id) || {};

      const totalFeedKg = totalFeedAmount / 1000;
      const feedBreakdown = Object.entries(feedBreakdownObj).map(([name, amount]) => ({
        name,
        amountKg: amount / 1000
      })).sort((a, b) => a.name.localeCompare(b.name));

      const totalProducedWeightKg = totalBiomassKg + totalHarvestedWeight;
      const fcaValue = totalProducedWeightKg > 0 ? (totalFeedKg / totalProducedWeightKg).toFixed(2) : '0.00';

      return { 
        id: batch.id, 
        name: batch.name, 
        stock: currentTotalStock, 
        harvested: totalHarvested,
        harvestedWeight: totalHarvestedWeight,
        mortality: totalMortality,
        biomass: totalBiomassKg, 
        feed: totalFeedKg, 
        feedBreakdown,
        fca: fcaValue,
        avgWeight: currentAvgWeight,
        samplingInfo
      };
    });
  }, [state.batches, state.cages, state.mortalityLogs, state.biometryLogs, state.feedingLogs, state.feedTypes, state.harvestLogs]);

  const selectedBatchData = useMemo(() => {
    return batchStats.find(b => b.id === selectedBatchId) || { 
      stock: 0, 
      harvested: 0, 
      harvestedWeight: 0,
      mortality: 0, 
      biomass: 0, 
      feed: 0, 
      fca: '0.00', 
      feedBreakdown: [], 
      avgWeight: 0, 
      samplingInfo: 'Sem dados' 
    };
  }, [batchStats, selectedBatchId]);

  const biometryEvolutionData = useMemo(() => {
    if (!selectedBatchId) return [];
    const batch = (state.batches || []).find(b => b.id === selectedBatchId);
    if (!batch) return [];
    
    const logs = (state.biometryLogs || []).filter(l => {
      if (l.batchId === selectedBatchId) return true;
      if (!l.batchId && l.cageId) {
        const cage = state.cages.find(c => c.id === l.cageId);
        if (cage?.batchId === selectedBatchId && l.date >= batch.settlementDate) return true;
        
        // Fallback for harvested cages
        const harvest = (state.harvestLogs || []).find(h => h.cageId === l.cageId && h.date >= l.date);
        return harvest?.batchId === selectedBatchId;
      }
      return false;
    }).sort((a, b) => a.date.localeCompare(b.date));
    
    const uniqueDates = Array.from(new Set(logs.map(l => l.date))).sort();
    
    const data = uniqueDates.map(currentDate => {
      const dayLogs = logs.filter(l => l.date === currentDate);
      const avgWeight = dayLogs.reduce((a, b) => a + b.averageWeight, 0) / dayLogs.length;

      let dateLabel = currentDate;
      try {
        dateLabel = format(new Date(currentDate + 'T12:00:00'), 'dd/MM');
      } catch {}

      return {
        date: dateLabel,
        fullDate: currentDate,
        weight: Math.round(avgWeight)
      };
    });
    
    return [{ date: 'Início', weight: batch.initialUnitWeight }, ...data];
  }, [state.biometryLogs, state.batches, state.cages, state.harvestLogs, selectedBatchId]);

  const mortalityEvolutionData = useMemo(() => {
    if (!selectedBatchId) return [];
    const batch = (state.batches || []).find(b => b.id === selectedBatchId);
    if (!batch) return [];

    const logs = (state.mortalityLogs || []).filter(m => {
      if (m.batchId === selectedBatchId) return true;
      if (!m.batchId && m.cageId) {
        const cage = state.cages.find(c => c.id === m.cageId);
        if (cage?.batchId === selectedBatchId && m.date >= batch.settlementDate) return true;
        
        // Fallback for harvested cages
        const harvest = (state.harvestLogs || []).find(h => h.cageId === m.cageId && h.date >= m.date);
        return harvest?.batchId === selectedBatchId;
      }
      return false;
    });

    const grouped = logs.reduce((acc: any, log) => {
      if (!acc[log.date]) acc[log.date] = 0;
      acc[log.date] += log.count;
      return acc;
    }, {});
    return Object.keys(grouped).map(date => {
      let dateLabel = date;
      try {
        dateLabel = format(new Date(date + 'T12:00:00'), 'dd/MM');
      } catch {}
      return { 
        date: dateLabel, 
        fullDate: date, 
        count: grouped[date] 
      };
    }).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [state.mortalityLogs, state.cages, state.batches, state.harvestLogs, selectedBatchId]);

  const totalMortalityInChart = useMemo(() => {
    return mortalityEvolutionData.reduce((acc, curr) => acc + curr.count, 0);
  }, [mortalityEvolutionData]);

  // FUNÇÃO DE EXPORTAÇÃO COMPLETA COM FILTRO DE DATA
  const handleDownloadReport = () => {
    // Definir intervalo de filtro
    const start = startOfDay(parseISO(reportStartDate));
    const end = endOfDay(parseISO(reportEndDate));

    // Função auxiliar para filtrar logs por data
    const filterByDate = (dateString: string | undefined) => {
      if (!dateString) return false;
      try {
        const itemDate = parseISO(dateString);
        if (isNaN(itemDate.getTime())) return false;
        return isWithinInterval(itemDate, { start, end });
      } catch {
        return false;
      }
    };

    // 1. Helpers de Mapeamento
    const cageMap = new Map(state.cages.map(c => [c.id, c.name]));
    const feedMap = new Map(state.feedTypes.map(f => [f.id, f.name]));
    const userMap = new Map(state.users.map(u => [u.id, u.name]));
    const lineMap = new Map(state.lines.map(l => [l.id, l.name]));
    const batchMap = new Map(state.batches.map(b => [b.id, b.name]));
    const protocolMap = new Map(state.protocols.map(p => [p.id, p.name]));

    const wb = XLSX.utils.book_new();

    // 2. ABA: RESUMO GERAL
    const summaryHeader = [
      ["RELATÓRIO GERAL DE PRODUÇÃO - AQUAGESTÃO"],
      ["Período Selecionado:", `${format(start, 'dd/MM/yyyy')} até ${format(end, 'dd/MM/yyyy')}`],
      ["Data de Exportação:", format(new Date(), 'dd/MM/yyyy HH:mm')],
      [""],
      ["ESTATÍSTICAS CONSOLIDADAS POR LOTE (DADOS ATUAIS)"]
    ];
    const summaryData = batchStats.map(bs => [
      bs.name,
      `Estoque: ${bs.stock} un`,
      `Biomassa: ${bs.biomass.toFixed(2)} kg`,
      `Consumo Total: ${bs.feed.toFixed(2)} kg`,
      `FCA: ${bs.fca}`,
      `Peso Médio: ${bs.avgWeight.toFixed(1)} g`
    ]);
    const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryData]);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Geral");

    // 3. ABA: LOTES
    const wsBatches = XLSX.utils.json_to_sheet(state.batches.map(b => ({
      "Nome do Lote": b.name,
      "Data Povoamento": b.settlementDate,
      "Qtd Inicial": b.initialQuantity,
      "Peso Inicial (g)": b.initialUnitWeight,
      "Modelo Produção": protocolMap.get(b.protocolId || '') || "Nenhum"
    })));
    XLSX.utils.book_append_sheet(wb, wsBatches, "Lotes");

    // 4. ABA: GAIOLAS (INVENTÁRIO)
    const wsCages = XLSX.utils.json_to_sheet(state.cages.map(c => ({
      "Gaiola": c.name,
      "Linha/Setor": lineMap.get(c.lineId || '') || "N/A",
      "Capacidade": c.stockingCapacity,
      "Status": c.status,
      "Lote Atual": batchMap.get(c.batchId || '') || "Vazia",
      "Peixes Alojados": c.initialFishCount || 0,
      "Povoamento": c.settlementDate || "",
      "Prev. Despesca": c.harvestDate || ""
    })));
    XLSX.utils.book_append_sheet(wb, wsCages, "Inventário Gaiolas");

    // 5. ABA: TRATOS (ALIMENTAÇÃO) - FILTRADO
    const filteredFeedingLogs = (state.feedingLogs || []).filter(f => filterByDate(f.timestamp));
    const wsFeeding = XLSX.utils.json_to_sheet(filteredFeedingLogs.map(f => ({
      "Data/Hora": f.timestamp,
      "Gaiola": cageMap.get(f.cageId) || f.cageId,
      "Ração": feedMap.get(f.feedTypeId) || f.feedTypeId,
      "Quantidade (g)": f.amount,
      "Lançado por": userMap.get(f.userId) || f.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsFeeding, "Tratos Alimentares");

    // 6. ABA: MORTALIDADE - FILTRADO
    const filteredMortalityLogs = (state.mortalityLogs || []).filter(m => filterByDate(m.date));
    const wsMortality = XLSX.utils.json_to_sheet(filteredMortalityLogs.map(m => ({
      "Data": m.date,
      "Gaiola": cageMap.get(m.cageId) || m.cageId,
      "Quantidade": m.count,
      "Lançado por": userMap.get(m.userId) || m.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsMortality, "Mortalidade");

    // 7. ABA: BIOMETRIA - FILTRADO
    const filteredBiometryLogs = (state.biometryLogs || []).filter(b => filterByDate(b.date));
    const wsBiometry = XLSX.utils.json_to_sheet(filteredBiometryLogs.map(b => ({
      "Data": b.date,
      "Gaiola": cageMap.get(b.cageId) || b.cageId,
      "Peso Médio (g)": b.averageWeight,
      "Lançado por": userMap.get(b.userId) || b.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsBiometry, "Biometria");

    // 8. ABA: ESTOQUE RAÇÃO
    const wsFeedStock = XLSX.utils.json_to_sheet((state.feedTypes || []).map(f => ({
      "Ração": f.name,
      "Estoque Atual (kg)": f.totalStock / 1000,
      "Capacidade Silo (kg)": f.maxCapacity,
      "Alerta Mínimo (%)": f.minStockPercentage
    })));
    XLSX.utils.book_append_sheet(wb, wsFeedStock, "Estoque Ração");

    // 10. ABA: FRIGORÍFICO - FILTRADO
    const filteredSlaughterLogs = (state.slaughterLogs || []).filter(s => filterByDate(s.date));
    const wsSlaughter = XLSX.utils.json_to_sheet(filteredSlaughterLogs.map(s => ({
      "Data": s.date,
      "Lote Abate": s.slaughterBatch,
      "Produtor": s.producer,
      "Peso Filé Congelado (kg)": s.gtaWeight,
      "Recepção (kg)": s.receptionWeight,
      "Embalado (kg)": s.packedQuantity,
      "Rendimento (%)": s.receptionWeight > 0 ? ((s.packedQuantity / s.receptionWeight) * 100).toFixed(1) : 0,
      "Lote Embalagem": s.packagingBatch,
      "Lançado por": userMap.get(s.userId) || s.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsSlaughter, "Frigorífico");

    // FINALIZAR DOWNLOAD
    XLSX.writeFile(wb, `Relatorio_AquaGestao_${reportStartDate}_a_${reportEndDate}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Alerta de Estoque Baixo */}
      {lowStockFeeds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-top duration-500 shadow-lg shadow-red-500/5">
          <div className="p-4 bg-red-100 rounded-2xl text-red-600 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-sm font-black text-red-800 uppercase tracking-widest italic">Estoque Crítico de Ração!</h3>
            <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
              {lowStockFeeds.map(feed => (
                <span key={feed.id} className="px-3 py-1 bg-white border border-red-100 rounded-xl text-[11px] font-black text-red-600 uppercase flex items-center gap-2">
                  <PackageSearch className="w-3 h-3" /> {feed.name}: {(feed.totalStock/1000).toFixed(0)}kg restantes
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block text-[10px] font-black text-red-400 uppercase tracking-widest max-w-[150px] text-right">
            Providencie a compra imediata para evitar falhas no trato.
          </div>
        </div>
      )}

      {/* Seleção de Lote e Relatórios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm"><Layers className="w-6 h-6" /></div>
            <div>
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lote Selecionado</h3>
              <select 
                value={selectedBatchId} 
                onChange={e => setSelectedBatchId(e.target.value)}
                className="text-lg font-black text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer"
              >
                {state.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                {state.batches.length === 0 && <option value="">Nenhum lote criado</option>}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row-reverse items-center gap-4">
          <button onClick={handleDownloadReport} className="w-full xl:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95 whitespace-nowrap">
            <Download className="w-4 h-4" /> RELATÓRIO (EXCEL)
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm hidden sm:block"><Calendar className="w-6 h-6" /></div>
            <div className="flex-1 grid grid-cols-2 gap-3 w-full">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Início Relatório</label>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fim Relatório</label>
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas Gerais do Lote */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniStat label="Estoque Vivo Atual" value={<span className="text-xl font-black">{selectedBatchData.stock} un</span>} icon={<Fish className="w-5 h-5" />} color="text-blue-600" subtext="Peixes atualmente na água" />
        <MiniStat 
          label="Total Despescado" 
          value={
            <div className="flex flex-col">
              <span className="text-xl font-black text-indigo-600 leading-none">{selectedBatchData.harvested} un</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1">Biomassa: {selectedBatchData.harvestedWeight.toFixed(1)}kg</span>
            </div>
          } 
          icon={<Download className="w-5 h-5" />} 
          color="text-indigo-600" 
          subtext="Peixes retirados para abate" 
        />
        <MiniStat label="Mortalidade Total" value={<span className="text-xl font-black">{selectedBatchData.mortality} un</span>} icon={<FishOff className="w-5 h-5" />} color="text-red-600" subtext="Perdas registradas no lote" />
        <MiniStat label="Biomassa Est. Atual" value={<span className="text-xl font-black">{selectedBatchData.biomass.toFixed(1)}kg</span>} icon={<Scale className="w-5 h-5" />} color="text-emerald-600" subtext={selectedBatchData.samplingInfo} />
        <MiniStat 
          label="Ração Consumida" 
          value={
            <div className="flex flex-col">
              <div className="text-xl font-black text-slate-800 leading-none mb-2">{selectedBatchData.feed.toFixed(1)}kg</div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                {selectedBatchData.feedBreakdown.length > 0 ? selectedBatchData.feedBreakdown.map((item: any) => (
                  <div key={item.name} className="flex justify-between items-center text-[9px]">
                    <span className="font-bold text-slate-400 uppercase truncate">{item.name}</span>
                    <span className="font-black text-slate-600 ml-1">{item.amountKg.toFixed(1)}k</span>
                  </div>
                )) : <span className="text-[9px] font-bold text-slate-300 italic">Sem consumo</span>}
              </div>
            </div>
          } icon={<Utensils className="w-5 h-5" />} color="text-amber-600" />
        <MiniStat label="FCA (Conversão)" value={<span className="text-xl font-black">{selectedBatchData.fca}</span>} icon={<TrendingUp className="w-5 h-5" />} color="text-indigo-600" subtext="Baseado na biomassa atual" />
      </div>

      {/* Gráficos Evolutivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><TrendingUp className="w-4 h-4" /> Evolução de Peso (Lote)</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={biometryEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={4} dot={{r: 4, fill: '#3b82f6', strokeWidth: 0}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><FishOff className="w-4 h-4" /> Mortalidade Registrada</h3>
            </div>
            <div className="mt-1"><span className="text-[11px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">Perdas Totais: {totalMortalityInChart} un</span></div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mortalityEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]}>{mortalityEvolutionData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.count > 50 ? '#b91c1c' : '#ef4444'} />))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
