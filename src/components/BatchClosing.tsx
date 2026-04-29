
import React, { useState, useMemo } from 'react';
import { AppState, Batch, BatchExpense, BatchRevenue, User } from '../types';
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
  const [revenueForm, setRevenueForm] = useState({
    receptionWeight: '',
    unitPrice: '0',
    date: new Date().toISOString().split('T')[0]
  });
  const [formType, setFormType] = useState<'expense' | 'revenue'>('expense');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

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
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.batches, state.cages, state.harvestLogs]);

  const batchData = useMemo(() => {
    if (!selectedBatchId) return null;
    const batch = (state.batches || []).find(b => b.id === selectedBatchId);
    if (!batch) return null;

    // Create lookups for better performance
    const harvestsByBatch = (state.harvestLogs || []).filter(h => h.batchId === batch.id);
    const harvestCages = new Set(harvestsByBatch.map(h => h.cageId));
    const batchCages = new Set((state.cages || []).filter(c => c.batchId === batch.id).map(c => c.id));
    
    // Map for quick cage lookup
    const cageMap = new Map((state.cages || []).map(c => [c.id, c]));

    // Optimized mortality filtering
    const mortalityLogs = (state.mortalityLogs || []).filter(m => {
      if (m.batchId === batch.id) return true;
      if (m.cageId) {
        if (harvestCages.has(m.cageId)) {
          const harvest = harvestsByBatch.find(h => h.cageId === m.cageId);
          return harvest && m.date <= harvest.date;
        }
        const cage = cageMap.get(m.cageId);
        return cage?.batchId === batch.id && m.date >= batch.settlementDate;
      }
      return false;
    });
    const mortality = mortalityLogs.reduce((acc, curr) => acc + curr.count, 0);

    // Optimized feeding filtering
    const feedingLogs = (state.feedingLogs || []).filter(f => {
      if (f.batchId === batch.id) return true;
      if (f.cageId) {
        const fDate = (f.timestamp || '').split('T')[0];
        if (harvestCages.has(f.cageId)) {
          const harvest = harvestsByBatch.find(h => h.cageId === f.cageId);
          return harvest && fDate <= harvest.date;
        }
        const cage = cageMap.get(f.cageId);
        return cage?.batchId === batch.id && fDate >= batch.settlementDate;
      }
      return false;
    });
    
    const feeding = feedingLogs.reduce((acc, curr) => acc + curr.amount, 0);

    const feedingByType = feedingLogs.reduce((acc, curr) => {
      const feedType = state.feedTypes?.find(t => t.id === curr.feedTypeId);
      const typeName = feedType?.name || 'Não especificado';
      acc[typeName] = (acc[typeName] || 0) + curr.amount;
      return acc;
    }, {} as Record<string, number>);

    const harvestedFish = harvestsByBatch.reduce((acc, curr) => acc + curr.fishCount, 0);
    const harvestedWeight = harvestsByBatch.reduce((acc, curr) => acc + curr.totalWeight, 0);

    // Biomass before first harvest
    const firstHarvestDate = harvestsByBatch.length > 0 
      ? harvestsByBatch.reduce((min, h) => h.date < min ? h.date : min, harvestsByBatch[0].date)
      : null;

    let biomassBeforeHarvest = 0;
    let avgWeightBeforeHarvest = batch.initialUnitWeight;
    let expectedFish = batch.initialQuantity - mortality;

    // Optimized biometry filtering
    const batchBiometries = (state.biometryLogs || []).filter(b => {
      if (b.batchId === batch.id) return true;
      if (b.cageId) {
        if (harvestCages.has(b.cageId)) return true;
        const cage = cageMap.get(b.cageId);
        return cage?.batchId === batch.id;
      }
      return false;
    });

    if (firstHarvestDate) {
      const mortalityBeforeHarvest = mortalityLogs
        .filter(m => m.date < firstHarvestDate)
        .reduce((acc, curr) => acc + curr.count, 0);
      
      const liveFishBeforeHarvest = batch.initialQuantity - mortalityBeforeHarvest;
      expectedFish = liveFishBeforeHarvest;
      
      const biometriesBeforeHarvest = batchBiometries.filter(b => b.date <= firstHarvestDate);

      if (biometriesBeforeHarvest.length > 0) {
        const harvestDayLogs = biometriesBeforeHarvest.filter(log => log.date === firstHarvestDate);
        if (harvestDayLogs.length > 0) {
          avgWeightBeforeHarvest = harvestDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) / harvestDayLogs.length;
        } else {
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
    
    const slaughteredWeight = slaughters.reduce((acc, curr) => acc + (curr.netWeight || 0), 0);
    const slaughteredCount = slaughters.reduce((acc, curr) => acc + (curr.fishCount || 0), 0);

    const expenses = (state.batchExpenses || [])
      .filter(e => e.batchId === batch.id);
    
    const revenues = (state.batchRevenues || [])
      .filter(r => r.batchId === batch.id);
    
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.value, 0);
    const totalRevenue = revenues.length > 0 
      ? revenues.reduce((acc, curr) => acc + (curr.receptionWeight * curr.unitPrice), 0)
      : harvestsByBatch.reduce((acc, curr) => acc + (curr.totalWeight * (curr.unitPrice || 0)), 0);
    
    const totalReceptionWeight = revenues.reduce((acc, curr) => acc + curr.receptionWeight, 0);
    const totalProfit = totalRevenue - totalExpenses;

    const categories = Array.from(new Set((state.batchExpenses || []).map(e => e.category))).sort();
    const items = Array.from(new Set((state.batchExpenses || []).map(e => e.description))).sort();

    const allEntries = [
      ...expenses.map(e => ({ ...e, type: 'expense' as const })),
      ...revenues.map(r => ({ 
        id: r.id, 
        batchId: r.batchId, 
        description: `Peso Recepção Frigorífico: ${formatNumber(r.receptionWeight, 1)}kg`,
        category: 'Receita',
        value: 0,
        date: r.date,
        userId: r.userId,
        type: 'revenue' as const
      }))
    ];

    const filteredEntries = allEntries.filter(e => {
      const matchCategory = !filterCategory || e.category === filterCategory;
      const matchItem = !filterItem || e.description.toLowerCase().includes(filterItem.toLowerCase());
      return matchCategory && matchItem;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const protocol = (state.protocols || []).find(p => p.id === batch.protocolId);
    
    // Calculate total days
    const startDate = parseISO(batch.settlementDate);
    const endDate = harvestsByBatch.length > 0 
      ? parseISO(harvestsByBatch.reduce((max, h) => h.date > max ? h.date : max, batch.settlementDate))
      : new Date();
    const totalDays = isNaN(differenceInDays(endDate, startDate)) ? 0 : differenceInDays(endDate, startDate);

    // Survival Rate (Predicted): (Expected Fish / Initial)
    const survivalRate = batch.initialQuantity > 0 
      ? (expectedFish / batch.initialQuantity) * 100 
      : 0;

    // Biomass Before Harvest: (Avg Weight * Expected Fish) / 1000
    const expectedWeight = expectedFish * (avgWeightBeforeHarvest / 1000);
    biomassBeforeHarvest = expectedWeight;

    // FCA Previsto: Total Feed / Predicted Biomass
    const fcaTheoretical = expectedWeight > 0 ? (feeding / 1000) / expectedWeight : 0;

    // FCA Real: Total Feed / Frigorific Reception Weight (fallback to Harvested Weight)
    const fcaReal = totalReceptionWeight > 0 
      ? (feeding / 1000) / totalReceptionWeight 
      : (harvestedWeight > 0 ? (feeding / 1000) / harvestedWeight : 0);

    // GPD: (Final Avg Weight - Initial Weight) / Total Days
    const finalAvgWeight = harvestedFish > 0 ? (harvestedWeight / harvestedFish) * 1000 : currentAvgWeight;
    const gpd = totalDays > 0 ? (finalAvgWeight - batch.initialUnitWeight) / totalDays : 0;

    // Cost per kg
    const divisor = totalReceptionWeight;
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
    const cageIds = Array.from(new Set(harvestsByBatch.map(h => h.cageId)));
    
    cageIds.forEach(cId => {
      const cage = cageMap.get(cId);
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
      gpd,
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
      filteredEntries,
      totalReceptionWeight
    };
  }, [selectedBatchId, state.batches, state.mortalityLogs, state.feedingLogs, state.harvestLogs, state.slaughterLogs, state.batchExpenses, state.batchRevenues, state.protocols, state.biometryLogs, state.cages, state.feedTypes, filterCategory, filterItem]);

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

  const handleAddRevenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || revenueForm.receptionWeight === '') return;

    const revenueData = {
      batchId: selectedBatchId,
      receptionWeight: Number(revenueForm.receptionWeight),
      unitPrice: 0,
      date: revenueForm.date,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    let updatedRevenues;
    if (editingRevenueId) {
      updatedRevenues = (state.batchRevenues || []).map(r => 
        r.id === editingRevenueId ? { ...r, ...revenueData } : r
      );
    } else {
      const newRevenue: BatchRevenue = {
        id: generateId(),
        ...revenueData
      };
      updatedRevenues = [...(state.batchRevenues || []), newRevenue];
    }

    onUpdate({
      ...state,
      batchRevenues: updatedRevenues
    });

    setRevenueForm({
      receptionWeight: '',
      unitPrice: '0',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingRevenueId(null);
  };

  const startEditExpense = (expense: any) => {
    if (expense.type === 'revenue') {
      const revenue = (state.batchRevenues || []).find(r => r.id === expense.id);
      if (!revenue) return;
      setFormType('revenue');
      setEditingRevenueId(revenue.id);
      setEditingExpenseId(null);
      setRevenueForm({
        receptionWeight: revenue.receptionWeight.toString(),
        unitPrice: '0',
        date: revenue.date
      });
      return;
    }
    setEditingExpenseId(expense.id);
    setEditingRevenueId(null);
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
    setEditingRevenueId(null);
    setExpenseForm({
      category: '',
      item: '',
      date: new Date().toISOString().split('T')[0],
      amount: ''
    });
    setRevenueForm({
      receptionWeight: '',
      unitPrice: '0',
      date: new Date().toISOString().split('T')[0]
    });
    setIsAddingCategory(false);
    setIsAddingItem(false);
  };

  const removeExpense = (id: string, type: 'expense' | 'revenue' = 'expense') => {
    if (!confirm(`Excluir este ${type === 'expense' ? 'gasto' : 'lançamento de receita'}?`)) return;
    
    if (type === 'expense') {
      onUpdate({
        ...state,
        batchExpenses: (state.batchExpenses || []).filter(e => e.id !== id),
        deletedIds: [...(state.deletedIds || []), id]
      });
    } else {
      onUpdate({
        ...state,
        batchRevenues: (state.batchRevenues || []).filter(r => r.id !== id),
        deletedIds: [...(state.deletedIds || []), id]
      });
    }
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
    <div id="batch-closing-report" className="space-y-8 animate-in fade-in duration-500 print:p-0 print:m-0 print:w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 ${printOrientation};
            margin: 5mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
            height: auto !important;
            font-size: ${printOrientation === 'landscape' ? '12pt' : '11pt'} !important;
          }
          
          .print-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 0.5rem !important;
            width: 100% !important;
          }
          .print-grid-3 {
            display: grid !important;
            grid-template-columns: ${printOrientation === 'landscape' ? 'repeat(3, 1fr)' : 'repeat(1, 1fr)'} !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: ${printOrientation === 'landscape' ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)'} !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          
          /* Landscape specific overrides */
          ${printOrientation === 'landscape' ? `
            .print-card {
              padding: 2rem !important;
              margin-bottom: 1.5rem !important;
              width: 100% !important;
            }
            .print-header {
              margin-bottom: 2rem !important;
            }
            .print-text-2xl { font-size: 2.2rem !important; }
            .print-text-xl { font-size: 1.8rem !important; }
            .print-text-lg { font-size: 1.4rem !important; }
            .print-text-base { font-size: 1.2rem !important; }
            .print-text-sm { font-size: 1rem !important; }
            .print-text-xs { font-size: 0.85rem !important; }
            
            /* Force full width for specific sections in landscape */
            .print-full-width {
              grid-column: span 1 / span 1 !important;
              width: 100% !important;
            }
          ` : ''}

          .print-card {
            border: 1px solid #e2e8f0 !important;
            border-radius: 1rem !important;
            box-shadow: none !important;
            margin-bottom: 1rem !important;
            padding: 1.25rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: white !important;
          }
          .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-bg-slate { background-color: #f8fafc !important; }
          .print-bg-blue { background-color: #eff6ff !important; }
          .print-bg-emerald { background-color: #ecfdf5 !important; }
          .print-text-blue { color: #2563eb !important; }
          .print-text-emerald { color: #059669 !important; }
          .print-text-red { color: #dc2626 !important; }
          
          /* Force visibility of print header */
          .print-header {
            display: block !important;
            visibility: visible !important;
          }
          
          /* Ensure tables expand */
          table { width: 100% !important; }
          
          /* Fix distortions */
          .print-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tighter italic flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Fechamento de Lote
          </h2>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Resumo financeiro e produtivo do lote finalizado</p>
        </div>

        <div className="flex items-center gap-3">
          {batchData?.batch.isClosed && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Impressão:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${printOrientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Orientação Retrato"
                  >
                    Vertical
                  </button>
                  <button
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${printOrientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Orientação Paisagem"
                  >
                    Horizontal
                  </button>
                </div>
              </div>
              
              <button 
                onClick={handlePrint}
                className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs outline-none hover:bg-slate-50 uppercase tracking-widest shadow-sm flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
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
          <div className="hidden print:block print-header border-b-4 border-slate-900 pb-8 mb-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter text-black leading-none">AquaGestão</h1>
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest mt-1">Relatório de Fechamento de Lote</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data de Emissão</span>
                <p className="text-lg font-black text-slate-900">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-4 gap-4 print-grid-4">
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Identificação do Lote</span>
                <span className="text-2xl font-black text-slate-900 uppercase italic leading-tight">{batchData.batch.name}</span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data Povoamento</span>
                <span className="text-xl font-black text-slate-900">{safeDateFormat(batchData.batch.settlementDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Período de Cultivo</span>
                <span className="text-xl font-black text-slate-900">
                  {differenceInDays(new Date(), parseISO(batchData.batch.settlementDate))} dias
                </span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Status Final</span>
                <span className={`text-xl font-black uppercase italic ${batchData.batch.isClosed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {batchData.batch.isClosed ? 'CONCLUÍDO' : 'EM ABERTO'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 print-grid-3 gap-8 print-container">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                {/* Produção Summary */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic print-text-lg">
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
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Peso Médio Inicial</span>
                      <span className="text-xl font-black text-slate-700 italic print-text-xl">{formatNumber(batchData.batch.initialUnitWeight, 1)}g</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Estoque Vivo Atual</span>
                      <span className="text-xl font-black text-slate-800 italic print-text-xl">{formatNumber(batchData.liveFish)} un</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Mortalidade Atual</span>
                      <span className="text-xl font-black text-red-600 italic print-text-xl">{formatNumber(batchData.mortality)} un</span>
                    </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Biomassa Atual</span>
                    <span className="text-xl font-black text-blue-600 italic print-text-xl">{formatNumber(batchData.currentBiomassKg, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Ração Consumida Total</span>
                    <span className="text-xl font-black text-amber-600 italic print-text-xl">{formatNumber(batchData.feeding / 1000, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">FCA Previsto</span>
                    <span className="text-xl font-black text-indigo-600 italic print-text-xl">{formatNumber(batchData.fcaTheoretical, 2)}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block print-text-xs">Biomassa Pré-Despesca</span>
                    <span className="text-xl font-black text-emerald-600 italic print-text-xl">{formatNumber(batchData.biomassBeforeHarvest, 1)}kg</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Consumo Estratificado por Modelo</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(batchData.feedingByType).map(([type, amount]) => (
                      <div key={type} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-600 uppercase block truncate" title={type}>{type}</span>
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
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Biomassa Inicial</span>
                    <span className="text-sm font-black text-slate-600 uppercase">{formatNumber((batchData.batch.initialQuantity * batchData.batch.initialUnitWeight) / 1000, 1)}kg</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Qtd Inicial</span>
                    <span className="text-sm font-black text-slate-600 uppercase">{formatNumber(batchData.batch.initialQuantity)} un</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Sobrevivência Prevista</span>
                    <span className="text-sm font-black text-emerald-500 uppercase">{formatNumber(batchData.survivalRate, 1)}%</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Dias Totais</span>
                    <span className="text-sm font-black text-blue-600 uppercase">{batchData.totalDays} dias</span>
                  </div>
                </div>
              </div>

              {/* Slaughter Comparison */}
              <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 print-card print-bg-slate print-text-blue print-no-break">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 italic print-text-lg">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 print-text-blue" />
                  DADOS DESPESCA VS REAL
                </h3>

                <div className="space-y-6">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 print:border-slate-200 print:bg-white print:text-slate-900">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest print:text-slate-500 print-text-xs">Taxa de Assertividade do Lote</span>
                      <span className="text-lg font-black text-indigo-400 italic print:text-blue-600 print-text-xl">{formatNumber(batchData.accuracy, 1)}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden print:bg-slate-100">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-1000 print:bg-blue-600" 
                        style={{ width: `${Math.min(100, batchData.accuracy)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 print-grid-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Sobrevivência Prevista</span>
                      <span className="text-lg font-black italic text-emerald-400 print:text-emerald-600 print-text-xl">{formatNumber(batchData.survivalRate, 1)}%</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Sobrevivência Real</span>
                      <span className="text-lg font-black italic text-blue-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.survivalRateReal, 1)}%</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">FCA Previsto</span>
                      <span className="text-lg font-black italic text-indigo-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.fcaTheoretical, 2)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">FCA Real</span>
                      <span className="text-lg font-black italic text-amber-400 print:text-amber-600 print-text-xl">{formatNumber(batchData.fcaReal, 2)}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Peixes Despescados</span>
                      <span className="text-lg font-black italic text-cyan-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.harvestedFish)} un</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Peso Total Deck</span>
                      <span className="text-lg font-black italic text-cyan-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.harvestedWeight, 1)}kg</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Peixes Previstos</span>
                      <span className="text-lg font-black italic text-blue-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.expectedFish)} un</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500 print-text-xs">Peso Previsto</span>
                      <span className="text-lg font-black italic text-blue-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.expectedWeight, 1)}kg</span>
                    </div>

                    <div className="col-span-2 pt-4 border-t border-white/10 print:border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest print:text-slate-500 print-text-xs">GPD (Crescimento Diário)</span>
                      <span className="text-lg font-black italic text-cyan-400 print:text-blue-600 print-text-xl">{formatNumber(batchData.gpd, 2)}g/dia</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar (Right Column) */}
          <div className="space-y-8">
              {/* Cost Analysis Card */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic print-text-lg">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Análise de Custos
                </h3>

                <div className="grid space-y-4 print-grid-3">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 print:bg-slate-50">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1 print-text-xs">Peso Recepção Frigorífico (kg)</span>
                    <span className="text-2xl font-black text-slate-800 italic print-text-xl">{formatNumber(batchData.totalReceptionWeight, 1)} kg</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 print:bg-slate-50">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1 print-text-xs">Custo Total Acumulado</span>
                    <span className="text-2xl font-black text-slate-800 italic print-text-xl">{formatCurrency(batchData.totalExpenses)}</span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 print:bg-emerald-50">
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1 print-text-xs">Custo por KG</span>
                    <span className="text-2xl font-black text-emerald-700 italic print-text-xl">{formatCurrency(batchData.costPerKg)}</span>
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
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Lote Encerrado</p>
                    <p className="text-[9px] font-bold text-slate-600 uppercase mt-1">Nenhuma alteração permitida</p>
                  </div>
                )}
              </div>

              {/* Add Entry Form */}
              {!batchData.batch.isClosed && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 print:hidden">
                  <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
                    <button 
                      onClick={() => setFormType('expense')}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formType === 'expense' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      Despesa
                    </button>
                    <button 
                      onClick={() => setFormType('revenue')}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formType === 'revenue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      Receita
                    </button>
                  </div>

                  <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic mb-6">
                    {formType === 'expense' ? (
                      <>
                        <Plus className="w-4 h-4 text-blue-600" />
                        {editingExpenseId ? 'Editar Despesa' : 'Lançar Despesa'}
                      </>
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Lançar Receita
                      </>
                    )}
                  </h3>
                  
                  {formType === 'expense' ? (
                    <form onSubmit={handleAddExpense} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Categoria</label>
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
                              className="px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase"
                            >
                              Voltar
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Item (Lançamento)</label>
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
                              className="px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase"
                            >
                              Voltar
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Data</label>
                          <input 
                            type="date" 
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                            value={expenseForm.date}
                            onChange={e => setExpenseForm({...expenseForm, date: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Valor (R$)</label>
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
                  ) : (
                    <form onSubmit={handleAddRevenue} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Data</label>
                        <input 
                          type="date" 
                          required
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                          value={revenueForm.date}
                          onChange={e => setRevenueForm({...revenueForm, date: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 tracking-widest ml-1">Peso Recepção Frigorífico (kg)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          placeholder="0,00"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                          value={revenueForm.receptionWeight}
                          onChange={e => setRevenueForm({...revenueForm, receptionWeight: e.target.value})}
                        />
                      </div>
                      <div className="flex gap-3">
                        {editingRevenueId && (
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
                          className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingRevenueId ? 'Salvar Alterações' : 'Confirmar Receita'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 print-card print-no-break">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Quadro de Lançamentos
                </h3>
                
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase">Filtrar:</span>
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
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest print-text-sm">Data</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest print-text-sm">Categoria</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest print-text-sm">Lançamento (Item)</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest print-text-sm">Usuário</th>
                      <th className="text-right py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest print-text-sm">Valor</th>
                      <th className="w-20 print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batchData.filteredEntries.map(entry => {
                      const user = state.users.find(u => u.id === entry.userId);
                      const isRevenue = entry.type === 'revenue';
                      return (
                        <tr key={entry.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 text-xs font-bold text-slate-600 print-text-sm">{safeDateFormat(entry.date, 'dd/MM/yyyy')}</td>
                          <td className="py-4 text-xs font-black text-slate-600 uppercase italic print-text-sm">{entry.category}</td>
                          <td className="py-4 text-xs font-black text-slate-800 uppercase italic print-text-sm">{entry.description}</td>
                          <td className="py-4 text-xs font-bold text-slate-600 italic print-text-sm">{user?.name || '---'}</td>
                          <td className={`py-4 text-right text-xs font-black ${isRevenue ? 'text-blue-600' : 'text-emerald-600'} print-text-sm`}>
                            {isRevenue ? '+' : ''}{formatCurrency(entry.value)}
                          </td>
                          <td className="py-4 text-right print:hidden">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={() => startEditExpense(entry)}
                                className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => removeExpense(entry.id, entry.type)}
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
                    {batchData.filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nenhum lançamento encontrado.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Detailed Logs Section (Only visible after closing or for audit) */}
          {batchData.batch.isClosed && (
            <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700 print-container">
              <div className="flex items-center gap-3 px-4">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-black uppercase tracking-tighter italic">Detalhamento por Gaiola</h3>
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Histórico completo de manejos do lote</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {Array.from(batchData.logsByCage.entries()).map(([cageId, logs]) => (
                  <div key={cageId} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden print-card print-no-break">
                    <div className="bg-slate-100 px-8 py-6 border-b border-slate-100 flex items-center justify-between print:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Fish className="w-5 h-5 text-blue-600" />
                        <h4 className="text-lg font-black text-black uppercase italic print-text-xl">{logs.cageName}</h4>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-600 uppercase block print-text-xs">Tratos</span>
                          <span className="text-xs font-black text-slate-700 print-text-sm">{logs.feeding.length}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-black text-slate-600 uppercase block print-text-xs">Mortes</span>
                          <span className="text-xs font-black text-red-600 print-text-sm">{logs.mortality.reduce((acc, m) => acc + m.count, 0)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 print-grid-3">
                      {/* Feeding Logs */}
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          <Utensils className="w-3 h-3" />
                          Histórico de Trato
                        </h5>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide print:max-h-none">
                          {logs.feeding.map((f, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 print:bg-slate-50">
                              <span className="text-[10px] font-bold text-slate-600">{safeDateFormat(f.timestamp, 'dd/MM')}</span>
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
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide print:max-h-none">
                          {logs.mortality.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100 print:bg-red-50">
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
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide print:max-h-none">
                          {logs.biometry.map((b, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 print:bg-emerald-50">
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
          {/* Print Footer */}
          <div className="hidden print:block mt-12 pt-8 border-t border-slate-200">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AquaGestão - Sistema de Gerenciamento Aquícola</p>
                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Este documento é um relatório gerencial gerado automaticamente.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Página 1 de 1</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center text-center space-y-4">
          <div className="p-6 bg-slate-50 rounded-full">
            <FileText className="w-12 h-12 text-slate-200" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-600 uppercase tracking-widest italic">Nenhum Lote Selecionado</h3>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-2">Selecione um lote acima para visualizar o fechamento</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchClosing;
