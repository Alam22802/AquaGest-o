
import React, { useState, useMemo } from 'react';
import { AppState, FeedType, FeedStockLog, User } from '../types';
import { Plus, Package, TrendingDown, AlertCircle, Calendar, Settings2, Edit, Trash2, X, ArrowUpDown, Clock, User as UserIcon, Filter, CheckSquare, Square, Info, FileText } from 'lucide-react';
import { subDays, format, parseISO } from 'date-fns';
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

const FeedManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'recommended'>('stock');
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

  const createEmptyRows = (count: number, startWeek: number) => {
    return Array.from({ length: count }, (_, i) => ({
      week: startWeek + i,
      averageWeight: 0,
      gpd: 0,
      feedPercentagePV: 0,
      feedingsPerDay: 3,
      feedTypeId: ''
    }));
  };

  const [tableFormData, setTableFormData] = useState({
    name: '',
    recriaInicial: createEmptyRows(3, 1),
    recriaFinal: createEmptyRows(4, 4),
    crescimento: createEmptyRows(5, 8),
    terminacao: createEmptyRows(14, 13)
  });

  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const [calcData, setCalcData] = useState({
    fishCount: '1000',
    currentWeek: '1',
    averageWeight: '',
    selectedTableId: '',
    calculationDays: '1'
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
      feedStockLogs: (state.feedStockLogs || []).filter(l => l.feedTypeId !== id),
      deletedIds: [...(state.deletedIds || []), id, ...(state.feedStockLogs || []).filter(l => l.feedTypeId === id).map(l => l.id)]
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

  const handleSaveFeedingTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!tableFormData.name) return;

    const newTable = {
      ...tableFormData,
      id: editingTableId || generateId(),
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedTables = editingTableId
      ? (state.feedingTables || []).map(t => t.id === editingTableId ? newTable : t)
      : [newTable, ...(state.feedingTables || [])];

    onUpdate({ ...state, feedingTables: updatedTables });
    setEditingTableId(null);
    setTableFormData({
      name: '',
      recriaInicial: createEmptyRows(3, 1),
      recriaFinal: createEmptyRows(4, 4),
      crescimento: createEmptyRows(5, 8),
      terminacao: createEmptyRows(14, 13)
    });
  };

  const removeFeedingTable = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir esta tabela de trato?')) return;
    onUpdate({
      ...state,
      feedingTables: (state.feedingTables || []).filter(t => t.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const startEditTable = (table: any) => {
    if (!hasPermission) return;
    setEditingTableId(table.id);
    setTableFormData({
      name: table.name,
      recriaInicial: table.recriaInicial,
      recriaFinal: table.recriaFinal,
      crescimento: table.crescimento,
      terminacao: table.terminacao
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateRow = (phase: 'recriaInicial' | 'recriaFinal' | 'crescimento' | 'terminacao', index: number, field: string, value: string) => {
    const finalValue = field === 'feedTypeId' ? value : Number(value);
    const newPhases = { ...tableFormData };
    newPhases[phase][index] = { ...newPhases[phase][index], [field]: finalValue };
    setTableFormData(newPhases);
  };

  const calculatedFeed = useMemo(() => {
    if (!calcData.selectedTableId || !calcData.currentWeek || !calcData.fishCount) return 0;
    
    const table = (state.feedingTables || []).find(t => t.id === calcData.selectedTableId);
    if (!table) return 0;

    const week = Number(calcData.currentWeek);
    const fishCount = Number(calcData.fishCount);
    
    // Find the row for the given week
    const allRows = [
      ...table.recriaInicial,
      ...table.recriaFinal,
      ...table.crescimento,
      ...table.terminacao
    ];
    
    const row = allRows.find(r => r.week === week);
    if (!row) return 0;

    // If user provided a specific average weight, use it, otherwise use the table's weight
    const weight = calcData.averageWeight ? Number(calcData.averageWeight) : row.averageWeight;
    
    // Feed Amount (kg) = (Fish Count * Weight (g) / 1000) * (Feed % PV / 100)
    const dailyFeed = (fishCount * weight / 1000) * (row.feedPercentagePV / 100);
    const days = Number(calcData.calculationDays) || 1;
    return dailyFeed * days;
  }, [calcData, state.feedingTables]);

  return (
    <div className="space-y-8">
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-4">
        <button
          onClick={() => setActiveSubTab('stock')}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Estoque de Ração
        </button>
        <button
          onClick={() => setActiveSubTab('recommended')}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'recommended' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Trato Indicado
        </button>
      </div>

      {activeSubTab === 'stock' ? (
        <React.Fragment>
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
                          {formatNumber(stockKg, 1)}kg ({formatNumber(percentage, 0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatNumber(feed.maxCapacity)}kg</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatNumber(feed.minStockPercentage)}%</td>
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
                      {isNegative ? '' : '+'}{formatNumber(log.amount / 1000, 1)}kg
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
    </React.Fragment>
  ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Calculator Section */}
          <div className="bg-[#344434] p-8 rounded-[2.5rem] shadow-2xl text-[#e4e4d4]">
            <h3 className="text-lg font-black mb-8 flex items-center gap-3 uppercase tracking-tighter italic text-white">
              <TrendingDown className="w-6 h-6 text-blue-400" />
              Calculadora de Trato
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-black text-[#e4e4d4]/60 uppercase mb-2 tracking-widest">Tabela de Referência</label>
                <select
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-white"
                  value={calcData.selectedTableId}
                  onChange={(e) => setCalcData({ ...calcData, selectedTableId: e.target.value })}
                >
                  <option value="" className="bg-[#344434]">Selecione uma tabela...</option>
                  {(state.feedingTables || []).map(t => <option key={t.id} value={t.id} className="bg-[#344434]">{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#e4e4d4]/60 uppercase mb-2 tracking-widest">Quantidade de Peixes</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-white"
                  value={calcData.fishCount}
                  onChange={(e) => setCalcData({ ...calcData, fishCount: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#e4e4d4]/60 uppercase mb-2 tracking-widest">Semana Atual</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-white"
                  value={calcData.currentWeek}
                  onChange={(e) => setCalcData({ ...calcData, currentWeek: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#e4e4d4]/60 uppercase mb-2 tracking-widest">Peso Médio (g)</label>
                <div className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-2xl font-bold text-sm text-blue-400 flex items-center">
                  {calcData.selectedTableId ? (
                    (() => {
                      const table = (state.feedingTables || []).find(t => t.id === calcData.selectedTableId);
                      const allRows = table ? [...table.recriaInicial, ...table.recriaFinal, ...table.crescimento, ...table.terminacao] : [];
                      const row = allRows.find(r => r.week === Number(calcData.currentWeek));
                      return row ? `${formatNumber(row.averageWeight, 1)}g` : '---';
                    })()
                  ) : '---'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#e4e4d4]/60 uppercase mb-2 tracking-widest">Dias para Cálculo</label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20 text-white"
                  value={calcData.calculationDays}
                  onChange={(e) => setCalcData({ ...calcData, calculationDays: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-600 rounded-2xl shadow-lg">
                  <Package className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#e4e4d4]/60 uppercase tracking-widest">Quantidade de Ração Estimada</p>
                  <h4 className="text-3xl font-black italic text-white">
                    {formatNumber(calculatedFeed, 2)} kg 
                    <span className="text-sm not-italic opacity-60 ml-2">
                      / {calcData.calculationDays === '1' ? 'dia' : `${calcData.calculationDays} dias`}
                    </span>
                  </h4>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-[#e4e4d4]/60 uppercase tracking-widest">Baseado na % PV da Tabela</p>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-white">
                    {calcData.selectedTableId ? (
                      (() => {
                        const table = (state.feedingTables || []).find(t => t.id === calcData.selectedTableId);
                        const allRows = table ? [...table.recriaInicial, ...table.recriaFinal, ...table.crescimento, ...table.terminacao] : [];
                        const row = allRows.find(r => r.week === Number(calcData.currentWeek));
                        return row ? `${formatNumber(row.feedPercentagePV, 2)}% PV` : 'Semana não encontrada';
                      })()
                    ) : 'Selecione uma tabela'}
                  </p>
                  {calcData.selectedTableId && (
                    <div className="bg-blue-600/20 px-4 py-2 rounded-xl border border-blue-500/30">
                      <p className="text-xs font-black text-blue-400 uppercase tracking-widest">
                        {(() => {
                          const table = (state.feedingTables || []).find(t => t.id === calcData.selectedTableId);
                          const allRows = table ? [...table.recriaInicial, ...table.recriaFinal, ...table.crescimento, ...table.terminacao] : [];
                          const row = allRows.find(r => r.week === Number(calcData.currentWeek));
                          if (row) {
                            const feed = feedMap.get(row.feedTypeId || '');
                            return feed ? `Ração Indicada: ${feed.name}` : 'Ração não definida para esta semana';
                          }
                          return '';
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {hasPermission ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter italic">
                <Settings2 className="w-6 h-6 text-blue-500" />
                {editingTableId ? 'Editar Tabela de Trato' : 'Nova Tabela de Trato Indicado'}
              </h3>
              <form onSubmit={handleSaveFeedingTable} className="space-y-10">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nome da Tabela</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tilápia Ciclo Verão"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={tableFormData.name}
                      onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Phases */}
                {[
                  { id: 'recriaInicial' as const, label: 'RECRIA INICIAL', rows: 3 },
                  { id: 'recriaFinal' as const, label: 'RECRIA FINAL', rows: 4 },
                  { id: 'crescimento' as const, label: 'CRESCIMENTO', rows: 5 },
                  { id: 'terminacao' as const, label: 'TERMINAÇÃO', rows: 14 }
                ].map(phase => (
                  <div key={phase.id} className="space-y-4">
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-l-4 border-blue-600 pl-3">{phase.label}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-2 py-2 w-24">Semana</th>
                            <th className="px-2 py-2">Ração</th>
                            <th className="px-2 py-2">Peso Médio (g)</th>
                            <th className="px-2 py-2">GPD (g/dia)</th>
                            <th className="px-2 py-2">Trato Diário (% PV)</th>
                            <th className="px-2 py-2">Tratos/Dia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tableFormData[phase.id].map((row: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-2 py-2 w-24">
                                <input
                                  type="number"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.week}
                                  onChange={(e) => updateRow(phase.id, idx, 'week', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-[10px] outline-none"
                                  value={row.feedTypeId || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'feedTypeId', e.target.value)}
                                >
                                  <option value="">Selecione...</option>
                                  {(state.feedTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.averageWeight || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'averageWeight', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.gpd || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'gpd', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none pr-6"
                                    value={row.feedPercentagePV || ''}
                                    onChange={(e) => updateRow(phase.id, idx, 'feedPercentagePV', e.target.value)}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.feedingsPerDay || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'feedingsPerDay', e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-4">
                  {editingTableId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTableId(null);
                        setTableFormData({
                          name: '',
                          recriaInicial: createEmptyRows(3, 1),
                          recriaFinal: createEmptyRows(4, 4),
                          crescimento: createEmptyRows(5, 8),
                          terminacao: createEmptyRows(14, 13)
                        });
                      }}
                      className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    {editingTableId ? 'Atualizar Tabela' : 'Salvar Tabela'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
              <Info className="w-10 h-10 text-slate-300" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar tabelas de trato.</p>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Tabelas de Trato Cadastradas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nome da Tabela</th>
                    <th className="px-6 py-4">Total Semanas</th>
                    <th className="px-6 py-4">Última Atualização</th>
                    {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.feedingTables || []).map(table => {
                    const totalWeeks = table.terminacao.length > 0 ? table.terminacao[table.terminacao.length - 1].week : 0;
                    return (
                      <tr key={table.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800 uppercase">{table.name}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">{totalWeeks} semanas</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400">
                          {table.updatedAt ? format(table.updatedAt, 'dd/MM/yyyy HH:mm') : '---'}
                        </td>
                        {hasPermission && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditTable(table)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeFeedingTable(table.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {(state.feedingTables || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhuma tabela cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedManagement;
