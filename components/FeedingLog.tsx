
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, FeedingLog as IFeedingLog, User } from '../types';
import { Utensils, Trash2, Edit3, X, ArrowUpDown, Clock, Calendar, AlertTriangle, Eye, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatNumber } from '../utils/formatters';

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

const FeedingLog: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [formBatchId, setFormBatchId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedFilterCageId, setSelectedFilterCageId] = useState('');
  const [selectedFilterFeedTypeId, setSelectedFilterFeedTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [isBulk, setIsBulk] = useState(false);
  const [selectedCageIds, setSelectedCageIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;
  
  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    feedTypeId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: format(new Date(), 'HH:mm')
  });

  useEffect(() => {
    if (!editingId) {
      setSelectedLineId('');
      setFormData(prev => ({ ...prev, cageId: '' }));
      setSelectedCageIds(new Set());
    }
  }, [formBatchId]);

  useEffect(() => {
    if (!editingId) {
      setFormData(prev => ({ ...prev, cageId: '' }));
      setSelectedCageIds(new Set());
    }
  }, [selectedLineId]);

  const filteredLines = useMemo(() => {
    if (!formBatchId) return state.lines || [];
    const cagesInBatch = (state.cages || []).filter(c => c.batchId === formBatchId);
    const harvestedCageIds = new Set(
      (state.harvestLogs || []).filter(h => h.batchId === formBatchId).map(h => h.cageId)
    );
    const feedingCageIds = new Set(
      (state.feedingLogs || []).filter(f => f.batchId === formBatchId).map(f => f.cageId)
    );

    const lineIdsInBatch = new Set<string>();
    cagesInBatch.forEach(c => { if (c.lineId) lineIdsInBatch.add(c.lineId); });
    (state.cages || []).forEach(c => {
      if (harvestedCageIds.has(c.id) || feedingCageIds.has(c.id)) {
        if (c.lineId) lineIdsInBatch.add(c.lineId);
      }
    });

    const matchedLines = (state.lines || []).filter(l => lineIdsInBatch.has(l.id));
    return matchedLines.length > 0 ? matchedLines : (state.lines || []);
  }, [formBatchId, state.cages, state.lines, state.harvestLogs, state.feedingLogs]);

  const filteredCages = useMemo(() => {
    if (!formBatchId) return [];
    const batch = (state.batches || []).find(b => b.id === formBatchId);
    if (batch?.isClosed && !editingId) return [];

    const harvestedCageIds = new Set(
      (state.harvestLogs || []).filter(h => h.batchId === formBatchId).map(h => h.cageId)
    );

    let cages = (state.cages || []).filter(c => {
      if (c.id === formData.cageId && editingId) return true;
      if (c.batchId !== formBatchId) return false;
      if (harvestedCageIds.has(c.id)) return false;
      if (c.status !== 'Ocupada') return false;
      return true;
    });

    if (selectedLineId) {
      cages = cages.filter(c => c.lineId === selectedLineId);
    }

    return cages.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [formBatchId, selectedLineId, state.cages, state.harvestLogs, state.batches, formData.cageId, editingId]);

  const { cageMap, feedMap, userMap } = useMemo(() => {
    const cages = new Map((state.cages || []).map(c => [c.id, c]));
    const feeds = new Map((state.feedTypes || []).map(f => [f.id, f]));
    const users = new Map((state.users || []).map(u => [u.id, u]));
    return { cageMap: cages, feedMap: feeds, userMap: users };
  }, [state.cages, state.feedTypes, state.users]);

  const availableFilterCages = useMemo(() => {
    const allCages = state.cages || [];
    if (!selectedBatchId) {
      return [...allCages].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    }
    
    const batchCageIds = new Set(allCages.filter(c => c.batchId === selectedBatchId).map(c => c.id));
    (state.feedingLogs || []).forEach(log => {
      if (log.batchId === selectedBatchId && log.cageId) {
        batchCageIds.add(log.cageId);
      }
    });

    return allCages
      .filter(c => batchCageIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [state.cages, state.feedingLogs, selectedBatchId]);

  const availableFilterFeedTypes = useMemo(() => {
    const allFeeds = state.feedTypes || [];
    const logs = Array.isArray(state.feedingLogs) ? state.feedingLogs : [];
    
    // Calculate consumption per feed type for the selected batch or overall
    const feedConsumptionMap = new Map<string, number>();
    logs.forEach(log => {
      if (!log.feedTypeId) return;
      if (selectedBatchId) {
        let bId = log.batchId;
        if (!bId && log.cageId) {
          const cage = cageMap.get(log.cageId);
          bId = cage?.batchId;
        }
        if (bId !== selectedBatchId) return;
      }
      feedConsumptionMap.set(log.feedTypeId, (feedConsumptionMap.get(log.feedTypeId) || 0) + (Number(log.amount) || 0));
    });

    return [...allFeeds].map(ft => {
      const consumedGrams = feedConsumptionMap.get(ft.id) || 0;
      const consumedKg = consumedGrams / 1000;
      return {
        ...ft,
        consumedKg,
        hasConsumption: consumedGrams > 0
      };
    }).sort((a, b) => {
      if (a.hasConsumption && !b.hasConsumption) return -1;
      if (!a.hasConsumption && b.hasConsumption) return 1;
      if (a.hasConsumption && b.hasConsumption) return b.consumedKg - a.consumedKg;
      return a.name.localeCompare(b.name);
    });
  }, [state.feedTypes, state.feedingLogs, selectedBatchId, cageMap]);

  const sortedLogs = useMemo(() => {
    const logs = Array.isArray(state.feedingLogs) ? state.feedingLogs : [];
    let filtered = logs;
    
    if (selectedBatchId || selectedFilterCageId || selectedFilterFeedTypeId || startDate || endDate) {
      const sortedHarvestLogs = [...(state.harvestLogs || [])].sort((a, b) => a.date.localeCompare(b.date));
      
      filtered = logs.filter(log => {
        if (selectedFilterCageId && log.cageId !== selectedFilterCageId) return false;
        if (selectedFilterFeedTypeId && log.feedTypeId !== selectedFilterFeedTypeId) return false;
        if (selectedBatchId) {
          let bId = log.batchId;

          if (!bId && log.cageId) {
            const cage = cageMap.get(log.cageId);
            if (cage?.batchId) {
              bId = cage.batchId;
            } else {
              const harvest = sortedHarvestLogs.find(h => h.cageId === log.cageId && h.date >= (log.timestamp || '').split('T')[0]);
              if (harvest) {
                bId = harvest.batchId;
              }
            }
          }
          if (bId !== selectedBatchId) return false;
        }
        if (startDate && log.timestamp.split('T')[0] < startDate) return false;
        if (endDate && log.timestamp.split('T')[0] > endDate) return false;
        return true;
      });
    }

    return [...filtered].sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.timestamp.localeCompare(a.timestamp) 
        : a.timestamp.localeCompare(b.timestamp);
    });
  }, [state.feedingLogs, sortOrder, selectedBatchId, selectedFilterCageId, selectedFilterFeedTypeId, startDate, endDate, cageMap, state.harvestLogs]);

  const filteredTotalGrams = useMemo(() => {
    return sortedLogs.reduce((sum, log) => sum + (Number(log.amount) || 0), 0);
  }, [sortedLogs]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage]);

  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);

  const originalLog = useMemo(() => {
    if (!editingId) return null;
    return (state.feedingLogs || []).find(l => l.id === editingId) || null;
  }, [editingId, state.feedingLogs]);

  const editStockDifference = useMemo(() => {
    if (!editingId || !originalLog) return null;
    const newAmount = Number(formData.amount);
    if (isNaN(newAmount) || newAmount <= 0) return null;
    const oldAmount = Number(originalLog.amount) || 0;
    const oldFeed = feedMap.get(originalLog.feedTypeId);
    const newFeed = feedMap.get(formData.feedTypeId);

    if (originalLog.feedTypeId === formData.feedTypeId) {
      const diff = newAmount - oldAmount;
      if (diff < 0) {
        const returnedKg = Math.abs(diff) / 1000;
        return {
          type: 'return' as const,
          text: `Quantidade reduzida em ${formatNumber(returnedKg, 2)} kg. Esse saldo retornará para o estoque de ${newFeed?.name || 'ração'}.`
        };
      } else if (diff > 0) {
        const addedKg = diff / 1000;
        return {
          type: 'deduct' as const,
          text: `Quantidade aumentada em ${formatNumber(addedKg, 2)} kg. Esse saldo adicional será debitado do estoque de ${newFeed?.name || 'ração'}.`
        };
      } else {
        return {
          type: 'neutral' as const,
          text: 'Mesma quantidade anterior. Nenhuma alteração no saldo de estoque.'
        };
      }
    } else {
      const oldKg = oldAmount / 1000;
      const newKg = newAmount / 1000;
      return {
        type: 'change_feed' as const,
        text: `Troca de ração: ${formatNumber(oldKg, 2)} kg retornarão ao estoque de ${oldFeed?.name || 'ração anterior'} e ${formatNumber(newKg, 2)} kg serão debitados de ${newFeed?.name || 'nova ração'}.`
      };
    }
  }, [editingId, originalLog, formData.amount, formData.feedTypeId, feedMap]);

  const toggleSelectAll = () => {
    if (selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(paginatedLogs.map(l => l.id)));
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

  const removeSelectedLogs = () => {
    if (!hasPermission || selectedLogIds.size === 0) return;
    if (!confirm(`Deseja excluir ${selectedLogIds.size} trato(s) selecionado(s) do histórico do lote? Atenção: o saldo de ração NÃO será estornado para o estoque central.`)) return;

    onUpdate({
      ...state,
      feedingLogs: (state.feedingLogs || []).filter(l => !selectedLogIds.has(l.id)),
      deletedIds: [...(state.deletedIds || []), ...Array.from(selectedLogIds)]
    });
    setSelectedLogIds(new Set());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    const targetBatch = (state.batches || []).find(b => b.id === formBatchId);
    if (targetBatch?.isClosed) {
      alert('Atenção: Não é possível registrar ou alterar trato para um lote já fechado.');
      return;
    }

    const amountNum = Number(formData.amount);
    
    const isBulkMode = isBulk && !editingId;
    
    if (isBulkMode) {
      if (selectedCageIds.size === 0) {
        alert('Selecione pelo menos uma gaiola para o trato em massa.');
        return;
      }
    } else {
      if (!formData.cageId) {
        alert('Selecione uma gaiola.');
        return;
      }
    }

    if (!formData.feedTypeId || isNaN(amountNum) || amountNum <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    const selectedFeed = feedMap.get(formData.feedTypeId);
    if (!selectedFeed) return;

    if (editingId) {
      const targetOriginalLog = originalLog || (state.feedingLogs || []).find(l => l.id === editingId);

      const updatedLogs = (state.feedingLogs || []).map(l => 
        l.id === editingId ? {
          ...l,
          cageId: formData.cageId,
          batchId: formBatchId || l.batchId,
          feedTypeId: formData.feedTypeId,
          amount: amountNum,
          timestamp: `${formData.date}T${formData.time}:00`,
          updatedAt: Date.now()
        } : l
      );

      // Na edição do lançamento de trato:
      // Se a quantidade diminuir: a diferença retorna ao estoque (+).
      // Se a quantidade aumentar: o saldo adicional é debitado do estoque (-).
      // Se o tipo de ração mudar: estorna o valor da ração anterior e debita o valor da nova ração.
      let updatedFeeds = state.feedTypes || [];
      if (targetOriginalLog) {
        const oldFeedId = targetOriginalLog.feedTypeId;
        const newFeedId = formData.feedTypeId;
        const oldAmount = Number(targetOriginalLog.amount) || 0;
        const newAmount = amountNum;

        updatedFeeds = updatedFeeds.map(f => {
          let stock = f.totalStock;
          let changed = false;

          if (oldFeedId === newFeedId && f.id === newFeedId) {
            stock = stock + oldAmount - newAmount;
            changed = true;
          } else {
            if (f.id === oldFeedId) {
              stock = stock + oldAmount;
              changed = true;
            }
            if (f.id === newFeedId) {
              stock = stock - newAmount;
              changed = true;
            }
          }

          return changed ? { ...f, totalStock: stock, updatedAt: Date.now() } : f;
        });
      }

      onUpdate({ 
        ...state, 
        feedingLogs: updatedLogs,
        feedTypes: updatedFeeds 
      });
      setEditingId(null);
    } else {
      const cagesToProcess = isBulkMode ? Array.from(selectedCageIds) : [formData.cageId];
      const newLogs: IFeedingLog[] = cagesToProcess.map(cageId => ({
        id: generateId(),
        cageId,
        batchId: formBatchId || cageMap.get(cageId)?.batchId || '',
        feedTypeId: formData.feedTypeId,
        amount: amountNum,
        timestamp: `${formData.date}T${formData.time}:00`,
        userId: currentUser.id,
        updatedAt: Date.now()
      }));

      const totalDeduction = amountNum * cagesToProcess.length;

      const updatedFeeds = (state.feedTypes || []).map(f => {
        if (f.id === formData.feedTypeId) return { ...f, totalStock: f.totalStock - totalDeduction, updatedAt: Date.now() };
        return f;
      });

      onUpdate({ 
        ...state, 
        feedingLogs: [...newLogs, ...(state.feedingLogs || [])], 
        feedTypes: updatedFeeds 
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormBatchId('');
    setSelectedLineId('');
    setIsBulk(false);
    setSelectedCageIds(new Set());
    setFormData({ cageId: '', feedTypeId: '', amount: '', date: new Date().toISOString().split('T')[0], time: format(new Date(), 'HH:mm') });
  };

  const startEdit = (log: IFeedingLog) => {
    if (!hasPermission) return;
    
    let bId = log.batchId;
    const cage = cageMap.get(log.cageId);

    if (!bId && cage) {
      bId = cage.batchId;
    }
    
    setFormBatchId(bId || '');
    if (cage && cage.lineId) {
      setSelectedLineId(cage.lineId);
    } else {
      setSelectedLineId('');
    }
    
    const [d, t] = log.timestamp.split('T');
    setEditingId(log.id);
    setIsBulk(false);
    setSelectedCageIds(new Set());
    setFormData({ 
      cageId: log.cageId, 
      feedTypeId: log.feedTypeId, 
      amount: log.amount.toString(), 
      date: d, 
      time: t.substring(0, 5) 
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeLog = (logId: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este trato do histórico do lote? Atenção: o saldo de ração NÃO será estornado para o estoque central.')) return;
    const log = (state.feedingLogs || []).find(l => l.id === logId);
    if (!log) return;
    
    onUpdate({ 
      ...state, 
      feedingLogs: (state.feedingLogs || []).filter(l => l.id !== logId), 
      deletedIds: [...(state.deletedIds || []), logId]
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 lg:sticky lg:top-4">
        {hasPermission ? (
          <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                <Utensils className={`w-5 h-5 ${editingId ? 'text-amber-500' : 'text-blue-500'}`} />
                {editingId ? 'Editar Trato' : 'Registrar Trato'}
              </div>
              {editingId && <button onClick={resetForm}><X className="w-5 h-5 text-slate-400" /></button>}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formBatchId} onChange={e => setFormBatchId(e.target.value)}>
                <option value="">Escolher Lote...</option>
                {(state.batches || [])
                  .filter(b => !b.isClosed || b.id === formBatchId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(b => <option key={b.id} value={b.id}>{b.name}{b.isClosed ? ' (Fechado)' : ''}</option>)}
              </select>
              <select disabled={!formBatchId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}>
                <option value="">Escolher Linha (Opcional)...</option>
                {filteredLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>

              {!editingId && (
                <div className="flex items-center gap-2 py-1 px-1 border-b border-dashed border-slate-200">
                  <input 
                    type="checkbox" 
                    id="isBulkCheck"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={isBulk}
                    onChange={e => {
                      setIsBulk(e.target.checked);
                      setSelectedCageIds(new Set());
                    }}
                  />
                  <label htmlFor="isBulkCheck" className="text-xs font-black text-slate-600 uppercase tracking-widest cursor-pointer select-none">
                    Trato em Massa
                  </label>
                </div>
              )}

              {isBulk && !editingId ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Gaiolas Selecionadas ({selectedCageIds.size})
                    </label>
                    {filteredCages.length > 0 && (
                      <div className="flex gap-2 text-[10px] font-bold">
                        <button
                          type="button"
                          className="text-blue-600 hover:underline"
                          onClick={() => setSelectedCageIds(new Set(filteredCages.map(c => c.id)))}
                        >
                          Marcar Todas
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:underline"
                          onClick={() => setSelectedCageIds(new Set())}
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-3 bg-slate-50 space-y-1.5">
                    {filteredCages.length === 0 ? (
                      <p className="text-[11px] font-bold text-slate-400 uppercase text-center py-4 italic">
                        {!formBatchId ? 'Escolha um lote primeiro...' : 'Nenhuma gaiola encontrada.'}
                      </p>
                    ) : (
                      filteredCages.map(c => {
                        const isChecked = selectedCageIds.has(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2.5 py-1 px-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={isChecked}
                              onChange={() => {
                                const newSet = new Set(selectedCageIds);
                                if (newSet.has(c.id)) {
                                  newSet.delete(c.id);
                                } else {
                                  newSet.add(c.id);
                                }
                                setSelectedCageIds(newSet);
                              }}
                            />
                            <span className="text-xs font-black text-slate-700 uppercase">
                              {c.name} <span className="text-[10px] text-slate-400 font-bold ml-1">({c.model || 'G70 - 3x3x3'})</span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <select required disabled={!formBatchId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.cageId} onChange={e => setFormData({...formData, cageId: e.target.value})}>
                  <option value="">Escolher Gaiola...</option>
                  {filteredCages.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - ({c.model || 'G70 - 3x3x3'})
                    </option>
                  ))}
                </select>
              )}
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.feedTypeId} onChange={e => setFormData({...formData, feedTypeId: e.target.value})}>
                <option value="">Tipo de Ração...</option>
                {(state.feedTypes || []).map(ft => <option key={ft.id} value={ft.id}>{ft.name} (Saldo: {formatNumber(ft.totalStock/1000, 1)}kg)</option>)}
              </select>
              <div className="relative">
                <input type="number" required placeholder="Quantidade (gramas)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-300 uppercase">GRAMAS</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <input type="time" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>

              {editingId && editStockDifference && (
                <div className={`p-3.5 rounded-2xl border text-[11px] leading-relaxed transition-all ${
                  editStockDifference.type === 'return'
                    ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-900'
                    : editStockDifference.type === 'deduct'
                      ? 'bg-amber-50/90 border-amber-200/90 text-amber-900'
                      : editStockDifference.type === 'change_feed'
                        ? 'bg-indigo-50/90 border-indigo-200/90 text-indigo-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="font-black flex items-center gap-1.5 mb-1 uppercase tracking-wider text-[10px]">
                    {editStockDifference.type === 'return' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {editStockDifference.type === 'deduct' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    {editStockDifference.type === 'change_feed' && <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    {editStockDifference.type === 'neutral' && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    <span>Ajuste de Estoque na Edição</span>
                  </div>
                  <p className="font-medium">{editStockDifference.text}</p>
                </div>
              )}

              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {editingId ? 'Salvar Alteração' : 'Registrar Trato'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
            <Eye className="w-10 h-10 text-slate-300" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para registrar novos tratos.</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-[10px] text-blue-900 leading-relaxed">
            <div className="uppercase tracking-wider font-black mb-1.5 text-blue-800">Regras de Estoque no Trato Diário:</div>
            <ul className="space-y-1 font-medium list-disc pl-3.5 text-blue-900/90">
              <li><strong>Novo lançamento:</strong> O saldo lançado é debitado automaticamente do estoque de ração.</li>
              <li><strong>Edição de lançamento:</strong> O estoque é recalculado com a diferença (se diminuir, o saldo retorna ao estoque; se aumentar, a diferença é debitada).</li>
              <li><strong>Exclusão de lançamento:</strong> O saldo lançado não é estornado para o estoque central.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Alimentação</h3>
          <div className="flex items-center gap-2">
            {selectedLogIds.size > 0 && (
              <button 
                onClick={removeSelectedLogs}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-3 h-3" /> Excluir ({selectedLogIds.size})
              </button>
            )}
            <select 
              className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg outline-none border-none"
              value={selectedBatchId}
              onChange={e => {
                setSelectedBatchId(e.target.value);
                setSelectedFilterCageId('');
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todos os Lotes</option>
              {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select 
              className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg outline-none border-none"
              value={selectedFilterCageId}
              onChange={e => {
                setSelectedFilterCageId(e.target.value);
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todas as Gaiolas</option>
              {availableFilterCages.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.model ? `(${c.model})` : ''}
                </option>
              ))}
            </select>
            <select 
              className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg outline-none border-none max-w-[200px]"
              value={selectedFilterFeedTypeId}
              onChange={e => {
                setSelectedFilterFeedTypeId(e.target.value);
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todas as Rações (Modelos)</option>
              {availableFilterFeedTypes.map(ft => (
                <option key={ft.id} value={ft.id}>
                  {ft.name} {ft.hasConsumption ? `(${formatNumber(ft.consumedKg, 1)} kg)` : ''}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
              <input 
                type="date"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
              />
              <span className="text-[9px] font-black text-slate-300">ATÉ</span>
              <input 
                type="date"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
              />
            </div>
            <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
            </button>
          </div>
        </div>

        {/* Quick Filter Chips for Feed Models consumed in the selected batch */}
        {availableFilterFeedTypes.some(ft => ft.hasConsumption) && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Modelos consumidos:</span>
            <button
              onClick={() => {
                setSelectedFilterFeedTypeId('');
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all shrink-0 ${
                !selectedFilterFeedTypeId 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({formatNumber(filteredTotalGrams / 1000, 1)} kg)
            </button>
            {availableFilterFeedTypes.filter(ft => ft.hasConsumption).map(ft => (
              <button
                key={ft.id}
                onClick={() => {
                  setSelectedFilterFeedTypeId(selectedFilterFeedTypeId === ft.id ? '' : ft.id);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedFilterFeedTypeId === ft.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/50'
                }`}
              >
                <span>{ft.name}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${selectedFilterFeedTypeId === ft.id ? 'bg-emerald-700/50 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {formatNumber(ft.consumedKg, 1)} kg
                </span>
              </button>
            ))}
          </div>
        )}

        {(selectedBatchId || selectedFilterCageId || selectedFilterFeedTypeId || startDate || endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] font-bold text-blue-900">
            <div className="flex items-center gap-3">
              <span>
                Filtro ativo: <strong className="font-black text-blue-700">{sortedLogs.length}</strong> registro(s) encontrado(s)
              </span>
              <span className="text-blue-300">|</span>
              <span>
                Consumo total filtrado: <strong className="font-black text-blue-700">{formatNumber(filteredTotalGrams / 1000, 2)} kg</strong> ({formatNumber(filteredTotalGrams)} g)
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedBatchId('');
                setSelectedFilterCageId('');
                setSelectedFilterFeedTypeId('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
              className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 underline transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                {hasPermission && (
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4">Gaiola / Ração</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Qtd</th>
                <th className="px-6 py-4">Lançado por</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const cage = cageMap.get(log.cageId);
                const feed = feedMap.get(log.feedTypeId);
                const user = userMap.get(log.userId);
                const isSelected = selectedLogIds.has(log.id);
                return (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    {hasPermission && (
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-800 uppercase">
                        {cage?.name || '---'} {cage?.model ? `(${cage.model})` : ''}
                      </div>
                      <div className="text-[10px] font-bold text-blue-500 uppercase">{feed?.name || '---'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'dd/MM/yyyy')}</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'HH:mm')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700">{formatNumber(log.amount)}g</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{user ? `@${user.username}` : 'Usuário Excluído'}</td>
                    {hasPermission && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 6 : 4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum trato registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-4">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedingLog;
