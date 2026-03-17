
import React, { useState, useMemo } from 'react';
import { Batch, AppState, User } from '../types';
import { Plus, Trash2, Tag, Calendar, Scale, Hash, Edit, X, BookOpen, Eye, TrendingUp, Fish, AlertCircle, ShoppingCart, CheckCircle2, Package, Utensils, Info, CheckSquare, Box } from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay } from 'date-fns';
import HarvestManagement from './HarvestManagement';

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

const BatchManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'harvest'>('inventory');
  const [selectedPlanningBatchId, setSelectedPlanningBatchId] = useState('');
  const [selectedPlanningCageIds, setSelectedPlanningCageIds] = useState<string[]>([]);
  const [lastFeeding, setLastFeeding] = useState('');
  const [plannedHarvestDate, setPlannedHarvestDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    settlementDate: new Date().toISOString().split('T')[0],
    initialQuantity: '',
    initialUnitWeight: '',
    protocolId: '',
    expectedHarvestDate: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name || !formData.initialQuantity) return;

    if (editingId) {
      const updatedBatches = (state.batches || []).map(b => 
        b.id === editingId ? {
          ...b,
          name: formData.name,
          settlementDate: formData.settlementDate,
          initialQuantity: Number(formData.initialQuantity),
          initialUnitWeight: Number(formData.initialUnitWeight),
          protocolId: formData.protocolId,
          expectedHarvestDate: formData.expectedHarvestDate || undefined,
          updatedAt: Date.now()
        } : b
      );
      onUpdate({ ...state, batches: updatedBatches });
      setEditingId(null);
    } else {
      const newBatch: Batch = {
        id: generateId(),
        name: formData.name,
        settlementDate: formData.settlementDate,
        initialQuantity: Number(formData.initialQuantity),
        initialUnitWeight: Number(formData.initialUnitWeight),
        protocolId: formData.protocolId,
        expectedHarvestDate: formData.expectedHarvestDate || undefined,
        updatedAt: Date.now()
      };
      onUpdate({ ...state, batches: [...(state.batches || []), newBatch] });
    }

    setFormData({
      name: '',
      settlementDate: new Date().toISOString().split('T')[0],
      initialQuantity: '',
      initialUnitWeight: '',
      protocolId: '',
      expectedHarvestDate: ''
    });
  };

  const startEdit = (batch: Batch) => {
    if (!hasPermission) return;
    setEditingId(batch.id);
    setFormData({
      name: batch.name,
      settlementDate: batch.settlementDate,
      initialQuantity: batch.initialQuantity.toString(),
      initialUnitWeight: batch.initialUnitWeight.toString(),
      protocolId: batch.protocolId || '',
      expectedHarvestDate: batch.expectedHarvestDate || ''
    });
  };

  const removeBatch = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir este lote? Isso removerá o vínculo com todas as gaiolas.')) return;
    onUpdate({
      ...state,
      batches: (state.batches || []).filter(b => b.id !== id)
    });
  };

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
    const activeCageMortalityByBatch = new Map<string, number>();
    const nurseryMortalityByBatch = new Map<string, number>();
    (state.mortalityLogs || []).forEach(m => {
      let bId = m.batchId;
      const cage = m.cageId ? (state.cages || []).find(c => c.id === m.cageId) : null;
      
      // Tenta encontrar o lote se não estiver no log
      if (!bId && cage?.batchId) {
        bId = cage.batchId;
      } else if (!bId && m.cageId) {
        // Se a gaiola já foi despescada, tenta encontrar o lote pelo log de despesca
        const harvest = (state.harvestLogs || []).find(h => h.cageId === m.cageId && h.date >= (m.date || ''));
        if (harvest) bId = harvest.batchId;
      }

      if (bId) {
        mortalityByBatch.set(bId, (mortalityByBatch.get(bId) || 0) + m.count);
        // Mortalidade em gaiola ATIVA (que ainda pertence ao lote)
        if (cage && cage.batchId === bId) {
          activeCageMortalityByBatch.set(bId, (activeCageMortalityByBatch.get(bId) || 0) + m.count);
        }
        // Mortalidade no berçário (sem gaiola)
        if (!m.cageId) {
          nurseryMortalityByBatch.set(bId, (nurseryMortalityByBatch.get(bId) || 0) + m.count);
        }
      }
    });

    const biometryByBatch = new Map<string, typeof state.biometryLogs>();
    (state.biometryLogs || []).forEach(b => {
      let bId = b.batchId;
      if (!bId && b.cageId) {
        const cage = (state.cages || []).find(c => c.id === b.cageId);
        if (cage?.batchId) {
          bId = cage.batchId;
        } else {
          const harvest = (state.harvestLogs || []).find(h => h.cageId === b.cageId && h.date >= (b.date || ''));
          if (harvest) bId = harvest.batchId;
        }
      }
      
      if (bId) {
        const list = biometryByBatch.get(bId) || [];
        list.push(b);
        biometryByBatch.set(bId, list);
      }
    });

    const feedingByBatch = new Map<string, number>();
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
      }
    });

    const harvestsByBatch = new Map<string, { fishCount: number, initialFishCount: number, weight: number }>();
    (state.harvestLogs || []).forEach(h => {
      const current = harvestsByBatch.get(h.batchId) || { fishCount: 0, initialFishCount: 0, weight: 0 };
      
      // Se não temos o initialFishCount no log (logs antigos), tentamos reconstruir com a mortalidade daquela gaiola
      let initial = h.initialFishCount;
      if (!initial) {
        const cageMortality = (state.mortalityLogs || [])
          .filter(m => m.cageId === h.cageId && m.date <= h.date)
          .reduce((acc, curr) => acc + curr.count, 0);
        initial = h.fishCount + cageMortality;
      }

      harvestsByBatch.set(h.batchId, {
        fishCount: current.fishCount + h.fishCount,
        initialFishCount: current.initialFishCount + initial,
        weight: current.weight + h.weight
      });
    });

    return (state.batches || []).map(batch => {
      const batchCages = cagesByBatch.get(batch.id) || [];
      const cageIds = batchCages.map(c => c.id);
      
      const usedFish = batchCages.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
      const harvestData = harvestsByBatch.get(batch.id) || { fishCount: 0, initialFishCount: 0, weight: 0 };
      const harvestedFish = harvestData.fishCount;
      const harvestedWeight = harvestData.weight;
      const settledAndHarvested = harvestData.initialFishCount;
      
      const totalMortality = mortalityByBatch.get(batch.id) || 0;
      const nurseryMortality = nurseryMortalityByBatch.get(batch.id) || 0;
      
      // Saldo Alojamento: O que ainda não saiu do berçário
      const balance = Math.max(0, batch.initialQuantity - usedFish - settledAndHarvested - nurseryMortality);
      
      const mortality = totalMortality;
      const liveFish = Math.max(0, batch.initialQuantity - mortality - harvestedFish);
      // Rendimento baseado na sobrevivência (Povoado - Morto) / Povoado
      const yieldPercentage = batch.initialQuantity > 0 ? ((batch.initialQuantity - mortality) / batch.initialQuantity) * 100 : 0;

      const expectedAtHarvest = batch.initialQuantity - mortality;
      const accuracy = expectedAtHarvest > 0 ? (harvestedFish / expectedAtHarvest) * 100 : 0;
      const isFinalized = harvestedFish > 0 && batchCages.length === 0;
      
      const batchBiometries = biometryByBatch.get(batch.id) || [];

      let currentAvgWeight = batch.initialUnitWeight;
      if (batchBiometries.length > 0) {
        const lastDate = batchBiometries.reduce((max, log) => log.date > max ? log.date : max, "");
        const lastDayLogs = batchBiometries.filter(log => log.date === lastDate);
        if (lastDayLogs.length > 0) {
          const sumWeights = lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0);
          currentAvgWeight = sumWeights / lastDayLogs.length;
        }
      }

      const totalBiomassKg = (liveFish * currentAvgWeight) / 1000;
      const totalFeed = feedingByBatch.get(batch.id) || 0;
      
      // FCA: Total Feed / (Current Biomass + Harvested Weight)
      const totalProducedWeightKg = totalBiomassKg + harvestedWeight;
      const fca = totalProducedWeightKg > 0 ? (totalFeed / 1000) / totalProducedWeightKg : 0;

      const protocol = (state.protocols || []).find(p => p.id === batch.protocolId);

      let settlementAlert = null;
      if (batch.settlementDate) {
        const today = startOfDay(new Date());
        const settlement = startOfDay(parseISO(batch.settlementDate));
        const daysDiff = differenceInDays(settlement, today);
        
        if (daysDiff >= 0 && daysDiff <= 5) {
          settlementAlert = (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-3 animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                Povoamento em {daysDiff === 0 ? 'HOJE' : `${daysDiff} dias`}
              </span>
            </div>
          );
        }
      }

      return {
        ...batch,
        batchCages,
        usedFish,
        harvestedFish,
        balance,
        mortality,
        liveFish,
        yieldPercentage,
        currentAvgWeight,
        totalBiomassKg,
        totalFeed,
        fca,
        protocol,
        settlementAlert,
        accuracy,
        isFinalized
      };
    });
  }, [state.batches, state.cages, state.mortalityLogs, state.biometryLogs, state.protocols, state.harvestLogs]);

  const planningCages = useMemo(() => {
    if (!selectedPlanningBatchId) return [];
    
    const batch = batchStats.find(b => b.id === selectedPlanningBatchId);
    if (!batch) return [];

    return batch.batchCages.map(cage => {
      const mortality = (state.mortalityLogs || [])
        .filter(m => m.cageId === cage.id)
        .reduce((acc, curr) => acc + curr.count, 0);
      
      const currentCount = (cage.initialFishCount || 0) - mortality;
      const biomass = (currentCount * batch.currentAvgWeight) / 1000;

      return {
        ...cage,
        mortality,
        currentCount,
        biomass
      };
    }).sort((a, b) => b.mortality - a.mortality);
  }, [selectedPlanningBatchId, batchStats, state.mortalityLogs]);

  const selectedPlanningCagesData = useMemo(() => {
    return planningCages.filter(c => selectedPlanningCageIds.includes(c.id));
  }, [planningCages, selectedPlanningCageIds]);

  const totalPlanningBiomass = useMemo(() => {
    return selectedPlanningCagesData.reduce((acc, curr) => acc + curr.biomass, 0);
  }, [selectedPlanningCagesData]);

  return (
    <div className="space-y-8 pb-20">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit mx-auto md:mx-0">
        <button 
          onClick={() => setActiveSubTab('inventory')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'inventory' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Tag className="w-4 h-4" />
          Estoque de Lotes
        </button>
        <button 
          onClick={() => setActiveSubTab('harvest')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'harvest' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <ShoppingCart className="w-4 h-4" />
          Despesca
        </button>
      </div>

      {activeSubTab === 'harvest' ? (
        <HarvestManagement state={state} onUpdate={onUpdate} currentUser={currentUser} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 lg:sticky lg:top-8">
            {hasPermission ? (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
                  <div className="flex items-center gap-2">
                    {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                    {editingId ? 'Editar Lote' : 'Cadastrar Lote'}
                  </div>
                  {editingId && (
                    <button onClick={() => { setEditingId(null); setFormData({name:'', settlementDate: new Date().toISOString().split('T')[0], initialQuantity: '', initialUnitWeight: '', protocolId: '', expectedHarvestDate: ''}); }} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Identificação do Lote</label>
                    <input type="text" required placeholder="Ex: Lote 2024-A" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Modelo de Produção</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm" value={formData.protocolId} onChange={(e) => setFormData({...formData, protocolId: e.target.value})}>
                      <option value="">Nenhum modelo</option>
                      {(state.protocols || []).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Povoamento</label>
                      <input type="date" required className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" value={formData.settlementDate} onChange={(e) => setFormData({...formData, settlementDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Quantidade</label>
                      <input type="number" required placeholder="0" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" value={formData.initialQuantity} onChange={(e) => setFormData({...formData, initialQuantity: e.target.value})} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Peso Médio (g)</label>
                      <input type="number" required placeholder="0" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" value={formData.initialUnitWeight} onChange={(e) => setFormData({...formData, initialUnitWeight: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Prev. Despesca</label>
                      <input type="date" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs" value={formData.expectedHarvestDate} onChange={(e) => setFormData({...formData, expectedHarvestDate: e.target.value})} />
                    </div>
                  </div>

                  <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                    {editingId ? 'Salvar Lote' : 'Povoar Lote'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
                <Eye className="w-10 h-10 text-slate-300" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura</h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Sem permissão para editar.</p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* Indicação de Gaiola Box */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 rounded-2xl">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Indicação de Gaiolas para Despesca</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Planejamento e Programação por Gaiola</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Selecionar Lote</label>
                    <select 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                      value={selectedPlanningBatchId}
                      onChange={e => {
                        setSelectedPlanningBatchId(e.target.value);
                        setSelectedPlanningCageIds([]);
                      }}
                    >
                      <option value="">Escolher Lote para Planejar</option>
                      {batchStats.filter(b => !b.isFinalized).map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.batchCages.length} gaiolas)</option>
                      ))}
                    </select>
                  </div>

                  {selectedPlanningBatchId && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gaiolas Disponíveis (Maior Mortalidade Primeiro)</label>
                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">
                          {planningCages.length} Total
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                        {planningCages.map(cage => (
                          <button
                            key={cage.id}
                            onClick={() => {
                              if (selectedPlanningCageIds.includes(cage.id)) {
                                setSelectedPlanningCageIds(selectedPlanningCageIds.filter(id => id !== cage.id));
                              } else {
                                setSelectedPlanningCageIds([...selectedPlanningCageIds, cage.id]);
                              }
                            }}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              selectedPlanningCageIds.includes(cage.id)
                                ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/10'
                                : 'bg-white border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl ${selectedPlanningCageIds.includes(cage.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {selectedPlanningCageIds.includes(cage.id) ? <CheckCircle2 className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                              </div>
                              <div className="text-left">
                                <span className="text-sm font-black text-slate-800 uppercase italic">{cage.name}</span>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-1.5 py-0.5 rounded-md">{`${cage.dimensions.length}x${cage.dimensions.width}x${cage.dimensions.depth}m`}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Mortalidade: {cage.mortality}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">•</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{cage.currentCount} peixes</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-blue-600">{cage.biomass.toFixed(1)}kg</span>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">Est. Biomassa</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {selectedPlanningCageIds.length > 0 ? (
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Resumo da Seleção</h4>
                        <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase">
                          {selectedPlanningCageIds.length} Gaiolas
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Biomassa Total</span>
                          <span className="text-xl font-black text-blue-600 italic">{totalPlanningBiomass.toFixed(1)}kg</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Modelos Selecionados</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(
                              selectedPlanningCagesData.reduce((acc, c) => {
                                const key = `${c.dimensions.length}x${c.dimensions.width}x${c.dimensions.depth}m`;
                                acc[key] = (acc[key] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            ).map(([m, count]) => (
                              <span key={m} className="px-2 py-0.5 bg-blue-50 text-[8px] font-black text-blue-600 rounded-md uppercase border border-blue-100">
                                {m} = {count}und
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Última Alimentação (Jejum 30h)</span>
                          <span className="text-xs font-black text-amber-600 italic">
                            {lastFeeding ? format(new Date(lastFeeding), 'dd/MM/yyyy HH:mm') : '---'}
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dia da Despesca (03:00 AM)</span>
                          <span className="text-xs font-black text-emerald-600 italic">
                            {plannedHarvestDate ? format(parseISO(plannedHarvestDate), 'dd/MM/yyyy') : '---'}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Data da Despesca
                          </label>
                          <input 
                            type="date"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                            value={plannedHarvestDate}
                            onChange={e => {
                              const date = e.target.value;
                              setPlannedHarvestDate(date);
                              if (date) {
                                // Considera despesca às 03:00 AM do dia selecionado
                                // Jejum de 30 horas: 03:00 - 30h = 21:00 de 2 dias atrás
                                const harvestDateTime = new Date(`${date}T03:00:00`);
                                const lastFeedingDateTime = new Date(harvestDateTime.getTime() - (30 * 60 * 60 * 1000));
                                setLastFeeding(format(lastFeedingDateTime, "yyyy-MM-dd'T'HH:mm"));
                              } else {
                                setLastFeeding('');
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-amber-700 uppercase leading-relaxed">
                          Esta ferramenta é apenas para planejamento. Nenhuma alteração será salva permanentemente no banco de dados.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                      <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                        <CheckSquare className="w-8 h-8 text-slate-300" />
                      </div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aguardando Seleção</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed mt-2 max-w-[200px]">
                        Selecione as gaiolas na lista ao lado para programar a despesca.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {batchStats.map(batch => {
              return (
                <div key={batch.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:border-blue-200 transition-all">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-blue-500" />
                      <span className="font-black text-slate-800 uppercase tracking-tighter">{batch.name}</span>
                    </div>
                    {hasPermission && (
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(batch)} className="text-slate-300 hover:text-blue-500 p-2 transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => removeBatch(batch.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    {batch.settlementAlert}
                    <div className="flex items-center justify-between">
                      {batch.protocol ? (
                         <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100">
                           <BookOpen className="w-3 h-3 text-indigo-600" />
                           <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{batch.protocol.name}</span>
                         </div>
                      ) : <div></div>}
                      
                      {batch.isFinalized ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900 rounded-xl border border-indigo-800 text-white">
                          <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Assertividade: {batch.accuracy.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Rend: {batch.yieldPercentage.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> Povoamento</span>
                        <span className="text-xs font-black text-slate-700">
                          {batch.settlementDate ? format(new Date(batch.settlementDate + 'T12:00:00'), 'dd/MM/yyyy') : '---'}
                        </span>
                      </div>

                      {batch.expectedHarvestDate && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30 text-blue-400" /> Prev. Despesca</span>
                          <span className="text-xs font-black text-blue-600">
                            {format(new Date(batch.expectedHarvestDate + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Barra de Progresso do Rendimento */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full transition-all duration-500 ${batch.yieldPercentage > 90 ? 'bg-emerald-500' : (batch.yieldPercentage > 70 ? 'bg-blue-500' : 'bg-amber-500')}`} 
                        style={{ width: `${batch.yieldPercentage}%` }} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Scale className="w-2.5 h-2.5" /> Peso Médio
                        </span>
                        <span className="text-lg font-black text-blue-600 leading-none mt-1">{batch.currentAvgWeight.toFixed(1)}g</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5" /> Biomassa Est.
                        </span>
                        <span className="text-lg font-black text-emerald-600 leading-none mt-1">{batch.totalBiomassKg.toFixed(1)}kg</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" /> Ração Total
                        </span>
                        <span className="text-lg font-black text-amber-600 leading-none mt-1">{(batch.totalFeed / 1000).toFixed(1)}kg</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <TrendingUp className="w-2.5 h-2.5" /> FCA
                        </span>
                        <span className="text-lg font-black text-indigo-600 leading-none mt-1">{batch.fca.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Fish className="w-2.5 h-2.5" /> Peixes Vivos
                        </span>
                        <span className="text-lg font-black text-slate-700 leading-none mt-1">{batch.liveFish} un</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Aloj.</span>
                        <span className={`text-lg font-black mt-1 leading-none ${batch.balance > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{batch.balance} un</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Despescado</span>
                        <span className="text-sm font-black text-blue-600">{batch.harvestedFish} un</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mortalidade</span>
                        <span className="text-sm font-black text-red-500">{batch.mortality} un</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Povoado</span>
                        <span className="text-sm font-black text-slate-700">{batch.initialQuantity} un</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
  </div>
);
};

export default BatchManagement;
