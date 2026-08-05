
import React, { useState } from 'react';
import { ProductionProtocol, AppState, User, StandardCurve } from '../types';
import { Plus, BookOpen, Trash2, Edit, X, Target, Clock, Activity, TrendingUp, History, Calendar, Package } from 'lucide-react';

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

const ProtocolManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    species: '',
    targetWeight: '',
    expectedFca: '',
    estimatedDays: '',
    supplierCurve: Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
  });

  const [standardCurveEditingId, setStandardCurveEditingId] = useState<string | null>(null);
  const [standardCurveFormData, setStandardCurveFormData] = useState({
    name: '',
    sampleBatch: '',
    insertionDate: new Date().toISOString().split('T')[0],
    curve: Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const generateCurve = () => {
    const curve = [...formData.supplierCurve];
    const filledPoints = curve.filter(p => p.weight > 0).sort((a, b) => a.day - b.day);
    
    if (filledPoints.length < 2) {
      alert('Preencha pelo menos duas biometrias (ex: Semana 0 e Semana 4) para gerar a curva.');
      return;
    }
    
    const first = filledPoints[0];
    const last = filledPoints[filledPoints.length - 1];
    
    const weeklyGrowthRate = (last.weight - first.weight) / (last.day - first.day);
    
    const newCurve = curve.map(p => {
      const projectedWeight = Math.max(0, Math.round(first.weight + weeklyGrowthRate * (p.day - first.day)));
      return { ...p, weight: projectedWeight };
    });
    
    setFormData({ ...formData, supplierCurve: newCurve });
  };

  const generateStandardCurve = () => {
    const curve = [...standardCurveFormData.curve];
    const filledPoints = curve.filter(p => p.weight > 0).sort((a, b) => a.day - b.day);
    
    if (filledPoints.length < 2) {
      alert('Preencha pelo menos duas biometrias para gerar a curva.');
      return;
    }
    
    const first = filledPoints[0];
    const last = filledPoints[filledPoints.length - 1];
    const weeklyGrowthRate = (last.weight - first.weight) / (last.day - first.day);
    
    const newCurve = curve.map(p => {
      const projectedWeight = Math.max(0, Math.round(first.weight + weeklyGrowthRate * (p.day - first.day)));
      return { ...p, weight: projectedWeight };
    });
    
    setStandardCurveFormData({ ...standardCurveFormData, curve: newCurve });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name || !formData.species) return;

    const protocolData = {
      name: formData.name,
      species: formData.species,
      targetWeight: Number(formData.targetWeight),
      expectedFca: Number(formData.expectedFca),
      estimatedDays: Number(formData.estimatedDays),
      supplierCurve: formData.supplierCurve.map(p => ({ ...p, weight: Number(p.weight) })),
      updatedAt: Date.now()
    };

    if (editingId) {
      onUpdate({
        ...state,
        protocols: (state.protocols || []).map(p => p.id === editingId ? {
          ...p,
          ...protocolData
        } : p)
      });
      setEditingId(null);
    } else {
      const newProtocol: ProductionProtocol = {
        id: generateId(),
        ...protocolData
      };
      onUpdate({ ...state, protocols: [...(state.protocols || []), newProtocol] });
    }
    setFormData({ 
      name: '', 
      species: '', 
      targetWeight: '', 
      expectedFca: '', 
      estimatedDays: '',
      supplierCurve: Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
    });
  };

  const handleSaveStandardCurve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!standardCurveFormData.name) return;

    const curveData = {
      name: standardCurveFormData.name,
      sampleBatch: standardCurveFormData.sampleBatch,
      insertionDate: standardCurveFormData.insertionDate,
      curve: standardCurveFormData.curve.map(p => ({ ...p, weight: Number(p.weight) })),
      userId: currentUser.id,
      userName: currentUser.name,
      updatedAt: Date.now()
    };

    if (standardCurveEditingId) {
      onUpdate({
        ...state,
        standardCurves: (state.standardCurves || []).map(c => c.id === standardCurveEditingId ? {
          ...c,
          ...curveData
        } : c)
      });
      setStandardCurveEditingId(null);
    } else {
      const newCurve: StandardCurve = {
        id: generateId(),
        ...curveData
      };
      onUpdate({ ...state, standardCurves: [...(state.standardCurves || []), newCurve] });
    }
    setStandardCurveFormData({ 
      name: '', 
      sampleBatch: '', 
      insertionDate: new Date().toISOString().split('T')[0],
      curve: Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
    });
  };

  const removeProtocol = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir este modelo de produção? Lotes vinculados perderão a referência de meta.')) return;
    onUpdate({ 
      ...state, 
      protocols: (state.protocols || []).filter(p => p.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const removeStandardCurve = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir esta curva padrão?')) return;
    onUpdate({ 
      ...state, 
      standardCurves: (state.standardCurves || []).filter(c => c.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Modelos de Produção */}
        <div className="space-y-6">
          {hasPermission ? (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
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

                <div className="col-span-2 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Curva de Peso Fornecedor (Semanas)
                    </h4>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {formData.supplierCurve.map((point, idx) => (
                      <div key={point.day} className="flex flex-col gap-1">
                        <input 
                          type="number" 
                          placeholder={`S${point.day}`} 
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-center" 
                          value={point.weight || ''} 
                          onChange={e => {
                            const newCurve = [...formData.supplierCurve];
                            newCurve[idx].weight = Number(e.target.value);
                            setFormData({ ...formData, supplierCurve: newCurve });
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="col-span-2 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-4">
                  {editingId ? 'Salvar Alterações' : 'Cadastrar Modelo'}
                </button>
              </form>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4">
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
                          estimatedDays: protocol.estimatedDays.toString(),
                          supplierCurve: protocol.supplierCurve || Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
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

        {/* Curva Padrão */}
        <div className="space-y-6">
          {hasPermission ? (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  {standardCurveEditingId ? 'Editar Curva Padrão' : 'Nova Curva Padrão'}
                </div>
                {standardCurveEditingId && <button onClick={() => setStandardCurveEditingId(null)}><X className="w-5 h-5 text-slate-400" /></button>}
              </h3>

              <form onSubmit={handleSaveStandardCurve} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Nome da Curva</label>
                  <input type="text" required placeholder="Ex: Curva Padrão 2026" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={standardCurveFormData.name} onChange={e => setStandardCurveFormData({...standardCurveFormData, name: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Lote de Amostra</label>
                  <input type="text" placeholder="Ex: 01/2025 - L1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={standardCurveFormData.sampleBatch} onChange={e => setStandardCurveFormData({...standardCurveFormData, sampleBatch: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Data de Inserção</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={standardCurveFormData.insertionDate} onChange={e => setStandardCurveFormData({...standardCurveFormData, insertionDate: e.target.value})} />
                </div>

                <div className="col-span-2 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <TrendingUp className="w-3 h-3" /> Preenchimento da Curva (Semanas)
                    </h4>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {standardCurveFormData.curve.map((point, idx) => (
                      <div key={point.day} className="flex flex-col gap-1">
                        <input 
                          type="number" 
                          placeholder={`S${point.day}`} 
                          className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-center" 
                          value={point.weight || ''} 
                          onChange={e => {
                            const newCurve = [...standardCurveFormData.curve];
                            newCurve[idx].weight = Number(e.target.value);
                            setStandardCurveFormData({ ...standardCurveFormData, curve: newCurve });
                          }} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="col-span-2 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-4">
                  {standardCurveEditingId ? 'Salvar Alterações' : 'Cadastrar Curva'}
                </button>
              </form>
            </div>
          ) : null}

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <History className="w-3 h-3" /> Histórico de Curvas Padrão
            </h4>
            <div className="grid grid-cols-1 gap-4">
              {(state.standardCurves || []).map(curve => (
                <div key={curve.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 hover:border-emerald-200 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm">{curve.name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" /> {curve.sampleBatch || 'N/A'}
                        </span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {curve.insertionDate}
                        </span>
                      </div>
                    </div>
                    {hasPermission && (
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setStandardCurveEditingId(curve.id);
                          setStandardCurveFormData({
                            name: curve.name,
                            sampleBatch: curve.sampleBatch,
                            insertionDate: curve.insertionDate,
                            curve: curve.curve || Array.from({ length: 25 }, (_, i) => ({ day: i, weight: 0 }))
                          });
                        }} className="text-slate-300 hover:text-emerald-600"><Edit className="w-3.5 h-3.5"/></button>
                        <button onClick={() => removeStandardCurve(curve.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    )}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase border-t border-slate-50 pt-3 flex justify-between items-center">
                    <span>Lançado por: <span className="text-slate-600">{curve.userName}</span></span>
                    <span className="text-[8px] opacity-50">{new Date(curve.updatedAt || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {(state.standardCurves || []).length === 0 && (
                <div className="text-center py-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma curva cadastrada</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolManagement;
