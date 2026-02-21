
import React, { useState } from 'react';
import { ProductionProtocol, AppState } from '../types';
import { Plus, BookOpen, Trash2, Edit, X, Target, Clock, Activity } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

const ProtocolManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    targetWeight: '',
    expectedFca: '',
    estimatedDays: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name || !formData.species) return;

    if (editingId) {
      onUpdate({
        ...state,
        protocols: state.protocols.map(p => p.id === editingId ? {
          ...p,
          name: formData.name,
          species: formData.species,
          targetWeight: Number(formData.targetWeight),
          expectedFca: Number(formData.expectedFca),
          estimatedDays: Number(formData.estimatedDays)
        } : p)
      });
      setEditingId(null);
    } else {
      const newProtocol: ProductionProtocol = {
        id: crypto.randomUUID(),
        name: formData.name,
        species: formData.species,
        targetWeight: Number(formData.targetWeight),
        expectedFca: Number(formData.expectedFca),
        estimatedDays: Number(formData.estimatedDays)
      };
      onUpdate({ ...state, protocols: [...(state.protocols || []), newProtocol] });
    }
    setFormData({ name: '', species: '', targetWeight: '', expectedFca: '', estimatedDays: '' });
  };

  const removeProtocol = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir este modelo de produção? Lotes vinculados perderão a referência de meta.')) return;
    onUpdate({ ...state, protocols: (state.protocols || []).filter(p => p.id !== id) });
  };

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              {editingId ? 'Editar Modelo' : 'Novo Modelo de Produção'}
            </div>
            {editingId && <button onClick={() => setEditingId(null)}><X className="w-5 h-5 text-slate-400" /></button>}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome do Modelo</label>
              <input type="text" required placeholder="Ex: Tilápia de Corte" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Espécie</label>
              <input type="text" required placeholder="Ex: Oreochromis niloticus" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.species} onChange={e => setFormData({...formData, species: e.target.value})} />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Peso Alvo (g)</label>
              <input type="number" required placeholder="Ex: 850" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.targetWeight} onChange={e => setFormData({...formData, targetWeight: e.target.value})} />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Ciclo Est. (Dias)</label>
              <input type="number" required placeholder="Ex: 180" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.estimatedDays} onChange={e => setFormData({...formData, estimatedDays: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Meta de FCA (Conversão Alimentar)</label>
              <input type="number" step="0.01" required placeholder="Ex: 1.45" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.expectedFca} onChange={e => setFormData({...formData, expectedFca: e.target.value})} />
            </div>
            <button type="submit" className="col-span-2 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-2">
              {editingId ? 'Salvar Alterações' : 'Cadastrar Modelo'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <BookOpen className="w-12 h-12 text-slate-300" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-xs font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar modelos de produção.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(state.protocols || []).map(protocol => (
          <div key={protocol.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-indigo-200 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-slate-800 uppercase tracking-tighter">{protocol.name}</h4>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{protocol.species}</p>
              </div>
              {hasPermission && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingId(protocol.id);
                    setFormData({
                      name: protocol.name,
                      species: protocol.species,
                      targetWeight: protocol.targetWeight.toString(),
                      expectedFca: protocol.expectedFca.toString(),
                      estimatedDays: protocol.estimatedDays.toString()
                    });
                  }} className="text-slate-300 hover:text-indigo-600"><Edit className="w-4 h-4"/></button>
                  <button onClick={() => removeProtocol(protocol.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
              <div className="text-center">
                <Target className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                <div className="text-[9px] font-black text-slate-400 uppercase">Alvo</div>
                <div className="text-xs font-black text-slate-700">{protocol.targetWeight}g</div>
              </div>
              <div className="text-center">
                <Clock className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                <div className="text-[9px] font-black text-slate-400 uppercase">Dias</div>
                <div className="text-xs font-black text-slate-700">{protocol.estimatedDays}</div>
              </div>
              <div className="text-center">
                <Activity className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                <div className="text-[9px] font-black text-slate-400 uppercase">FCA</div>
                <div className="text-xs font-black text-slate-700">{protocol.expectedFca}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProtocolManagement;
