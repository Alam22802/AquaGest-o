
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, MortalityLog as IMortalityLog, User } from '../types';
import { FishOff, Trash2, Edit3, X, ArrowUpDown, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const MortalityLog: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 50;

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    count: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!editingId) setFormData(prev => ({ ...prev, cageId: '' }));
  }, [selectedLineId]);

  const { cageMap, userMap } = useMemo(() => {
    const cages = new Map(state.cages.map(c => [c.id, c]));
    const users = new Map(state.users.map(u => [u.id, u]));
    return { cageMap: cages, userMap: users };
  }, [state.cages, state.users]);

  const sortedLogs = useMemo(() => {
    const logs = Array.isArray(state.mortalityLogs) ? state.mortalityLogs : [];
    let filtered = logs;
    
    if (selectedBatchId || startDate || endDate) {
      filtered = logs.filter(log => {
        if (selectedBatchId) {
          const cage = cageMap.get(log.cageId);
          if (cage?.batchId !== selectedBatchId) return false;
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
  }, [state.mortalityLogs, sortOrder, selectedBatchId, startDate, endDate, cageMap]);

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
      mortalityLogs: state.mortalityLogs.filter(l => !selectedLogIds.has(l.id))
    });
    setSelectedLogIds(new Set());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId || !formData.count) return;

    if (editingId) {
      onUpdate({
        ...state,
        mortalityLogs: state.mortalityLogs.map(m => m.id === editingId ? { ...m, cageId: formData.cageId, count: Number(formData.count), date: formData.date } : m)
      });
      setEditingId(null);
    } else {
      const newLog: IMortalityLog = {
        id: crypto.randomUUID(),
        cageId: formData.cageId,
        count: Number(formData.count),
        date: formData.date,
        userId: currentUser.id
      };
      onUpdate({ ...state, mortalityLogs: [newLog, ...state.mortalityLogs] });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ cageId: '', count: '', date: new Date().toISOString().split('T')[0] });
  };

  const startEdit = (log: IMortalityLog) => {
    if (!hasPermission) return;
    const cage = cageMap.get(log.cageId);
    if (cage) setSelectedLineId(cage.lineId || '');
    setEditingId(log.id);
    setFormData({ cageId: log.cageId, count: log.count.toString(), date: log.date });
  };

  const removeLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de perda?')) return;
    onUpdate({ ...state, mortalityLogs: state.mortalityLogs.filter(m => m.id !== id) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 sticky top-4">
        {hasPermission ? (
          <div className={`bg-white p-6 rounded-3xl border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50 shadow-sm' : 'border-slate-200 shadow-sm'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                <FishOff className={`w-5 h-5 ${editingId ? 'text-amber-500' : 'text-red-500'}`} />
                {editingId ? 'Editar Perda' : 'Registrar Perda'}
              </div>
              {editingId && <button onClick={resetForm}><X className="w-5 h-5 text-slate-400" /></button>}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}>
                <option value="">Escolher Linha...</option>
                {state.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select required disabled={!selectedLineId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.cageId} onChange={e => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Escolher Gaiola...</option>
                {state.cages.filter(c => c.lineId === selectedLineId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" required placeholder="Quantidade" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.count} onChange={e => setFormData({...formData, count: e.target.value})} />
              <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-red-600 shadow-red-600/20'}`}>
                {editingId ? 'Salvar Edição' : 'Confirmar Registro'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
            <FishOff className="w-10 h-10 text-slate-300" />
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para registrar perdas.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Perdas</h3>
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
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todos os Lotes</option>
              {state.batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
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
                <th className="px-6 py-4">Gaiola</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Mortos</th>
                <th className="px-6 py-4">Lançado por</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const cage = cageMap.get(log.cageId);
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
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{cage?.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-red-600">{log.count}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">@{user?.username || '---'}</td>
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
                  <td colSpan={hasPermission ? 6 : 4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum registro de perda.</td>
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
