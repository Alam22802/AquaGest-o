
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
  const [formData, setFormData] = useState({
    cageId: '',
    count: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!editingId) setFormData(prev => ({ ...prev, cageId: '' }));
  }, [selectedLineId]);

  const sortedLogs = useMemo(() => {
    return [...state.mortalityLogs].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.mortalityLogs, sortOrder]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
    const cage = state.cages.find(c => c.id === log.cageId);
    if (cage) setSelectedLineId(cage.lineId || '');
    setEditingId(log.id);
    setFormData({ cageId: log.cageId, count: log.count.toString(), date: log.date });
  };

  const removeLog = (id: string) => {
    if (!confirm('Deseja excluir este registro de perda?')) return;
    onUpdate({ ...state, mortalityLogs: state.mortalityLogs.filter(m => m.id !== id) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
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
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Perdas</h3>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Gaiola</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Mortos</th>
                <th className="px-6 py-4">Lançado por</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLogs.map(log => {
                const cage = state.cages.find(c => c.id === log.cageId);
                const user = state.users.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{cage?.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-red-600">{log.count}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">@{user?.username || '---'}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => removeLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MortalityLog;
