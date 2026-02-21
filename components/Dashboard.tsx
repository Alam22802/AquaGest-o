
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
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-slate-800">{value}</div>
      {subtext && <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{subtext}</div>}
    </div>
  </div>
);

const Dashboard: React.FC<Props> = ({ state }) => {
  const [selectedMainBatchId, setSelectedMainBatchId] = useState<string>('');
  const [selectedBioBatchId, setSelectedBioBatchId] = useState<string>('');
  const [selectedMortBatchId, setSelectedMortBatchId] = useState<string>('');
  const [reportStartDate, setReportStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (state.batches && state.batches.length > 0) {
      if (!selectedMainBatchId) setSelectedMainBatchId(state.batches[0].id);
      if (!selectedBioBatchId) setSelectedBioBatchId(state.batches[0].id);
      if (!selectedMortBatchId) setSelectedMortBatchId(state.batches[0].id);
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
    return (state.batches || []).map(batch => {
      const batchCages = (state.cages || []).filter(c => c.batchId === batch.id);
      const cageIds = batchCages.map(c => c.id);
      
      const totalInitial = batchCages.reduce((acc, c) => acc + (c.initialFishCount || 0), 0);
      const totalMortality = (state.mortalityLogs || [])
        .filter(m => cageIds.includes(m.cageId))
        .reduce((acc, m) => acc + m.count, 0);
      const currentTotalStock = totalInitial - totalMortality;

      const batchBiometries = (state.biometryLogs || []).filter(b => cageIds.includes(b.cageId));
      let currentAvgWeight = batch.initialUnitWeight;
      let samplingInfo = "Peso Inicial";

      if (batchBiometries.length > 0) {
        // Pegar a última biometria de cada gaiola que já foi pesada
        const latestBiometryPerCage = new Map<string, { date: string, weight: number }>();
        batchBiometries.forEach(log => {
          const current = latestBiometryPerCage.get(log.cageId);
          if (!current || log.date >= current.date) {
            latestBiometryPerCage.set(log.cageId, { date: log.date, weight: log.averageWeight });
          }
        });

        const latestWeights = Array.from(latestBiometryPerCage.values());
        const sumWeights = latestWeights.reduce((acc, w) => acc + w.weight, 0);
        currentAvgWeight = sumWeights / latestWeights.length;
        
        const latestDate = latestWeights.reduce((max, w) => w.date > max ? w.date : max, latestWeights[0].date);
        samplingInfo = `Média de ${latestWeights.length} gaiolas (Ref: ${format(parseISO(latestDate), 'dd/MM')})`;
      }

      const totalBiomassKg = (currentTotalStock * currentAvgWeight) / 1000;
      const feedingLogsForBatch = (state.feedingLogs || []).filter(f => cageIds.includes(f.cageId));
      const totalFeedKg = feedingLogsForBatch.reduce((acc, f) => acc + f.amount, 0) / 1000;

      const feedBreakdownObj: { [name: string]: number } = {};
      feedingLogsForBatch.forEach(log => {
        const feedType = state.feedTypes.find(ft => ft.id === log.feedTypeId);
        const name = feedType ? feedType.name : 'Ração S/ Ident.';
        feedBreakdownObj[name] = (feedBreakdownObj[name] || 0) + log.amount;
      });

      const feedBreakdown = Object.entries(feedBreakdownObj).map(([name, amount]) => ({
        name,
        amountKg: amount / 1000
      })).sort((a, b) => a.name.localeCompare(b.name));

      const fcaValue = totalBiomassKg > 0 ? (totalFeedKg / totalBiomassKg).toFixed(2) : '0.00';

      return { 
        id: batch.id, 
        name: batch.name, 
        stock: currentTotalStock, 
        biomass: totalBiomassKg, 
        feed: totalFeedKg, 
        feedBreakdown,
        fca: fcaValue,
        avgWeight: currentAvgWeight,
        samplingInfo
      };
    });
  }, [state.batches, state.cages, state.mortalityLogs, state.biometryLogs, state.feedingLogs, state.feedTypes]);

  const selectedBatchData = useMemo(() => {
    return batchStats.find(b => b.id === selectedMainBatchId) || { stock: 0, biomass: 0, feed: 0, fca: '0.00', feedBreakdown: [], avgWeight: 0, samplingInfo: 'Sem dados' };
  }, [batchStats, selectedMainBatchId]);

  const biometryEvolutionData = useMemo(() => {
    if (!selectedBioBatchId) return [];
    const batch = (state.batches || []).find(b => b.id === selectedBioBatchId);
    if (!batch) return [];
    const cageIds = (state.cages || []).filter(c => c.batchId === selectedBioBatchId).map(c => c.id);
    const logs = (state.biometryLogs || []).filter(l => cageIds.includes(l.cageId)).sort((a, b) => a.date.localeCompare(b.date));
    
    const uniqueDates = Array.from(new Set(logs.map(l => l.date))).sort();
    const latestWeights = new Map<string, number>();
    
    const data = uniqueDates.map(currentDate => {
      // Atualizar pesos das gaiolas que tiveram biometria nesta data
      logs.filter(l => l.date === currentDate).forEach(l => {
        latestWeights.set(l.cageId, l.averageWeight);
      });
      
      const weights = Array.from(latestWeights.values());
      const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : batch.initialUnitWeight;

      return {
        date: format(new Date(currentDate + 'T12:00:00'), 'dd/MM'),
        fullDate: currentDate,
        weight: Math.round(avgWeight)
      };
    });
    
    return [{ date: 'Início', weight: batch.initialUnitWeight }, ...data];
  }, [state.biometryLogs, state.batches, state.cages, selectedBioBatchId]);

  const mortalityEvolutionData = useMemo(() => {
    if (!selectedMortBatchId) return [];
    const cageIds = (state.cages || []).filter(c => c.batchId === selectedMortBatchId).map(c => c.id);
    const logs = (state.mortalityLogs || []).filter(m => cageIds.includes(m.cageId));
    const grouped = logs.reduce((acc: any, log) => {
      if (!acc[log.date]) acc[log.date] = 0;
      acc[log.date] += log.count;
      return acc;
    }, {});
    return Object.keys(grouped).map(date => ({ 
      date: format(new Date(date + 'T12:00:00'), 'dd/MM'), 
      fullDate: date, 
      count: grouped[date] 
    })).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [state.mortalityLogs, state.cages, selectedMortBatchId]);

  const totalMortalityInChart = useMemo(() => {
    return mortalityEvolutionData.reduce((acc, curr) => acc + curr.count, 0);
  }, [mortalityEvolutionData]);

  // FUNÇÃO DE EXPORTAÇÃO COMPLETA COM FILTRO DE DATA
  const handleDownloadReport = () => {
    // Definir intervalo de filtro
    const start = startOfDay(parseISO(reportStartDate));
    const end = endOfDay(parseISO(reportEndDate));

    // Função auxiliar para filtrar logs por data
    const filterByDate = (dateString: string) => {
      try {
        const itemDate = parseISO(dateString);
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
    const filteredFeedingLogs = state.feedingLogs.filter(f => filterByDate(f.timestamp));
    const wsFeeding = XLSX.utils.json_to_sheet(filteredFeedingLogs.map(f => ({
      "Data/Hora": f.timestamp,
      "Gaiola": cageMap.get(f.cageId) || f.cageId,
      "Ração": feedMap.get(f.feedTypeId) || f.feedTypeId,
      "Quantidade (g)": f.amount,
      "Lançado por": userMap.get(f.userId) || f.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsFeeding, "Tratos Alimentares");

    // 6. ABA: MORTALIDADE - FILTRADO
    const filteredMortalityLogs = state.mortalityLogs.filter(m => filterByDate(m.date));
    const wsMortality = XLSX.utils.json_to_sheet(filteredMortalityLogs.map(m => ({
      "Data": m.date,
      "Gaiola": cageMap.get(m.cageId) || m.cageId,
      "Quantidade": m.count,
      "Lançado por": userMap.get(m.userId) || m.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsMortality, "Mortalidade");

    // 7. ABA: BIOMETRIA - FILTRADO
    const filteredBiometryLogs = state.biometryLogs.filter(b => filterByDate(b.date));
    const wsBiometry = XLSX.utils.json_to_sheet(filteredBiometryLogs.map(b => ({
      "Data": b.date,
      "Gaiola": cageMap.get(b.cageId) || b.cageId,
      "Peso Médio (g)": b.averageWeight,
      "Lançado por": userMap.get(b.userId) || b.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsBiometry, "Biometria");

    // 8. ABA: QUALIDADE ÁGUA - FILTRADO
    const filteredWaterLogs = state.waterLogs.filter(w => filterByDate(w.date));
    const wsWater = XLSX.utils.json_to_sheet(filteredWaterLogs.map(w => ({
      "Data": w.date,
      "Hora": w.time,
      "Temp (°C)": w.temperature,
      "pH": w.ph,
      "O2 (mg/L)": w.oxygen,
      "Transp. (cm)": w.transparency,
      "Lançado por": userMap.get(w.userId) || w.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsWater, "Qualidade Água");

    // 9. ABA: ESTOQUE RAÇÃO
    const wsFeedStock = XLSX.utils.json_to_sheet(state.feedTypes.map(f => ({
      "Ração": f.name,
      "Estoque Atual (kg)": f.totalStock / 1000,
      "Capacidade Silo (kg)": f.maxCapacity,
      "Alerta Mínimo (%)": f.minStockPercentage
    })));
    XLSX.utils.book_append_sheet(wb, wsFeedStock, "Estoque Ração");

    // 10. ABA: FRIGORÍFICO - FILTRADO
    const filteredSlaughterLogs = state.slaughterLogs.filter(s => filterByDate(s.date));
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
                <span key={feed.id} className="px-3 py-1 bg-white border border-red-100 rounded-xl text-[10px] font-black text-red-600 uppercase flex items-center gap-2">
                  <PackageSearch className="w-3 h-3" /> {feed.name}: {(feed.totalStock/1000).toFixed(0)}kg restantes
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block text-[9px] font-black text-red-400 uppercase tracking-widest max-w-[150px] text-right">
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
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lote Selecionado</h3>
              <select 
                value={selectedMainBatchId} 
                onChange={e => setSelectedMainBatchId(e.target.value)}
                className="text-lg font-black text-slate-800 bg-transparent border-none outline-none focus:ring-0 p-0 cursor-pointer"
              >
                {state.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                {state.batches.length === 0 && <option value="">Nenhum lote criado</option>}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 flex-1 w-full">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm"><Calendar className="w-6 h-6" /></div>
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Início Relatório</label>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Fim Relatório</label>
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
            </div>
          </div>
          <button onClick={handleDownloadReport} className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
            <Download className="w-4 h-4" /> Relatório Período (Excel)
          </button>
        </div>
      </div>

      {/* Estatísticas Gerais do Lote */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Estoque Vivo Total" value={<span className="text-xl font-black">{selectedBatchData.stock} un</span>} icon={<Fish className="w-5 h-5" />} color="text-blue-600" subtext="Todas as gaiolas do lote" />
        <MiniStat label="Biomassa Est. Total" value={<span className="text-xl font-black">{selectedBatchData.biomass.toFixed(1)}kg</span>} icon={<Scale className="w-5 h-5" />} color="text-emerald-600" subtext={selectedBatchData.samplingInfo} />
        <MiniStat 
          label="Ração Consumida" 
          value={
            <div className="flex flex-col">
              <div className="text-xl font-black text-slate-800 leading-none mb-2">{selectedBatchData.feed.toFixed(1)}kg</div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                {selectedBatchData.feedBreakdown.length > 0 ? selectedBatchData.feedBreakdown.slice(0, 2).map((item: any) => (
                  <div key={item.name} className="flex justify-between items-center text-[8px]">
                    <span className="font-bold text-slate-400 uppercase truncate">{item.name}</span>
                    <span className="font-black text-slate-600 ml-1">{item.amountKg.toFixed(1)}k</span>
                  </div>
                )) : <span className="text-[8px] font-bold text-slate-300 italic">Sem consumo</span>}
              </div>
            </div>
          } icon={<Utensils className="w-5 h-5" />} color="text-amber-600" />
        <MiniStat label="FCA (Conversão)" value={<span className="text-xl font-black">{selectedBatchData.fca}</span>} icon={<TrendingUp className="w-5 h-5" />} color="text-indigo-600" subtext="Baseado na biomassa est." />
      </div>

      {/* Gráficos Evolutivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><TrendingUp className="w-4 h-4" /> Evolução de Peso (Lote)</h3>
            <select className="text-[10px] font-black border-none bg-slate-100 rounded-lg px-2 py-1 outline-none" value={selectedBioBatchId} onChange={e => setSelectedBioBatchId(e.target.value)}>{state.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
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
              <select className="text-[10px] font-black border-none bg-slate-100 rounded-lg px-2 py-1 outline-none" value={selectedMortBatchId} onChange={e => setSelectedMortBatchId(e.target.value)}>{state.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            </div>
            <div className="mt-1"><span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">Perdas Totais: {totalMortalityInChart} un</span></div>
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
