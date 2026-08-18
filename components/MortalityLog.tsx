
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, MortalityLog as IMortalityLog, User } from '../types';
import { FishOff, Trash2, Edit3, X, ArrowUpDown, Calendar, CheckCircle2, Layers, Check, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
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

const MortalityLog: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  // Form State
  const [formBatchId, setFormBatchId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [cageCounts, setCageCounts] = useState<Record<string, string>>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit Single Log State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    cageId: '',
    batchId: '',
    count: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Table Filters & Pagination
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedFilterLineId, setSelectedFilterLineId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  // Reset cage inputs when batch or line changes
  useEffect(() => {
    if (!editingId) {
      setCageCounts({});
    }
  }, [formBatchId, selectedLineId, editingId]);

  // Reset line selection when batch changes
  useEffect(() => {
    if (!editingId) {
      setSelectedLineId('');
      setCageCounts({});
    }
  }, [formBatchId, editingId]);

  // Lines available for the selected batch
  const filteredLines = useMemo(() => {
    if (!formBatchId) return [];
    const harvestedCageIds = new Set(
      (state.harvestLogs || [])
        .filter(h => h.batchId === formBatchId)
        .map(h => h.cageId)
    );
    const lineIdsInBatch = new Set(
      (state.cages || [])
        .filter(c => c.batchId === formBatchId && c.status === 'Ocupada' && !harvestedCageIds.has(c.id))
        .map(c => c.lineId)
    );
    return (state.lines || []).filter(l => lineIdsInBatch.has(l.id));
  }, [formBatchId, state.cages, state.lines, state.harvestLogs]);

  // Cages available for the selected batch and line
  const filteredCages = useMemo(() => {
    if (!formBatchId || !selectedLineId) return [];
    const harvestedCageIds = new Set(
      (state.harvestLogs || [])
        .filter(h => h.batchId === formBatchId)
        .map(h => h.cageId)
    );
    return (state.cages || [])
      .filter(c => 
        c.batchId === formBatchId && 
        c.lineId === selectedLineId && 
        c.status === 'Ocupada' && 
        !harvestedCageIds.has(c.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [formBatchId, selectedLineId, state.cages, state.harvestLogs]);

  const { cageMap, userMap, lineMap } = useMemo(() => {
    const cages = new Map((state.cages || []).map(c => [c.id, c]));
    const users = new Map((state.users || []).map(u => [u.id, u]));
    const lines = new Map((state.lines || []).map(l => [l.id, l]));
    return { cageMap: cages, userMap: users, lineMap: lines };
  }, [state.cages, state.users, state.lines]);

  // Calculations for mass entry
  const { totalEnteredCount, totalCagesFilled } = useMemo(() => {
    let countSum = 0;
    let filledCount = 0;
    Object.values(cageCounts).forEach(val => {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) {
        countSum += num;
        filledCount += 1;
      }
    });
    return { totalEnteredCount: countSum, totalCagesFilled: filledCount };
  }, [cageCounts]);

  const handleCageCountChange = (cageId: string, value: string) => {
    if (value === '' || /^\d+$/.test(value)) {
      setCageCounts(prev => ({
        ...prev,
        [cageId]: value
      }));
    }
  };

  const handleMassSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formBatchId) {
      setFeedbackMessage({ text: 'Por favor, selecione um lote.', type: 'error' });
      return;
    }
    if (!formDate) {
      setFeedbackMessage({ text: 'Por favor, selecione a data do lançamento.', type: 'error' });
      return;
    }
    if (!selectedLineId) {
      setFeedbackMessage({ text: 'Por favor, selecione uma linha.', type: 'error' });
      return;
    }

    const newLogs: IMortalityLog[] = [];
    filteredCages.forEach(cage => {
      const rawCount = cageCounts[cage.id];
      const count = parseInt(rawCount, 10);
      if (!isNaN(count) && count > 0) {
        newLogs.push({
          id: generateId(),
          cageId: cage.id,
          batchId: formBatchId,
          count,
          date: formDate,
          userId: currentUser.id,
          updatedAt: Date.now()
        });
      }
    });

    if (newLogs.length === 0) {
      setFeedbackMessage({ text: 'Informe a quantidade de perdas em pelo menos uma gaiola.', type: 'error' });
      return;
    }

    onUpdate({
      ...state,
      mortalityLogs: [...newLogs, ...(state.mortalityLogs || [])]
    });

    setFeedbackMessage({
      text: `${newLogs.length} registro(s) salvo(s) com sucesso (${formatNumber(totalEnteredCount)} peixes no total)!`,
      type: 'success'
    });

    // Reset cage counts while keeping batch, date and line for quick follow-up entry
    setCageCounts({});
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleSingleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission || !editingId) return;
    if (!editFormData.cageId || !editFormData.count) return;

    onUpdate({
      ...state,
      mortalityLogs: (state.mortalityLogs || []).map(m => 
        m.id === editingId ? {
          ...m,
          cageId: editFormData.cageId,
          batchId: editFormData.batchId,
          count: Number(editFormData.count),
          date: editFormData.date,
          updatedAt: Date.now()
        } : m
      )
    });

    setEditingId(null);
    setFeedbackMessage({ text: 'Registro atualizado com sucesso!', type: 'success' });
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const startEdit = (log: IMortalityLog) => {
    if (!hasPermission) return;
    
    let bId = log.batchId;
    const cage = cageMap.get(log.cageId);
    const mDate = log.date;

    if (!bId && cage) {
      const sortedHarvestLogs = [...(state.harvestLogs || [])].sort((a, b) => a.date.localeCompare(b.date));
      const harvest = sortedHarvestLogs.find(h => h.cageId === log.cageId && h.date >= mDate);
      if (harvest) {
        bId = harvest.batchId;
      } else if (cage.batchId) {
        const batch = (state.batches || []).find(b => b.id === cage.batchId);
        const cageSettlement = cage.settlementDate || batch?.settlementDate;
        if (cageSettlement && mDate >= cageSettlement) {
          bId = cage.batchId;
        }
      }
    }

    setEditingId(log.id);
    setEditFormData({
      cageId: log.cageId,
      batchId: bId || '',
      count: log.count.toString(),
      date: log.date
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const removeLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de perda?')) return;
    onUpdate({ 
      ...state, 
      mortalityLogs: (state.mortalityLogs || []).filter(m => m.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const sortedLogs = useMemo(() => {
    const logs = Array.isArray(state.mortalityLogs) ? state.mortalityLogs : [];
    let filtered = logs;
    
    if (selectedBatchId || selectedFilterLineId || startDate || endDate) {
      const sortedHarvestLogs = [...(state.harvestLogs || [])].sort((a, b) => a.date.localeCompare(b.date));
      
      filtered = logs.filter(log => {
        const cage = cageMap.get(log.cageId);

        if (selectedFilterLineId && cage?.lineId !== selectedFilterLineId) {
          return false;
        }

        if (selectedBatchId) {
          let bId = log.batchId;
          const mDate = log.date;

          if (!bId && log.cageId) {
            if (cage?.batchId) {
              const batch = (state.batches || []).find(b => b.id === cage.batchId);
              const cageSettlement = cage.settlementDate || batch?.settlementDate;
              if (cageSettlement && mDate >= cageSettlement) {
                bId = cage.batchId;
              }
            }
            if (!bId) {
              const harvest = sortedHarvestLogs.find(h => h.cageId === log.cageId && h.date >= mDate);
              if (harvest) {
                const hBatch = (state.batches || []).find(b => b.id === harvest.batchId);
                if (!hBatch?.settlementDate || mDate >= hBatch.settlementDate) {
                  bId = harvest.batchId;
                }
              }
            }
          }
          if (bId !== selectedBatchId) return false;
        }
        if (startDate && log.date < startDate) return false;
        if (endDate && log.date > endDate) return false;
        return true;
      });
    }

    return [...filtered].sort((a, b) => {
      return sortOrder === 'desc' 
        ? b.date.localeCompare(a.date) 
        : a.date.localeCompare(b.date);
    });
  }, [state.mortalityLogs, sortOrder, selectedBatchId, selectedFilterLineId, startDate, endDate, cageMap, state.harvestLogs, state.batches]);

  const filteredTotalMortality = useMemo(() => {
    return sortedLogs.reduce((acc, log) => acc + (log.count || 0), 0);
  }, [sortedLogs]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage]);

  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);

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
    if (!confirm(`Deseja excluir ${selectedLogIds.size} registros de perda selecionados?`)) return;

    onUpdate({
      ...state,
      mortalityLogs: (state.mortalityLogs || []).filter(l => !selectedLogIds.has(l.id)),
      deletedIds: [...(state.deletedIds || []), ...Array.from(selectedLogIds)]
    });
    setSelectedLogIds(new Set());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      {/* Coluna de Registro / Formulário */}
      <div className="lg:col-span-1 lg:sticky lg:top-4">
        {hasPermission ? (
          <div className={`bg-white p-6 rounded-3xl border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50 shadow-sm' : 'border-slate-200 shadow-sm'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                <FishOff className={`w-5 h-5 ${editingId ? 'text-amber-500' : 'text-red-500'}`} />
                {editingId ? 'Editar Perda' : 'Lançar Perdas em Massa'}
              </div>
              {editingId && (
                <button onClick={cancelEdit} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </h3>

            {feedbackMessage && (
              <div className={`mb-4 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            {editingId ? (
              /* Formulário de Edição Individual */
              <form onSubmit={handleSingleEditSave} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Lote</label>
                  <select 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" 
                    value={editFormData.batchId} 
                    onChange={e => setEditFormData({ ...editFormData, batchId: e.target.value })}
                  >
                    <option value="">Escolher Lote...</option>
                    {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Gaiola</label>
                  <select 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" 
                    value={editFormData.cageId} 
                    onChange={e => setEditFormData({ ...editFormData, cageId: e.target.value })}
                  >
                    <option value="">Escolher Gaiola...</option>
                    {(state.cages || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Quantidade de Mortos</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="Quantidade" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" 
                    value={editFormData.count} 
                    onChange={e => setEditFormData({ ...editFormData, count: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" 
                    value={editFormData.date} 
                    onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} 
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={cancelEdit} 
                    className="w-1/3 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-600/20 transition-all active:scale-95"
                  >
                    Salvar Edição
                  </button>
                </div>
              </form>
            ) : (
              /* Formulário de Lançamento em Massa por Linha */
              <form onSubmit={handleMassSave} className="space-y-4">
                {/* 1. Seleção do Lote */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    1. Escolha o Lote
                  </label>
                  <select 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                    value={formBatchId} 
                    onChange={e => setFormBatchId(e.target.value)}
                  >
                    <option value="">Selecione o Lote...</option>
                    {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Escolha da Data de Lançamento */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    2. Data do Lançamento
                  </label>
                  <input 
                    type="date" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                    value={formDate} 
                    onChange={e => setFormDate(e.target.value)} 
                  />
                </div>

                {/* 3. Seleção da Linha */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    3. Escolha a Linha
                  </label>
                  <select 
                    required 
                    disabled={!formBatchId} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all disabled:opacity-50" 
                    value={selectedLineId} 
                    onChange={e => setSelectedLineId(e.target.value)}
                  >
                    <option value="">{formBatchId ? 'Selecione a Linha...' : 'Primeiro selecione o Lote'}</option>
                    {filteredLines.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Lista de Gaiolas da Linha com campos de quantidade */}
                {selectedLineId && (
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-red-500" />
                        Gaiolas da Linha ({filteredCages.length})
                      </label>
                      {totalCagesFilled > 0 && (
                        <button
                          type="button"
                          onClick={() => setCageCounts({})}
                          className="text-[9px] font-black uppercase text-slate-400 hover:text-red-600 transition-colors"
                        >
                          Limpar tudo
                        </button>
                      )}
                    </div>

                    {filteredCages.length > 0 ? (
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                        {filteredCages.map(cage => {
                          const val = cageCounts[cage.id] || '';
                          const isFilled = parseInt(val, 10) > 0;
                          return (
                            <div 
                              key={cage.id} 
                              className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                                isFilled 
                                  ? 'bg-red-50/60 border-red-200 shadow-sm' 
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg ${
                                  isFilled ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {cage.name}
                                </span>
                                <div className="text-[10px] font-bold text-slate-400 truncate">
                                  {cage.initialFishCount ? `${formatNumber(cage.initialFishCount)} peixes` : 'Gaiola ativa'}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <input 
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  placeholder="0" 
                                  className={`w-20 px-3 py-2 text-center font-black text-sm rounded-xl outline-none border transition-all ${
                                    isFilled 
                                      ? 'bg-white border-red-400 text-red-700 ring-2 ring-red-500/20' 
                                      : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-red-500'
                                  }`}
                                  value={val}
                                  onChange={e => handleCageCountChange(cage.id, e.target.value)}
                                />
                                <span className="text-[10px] font-black text-slate-400">un</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                        <p className="text-xs font-bold text-amber-800">
                          Nenhuma gaiola ocupada encontrada nesta linha para o lote selecionado.
                        </p>
                      </div>
                    )}

                    {/* Resumo e Botão de Salvar em Massa */}
                    {filteredCages.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="bg-slate-100 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>Total da Linha:</span>
                          <span className="font-black text-red-600 text-sm">
                            {formatNumber(totalEnteredCount)} mortos <span className="text-[10px] text-slate-500 font-bold">({totalCagesFilled} gaiola{totalCagesFilled === 1 ? '' : 's'})</span>
                          </span>
                        </div>

                        <button 
                          type="submit" 
                          disabled={totalEnteredCount === 0}
                          className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Confirmar Lançamentos ({totalEnteredCount} peixes)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        ) : (
          <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
            <FishOff className="w-10 h-10 text-slate-300" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para registrar perdas.</p>
          </div>
        )}
      </div>

      {/* Coluna da Tabela de Histórico */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Perdas</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Total filtrado: <span className="text-red-600 font-black">{formatNumber(filteredTotalMortality)}</span> peixes em <span className="text-slate-700 font-black">{sortedLogs.length}</span> lançamentos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              value={selectedFilterLineId}
              onChange={e => {
                setSelectedFilterLineId(e.target.value);
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todas as Linhas</option>
              {(state.lines || []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
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

        {(selectedBatchId || selectedFilterLineId || startDate || endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-red-50/70 border border-red-100 rounded-2xl text-[11px] font-bold text-red-900">
            <div className="flex items-center gap-3">
              <span>
                Filtro ativo: <strong className="font-black text-red-700">{sortedLogs.length}</strong> registro(s)
              </span>
              <span className="text-red-300">|</span>
              <span>
                Perda total filtrada: <strong className="font-black text-red-700">{formatNumber(filteredTotalMortality)} peixes</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedBatchId('');
                setSelectedFilterLineId('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
              className="text-[10px] font-black uppercase text-red-600 hover:text-red-800 underline transition-colors"
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
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      checked={selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4">Gaiola</th>
                <th className="px-6 py-4">Linha</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Mortos</th>
                <th className="px-6 py-4">Lançado por</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const cage = cageMap.get(log.cageId);
                const line = cage?.lineId ? lineMap.get(cage.lineId) : null;
                const user = userMap.get(log.userId);
                const isSelected = selectedLogIds.has(log.id);
                return (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}>
                    {hasPermission && (
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{cage?.name || 'Gaiola Excluída'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{line?.name || '---'}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-red-600">{formatNumber(log.count)} un</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{user ? `@${user.username}` : 'Usuário Excluído'}</td>
                    {hasPermission && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Editar"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 7 : 5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum registro de perda.</td>
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

export default MortalityLog;

