
import React, { useState, useMemo } from 'react';
import { AppState, FeedType, FeedStockLog, User } from '../types';
import { Plus, Package, TrendingDown, AlertCircle, Calendar, Settings2, Edit, Trash2, X, ArrowUpDown, Clock, User as UserIcon, Filter, CheckSquare, Square } from 'lucide-react';
import { subDays, format, parseISO } from 'date-fns';

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

const FeedManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '',
    maxCapacity: '1000',
    minStockPercentage: '20',
    currentStockKg: '0'
  });

  // Filters and Pagination
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterFeedId, setFilterFeedId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 20;

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [entryData, setEntryData] = useState({ 
    feedId: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const { userMap, feedMap } = useMemo(() => {
    const users = new Map((state.users || []).map(u => [u.id, u]));
    const feeds = new Map((state.feedTypes || []).map(f => [f.id, f]));
    return { userMap: users, feedMap: feeds };
  }, [state.users, state.feedTypes]);

  const handleSaveFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name) return;

    const newStockGrams = Number(formData.currentStockKg) * 1000;

    if (editingId) {
      const oldFeed = (state.feedTypes || []).find(f => f.id === editingId);
      const diff = newStockGrams - (oldFeed?.totalStock || 0);

      const updatedFeeds = (state.feedTypes || []).map(f => {
        if (f.id === editingId) {
          return {
            ...f,
            name: formData.name,
            maxCapacity: Number(formData.maxCapacity),
            minStockPercentage: Number(formData.minStockPercentage),
            totalStock: newStockGrams
          };
        }
        return f;
      });

      const newLogs = [...(state.feedStockLogs || [])];
      if (diff !== 0) {
        newLogs.unshift({
          id: generateId(),
          feedTypeId: editingId,
          amount: diff,
          type: 'Ajuste',
          timestamp: new Date().toISOString(),
          userId: currentUser.id
        });
      }

      onUpdate({ ...state, feedTypes: updatedFeeds, feedStockLogs: newLogs });
      setEditingId(null);
    } else {
      const newId = generateId();
      const newFeed: FeedType = {
        id: newId,
        name: formData.name,
        totalStock: newStockGrams,
        maxCapacity: Number(formData.maxCapacity),
        minStockPercentage: Number(formData.minStockPercentage)
      };

      const newLogs = [...(state.feedStockLogs || [])];
      if (newStockGrams > 0) {
        newLogs.unshift({
          id: generateId(),
          feedTypeId: newId,
          amount: newStockGrams,
          type: 'Entrada',
          timestamp: new Date().toISOString(),
          userId: currentUser.id
        });
      }

      onUpdate({
        ...state,
        feedTypes: [...(state.feedTypes || []), newFeed],
        feedStockLogs: newLogs
      });
    }
    setFormData({ name: '', maxCapacity: '1000', minStockPercentage: '20', currentStockKg: '0' });
  };

  const startEdit = (feed: FeedType) => {
    if (!hasPermission) return;
    setEditingId(feed.id);
    setFormData({
      name: feed.name,
      maxCapacity: feed.maxCapacity.toString(),
      minStockPercentage: feed.minStockPercentage.toString(),
      currentStockKg: (feed.totalStock / 1000).toString()
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFeed = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Tem certeza que deseja excluir este modelo de ração?')) return;
    onUpdate({
      ...state,
      feedTypes: (state.feedTypes || []).filter(f => f.id !== id),
      feedStockLogs: (state.feedStockLogs || []).filter(l => l.feedTypeId !== id)
    });
  };

  const addStockEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!entryData.feedId || !entryData.amount) return;

    const amountGrams = Number(entryData.amount) * 1000;

    const updatedFeeds = (state.feedTypes || []).map(f => {
      if (f.id === entryData.feedId) {
        return { ...f, totalStock: f.totalStock + amountGrams, updatedAt: Date.now() };
      }
      return f;
    });

    const newLog: FeedStockLog = {
      id: generateId(),
      feedTypeId: entryData.feedId,
      amount: amountGrams,
      type: 'Entrada',
      timestamp: `${entryData.date}T${format(new Date(), 'HH:mm:ss')}`,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    onUpdate({ 
      ...state, 
      feedTypes: updatedFeeds, 
      feedStockLogs: [newLog, ...(state.feedStockLogs || [])] 
    });
    setEntryData({ feedId: '', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  const feedStats = useMemo(() => {
    const last7Days = subDays(new Date(), 7);
    return (state.feedTypes || []).map(feed => {
      const consumptionLast7Days = (state.feedingLogs || [])
        .filter(log => log.feedTypeId === feed.id && new Date(log.timestamp) > last7Days)
        .reduce((acc, log) => acc + log.amount, 0);
      const avgDailyConsumption = consumptionLast7Days / 7;
      const daysLeft = avgDailyConsumption > 0 ? Math.floor(feed.totalStock / avgDailyConsumption) : Infinity;
      return { ...feed, avgDaily: avgDailyConsumption, daysLeft };
    });
  }, [state.feedTypes, state.feedingLogs]);

  // Log filtering and sorting
  const filteredLogs = useMemo(() => {
    let logs = Array.isArray(state.feedStockLogs) ? [...state.feedStockLogs] : [];
    
    if (filterFeedId) {
      logs = logs.filter(l => l.feedTypeId === filterFeedId);
    }
    if (startDate) {
      logs = logs.filter(l => l.timestamp.split('T')[0] >= startDate);
    }
    if (endDate) {
      logs = logs.filter(l => l.timestamp.split('T')[0] <= endDate);
    }

    return logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.feedStockLogs, filterFeedId, startDate, endDate, sortOrder]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

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
    if (!confirm(`Deseja excluir ${selectedLogIds.size} lançamentos selecionados? O estoque será ajustado.`)) return;

    const logsToRemove = (state.feedStockLogs || []).filter(l => selectedLogIds.has(l.id));
    
    // Group by feed type to update stock
    const feedUpdates = new Map<string, number>();
    logsToRemove.forEach(log => {
      const current = feedUpdates.get(log.feedTypeId) || 0;
      feedUpdates.set(log.feedTypeId, current + log.amount);
    });

    const updatedFeeds = state.feedTypes.map(f => {
      const adjustment = feedUpdates.get(f.id);
      if (adjustment) return { ...f, totalStock: f.totalStock - adjustment };
      return f;
    });

    onUpdate({
      ...state,
      feedStockLogs: (state.feedStockLogs || []).filter(l => !selectedLogIds.has(l.id)),
      feedTypes: (state.feedTypes || []).map(f => {
        const adjustment = feedUpdates.get(f.id);
        if (adjustment) return { ...f, totalStock: f.totalStock - adjustment };
        return f;
      })
    });
    setSelectedLogIds(new Set());
  };

  return (
    <div className="space-y-8">
      {hasPermission ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                 {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                 {editingId ? 'Editar Modelo' : 'Novo Modelo de Ração'}
              </div>
              {editingId && (
                <button onClick={() => { setEditingId(null); setFormData({name:'', maxCapacity:'1000', minStockPercentage:'20', currentStockKg: '0'}); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </h3>
            <form onSubmit={handleSaveFeed} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Modelo (Ex: 2a3mm)</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Capacidade (Kg)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.maxCapacity} onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Alerta Mínimo (%)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.minStockPercentage} onChange={(e) => setFormData({ ...formData, minStockPercentage: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Saldo Atual (Kg)</label>
                <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/20" value={formData.currentStockKg} onChange={(e) => setFormData({ ...formData, currentStockKg: e.target.value })} />
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight leading-relaxed italic opacity-70">O ajuste manual do saldo gerará um registro de "Ajuste" no histórico.</p>
              </div>
              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {editingId ? 'Atualizar Modelo' : 'Cadastrar Modelo'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
              <Package className="w-5 h-5 text-emerald-500" /> Entrada de Estoque
            </h3>
            <form onSubmit={addStockEntry} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Modelo de Ração</label>
                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={entryData.feedId} onChange={(e) => setEntryData({...entryData, feedId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {(state.feedTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Quantidade (Kg)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={entryData.amount} onChange={(e) => setEntryData({...entryData, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Data</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={entryData.date} onChange={(e) => setEntryData({...entryData, date: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 transition-all active:scale-95">
                Registrar Entrada
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
          <Package className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar modelos ou estoque de ração.</p>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 font-black text-slate-800 uppercase tracking-tighter italic">
          <Settings2 className="w-5 h-5 text-blue-500" /> Configuração e Status do Estoque
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Capacidade</th>
                <th className="px-6 py-4">Alerta</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feedStats.map(feed => {
                const stockKg = feed.totalStock / 1000;
                const percentage = feed.maxCapacity > 0 ? (stockKg / feed.maxCapacity) * 100 : 0;
                const isCritical = percentage <= feed.minStockPercentage;
                
                return (
                  <tr key={feed.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{feed.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, percentage)}%`}} />
                        </div>
                        <span className={`text-[11px] font-black ${isCritical ? 'text-red-600' : 'text-slate-600'}`}>
                          {stockKg.toFixed(1)}kg ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{feed.maxCapacity}kg</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{feed.minStockPercentage}%</td>
                    {hasPermission && (
                      <td className="px-6 py-4 text-center">
                         <div className="flex justify-center gap-2">
                            <button onClick={() => startEdit(feed)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeFeed(feed.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {feedStats.length === 0 && (
            <div className="p-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhuma ração cadastrada.</div>
          )}
        </div>
      </div>

      {/* Histórico de Lançamentos */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Lançamentos (Entradas/Ajustes)</h3>
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
              value={filterFeedId}
              onChange={e => {
                setFilterFeedId(e.target.value);
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todos os Modelos</option>
              {(state.feedTypes || []).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
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
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                {hasPermission && (
                  <th className="px-6 py-4 w-10">
                    <button onClick={toggleSelectAll} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                      {selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
                <th className="px-6 py-4">Tipo / Modelo</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Lançado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const feed = feedMap.get(log.feedTypeId);
                const user = userMap.get(log.userId);
                const isSelected = selectedLogIds.has(log.id);
                const isAdjustment = log.type === 'Ajuste';
                const isNegative = log.amount < 0;

                return (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    {hasPermission && (
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelectLog(log.id)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mb-1 ${isAdjustment ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {log.type}
                      </div>
                      <div className="font-black text-slate-800 uppercase">{feed?.name || '---'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'dd/MM/yyyy')}</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'HH:mm')}</div>
                    </td>
                    <td className={`px-6 py-4 font-black ${isNegative ? 'text-red-600' : 'text-slate-700'}`}>
                      {isNegative ? '' : '+'}{(log.amount / 1000).toFixed(1)}kg
                    </td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">
                      <div className="flex items-center gap-1"><UserIcon className="w-3 h-3 opacity-30" /> @{user?.username || '---'}</div>
                    </td>
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 5 : 4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum lançamento registrado.</td>
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

export default FeedManagement;
