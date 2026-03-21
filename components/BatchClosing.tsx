
import React, { useState, useMemo } from 'react';
import { AppState, Batch, BatchExpense, User } from '../types';
import { format, differenceInDays, parseISO } from 'date-fns';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { 
  FileText, 
  TrendingUp, 
  Scale, 
  Fish, 
  Utensils, 
  Calendar, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit2,
  AlertCircle,
  CheckCircle2,
  Target,
  Clock,
  Percent,
  Printer,
  Lock
} from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

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

const BatchClosing: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [expenseForm, setExpenseForm] = useState({
    category: '',
    item: '',
    date: new Date().toISOString().split('T')[0],
    amount: ''
  });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterItem, setFilterItem] = useState('');

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const batches = useMemo(() => {
    const cagesByBatch = new Map<string, string[]>();
    (state.cages || []).forEach(c => {
      if (c.batchId) {
        const list = cagesByBatch.get(c.batchId) || [];
        list.push(c.id);
        cagesByBatch.set(c.batchId, list);
      }
    });

    const harvestsByBatch = new Map<string, number>();
    (state.harvestLogs || []).forEach(h => {
      harvestsByBatch.set(h.batchId, (harvestsByBatch.get(h.batchId) || 0) + h.fishCount);
    });

    // Only show batches that have harvests and no active cages
    return (state.batches || [])
      .filter(batch => {
        const harvestedFish = harvestsByBatch.get(batch.id) || 0;
        const batchCages = cagesByBatch.get(batch.id) || [];
        return harvestedFish > 0 && batchCages.length === 0;
      })
      .sort((a, b) => b.settlementDate.localeCompare(a.settlementDate));
  }, [state.batches, state.cages, state.harvestLogs]);

  const batchData = useMemo(() => {
    if (!selectedBatchId) return null;
    const batch = (state.batches || []).find(b => b.id === selectedBatchId);
    if (!batch) return null;

    // Robust mortality calculation
    const mortalityLogs = (state.mortalityLogs || []).filter(m => {
      let bId = m.batchId;
      if (!bId && m.cageId) {
        // 1. Check harvest logs for this specific batch
        const harvest = (state.harvestLogs || []).find(h => h.cageId === m.cageId && h.batchId === batch.id);
        if (harvest && m.date <= harvest.date) {
          bId = batch.id;
        } else {
          // 2. Check current cage assignment
          const cage = (state.cages || []).find(c => c.id === m.cageId);
          if (cage?.batchId === batch.id && m.date >= batch.settlementDate) {
            bId = batch.id;
          }
        }
      }
      return bId === batch.id;
    });
    const mortality = mortalityLogs.reduce((acc, curr) => acc + curr.count, 0);

    // Robust feeding calculation
    const feedingLogs = (state.feedingLogs || []).filter(f => {
      let bId = f.batchId;
      if (!bId && f.cageId) {
        const fDate = (f.timestamp || '').split('T')[0];
        // 1. Check harvest logs for this specific batch
        const harvest = (state.harvestLogs || []).find(h => h.cageId === f.cageId && h.batchId === batch.id);
        if (harvest && fDate <= harvest.date) {
          bId = batch.id;
        } else {
          // 2. Check current cage assignment
          const cage = (state.cages || []).find(c => c.id === f.cageId);
          if (cage?.batchId === batch.id && fDate >= batch.settlementDate) {
            bId = batch.id;
          }
        }
      }
      return bId === batch.id;
    });
    
    const feeding = feedingLogs.reduce((acc, curr) => acc + curr.amount, 0);

    const feedingByType = feedingLogs.reduce((acc, curr) => {
      const feedType = state.feedTypes?.find(t => t.id === curr.feedTypeId);
      const typeName = feedType?.name || 'Não especificado';
      acc[typeName] = (acc[typeName] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const harvests = (state.harvestLogs || [])
      .filter(h => h.batchId === batch.id);
    
    const harvestedFish = harvests.reduce((acc, curr) => acc + curr.fishCount, 0);
    const harvestedWeight = harvests.reduce((acc, curr) => acc + curr.totalWeight, 0);

    // Biomass before first harvest
    const firstHarvestDate = harvests.length > 0 
      ? harvests.reduce((min, h) => h.date < min ? h.date : min, harvests[0].date)
      : null;

    let biomassBeforeHarvest = 0;
    let avgWeightBeforeHarvest = batch.initialUnitWeight;
    let expectedFish = batch.initialQuantity - mortality;

    if (firstHarvestDate) {
      const mortalityBeforeHarvest = mortalityLogs
        .filter(m => m.date < firstHarvestDate)
        .reduce((acc, curr) => acc + curr.count, 0);
      
      const liveFishBeforeHarvest = batch.initialQuantity - mortalityBeforeHarvest;
      expectedFish = liveFishBeforeHarvest;
      
      const biometriesBeforeHarvest = (state.biometryLogs || [])
        .filter(b => {
          let bId = b.batchId;
          if (!bId && b.cageId) {
             const cage = (state.cages || []).find(c => c.id === b.cageId);
             if (cage?.batchId === batch.id) bId = batch.id;
             else {
                const harvest = (state.harvestLogs || []).find(h => h.cageId === b.cageId && h.batchId === batch.id);
                if (harvest) bId = batch.id;
             }
          }
          return bId === batch.id && b.date <= firstHarvestDate;
        });

      if (biometriesBeforeHarvest.length > 0) {
        // Prioritize biometry on the harvest day itself
        const harvestDayLogs = biometriesBeforeHarvest.filter(log => log.date === firstHarvestDate);
        if (harvestDayLogs.length > 0) {
          avgWeightBeforeHarvest = harvestDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) / harvestDayLogs.length;
        } else {
          // Fallback to the most recent biometry up to the harvest day
          const lastDate = biometriesBeforeHarvest.reduce((max, log) => log.date > max ? log.date : max, "");
          const lastDayLogs = biometriesBeforeHarvest.filter(log => log.date === lastDate);
          if (lastDayLogs.length > 0) {
            avgWeightBeforeHarvest = lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) / lastDayLogs.length;
          }
        }
      }
      biomassBeforeHarvest = (liveFishBeforeHarvest * avgWeightBeforeHarvest) / 1000;
    }

    const liveFish = Math.max(0, batch.initialQuantity - mortality - harvestedFish);
    
    const batchBiometries = (state.biometryLogs || []).filter(b => {
      let bId = b.batchId;
      if (!bId && b.cageId) {
         const cage = (state.cages || []).find(c => c.id === b.cageId);
         if (cage?.batchId === batch.id) bId = batch.id;
         else {
            const harvest = (state.harvestLogs || []).find(h => h.cageId === b.cageId && h.batchId === batch.id);
            if (harvest) bId = batch.id;
         }
      }
      return bId === batch.id;
    });

    let currentAvgWeight = batch.initialUnitWeight;
    if (batchBiometries.length > 0) {
      const lastDate = batchBiometries.reduce((max, log) => log.date > max ? log.date : max, "");
      const lastDayLogs = batchBiometries.filter(log => log.date === lastDate);
      if (lastDayLogs.length > 0) {
        currentAvgWeight = lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) / lastDayLogs.length;
      }
    }

    const currentBiomassKg = (liveFish * currentAvgWeight) / 1000;

    const slaughters = (state.slaughterLogs || [])
      .filter(s => s.batchId === batch.id);
    
    const slaughteredWeight = slaughters.reduce((acc, curr) => acc + curr.netWeight, 0);
    const slaughteredCount = slaughters.reduce((acc, curr) => acc + curr.fishCount, 0);

    const expenses = (state.batchExpenses || [])
      .filter(e => e.batchId === batch.id);
    
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.value, 0);
    const totalRevenue = harvests.reduce((acc, curr) => acc + (curr.totalWeight * (curr.unitPrice || 0)), 0);
    const totalProfit = totalRevenue - totalExpenses;

    const categories = Array.from(new Set((state.batchExpenses || []).map(e => e.category))).sort();
    const items = Array.from(new Set((state.batchExpenses || []).map(e => e.description))).sort();

    const filteredExpenses = expenses.filter(e => {
      const matchCategory = !filterCategory || e.category === filterCategory;
      const matchItem = !filterItem || e.description.toLowerCase().includes(filterItem.toLowerCase());
      return matchCategory && matchItem;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const protocol = (state.protocols || []).find(p => p.id === batch.protocolId);
    
    // Calculate total days
    const startDate = parseISO(batch.settlementDate);
    const endDate = harvests.length > 0 
      ? parseISO(harvests.reduce((max, h) => h.date > max ? h.date : max, batch.settlementDate))
      : new Date();
    const totalDays = isNaN(differenceInDays(endDate, startDate)) ? 0 : differenceInDays(endDate, startDate);

    // Survival Rate (Predicted): (Expected Fish / Initial)
    const survivalRate = batch.initialQuantity > 0 
      ? (expectedFish / batch.initialQuantity) * 100 
      : 0;

    // Biomass Before Harvest: (Avg Weight * Expected Fish) / 1000
    // This is our predicted biomass for comparison
    const expectedWeight = expectedFish * (avgWeightBeforeHarvest / 1000);
    biomassBeforeHarvest = expectedWeight;

    // FCA Previsto: Total Feed / Predicted Biomass
    const fcaTheoretical = expectedWeight > 0 ? (feeding / 1000) / expectedWeight : 0;

    // FCA Real: Total Feed / Harvested Weight
    const fcaReal = harvestedWeight > 0 ? (feeding / 1000) / harvestedWeight : 0;

    // Cost per kg: Total Expenses / Slaughtered Weight (or harvested if slaughter not available)
    const divisor = slaughteredWeight || harvestedWeight;
    const costPerKg = divisor > 0 ? totalExpenses / divisor : 0;

    // Accuracy (Assertividade): Harvested Weight / Expected Weight
    const accuracy = expectedWeight > 0 ? (harvestedWeight / expectedWeight) * 100 : 0;

    // Real Survival Rate: Harvested Fish / Initial Quantity
    const survivalRateReal = batch.initialQuantity > 0 ? (harvestedFish / batch.initialQuantity) * 100 : 0;

    // Group logs by cage for detailed view
    const logsByCage = new Map<string, {
      cageName: string;
      feeding: any[];
      mortality: any[];
      biometry: any[];
    }>();

    // Get all cage IDs involved in this batch (from harvests)
    const cageIds = Array.from(new Set(harvests.map(h => h.cageId)));
    
    cageIds.forEach(cId => {
      const cage = (state.cages || []).find(c => c.id === cId);
      logsByCage.set(cId, {
        cageName: cage?.name || `Gaiola ${cId.substring(0, 4)}`,
        feeding: feedingLogs.filter(f => f.cageId === cId).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
        mortality: mortalityLogs.filter(m => m.cageId === cId).sort((a, b) => b.date.localeCompare(a.date)),
        biometry: batchBiometries.filter(b => b.cageId === cId).sort((a, b) => b.date.localeCompare(a.date))
      });
    });

    return {
      batch,
      mortality,
      feeding,
      feedingByType,
      harvestedFish,
      harvestedWeight,
      totalRevenue,
      totalProfit,
      slaughteredWeight,
      slaughteredCount,
      expenses,
      totalExpenses,
      protocol,
      totalDays,
      survivalRate,
      fcaTheoretical,
      fcaReal,
      costPerKg,
      accuracy,
      survivalRateReal,
      expectedFish,
      expectedWeight,
      liveFish,
      currentBiomassKg,
      biomassBeforeHarvest,
      logsByCage,
      categories,
      items,
      filteredExpenses
    };
  }, [selectedBatchId, state.batches, state.mortalityLogs, state.feedingLogs, state.harvestLogs, state.slaughterLogs, state.batchExpenses, state.protocols, state.biometryLogs, state.cages, state.feedTypes, filterCategory, filterItem]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !expenseForm.category || !expenseForm.item || !expenseForm.amount) return;

    const expenseData = {
      batchId: selectedBatchId,
      category: expenseForm.category,
      description: expenseForm.item,
      date: expenseForm.date,
      value: Number(expenseForm.amount),
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    let updatedExpenses;
    if (editingExpenseId) {
      updatedExpenses = (state.batchExpenses || []).map(e => 
        e.id === editingExpenseId ? { ...e, ...expenseData } : e
      );
    } else {
      const newExpense: BatchExpense = {
        id: generateId(),
        ...expenseData
      };
      updatedExpenses = [...(state.batchExpenses || []), newExpense];
    }

    onUpdate({
      ...state,
      batchExpenses: updatedExpenses
    });

    setExpenseForm({
      category: '',
      item: '',
      date: new Date().toISOString().split('T')[0],
      amount: ''
    });
    setIsAddingCategory(false);
    setIsAddingItem(false);
    setEditingExpenseId(null);
  };

  const startEditExpense = (expense: BatchExpense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      category: expense.category,
      item: expense.description,
      date: expense.date,
      amount: expense.value.toString()
    });
    setIsAddingCategory(false);
    setIsAddingItem(false);
  };

  const cancelEdit = () => {
    setEditingExpenseId(null);
    setExpenseForm({
      category: '',
      item: '',
      date: new Date().toISOString().split('T')[0],
      amount: ''
    });
    setIsAddingCategory(false);
    setIsAddingItem(false);
  };

  const removeExpense = (id: string) => {
    if (!confirm('Excluir este gasto?')) return;
    onUpdate({
      ...state,
      batchExpenses: (state.batchExpenses || []).filter(e => e.id !== id)
    });
  };

  const handleCloseBatch = () => {
    if (!selectedBatchId || !currentUser.isMaster) return;
    if (!confirm('Deseja realmente FECHAR este lote? Esta ação é definitiva para fins de auditoria.')) return;

    const updatedBatches = (state.batches || []).map(b => 
      b.id === selectedBatchId ? { ...b, isClosed: true, closedAt: new Date().toISOString() } : b
    );

    onUpdate({
      ...state,
      batches: updatedBatches
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 print:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Fechamento de Lote
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resumo financeiro e produtivo do lote finalizado</p>
        </div>

        <div className="flex items-center gap-3">
          {batchData?.batch.isClosed && (
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs outline-none hover:bg-slate-50 uppercase tracking-widest shadow-sm flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório
            </button>
          )}
          
          <select 
            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-blue-500/10 uppercase tracking-widest shadow-sm"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
          >
            <option value="">Selecionar Lote para Fechamento</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name} - {safeDateFormat(b.settlementDate, 'dd/MM/yyyy')}</option>
            ))}
          </select>
        </div>
      </div>

      {batchData ? (
        <div className="space-y-8">
          {/* Print Header (Only visible when printing) */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-8 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">AquaGestão - Relatório de Fechamento</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Relatório Gerencial de Desempenho e Custos</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data de Emissão</p>
                <p className="text-sm font-bold text-slate-900">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-8">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lote</span>
                <span className="text-lg font-black text-slate-900 uppercase italic">{batchData.batch.name}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Povoamento</span>
                <span className="text-lg font-black text-slate-900">{safeDateFormat(batchData.batch.settlementDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                <span className={`text-lg font-black uppercase italic ${batchData.batch.isClosed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {batchData.batch.isClosed ? 'Lote Fechado' : 'Aguardando Fechamento'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Stats */}
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Produção Summary */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print:shadow-none print:border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      Visão Geral do Lote
                    </h3>
                    {batchData.batch.isClosed && batchData.batch.closedAt && (
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          Fechado em {safeDateFormat(batchData.batch.closedAt, 'dd/MM/yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estoque Vivo Atual</span>
                    <span className="text-xl font-black text-slate-800 italic">{formatNumber(batchData.liveFish)} un</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mortalidade Atual</span>
                    <span className="text-xl font-black text-red-600 italic">{formatNumber(batchData.mortality)} un</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Biomassa Atual</span>
                    <span className="text-xl font-black text-blue-600 italic">{formatNumber(batchData.currentBiomassKg, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ração Consumida Total</span>
                    <span className="text-xl font-black text-amber-600 italic">{formatNumber(batchData.feeding / 1000, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">FCA Previsto</span>
                    <span className="text-xl font-black text-indigo-600 italic">{formatNumber(batchData.fcaTheoretical, 2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Biomassa Pré-Despesca</span>
                    <span className="text-xl font-black text-emerald-600 italic">{formatNumber(batchData.biomassBeforeHarvest, 1)}kg</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Consumo Estratificado por Modelo</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(batchData.feedingByType).map(([type, amount]) => (
                      <div key={type} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase block truncate" title={type}>{type}</span>
                        <span className="text-xs font-black text-slate-700 italic">{formatNumber(amount / 1000, 1)}kg</span>
                      </div>
                    ))}
                    {Object.keys(batchData.feedingByType).length === 0 && (
                      <span className="text-[10px] font-bold text-slate-300 uppercase italic col-span-full">Nenhum registro de trato</span>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Biomassa Inicial</span>
                    <span className="text-sm font-black text-slate-600 uppercase">{formatNumber((batchData.batch.initialQuantity * batchData.batch.initialUnitWeight) / 1000, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Qtd Inicial</span>
                    <span className="text-sm font-black text-slate-600 uppercase">{formatNumber(batchData.batch.initialQuantity)} un</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sobrevivência Prevista</span>
                    <span className="text-sm font-black text-emerald-500 uppercase">{formatNumber(batchData.survivalRate, 1)}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Dias Totais</span>
                    <span className="text-sm font-black text-blue-600 uppercase">{batchData.totalDays} dias</span>
                  </div>
                </div>
              </div>

              {/* Slaughter Comparison */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6">
                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 italic">
                  <CheckCircle2 className="w-4 h-4" />
                  Dados de Despesca vs Real
                </h3>

                <div className="space-y-6">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taxa de Sobrevivência do Lote</span>
                      <span className="text-lg font-black text-indigo-400 italic">{formatNumber(batchData.accuracy, 1)}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, batchData.accuracy)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Sobrevivência Prevista</span>
                      <span className="text-lg font-black italic text-emerald-400">{formatNumber(batchData.survivalRate, 1)}%</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Sobrevivência Real</span>
                      <span className="text-lg font-black italic text-blue-400">{formatNumber(batchData.survivalRateReal, 1)}%</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">FCA Previsto</span>
                      <span className="text-lg font-black italic text-indigo-400">{formatNumber(batchData.fcaTheoretical, 2)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">FCA Real</span>
                      <span className="text-lg font-black italic text-amber-400">{formatNumber(batchData.fcaReal, 2)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Peixes Despescados</span>
                      <span className="text-lg font-black italic">{formatNumber(batchData.harvestedFish)} un</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Peso Total</span>
                      <span className="text-lg font-black italic">{formatNumber(batchData.harvestedWeight, 1)}kg</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Peixes Previstos</span>
                      <span className="text-lg font-black italic text-blue-400">{formatNumber(batchData.expectedFish)} un</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Peso Previsto</span>
                      <span className="text-lg font-black italic text-blue-400">{formatNumber(batchData.expectedWeight, 1)}kg</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block">FCA Real</span>
                      <span className="text-lg font-black text-emerald-400 italic">{formatNumber(batchData.fcaReal, 2)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">Diferença Peso</span>
                      <span className="text-lg font-black text-amber-400 italic">{formatNumber(Math.abs(batchData.harvestedWeight - batchData.expectedWeight), 1)}kg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar (Right Column) */}
          <div className="space-y-8">
              {/* Cost Analysis Card */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Análise de Custos
                </h3>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Custo Total Acumulado</span>
                    <span className="text-2xl font-black text-slate-800 italic">{formatCurrency(batchData.totalExpenses)}</span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Custo por KG</span>
                    <span className="text-2xl font-black text-emerald-700 italic">{formatCurrency(batchData.costPerKg)}</span>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Receita Total</span>
                    <span className="text-2xl font-black text-blue-700 italic">{formatCurrency(batchData.totalRevenue)}</span>
                  </div>

                  <div className={`p-4 rounded-2xl border ${batchData.totalProfit >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-red-50 border-red-100'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest block mb-1 ${batchData.totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                      Resultado (Lucro/Prejuízo)
                    </span>
                    <span className={`text-2xl font-black italic ${batchData.totalProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
                      {formatCurrency(batchData.totalProfit)}
                    </span>
                  </div>
                </div>

                {!batchData.batch.isClosed && currentUser.isMaster && (
                  <button 
                    onClick={handleCloseBatch}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Fechar Lote Definitivamente
                  </button>
                )}

                {batchData.batch.isClosed && (
                  <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lote Encerrado</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Nenhuma alteração permitida</p>
                  </div>
                )}
              </div>

              {/* Add Expense Form */}
              {!batchData.batch.isClosed && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic mb-6">
                    <Plus className="w-4 h-4 text-blue-600" />
                    {editingExpenseId ? 'Editar Despesa' : 'Lançar Despesa'}
                  </h3>
                  
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest ml-1">Categoria</label>
                      {!isAddingCategory ? (
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                          value={expenseForm.category}
                          onChange={e => {
                            if (e.target.value === 'new') {
                              setIsAddingCategory(true);
                              setExpenseForm({ ...expenseForm, category: '' });
                            } else {
                              setExpenseForm({ ...expenseForm, category: e.target.value });
                            }
                          }}
                          required
                        >
                          <option value="">Selecione...</option>
                          {batchData.categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="new" className="text-blue-600 font-black">+ Cadastrar Nova Categoria</option>
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Nova Categoria"
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                            value={expenseForm.category}
                            onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                            required
                          />
                          <button 
                            type="button"
                            onClick={() => setIsAddingCategory(false)}
                            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase"
                          >
                            Voltar
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest ml-1">Item (Lançamento)</label>
                      {!isAddingItem ? (
                        <select 
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                          value={expenseForm.item}
                          onChange={e => {
                            if (e.target.value === 'new') {
                              setIsAddingItem(true);
                              setExpenseForm({ ...expenseForm, item: '' });
                            } else {
                              setExpenseForm({ ...expenseForm, item: e.target.value });
                            }
                          }}
                          required
                        >
                          <option value="">Selecione...</option>
                          {batchData.items.map(item => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                          <option value="new" className="text-blue-600 font-black">+ Cadastrar Novo Item</option>
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Novo Item"
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                            value={expenseForm.item}
                            onChange={e => setExpenseForm({ ...expenseForm, item: e.target.value })}
                            required
                          />
                          <button 
                            type="button"
                            onClick={() => setIsAddingItem(false)}
                            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase"
                          >
                            Voltar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest ml-1">Data</label>
                        <input 
                          type="date" 
                          required
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                          value={expenseForm.date}
                          onChange={e => setExpenseForm({...expenseForm, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest ml-1">Valor (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          placeholder="0,00"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                          value={expenseForm.amount}
                          onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {editingExpenseId && (
                        <button 
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                      <button 
                        type="submit"
                        disabled={!hasPermission}
                        className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editingExpenseId ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Quadro de Lançamentos
                </h3>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Filtrar:</span>
                    <select 
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      <option value="">Todas Categorias</option>
                      {batchData.categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <input 
                      type="text"
                      placeholder="Buscar Item..."
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={filterItem}
                      onChange={e => setFilterItem(e.target.value)}
                    />
                  </div>
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-black uppercase tracking-widest">Total: {formatCurrency(batchData.totalExpenses)}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lançamento (Item)</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                      <th className="text-right py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batchData.filteredExpenses.map(expense => {
                      const user = state.users.find(u => u.id === expense.userId);
                      return (
                        <tr key={expense.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 text-xs font-bold text-slate-600">{safeDateFormat(expense.date, 'dd/MM/yyyy')}</td>
                          <td className="py-4 text-xs font-black text-slate-400 uppercase italic">{expense.category}</td>
                          <td className="py-4 text-xs font-black text-slate-800 uppercase italic">{expense.description}</td>
                          <td className="py-4 text-xs font-bold text-slate-500 italic">{user?.name || '---'}</td>
                          <td className="py-4 text-right text-xs font-black text-emerald-600">{formatCurrency(expense.value)}</td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => startEditExpense(expense)}
                                className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => removeExpense(expense.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {batchData.filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum lançamento encontrado.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Detailed Logs Section (Only visible after closing or for audit) */}
          {batchData.batch.isClosed && (
            <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
              <div className="flex items-center gap-3 px-4">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Detalhamento por Gaiola</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Histórico completo de manejos do lote</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {Array.from(batchData.logsByCage.entries()).map(([cageId, logs]) => (
                  <div key={cageId} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden print:border-slate-100 print:shadow-none">
                    <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Fish className="w-5 h-5 text-blue-600" />
                        <h4 className="text-lg font-black text-slate-800 uppercase italic">{logs.cageName}</h4>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-400 uppercase block">Tratos</span>
                          <span className="text-xs font-black text-slate-700">{logs.feeding.length}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-400 uppercase block">Mortes</span>
                          <span className="text-xs font-black text-red-600">{logs.mortality.reduce((acc, m) => acc + m.count, 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Feeding Logs */}
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          <Utensils className="w-3 h-3" />
                          Histórico de Trato
                        </h5>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                          {logs.feeding.map((f, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-500">{safeDateFormat(f.timestamp, 'dd/MM')}</span>
                              <span className="text-xs font-black text-slate-800 italic">{formatNumber(f.amount / 1000, 1)}kg</span>
                            </div>
                          ))}
                          {logs.feeding.length === 0 && <p className="text-[10px] font-bold text-slate-300 uppercase italic">Sem registros</p>}
                        </div>
                      </div>

                      {/* Mortality Logs */}
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                          <AlertCircle className="w-3 h-3" />
                          Histórico de Mortalidade
                        </h5>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                          {logs.mortality.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                              <span className="text-[10px] font-bold text-red-500">{safeDateFormat(m.date, 'dd/MM')}</span>
                              <span className="text-xs font-black text-red-700 italic">{m.count} un</span>
                            </div>
                          ))}
                          {logs.mortality.length === 0 && <p className="text-[10px] font-bold text-slate-300 uppercase italic">Sem registros</p>}
                        </div>
                      </div>

                      {/* Biometry Logs */}
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                          <Scale className="w-3 h-3" />
                          Histórico de Biometria
                        </h5>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                          {logs.biometry.map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                              <span className="text-[10px] font-bold text-emerald-500">{safeDateFormat(b.date, 'dd/MM')}</span>
                              <span className="text-xs font-black text-emerald-700 italic">{formatNumber(b.averageWeight, 1)}g</span>
                            </div>
                          ))}
                          {logs.biometry.length === 0 && <p className="text-[10px] font-bold text-slate-300 uppercase italic">Sem registros</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center space-y-4">
          <div className="p-6 bg-slate-50 rounded-full">
            <FileText className="w-12 h-12 text-slate-200" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest italic">Nenhum Lote Selecionado</h3>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mt-2">Selecione um lote acima para visualizar o fechamento</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchClosing;
