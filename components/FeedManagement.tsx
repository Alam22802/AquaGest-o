
import React, { useState, useMemo } from 'react';
import { AppState, FeedType } from '../types';
import { Plus, Package, TrendingDown, AlertCircle, Calendar, Settings2, Edit, Trash2, X } from 'lucide-react';
import { subDays } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

const FeedManagement: React.FC<Props> = ({ state, onUpdate }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '',
    maxCapacity: '1000',
    minStockPercentage: '20'
  });
  const [entryData, setEntryData] = useState({ 
    feedId: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const handleSaveFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingId) {
      const updatedFeeds = state.feedTypes.map(f => {
        if (f.id === editingId) {
          return {
            ...f,
            name: formData.name,
            maxCapacity: Number(formData.maxCapacity),
            minStockPercentage: Number(formData.minStockPercentage)
          };
        }
        return f;
      });
      onUpdate({ ...state, feedTypes: updatedFeeds });
      setEditingId(null);
    } else {
      const newFeed: FeedType = {
        id: crypto.randomUUID(),
        name: formData.name,
        totalStock: 0,
        maxCapacity: Number(formData.maxCapacity),
        minStockPercentage: Number(formData.minStockPercentage)
      };
      onUpdate({
        ...state,
        feedTypes: [...state.feedTypes, newFeed]
      });
    }
    setFormData({ name: '', maxCapacity: '1000', minStockPercentage: '20' });
  };

  const startEdit = (feed: FeedType) => {
    setEditingId(feed.id);
    setFormData({
      name: feed.name,
      maxCapacity: feed.maxCapacity.toString(),
      minStockPercentage: feed.minStockPercentage.toString()
    });
  };

  const removeFeed = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este modelo de ração?')) return;
    onUpdate({
      ...state,
      feedTypes: state.feedTypes.filter(f => f.id !== id)
    });
  };

  const addStockEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryData.feedId || !entryData.amount) return;

    const updatedFeeds = state.feedTypes.map(f => {
      if (f.id === entryData.feedId) {
        return { ...f, totalStock: f.totalStock + (Number(entryData.amount) * 1000) };
      }
      return f;
    });

    onUpdate({ ...state, feedTypes: updatedFeeds });
    setEntryData({ feedId: '', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  const feedStats = useMemo(() => {
    const last7Days = subDays(new Date(), 7);
    return state.feedTypes.map(feed => {
      const consumptionLast7Days = state.feedingLogs
        .filter(log => log.feedTypeId === feed.id && new Date(log.timestamp) > last7Days)
        .reduce((acc, log) => acc + log.amount, 0);
      const avgDailyConsumption = consumptionLast7Days / 7;
      const daysLeft = avgDailyConsumption > 0 ? Math.floor(feed.totalStock / avgDailyConsumption) : Infinity;
      return { ...feed, avgDaily: avgDailyConsumption, daysLeft };
    });
  }, [state.feedTypes, state.feedingLogs]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6 text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
               {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
               {editingId ? 'Editar Modelo' : 'Novo Modelo de Ração'}
            </div>
            {editingId && (
              <button onClick={() => { setEditingId(null); setFormData({name:'', maxCapacity:'1000', minStockPercentage:'20'}); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>
          <form onSubmit={handleSaveFeed} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Modelo (Ex: 2a3mm)</label>
              <input type="text" required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Capacidade (Kg)</label>
                <input type="number" required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none" value={formData.maxCapacity} onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Alerta Mínimo (%)</label>
                <input type="number" required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none" value={formData.minStockPercentage} onChange={(e) => setFormData({ ...formData, minStockPercentage: e.target.value })} />
              </div>
            </div>
            <button type="submit" className={`w-full ${editingId ? 'bg-amber-600' : 'bg-blue-600'} text-white py-3 rounded-xl font-bold mt-2 shadow-lg`}>
              {editingId ? 'Atualizar Modelo' : 'Cadastrar Modelo'}
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6 text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-500" /> Entrada de Estoque
          </h3>
          <form onSubmit={addStockEntry} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Modelo de Ração</label>
              <select required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={entryData.feedId} onChange={(e) => setEntryData({...entryData, feedId: e.target.value})}>
                <option value="">Selecione...</option>
                {state.feedTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Quantidade (Kg)</label>
                <input type="number" required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none" value={entryData.amount} onChange={(e) => setEntryData({...entryData, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Data</label>
                <input type="date" required className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none" value={entryData.date} onChange={(e) => setEntryData({...entryData, date: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20">
              Registrar Entrada
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 font-bold text-slate-700">
          <Settings2 className="w-5 h-5 text-blue-500" /> Configuração e Status do Estoque
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Capacidade</th>
                <th className="px-6 py-4">Alerta</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feedStats.map(feed => {
                const stockKg = feed.totalStock / 1000;
                const percentage = feed.maxCapacity > 0 ? (stockKg / feed.maxCapacity) * 100 : 0;
                const isCritical = percentage <= feed.minStockPercentage;
                
                return (
                  <tr key={feed.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-800">{feed.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, percentage)}%`}} />
                        </div>
                        <span className={`text-xs font-bold ${isCritical ? 'text-red-600' : 'text-slate-600'}`}>
                          {stockKg.toFixed(0)}kg ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{feed.maxCapacity}kg</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{feed.minStockPercentage}%</td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex justify-center gap-3">
                          <button onClick={() => startEdit(feed)} className="text-slate-400 hover:text-blue-500">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeFeed(feed.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {feedStats.length === 0 && (
            <div className="p-8 text-center text-slate-400">Nenhuma ração cadastrada.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedManagement;
