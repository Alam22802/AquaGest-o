
import React, { useState, useMemo } from 'react';
import { Batch, AppState, User } from '../types';
import { Plus, Trash2, Tag, Calendar, Scale, Hash, Edit, X, BookOpen, Eye, TrendingUp, Fish } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const BatchManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    settlementDate: new Date().toISOString().split('T')[0],
    initialQuantity: '',
    initialUnitWeight: '',
    protocolId: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name || !formData.initialQuantity) return;

    if (editingId) {
      const updatedBatches = state.batches.map(b => 
        b.id === editingId ? {
          ...b,
          name: formData.name,
          settlementDate: formData.settlementDate,
          initialQuantity: Number(formData.initialQuantity),
          initialUnitWeight: Number(formData.initialUnitWeight),
          protocolId: formData.protocolId
        } : b
      );
      onUpdate({ ...state, batches: updatedBatches });
      setEditingId(null);
    } else {
      const newBatch: Batch = {
        id: crypto.randomUUID(),
        name: formData.name,
        settlementDate: formData.settlementDate,
        initialQuantity: Number(formData.initialQuantity),
        initialUnitWeight: Number(formData.initialUnitWeight),
        protocolId: formData.protocolId
      };
      onUpdate({ ...state, batches: [...state.batches, newBatch] });
    }

    setFormData({
      name: '',
      settlementDate: new Date().toISOString().split('T')[0],
      initialQuantity: '',
      initialUnitWeight: '',
      protocolId: ''
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
      protocolId: batch.protocolId || ''
    });
  };

  const removeBatch = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir este lote? Isso removerá o vínculo com todas as gaiolas.')) return;
    onUpdate({
      ...state,
      batches: state.batches.filter(b => b.id !== id)
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
            <div className="flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
              {editingId ? 'Editar Lote' : 'Cadastrar Novo Lote'}
            </div>
            {editingId && (
              <button onClick={() => { setEditingId(null); setFormData({name:'', settlementDate: new Date().toISOString().split('T')[0], initialQuantity: '', initialUnitWeight: '', protocolId: ''}); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Identificação do Lote</label>
              <input type="text" required placeholder="Ex: Lote 2024-A" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Modelo de Produção (Protocolo)</label>
              <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.protocolId} onChange={(e) => setFormData({...formData, protocolId: e.target.value})}>
                <option value="">Nenhum modelo selecionado</option>
                {(state.protocols || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.species})</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Data de Povoamento</label>
              <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.settlementDate} onChange={(e) => setFormData({...formData, settlementDate: e.target.value})} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Quantidade Total</label>
              <input type="number" required placeholder="Ex: 10000" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.initialQuantity} onChange={(e) => setFormData({...formData, initialQuantity: e.target.value})} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Peso Médio Inicial (g)</label>
              <input type="number" required placeholder="Ex: 5" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.initialUnitWeight} onChange={(e) => setFormData({...formData, initialUnitWeight: e.target.value})} />
            </div>
            <button type="submit" className={`col-span-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              {editingId ? 'Salvar Lote' : 'Povoar Lote'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <Eye className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Apenas usuários autorizados podem cadastrar ou editar lotes.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.batches.map(batch => {
          const batchCages = state.cages.filter(c => c.batchId === batch.id);
          const cageIds = batchCages.map(c => c.id);
          
          const usedFish = batchCages.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
          const balance = batch.initialQuantity - usedFish;
          
          // Cálculo de Mortalidade e Peixes Vivos
          const mortality = state.mortalityLogs
            .filter(m => cageIds.includes(m.cageId))
            .reduce((acc, curr) => acc + curr.count, 0);
          
          const liveFish = batch.initialQuantity - mortality;
          const yieldPercentage = batch.initialQuantity > 0 ? (liveFish / batch.initialQuantity) * 100 : 0;
          
          const protocol = (state.protocols || []).find(p => p.id === batch.protocolId);
          
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
                <div className="flex items-center justify-between">
                  {protocol ? (
                     <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100">
                       <BookOpen className="w-3 h-3 text-indigo-600" />
                       <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{protocol.name}</span>
                     </div>
                  ) : <div></div>}
                  
                  {/* Rendimento */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Rend: {yieldPercentage.toFixed(1)}%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> Povoamento</span>
                  <span className="text-xs font-black text-slate-700">{format(new Date(batch.settlementDate + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                </div>

                {/* Barra de Progresso do Rendimento */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full transition-all duration-500 ${yieldPercentage > 90 ? 'bg-emerald-500' : (yieldPercentage > 70 ? 'bg-blue-500' : 'bg-amber-500')}`} 
                    style={{ width: `${yieldPercentage}%` }} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Fish className="w-2.5 h-2.5" /> Peixes Vivos
                    </span>
                    <span className="text-lg font-black text-emerald-600 leading-none mt-1">{liveFish} un</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Aloj.</span>
                    <span className={`text-lg font-black mt-1 leading-none ${balance > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{balance} un</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Povoado</span>
                    <span className="text-sm font-black text-slate-700">{batch.initialQuantity} un</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mortalidade</span>
                    <span className="text-sm font-black text-red-500">{mortality} un</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BatchManagement;
