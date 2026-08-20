
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, BiometryLog as IBiometryLog, User } from '../types';
import { Scale, Trash2, Edit3, X, ArrowUpDown, Calendar } from 'lucide-react';
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

const BiometryLog: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [formBatchId, setFormBatchId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Table Filters & Pagination
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    averageWeight: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!editingId) {
      setSelectedLineId('');
      setFormData(prev => ({ ...prev, cageId: '' }));
    }
  }, [formBatchId]);

  useEffect(() => {
    if (!editingId) setFormData(prev => ({ ...prev, cageId: '' }));
  }, [selectedLineId]);

  const { cageMap, userMap, lineMap, batchMap } = useMemo(() => {
    const cages = new Map((state.cages || []).map(c => [c.id, c]));
    const users = new Map((state.users || []).map(u => [u.id, u]));
    const lines = new Map((state.lines || []).map(l => [l.id, l]));
    const batches = new Map((state.batches || []).map(b => [b.id, b]));
    return { cageMap: cages, userMap: users, lineMap: lines, batchMap: batches };
  }, [state.cages, state.users, state.lines, state.batches]);

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

  const filteredCages = useMemo(() => {
    if (!formBatchId || !selectedLineId) return [];
    const harvestedCageIds = new Set(
      (state.harvestLogs || [])
        .filter(h => h.batchId === formBatchId)
        .map(h => h.cageId)
    );
    return (state.cages || []).filter(c => 
      c.batchId === formBatchId && 
      c.lineId === selectedLineId && 
      (c.id === formData.cageId || (c.status === 'Ocupada' && !harvestedCageIds.has(c.id)))
    );
  }, [formBatchId, selectedLineId, state.cages, state.harvestLogs, formData.cageId]);

  const sortedLogs = useMemo(() => {
    const logs = Array.isArray(state.biometryLogs) ? state.biometryLogs : [];
    let filtered = logs;

    if (selectedBatchId || startDate || endDate) {
      const sortedHarvestLogs = [...(state.harvestLogs || [])].sort((a, b) => a.date.localeCompare(b.date));

      filtered = logs.filter(log => {
        if (selectedBatchId) {
          let bId = log.batchId;
          const logDate = log.date;

          if (!bId && log.cageId) {
            const cage = cageMap.get(log.cageId);
            if (cage?.batchId) {
              bId = cage.batchId;
            } else {
              const harvest = sortedHarvestLogs.find(h => h.cageId === log.cageId && h.date >= logDate);
              if (harvest) {
                bId = harvest.batchId;
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
  }, [state.biometryLogs, sortOrder, selectedBatchId, startDate, endDate, cageMap, state.harvestLogs]);

  const filteredStats = useMemo(() => {
    if (sortedLogs.length === 0) return { count: 0, avgWeight: 0 };
    const totalWeight = sortedLogs.reduce((acc, log) => acc + (Number(log.averageWeight) || 0), 0);
    return {
      count: sortedLogs.length,
      avgWeight: totalWeight / sortedLogs.length
    };
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
    if (!confirm(`Deseja excluir ${selectedLogIds.size} pesagens selecionadas?`)) return;

    onUpdate({
      ...state,
      biometryLogs: (state.biometryLogs || []).filter(l => !selectedLogIds.has(l.id)),
      deletedIds: [...(state.deletedIds || []), ...Array.from(selectedLogIds)]
    });
    setSelectedLogIds(new Set());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId || !formData.averageWeight) return;

    if (editingId) {
      onUpdate({
        ...state,
        biometryLogs: (state.biometryLogs || []).map(log => 
          log.id === editingId ? { 
            ...log, 
            cageId: formData.cageId, 
            batchId: formBatchId || log.batchId,
            averageWeight: Number(formData.averageWeight), 
            date: formData.date,
            updatedAt: Date.now()
          } : log
        )
      });
      setEditingId(null);
    } else {
      const newLog: IBiometryLog = {
        id: generateId(),
        cageId: formData.cageId,
        batchId: formBatchId,
        averageWeight: Number(formData.averageWeight),
        date: formData.date,
        userId: currentUser.id,
        updatedAt: Date.now()
      };
      onUpdate({ ...state, biometryLogs: [newLog, ...(state.biometryLogs || [])] });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormBatchId('');
    setSelectedLineId('');
    setFormData({ cageId: '', averageWeight: '', date: new Date().toISOString().split('T')[0] });
  };

  const startEdit = (log: IBiometryLog) => {
    if (!hasPermission) return;
    const cage = cageMap.get(log.cageId);
    let bId = log.batchId;
    if (!bId && cage) {
      bId = cage.batchId;
    }
    if (bId) setFormBatchId(bId);
    if (cage?.lineId) setSelectedLineId(cage.lineId);

    setEditingId(log.id);
    setFormData({ cageId: log.cageId, averageWeight: log.averageWeight.toString(), date: log.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir esta pesagem?')) return;
    onUpdate({ 
      ...state, 
      biometryLogs: (state.biometryLogs || []).filter(b => b.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedBatchId('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
    setSelectedLogIds(new Set());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 lg:sticky lg:top-4">
        {hasPermission ? (
          <div className={`bg-white p-6 rounded-3xl border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50 shadow-sm' : 'border-slate-200 shadow-sm'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                <Scale className={`w-5 h-5 ${editingId ? 'text-amber-500' : 'text-blue-500'}`} />
                {editingId ? 'Editar Pesagem' : 'Registrar Pesagem'}
              </div>
              {editingId && <button onClick={resetForm}><X className="w-5 h-5 text-slate-400" /></button>}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formBatchId} onChange={e => setFormBatchId(e.target.value)}>
                <option value="">Lote...</option>
                {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select required disabled={!formBatchId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}>
                <option value="">Linha...</option>
                {filteredLines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select required disabled={!selectedLineId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.cageId} onChange={e => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Gaiola...</option>
                {filteredCages.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" required placeholder="Peso Médio (g)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.averageWeight} onChange={e => setFormData({...formData, averageWeight: e.target.value})} />
              <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {editingId ? 'Salvar Edição' : 'Registrar Biometria'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
            <Scale className="w-10 h-10 text-slate-300" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para registrar biometrias.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Biometria</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Total: <span className="text-blue-600 font-black">{filteredStats.count}</span> pesagens {filteredStats.count > 0 && <span>| Média: <span className="text-blue-600 font-black">{formatNumber(filteredStats.avgWeight, 1)}g</span></span>}
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

            {/* Filtro de Lote */}
            <select 
              className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg outline-none border-none cursor-pointer"
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

            {/* Filtro de Período com Data Início e Fim */}
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
              <input 
                type="date"
                title="Data Início"
                aria-label="Data Início"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none cursor-pointer"
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
                title="Data Fim"
                aria-label="Data Fim"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none cursor-pointer"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
              />
            </div>

            {/* Ordenação */}
            <button 
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
              className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
            </button>
          </div>
        </div>

        {/* Banner de Filtros Ativos */}
        {(selectedBatchId || startDate || endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-blue-50/70 border border-blue-100 rounded-2xl text-[11px] font-bold text-blue-900 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                Filtro ativo: <strong className="font-black text-blue-700">{filteredStats.count}</strong> pesagem(ns)
              </span>
              {selectedBatchId && (
                <>
                  <span className="text-blue-300">|</span>
                  <span>Lote: <strong className="font-black text-blue-700">{batchMap.get(selectedBatchId)?.name || 'Lote Selecionado'}</strong></span>
                </>
              )}
              {(startDate || endDate) && (
                <>
                  <span className="text-blue-300">|</span>
                  <span>Período: <strong className="font-black text-blue-700">{startDate ? format(new Date(startDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Início'} até {endDate ? format(new Date(endDate + 'T12:00:00'), 'dd/MM/yyyy') : 'Hoje'}</strong></span>
                </>
              )}
              {filteredStats.count > 0 && (
                <>
                  <span className="text-blue-300">|</span>
                  <span>Média filtrada: <strong className="font-black text-blue-700">{formatNumber(filteredStats.avgWeight, 1)}g</strong></span>
                </>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 underline transition-colors cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[550px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                {hasPermission && (
                  <th className="px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="px-6 py-4">Gaiola / Lote</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Peso Médio (g)</th>
                <th className="px-6 py-4">Lançado por</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const cage = cageMap.get(log.cageId);
                const line = cage?.lineId ? lineMap.get(cage.lineId) : null;
                const batch = log.batchId ? batchMap.get(log.batchId) : (cage?.batchId ? batchMap.get(cage.batchId) : null);
                const user = userMap.get(log.userId);
                const isSelected = selectedLogIds.has(log.id);
                return (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''}`}>
                    {hasPermission && (
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectLog(log.id)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-800 uppercase">{cage?.name || 'Gaiola Excluída'}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {batch ? batch.name : 'Sem lote'} {line ? `• ${line.name}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-blue-600">{formatNumber(log.averageWeight)}g</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">{user ? `@${user.username}` : 'Usuário Excluído'}</td>
                    {hasPermission && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer" title="Editar"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 6 : 5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">
                    Nenhum registro de biometria encontrado.
                  </td>
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
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Anterior
            </button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BiometryLog;
