
import React, { useState, useMemo } from 'react';
import { AppState, User, HarvestLog } from '../types';
import { Tag, Box, Scale, Calendar, Trash2, Plus, Info, CheckCircle2, AlertCircle, TrendingUp, Edit3, X, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';

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

const HarvestManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedCageId, setSelectedCageId] = useState('');
  const [totalWeight, setTotalWeight] = useState('');
  const [averageWeight, setAverageWeight] = useState('');
  const [fishCount, setFishCount] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const batches = useMemo(() => [...(state.batches || [])].sort((a, b) => a.name.localeCompare(b.name)), [state.batches]);
  
  const selectedBatch = useMemo(() => 
    batches.find(b => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  const cagesInBatch = useMemo(() => 
    state.cages.filter(c => c.batchId === selectedBatchId || c.id === selectedCageId),
    [state.cages, selectedBatchId, selectedCageId]
  );

  const selectedCage = useMemo(() => 
    state.cages.find(c => c.id === selectedCageId),
    [state.cages, selectedCageId]
  );

  // Pre-fill fish count when cage is selected (only for new harvests)
  React.useEffect(() => {
    if (selectedCage && !editingId) {
      // Calculate current fish count in cage (initial - mortality)
      const cageMortality = (state.mortalityLogs || [])
        .filter(m => m.cageId === selectedCage.id)
        .reduce((acc, curr) => acc + curr.count, 0);
      
      const currentCount = (selectedCage.initialFishCount || 0) - cageMortality;
      setFishCount(currentCount.toString());
    } else if (!selectedCage && !editingId) {
      setFishCount('');
    }
  }, [selectedCage, state.mortalityLogs, editingId]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!selectedBatchId || !selectedCageId || !totalWeight || !fishCount) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (editingId) {
      const updatedLogs = (state.harvestLogs || []).map(l => 
        l.id === editingId ? {
          ...l,
          batchId: selectedBatchId,
          cageId: selectedCageId,
          fishCount: Number(fishCount),
          totalWeight: Number(totalWeight),
          averageWeight: averageWeight ? Number(averageWeight) : undefined,
          unitPrice: unitPrice ? Number(unitPrice) : undefined,
          date,
          updatedAt: Date.now()
        } : l
      );

      onUpdate({
        ...state,
        harvestLogs: updatedLogs
      });
      setEditingId(null);
    } else {
      const newLog: HarvestLog = {
        id: generateId(),
        batchId: selectedBatchId,
        cageId: selectedCageId,
        fishCount: Number(fishCount),
        totalWeight: Number(totalWeight),
        averageWeight: averageWeight ? Number(averageWeight) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
        initialFishCount: selectedCage?.initialFishCount,
        date,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
        updatedAt: Date.now()
      };

      // Update state: add harvest log and clear cage
      const updatedCages = state.cages.map(c => 
        c.id === selectedCageId ? { 
          ...c, 
          batchId: undefined, 
          initialFishCount: undefined, 
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Limpeza' as const,
          maintenanceStartDate: undefined,
          maintenanceEndDate: undefined,
          updatedAt: Date.now()
        } : c
      );

      const updatedHarvestLogs = [newLog, ...(state.harvestLogs || [])];

      onUpdate({
        ...state,
        cages: updatedCages,
        harvestLogs: updatedHarvestLogs
      });
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    
    // Reset form
    if (editingId) {
      resetForm();
    } else {
      // Check if there are more cages in the batch
      const remainingCages = state.cages.filter(c => c.batchId === selectedBatchId && c.id !== selectedCageId);
      if (remainingCages.length === 0) {
        resetForm();
      } else {
        // Only clear cage-specific fields, keep batch selected
        setEditingId(null);
        setSelectedCageId('');
        setTotalWeight('');
        setAverageWeight('');
        setFishCount('');
        setUnitPrice('');
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedBatchId('');
    setSelectedCageId('');
    setTotalWeight('');
    setAverageWeight('');
    setFishCount('');
    setUnitPrice('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const startEdit = (log: HarvestLog) => {
    setEditingId(log.id);
    setSelectedBatchId(log.batchId);
    setSelectedCageId(log.cageId);
    setTotalWeight(log.totalWeight.toString());
    setAverageWeight(log.averageWeight?.toString() || '');
    setFishCount(log.fishCount.toString());
    setUnitPrice(log.unitPrice?.toString() || '');
    setDate(log.date);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auto-calculate logic
  const handleWeightChange = (val: string) => {
    setTotalWeight(val);
    if (val && averageWeight && Number(averageWeight) > 0) {
      const count = Math.round((Number(val) * 1000) / Number(averageWeight));
      const currentFishCount = Number(fishCount);
      // Only update if the difference is significant to avoid jitter
      if (Math.abs(count - currentFishCount) > 0) {
        setFishCount(count.toString());
      }
    }
  };

  const handleAverageWeightChange = (val: string) => {
    setAverageWeight(val);
    if (val && totalWeight && Number(totalWeight) > 0 && Number(val) > 0) {
      const count = Math.round((Number(totalWeight) * 1000) / Number(val));
      setFishCount(count.toString());
    }
  };

  const handleFishCountChange = (val: string) => {
    setFishCount(val);
    if (val && totalWeight && Number(totalWeight) > 0 && Number(val) > 0) {
      const aw = (Number(totalWeight) * 1000) / Number(val);
      setAverageWeight(aw.toFixed(1));
    }
  };

  const finalizedBatches = useMemo(() => {
    return batches.filter(batch => {
      if (batch.isClosed) return false;
      
      const batchCages = state.cages.filter(c => c.batchId === batch.id);
      const harvestedFish = (state.harvestLogs || [])
        .filter(h => h.batchId === batch.id)
        .reduce((acc, curr) => acc + curr.fishCount, 0);
        
      return harvestedFish > 0 && batchCages.length === 0;
    }).map(batch => {
      const mortality = (state.mortalityLogs || [])
        .filter(m => m.batchId === batch.id)
        .reduce((acc, curr) => acc + curr.count, 0);

      const harvested = (state.harvestLogs || [])
        .filter(h => h.batchId === batch.id)
        .reduce((acc, curr) => acc + curr.fishCount, 0);

      const expected = batch.initialQuantity - mortality;
      const accuracy = expected > 0 ? (harvested / expected) * 100 : 0;

      // Find cages that were in this batch and are currently in 'Limpeza' or 'Manutenção'
      const batchCageIds = new Set((state.harvestLogs || [])
        .filter(h => h.batchId === batch.id)
        .map(h => h.cageId));
      
      const cagesToRelease = state.cages.filter(c => 
        batchCageIds.has(c.id) && 
        (c.status === 'Limpeza' || c.status === 'Manutenção') &&
        !c.batchId
      );

      return {
        ...batch,
        mortality,
        harvested,
        expected,
        accuracy,
        cagesToRelease
      };
    });
  }, [batches, state.harvestLogs, state.cages, state.mortalityLogs]);

  const handleReleaseCages = (batchId: string) => {
    if (!hasPermission) return;
    
    const batchData = finalizedBatches.find(b => b.id === batchId);
    if (!batchData || batchData.cagesToRelease.length === 0) return;

    const cageIdsToRelease = new Set(batchData.cagesToRelease.map(c => c.id));
    
    const updatedCages = state.cages.map(c => 
      cageIdsToRelease.has(c.id) ? {
        ...c,
        status: 'Disponível' as const,
        batchId: undefined,
        initialFishCount: undefined,
        settlementDate: undefined,
        harvestDate: undefined,
        maintenanceStartDate: undefined,
        maintenanceEndDate: undefined,
        updatedAt: Date.now()
      } : c
    );

    onUpdate({
      ...state,
      cages: updatedCages
    });
  };

  const removeLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de despesca? Atenção: isso não reverterá o status da gaiola automaticamente.')) return;
    
    onUpdate({
      ...state,
      harvestLogs: (state.harvestLogs || []).filter(l => l.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
    
    if (selectedLogIds.has(id)) {
      const newSelected = new Set(selectedLogIds);
      newSelected.delete(id);
      setSelectedLogIds(newSelected);
    }
  };

  const toggleSelectLog = (id: string) => {
    const newSelected = new Set(selectedLogIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLogIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLogIds.size === harvestLogs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(harvestLogs.map(l => l.id)));
    }
  };

  const removeSelectedLogs = () => {
    if (!hasPermission || selectedLogIds.size === 0) return;
    if (!confirm(`Deseja excluir os ${selectedLogIds.size} registros de despesca selecionados?`)) return;

    onUpdate({
      ...state,
      harvestLogs: (state.harvestLogs || []).filter(l => !selectedLogIds.has(l.id)),
      deletedIds: [...(state.deletedIds || []), ...Array.from(selectedLogIds)]
    });
    setSelectedLogIds(new Set());
  };

  const harvestLogs = useMemo(() => {
    const logs = [...(state.harvestLogs || [])];
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.harvestLogs]);

  return (
    <div className="space-y-8 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 lg:sticky lg:top-8">
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter italic">
              {editingId ? <Edit3 className="w-6 h-6 text-amber-500" /> : <Scale className="w-6 h-6 text-blue-600" />}
              {editingId ? 'Editar Despesca' : 'Nova Despesca'}
            </h3>
            {editingId && (
              <button 
                onClick={resetForm}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Lote *</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <select 
                  required
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                  value={selectedBatchId}
                  onChange={e => {
                    setSelectedBatchId(e.target.value);
                    setSelectedCageId('');
                  }}
                >
                  <option value="">Selecionar Lote</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Gaiola *</label>
              <div className="relative">
                <Box className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <select 
                  required
                  disabled={!selectedBatchId}
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 text-sm"
                  value={selectedCageId}
                  onChange={e => setSelectedCageId(e.target.value)}
                >
                  <option value="">Selecionar Gaiola</option>
                  {cagesInBatch.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Peso Médio (g) *</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                  value={averageWeight}
                  onChange={e => handleAverageWeightChange(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Peso Total Gaiola (kg) *</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                  value={totalWeight}
                  onChange={e => handleWeightChange(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Qtd Peixes *</label>
              <input 
                type="number" 
                required
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                value={fishCount}
                onChange={e => handleFishCountChange(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Preço por kg (R$)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="0.00"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Data</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="date" 
                  required
                  className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-sm"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20 hover:bg-amber-700' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}
            >
              {editingId ? 'Salvar Alterações' : 'Confirmar Despesca'}
            </button>
          </form>

          {saveSuccess && (
            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Sucesso!</span>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {finalizedBatches.length > 0 && (
          <div className="bg-indigo-900 p-8 rounded-[2.5rem] shadow-xl text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <CheckCircle2 className="w-32 h-32" />
            </div>
            <h3 className="text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
              <TrendingUp className="w-6 h-6 text-indigo-400" />
              Lotes Encerrados - Liberação de Gaiolas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {finalizedBatches.map(fb => (
                <div key={fb.id} className="bg-white/10 backdrop-blur-md p-5 rounded-3xl border border-white/10">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">Lote</span>
                      <h4 className="text-lg font-black uppercase italic">{fb.name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest block mb-1">Sobrevivência</span>
                      <span className={`text-2xl font-black ${fb.accuracy >= 98 ? 'text-emerald-400' : fb.accuracy >= 95 ? 'text-blue-400' : 'text-amber-400'}`}>
                        {fb.accuracy.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                    <div>
                      <span className="text-[8px] font-black text-indigo-300 uppercase block">Povoado</span>
                      <span className="text-xs font-bold">{fb.initialQuantity}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-black text-indigo-300 uppercase block">Despesca</span>
                      <span className="text-xs font-bold text-emerald-400">{fb.harvested}</span>
                    </div>
                  </div>
                  
                  {fb.cagesToRelease.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Gaiolas em Limpeza/Manutenção</span>
                        <span className="text-[10px] font-black text-white bg-indigo-500 px-2 py-0.5 rounded-full">{fb.cagesToRelease.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {fb.cagesToRelease.map(c => (
                          <span key={c.id} className="px-2 py-1 bg-white/5 text-[9px] font-black text-indigo-200 rounded-lg uppercase border border-white/10">
                            {c.name}
                          </span>
                        ))}
                      </div>
                      <button 
                        onClick={() => handleReleaseCages(fb.id)}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Liberar Gaiolas para Novos Povoamentos
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">Histórico de Despescas</h3>
              {selectedLogIds.size > 0 && (
                <button 
                  onClick={removeSelectedLogs}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Selecionados ({selectedLogIds.size})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <Info className="w-4 h-4" />
              {harvestLogs.length} registros
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <button 
                      onClick={toggleSelectAll}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                    >
                      {selectedLogIds.size === harvestLogs.length && harvestLogs.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Lote / Gaiola</th>
                  <th className="px-6 py-4 text-right">Peso Médio</th>
                  <th className="px-6 py-4 text-right">Peso Total</th>
                  <th className="px-6 py-4 text-right">Preço/kg</th>
                  <th className="px-6 py-4 text-right">Qtd Peixes</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {harvestLogs.map(log => {
                  const batch = (state.batches || []).find(b => b.id === log.batchId);
                  const cage = (state.cages || []).find(c => c.id === log.cageId);
                  const isSelected = selectedLogIds.has(log.id);
                  
                  // Logic to calculate fish count based on total weight and unit weight
                  const calculatedFishCount = log.averageWeight && log.averageWeight > 0 
                    ? Math.round((log.totalWeight * 1000) / log.averageWeight) 
                    : log.fishCount;

                  return (
                    <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleSelectLog(log.id)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-600">
                        {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-tighter italic">{batch?.name || 'Lote removido'}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{cage?.name || 'Gaiola removida'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-indigo-600">
                        {log.averageWeight ? `${log.averageWeight.toLocaleString()} g` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-emerald-600">
                        {log.totalWeight?.toLocaleString()} kg
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-amber-600">
                        {log.unitPrice ? `R$ ${log.unitPrice.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-black text-blue-600">
                        {calculatedFishCount?.toLocaleString()} un
                      </td>
                      <td className="px-6 py-4 text-center">
                        {hasPermission && (
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => startEdit(log)}
                              className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                              title="Editar"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => removeLog(log.id)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {harvestLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <AlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma despesca registrada.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default HarvestManagement;
