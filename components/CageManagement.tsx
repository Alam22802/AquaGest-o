
import React, { useState, useMemo } from 'react';
import { Cage, AppState, User } from '../types';
import { Trash2, Box, Edit, X, Ruler, Users, Tag, Calendar, LayoutDashboard, Info, Layers, Eye, Filter, CheckSquare, Square, Save, LogOut } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CageManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterBatchId, setFilterBatchId] = useState<string>('all');
  const [selectedCages, setSelectedCages] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkData, setBulkData] = useState({
    settlementDate: '',
    harvestDate: '',
    lineId: '',
    initialFishCount: ''
  });
  const [formData, setFormData] = useState({
    cageId: '',
    lineId: '',
    batchId: '',
    initialFishCount: '',
    settlementDate: new Date().toISOString().split('T')[0],
    harvestDate: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const availableCages = useMemo(() => {
    return (state.cages || []).filter(c => (c.status === 'Disponível' && !c.batchId) || (editingId && c.id === editingId));
  }, [state.cages, editingId]);

  const selectedCageDef = useMemo(() => {
    return (state.cages || []).find(c => c.id === formData.cageId);
  }, [state.cages, formData.cageId]);

  const selectedBatch = (state.batches || []).find(b => b.id === formData.batchId);
  
  // Calculate fish used by other cages in this batch (excluding the current cage being settled or edited)
  const otherCagesInBatch = (state.cages || [])
    .filter(c => c.batchId === formData.batchId && c.id !== (editingId || formData.cageId));
    
  const batchUsedFishByOthers = otherCagesInBatch.reduce((a, b) => a + (b.initialFishCount || 0), 0);
  
  let settledAndHarvestedOther = 0;
  (state.harvestLogs || []).forEach(h => {
    if (h.batchId === formData.batchId && h.cageId !== (editingId || formData.cageId)) {
      settledAndHarvestedOther += (h.initialFishCount || 0);
    }
  });

  let nurseryMortality = 0;
  (state.mortalityLogs || []).forEach(m => {
    if (m.batchId === formData.batchId && !m.cageId) {
      nurseryMortality += m.count;
    }
  });
    
  const maxAvailableForThisCage = selectedBatch 
    ? Math.max(0, selectedBatch.initialQuantity - batchUsedFishByOthers - settledAndHarvestedOther - nurseryMortality)
    : 0;

  const isOverBatchBalance = Number(formData.initialFishCount) > maxAvailableForThisCage;
  
  const isOverCageCapacity = selectedCageDef && Number(formData.initialFishCount) > selectedCageDef.stockingCapacity;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId || !formData.batchId || !formData.initialFishCount || !formData.lineId) return;
    
    const count = Number(formData.initialFishCount);
    let updatedBatches = state.batches;

    if (count > maxAvailableForThisCage) {
      if (confirm(`A quantidade (${count.toLocaleString('pt-BR')}) excede o saldo disponível do lote (${maxAvailableForThisCage.toLocaleString('pt-BR')}). Deseja ajustar o saldo inicial do lote para acomodar esta gaiola?`)) {
        const newTotalForBatch = batchUsedFishByOthers + settledAndHarvestedOther + nurseryMortality + count;
        updatedBatches = (state.batches || []).map(b => b.id === formData.batchId ? { ...b, initialQuantity: newTotalForBatch, updatedAt: Date.now() } : b);
      } else {
        return;
      }
    }

    const updatedCages = (state.cages || []).map(c => {
      if (c.id === formData.cageId) {
        return {
          ...c,
          lineId: formData.lineId,
          batchId: formData.batchId,
          initialFishCount: count,
          settlementDate: formData.settlementDate,
          harvestDate: formData.harvestDate,
          status: 'Ocupada' as const,
          updatedAt: Date.now()
        };
      }
      if (editingId && c.id === editingId && c.id !== formData.cageId) {
        return {
          ...c,
          batchId: undefined,
          initialFishCount: undefined,
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Disponível' as const,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, batches: updatedBatches, cages: updatedCages });
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      cageId: '', lineId: '', batchId: '', initialFishCount: '',
      settlementDate: new Date().toISOString().split('T')[0], harvestDate: ''
    });
  };

  const startEdit = (cage: Cage) => {
    if (!hasPermission) return;
    setEditingId(cage.id);
    setFormData({
      cageId: cage.id,
      lineId: cage.lineId || '',
      batchId: cage.batchId || '',
      initialFishCount: (cage.initialFishCount || '').toString(),
      settlementDate: cage.settlementDate || format(new Date(), 'yyyy-MM-dd'),
      harvestDate: cage.harvestDate || ''
    });
  };

  const deleteCageCompletely = (id: string) => {
    if (!hasPermission) return;
    const cage = (state.cages || []).find(c => c.id === id);
    if (!cage) return;
    if (!confirm(`Deseja EXCLUIR DEFINITIVAMENTE a gaiola "${cage.name}"? Esta ação removerá a gaiola do inventário e de todo o sistema.`)) return;

    onUpdate({
      ...state,
      cages: (state.cages || []).filter(c => c.id !== id),
      deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
    });
  };

  const releaseCage = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja desocupar e desvincular esta gaiola do lote? Seu status será alterado para "Limpeza".')) return;
    onUpdate({
      ...state,
      cages: (state.cages || []).map(c => c.id === id ? {
        ...c,
        batchId: undefined,
        initialFishCount: undefined,
        settlementDate: undefined,
        harvestDate: undefined,
        status: 'Limpeza' as const,
        maintenanceStartDate: new Date().toISOString().split('T')[0],
        maintenanceEndDate: undefined,
        updatedAt: Date.now()
      } : c)
    });
  };

  const handleBulkRelease = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!confirm(`Deseja desocupar e desvincular as ${selectedCages.length} gaiolas selecionadas? O status delas será alterado para "Limpeza".`)) return;

    const updatedCages = (state.cages || []).map(c => {
      if (selectedCages.includes(c.id)) {
        return {
          ...c,
          batchId: undefined,
          initialFishCount: undefined,
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Limpeza' as const,
          maintenanceStartDate: new Date().toISOString().split('T')[0],
          maintenanceEndDate: undefined,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setSelectedCages([]);
  };

  const handleBulkDelete = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!confirm(`Deseja EXCLUIR DEFINITIVAMENTE as ${selectedCages.length} gaiolas selecionadas? Elas serão removidas do sistema.`)) return;

    onUpdate({
      ...state,
      cages: (state.cages || []).filter(c => !selectedCages.includes(c.id)),
      deletedIds: Array.from(new Set([...(state.deletedIds || []), ...selectedCages]))
    });
    setSelectedCages([]);
  };

  const occupiedCages = useMemo(() => {
    return (state.cages || []).filter(c => Boolean(c.batchId) || c.status === 'Ocupada');
  }, [state.cages]);

  const filteredCages = useMemo(() => {
    if (filterBatchId === 'all') return occupiedCages;
    return occupiedCages.filter(c => c.batchId === filterBatchId);
  }, [occupiedCages, filterBatchId]);

  const batchStratification = useMemo(() => {
    if (filterBatchId === 'all') return null;
    const batch = (state.batches || []).find(b => b.id === filterBatchId);
    if (!batch) return null;

    const cagesInBatch = occupiedCages.filter(c => c.batchId === filterBatchId);
    
    // Group by model
    const counts: { [key: string]: number } = {};
    cagesInBatch.forEach(c => {
      counts[c.model] = (counts[c.model] || 0) + 1;
    });
    
    const modelList = Object.entries(counts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);

    const totalCages = cagesInBatch.length;
    const totalFishInCages = cagesInBatch.reduce((sum, c) => sum + (c.initialFishCount || 0), 0);

    // Calculate batch settlement balance (Saldo Povoamento) exactly like BatchManagement
    const allCagesForBatch = (state.cages || []).filter(c => c.batchId === filterBatchId);
    const activeCagesInBatch = allCagesForBatch.filter(c => c.status === 'Ocupada' || c.batchId === filterBatchId);
    const usedFish = activeCagesInBatch.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
    
    let settledAndHarvested = 0;
    (state.harvestLogs || []).forEach(h => {
      if (h.batchId === filterBatchId) {
        settledAndHarvested += (h.initialFishCount || 0);
      }
    });

    let nurseryMortality = 0;
    (state.mortalityLogs || []).forEach(m => {
      if (m.batchId === filterBatchId && !m.cageId) {
        nurseryMortality += m.count;
      }
    });

    const settlementBalance = batch.isSettlementComplete 
      ? 0 
      : Math.max(0, batch.initialQuantity - usedFish - settledAndHarvested - nurseryMortality);

    return {
      batchName: batch.name,
      totalCages,
      totalFishInCages,
      settlementBalance,
      initialQuantity: batch.initialQuantity,
      models: modelList
    };
  }, [occupiedCages, filterBatchId, state.batches, state.cages, state.harvestLogs, state.mortalityLogs]);

  const toggleSelectCage = (id: string) => {
    setSelectedCages(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCages.length === filteredCages.length) {
      setSelectedCages([]);
    } else {
      setSelectedCages(filteredCages.map(c => c.id));
    }
  };

  const handleBulkUpdate = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!bulkData.settlementDate && !bulkData.harvestDate && !bulkData.lineId && !bulkData.initialFishCount) return;

    if (!confirm(`Deseja aplicar as alterações em ${selectedCages.length} gaiolas?`)) return;

    const updatedCages = (state.cages || []).map(c => {
      if (selectedCages.includes(c.id)) {
        return {
          ...c,
          settlementDate: bulkData.settlementDate || c.settlementDate,
          harvestDate: bulkData.harvestDate || c.harvestDate,
          lineId: bulkData.lineId || c.lineId,
          initialFishCount: bulkData.initialFishCount ? Number(bulkData.initialFishCount) : c.initialFishCount,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setShowBulkEdit(false);
    setSelectedCages([]);
    setBulkData({ settlementDate: '', harvestDate: '', lineId: '', initialFishCount: '' });
  };

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
              {editingId ? 'Editar Povoamento' : 'Novo Povoamento'}
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Selecionar Gaiola</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.cageId} onChange={(e) => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Escolha a gaiola...</option>
                {availableCages.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.dimensions ? `(${c.dimensions.length}x${c.dimensions.width}x${c.dimensions.depth}m - Cap: ${c.stockingCapacity.toLocaleString('pt-BR')})` : `(Cap: ${c.stockingCapacity.toLocaleString('pt-BR')})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Linha de Localização</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.lineId} onChange={(e) => setFormData({...formData, lineId: e.target.value})}>
                <option value="">Selecione a linha...</option>
                {(state.lines || []).map(line => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Vincular ao Lote</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.batchId} onChange={(e) => setFormData({...formData, batchId: e.target.value})}>
                <option value="">Selecione o lote...</option>
                {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => {
                  const otherCages = (state.cages || []).filter(c => c.batchId === b.id && c.id !== (editingId || formData.cageId));
                  const used = otherCages.reduce((x, y) => x + (y.initialFishCount || 0), 0);
                  let harvests = 0;
                  (state.harvestLogs || []).forEach(h => {
                    if (h.batchId === b.id && h.cageId !== (editingId || formData.cageId)) harvests += (h.initialFishCount || 0);
                  });
                  let mort = 0;
                  (state.mortalityLogs || []).forEach(m => {
                    if (m.batchId === b.id && !m.cageId) mort += m.count;
                  });
                  const rem = Math.max(0, b.initialQuantity - used - harvests - mort);
                  return <option key={b.id} value={b.id}>{b.name} (Saldo: {rem.toLocaleString('pt-BR')})</option>;
                })}
              </select>
            </div>

            {selectedCageDef && (
              <div className="col-span-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Ruler className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Volume / Medidas</div>
                    <div className="text-xs font-bold text-slate-700">
                      {(selectedCageDef.dimensions.length * selectedCageDef.dimensions.width * selectedCageDef.dimensions.depth).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m³ 
                      <span className="text-[10px] text-slate-400 ml-1">({selectedCageDef.dimensions.length}x{selectedCageDef.dimensions.width}x{selectedCageDef.dimensions.depth}m)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Capacidade / Densidade</div>
                    <div className="text-xs font-bold text-slate-700">
                      {selectedCageDef.stockingCapacity.toLocaleString('pt-BR')} un
                      {selectedCageDef.stockingDensity && <span className="text-[10px] text-slate-400 ml-1">({selectedCageDef.stockingDensity.toLocaleString('pt-BR')} p/m³)</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Quantidade de Peixes</label>
              <input type="number" required placeholder="Qtd alojada" className={`w-full px-4 py-3 bg-white border rounded-2xl outline-none font-bold ${isOverCageCapacity || isOverBatchBalance ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`} value={formData.initialFishCount} onChange={(e) => setFormData({...formData, initialFishCount: e.target.value})} />
              {isOverCageCapacity && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Atenção: Acima da capacidade!</p>}
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Previsão de Despesca</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.harvestDate} onChange={(e) => setFormData({...formData, harvestDate: e.target.value})} />
            </div>

            <button type="submit" disabled={isOverBatchBalance || !formData.cageId || !formData.lineId} className={`col-span-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${isOverBatchBalance || !formData.cageId || !formData.lineId ? 'bg-slate-300' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}>
              {editingId ? 'Salvar Alterações' : 'Confirmar Povoamento'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <Eye className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para povoar novos peixes ou editar povoamentos.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
            <Filter className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Filtrar por Lote</label>
            <select 
              className="w-full bg-transparent border-none outline-none font-black text-slate-800 text-sm p-0 cursor-pointer"
              value={filterBatchId}
              onChange={(e) => {
                setFilterBatchId(e.target.value);
                setSelectedCages([]);
              }}
            >
              <option value="all">Todos os Lotes Ativos</option>
              {(state.batches || [])
                .filter(b => !b.isClosed)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
          </div>
        </div>

        {hasPermission && filteredCages.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={toggleSelectAll}
              className="flex-1 md:flex-none px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {selectedCages.length === filteredCages.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectedCages.length === filteredCages.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
            {selectedCages.length > 0 && (
              <React.Fragment>
                <button 
                  onClick={() => setShowBulkEdit(true)}
                  className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Edit className="w-4 h-4" /> Edição em Massa ({selectedCages.length})
                </button>
                <button 
                  onClick={handleBulkRelease}
                  title="Desvincular gaiolas do lote mantendo-as no inventário"
                  className="flex-1 md:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <LogOut className="w-4 h-4" /> Desvincular ({selectedCages.length})
                </button>
                <button 
                  onClick={handleBulkDelete}
                  title="Excluir gaiolas definitivamente do sistema"
                  className="flex-1 md:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                >
                  <Trash2 className="w-4 h-4" /> Excluir ({selectedCages.length})
                </button>
              </React.Fragment>
            )}
          </div>
        )}
      </div>

      {showBulkEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Edição em Massa</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alterando {selectedCages.length} gaiolas selecionadas</p>
              </div>
              <button onClick={() => setShowBulkEdit(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data de Povoamento</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.settlementDate}
                    onChange={(e) => setBulkData({...bulkData, settlementDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Previsão de Despesca</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.harvestDate}
                    onChange={(e) => setBulkData({...bulkData, harvestDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Linha/Setor</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.lineId}
                    onChange={(e) => setBulkData({...bulkData, lineId: e.target.value})}
                  >
                    <option value="">Manter atual...</option>
                    {(state.lines || []).map(line => (
                      <option key={line.id} value={line.id}>{line.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade de Peixes (Saldo Inicial)</label>
                  <input 
                    type="number" 
                    placeholder="Manter atual..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.initialFishCount}
                    onChange={(e) => setBulkData({...bulkData, initialFishCount: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                  Campos deixados em branco não serão alterados. As mudanças serão aplicadas instantaneamente a todas as gaiolas marcadas.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowBulkEdit(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkUpdate}
                  className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Aplicar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchStratification && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100 shadow-sm flex flex-col md:flex-row justify-between items-stretch gap-6 animate-in fade-in duration-300">
          <div className="flex flex-col justify-center min-w-[280px]">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Resumo do Lote Selecionado</span>
            <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">
              {batchStratification.batchName}
            </h4>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider block">Saldo Povoamento (Disponível)</span>
                <span className={`text-base font-black ${batchStratification.settlementBalance > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                  {batchStratification.settlementBalance.toLocaleString('pt-BR')} un
                </span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Povoado (Lote)</span>
                <span className="text-base font-black text-slate-700">{batchStratification.initialQuantity.toLocaleString('pt-BR')} un</span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Gaiolas Ativas</span>
                <span className="text-base font-black text-slate-800">{batchStratification.totalCages}</span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Peixes em Gaiolas</span>
                <span className="text-base font-black text-indigo-700">{batchStratification.totalFishInCages.toLocaleString('pt-BR')} un</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <span className="text-xs font-black text-slate-700 uppercase tracking-widest block mb-2.5">Modelos de Gaiola no Lote</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {batchStratification.models.map(({ model, count }) => (
                <div key={model} className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-black text-slate-800 uppercase block tracking-wider">Modelo {model}</span>
                    <span className="text-base font-black text-indigo-700">{count} {count === 1 ? 'gaiola' : 'gaiolas'}</span>
                  </div>
                </div>
              ))}
              {batchStratification.models.length === 0 && (
                <div className="col-span-full py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 rounded-2xl">
                  Nenhuma gaiola povoada neste lote.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCages.map(cage => {
          const isSelected = selectedCages.includes(cage.id);
          const batch = (state.batches || []).find(b => b.id === cage.batchId);
          const line = (state.lines || []).find(l => l.id === cage.lineId);
          const mortalities = (state.mortalityLogs || []).filter(m => {
            if (m.cageId !== cage.id) return false;
            if (m.batchId && m.batchId !== cage.batchId) return false;
            const cageSettlement = cage.settlementDate || batch?.settlementDate;
            if (cageSettlement && m.date < cageSettlement) return false;
            if (cage.harvestDate && m.date > cage.harvestDate) return false;
            return true;
          }).reduce((a, b) => a + b.count, 0);
          const currentCount = Math.max(0, (cage.initialFishCount || 0) - mortalities);

          const rawModel = cage.model 
            ? cage.model.toUpperCase() 
            : cage.dimensions 
              ? `${cage.dimensions.length}X${cage.dimensions.width}X${cage.dimensions.depth}`.replace('.', ',')
              : '';

          const cageCardTitle = rawModel && !cage.name.toUpperCase().includes(rawModel)
            ? `${cage.name} - ${rawModel}`
            : cage.name;
          
          return (
            <div key={cage.id} className={`bg-white rounded-3xl shadow-sm border transition-all overflow-hidden group ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-200'}`}>
              <div className={`p-4 border-b flex justify-between items-center ${isSelected ? 'bg-blue-50 border-blue-100' : 'bg-blue-50/30 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  {hasPermission && (
                    <button 
                      onClick={() => toggleSelectCage(cage.id)}
                      className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300 hover:text-blue-400'}`}
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="font-black text-slate-800 uppercase tracking-tighter block">{cageCardTitle}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{line?.name || 'Setor não definido'}</span>
                    </div>
                  </div>
                </div>
                {hasPermission && (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(cage)} title="Editar Povoamento" className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => releaseCage(cage.id)} title="Desvincular do Lote (tornar disponível)" className="p-2 text-slate-300 hover:text-amber-600 transition-colors"><LogOut className="w-4 h-4" /></button>
                    <button onClick={() => deleteCageCompletely(cage.id)} title="Excluir Gaiola Definitivamente" className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote Vinculado</span>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">{batch?.name || '---'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Vivo</span>
                    <span className={`text-xl font-black leading-none mt-1 ${currentCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{currentCount.toLocaleString('pt-BR')} un</span>
                    {currentCount === 0 && (cage.initialFishCount || 0) > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 uppercase mt-1">Saldo Positivo: {(cage.initialFishCount || 0).toLocaleString('pt-BR')} un</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicial</span>
                    <span className="text-xs font-bold text-slate-500">{cage.initialFishCount?.toLocaleString('pt-BR')} un</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredCages.length === 0 && (
          <div className="col-span-full py-24 text-center">
            <Info className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <h4 className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum povoamento ativo encontrado para este filtro.</h4>
          </div>
        )}
      </div>
    </div>
  );
};

export default CageManagement;
