
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, FeedingLog as IFeedingLog, User } from '../types';
import { Utensils, Trash2, Edit3, X, ArrowUpDown, Clock, Calendar, AlertTriangle, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const FeedingLog: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [selectedLineId, setSelectedLineId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    feedTypeId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    time: format(new Date(), 'HH:mm')
  });

  useEffect(() => {
    if (!editingId) setFormData(prev => ({ ...prev, cageId: '' }));
  }, [selectedLineId]);

  const sortedLogs = useMemo(() => {
    const logs = Array.isArray(state.feedingLogs) ? [...state.feedingLogs] : [];
    return logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.feedingLogs, sortOrder]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    const amountNum = Number(formData.amount);
    if (!formData.cageId || !formData.feedTypeId || isNaN(amountNum) || amountNum <= 0) {
      alert('Informe uma quantidade válida.');
      return;
    }

    const selectedFeed = state.feedTypes.find(f => f.id === formData.feedTypeId);
    if (!selectedFeed) return;

    if (editingId) {
      const oldLog = state.feedingLogs.find(l => l.id === editingId);
      const updatedLogs = state.feedingLogs.map(l => 
        l.id === editingId ? {
          ...l,
          cageId: formData.cageId,
          feedTypeId: formData.feedTypeId,
          amount: amountNum,
          timestamp: `${formData.date}T${formData.time}:00`,
        } : l
      );

      const updatedFeeds = state.feedTypes.map(f => {
        if (f.id === formData.feedTypeId) {
          const diff = (oldLog?.amount || 0) - amountNum;
          return { ...f, totalStock: f.totalStock + diff };
        }
        return f;
      });

      onUpdate({ ...state, feedingLogs: updatedLogs, feedTypes: updatedFeeds });
      setEditingId(null);
    } else {
      const newLog: IFeedingLog = {
        id: crypto.randomUUID(),
        cageId: formData.cageId,
        feedTypeId: formData.feedTypeId,
        amount: amountNum,
        timestamp: `${formData.date}T${formData.time}:00`,
        userId: currentUser.id
      };
      
      const updatedFeeds = state.feedTypes.map(f => {
        if (f.id === formData.feedTypeId) return { ...f, totalStock: f.totalStock - amountNum };
        return f;
      });

      onUpdate({ 
        ...state, 
        feedingLogs: [newLog, ...(state.feedingLogs || [])], 
        feedTypes: updatedFeeds 
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ cageId: '', feedTypeId: '', amount: '', date: new Date().toISOString().split('T')[0], time: format(new Date(), 'HH:mm') });
  };

  const startEdit = (log: IFeedingLog) => {
    if (!hasPermission) return;
    const cage = state.cages.find(c => c.id === log.cageId);
    if (cage) setSelectedLineId(cage.lineId || '');
    const [d, t] = log.timestamp.split('T');
    setEditingId(log.id);
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
    if (!confirm('Deseja excluir este trato? O estoque será devolvido.')) return;
    const log = state.feedingLogs.find(l => l.id === logId);
    if (!log) return;
    
    const updatedFeeds = state.feedTypes.map(f => 
      f.id === log.feedTypeId ? { ...f, totalStock: f.totalStock + log.amount } : f
    );
    
    onUpdate({ 
      ...state, 
      feedingLogs: state.feedingLogs.filter(l => l.id !== logId), 
      feedTypes: updatedFeeds 
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
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
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)}>
                <option value="">Escolher Linha...</option>
                {state.lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <select required disabled={!selectedLineId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.cageId} onChange={e => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Escolher Gaiola...</option>
                {state.cages.filter(c => c.lineId === selectedLineId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.feedTypeId} onChange={e => setFormData({...formData, feedTypeId: e.target.value})}>
                <option value="">Tipo de Ração...</option>
                {state.feedTypes.map(ft => <option key={ft.id} value={ft.id}>{ft.name} (Saldo: {(ft.totalStock/1000).toFixed(1)}kg)</option>)}
              </select>
              <div className="relative">
                <input type="number" required placeholder="Quantidade (gramas)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 uppercase">GRAMAS</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <input type="time" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
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
          <AlertTriangle className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
            A cada trato registrado, o sistema subtrai automaticamente a quantidade do estoque central de rações.
          </p>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Alimentação</h3>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Gaiola / Ração</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Qtd</th>
                <th className="px-6 py-4">Lançado por</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedLogs.map(log => {
                const cage = state.cages.find(c => c.id === log.cageId);
                const feed = state.feedTypes.find(f => f.id === log.feedTypeId);
                const user = state.users.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-800 uppercase">{cage?.name || '---'}</div>
                      <div className="text-[10px] font-bold text-blue-500 uppercase">{feed?.name || '---'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'dd/MM/yyyy')}</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'HH:mm')}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700">{log.amount}g</td>
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
              {sortedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 5 : 4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum trato registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeedingLog;
