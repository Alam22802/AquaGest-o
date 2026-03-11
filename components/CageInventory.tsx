
import React, { useState, useMemo } from 'react';
import { AppState, Cage, User, CageStatus } from '../types';
import { Plus, Trash2, Box, Edit, X, Ruler, Users, Info, Layers, Filter, CheckCircle2, Settings, Eraser } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CageInventory: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<CageStatus | 'Todos'>('Todos');
  const [formData, setFormData] = useState({
    name: '',
    length: '',
    width: '',
    depth: '',
    stockingDensity: '',
    stockingCapacity: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const volume = useMemo(() => {
    const v = Number(formData.length) * Number(formData.width) * Number(formData.depth);
    return isNaN(v) ? 0 : v;
  }, [formData.length, formData.width, formData.depth]);

  const calculatedCapacity = useMemo(() => {
    const cap = Math.floor(volume * Number(formData.stockingDensity));
    return isNaN(cap) ? 0 : cap;
  }, [volume, formData.stockingDensity]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    // Bulk Edit Logic
    if (selectedIds.length > 0 && !editingId) {
      const updatedCages = state.cages.map(c => 
        selectedIds.includes(c.id) ? {
          ...c,
          dimensions: {
            length: formData.length ? Number(formData.length) : c.dimensions.length,
            width: formData.width ? Number(formData.width) : c.dimensions.width,
            depth: formData.depth ? Number(formData.depth) : c.dimensions.depth
          },
          stockingDensity: formData.stockingDensity ? Number(formData.stockingDensity) : c.stockingDensity,
          stockingCapacity: formData.stockingDensity || formData.length || formData.width || formData.depth 
            ? Math.floor((formData.length ? Number(formData.length) : c.dimensions.length) * 
                         (formData.width ? Number(formData.width) : c.dimensions.width) * 
                         (formData.depth ? Number(formData.depth) : c.dimensions.depth) * 
                         (formData.stockingDensity ? Number(formData.stockingDensity) : c.stockingDensity))
            : c.stockingCapacity
        } : c
      );
      onUpdate({ ...state, cages: updatedCages });
      setSelectedIds([]);
      resetForm();
      alert(`${selectedIds.length} gaiolas atualizadas com sucesso!`);
      return;
    }

    if (!formData.name) return;

    // Lógica para detecção de intervalo (ex: G01 - G40)
    const rangeRegex = /^(.+?)(\d+)\s*-\s*(.+?)(\d+)$/;
    const match = formData.name.match(rangeRegex);

    if (!editingId && match) {
      const prefix1 = match[1];
      const startNumStr = match[2];
      const prefix2 = match[3];
      const endNumStr = match[4];

      const startNum = parseInt(startNumStr);
      const endNum = parseInt(endNumStr);
      const padding = startNumStr.length;

      if (prefix1.trim() === prefix2.trim() && startNum < endNum) {
        const newCages: Cage[] = [];
        const prefix = prefix1;

        for (let i = startNum; i <= endNum; i++) {
          const sequentialName = `${prefix}${String(i).padStart(padding, '0')}`;
          
          // Evitar duplicidade de nomes se desejar, mas aqui seguiremos a criação em massa
          newCages.push({
            id: crypto.randomUUID(),
            name: sequentialName,
            dimensions: {
              length: Number(formData.length),
              width: Number(formData.width),
              depth: Number(formData.depth)
            },
            stockingDensity: Number(formData.stockingDensity),
            stockingCapacity: calculatedCapacity,
            status: 'Disponível'
          });
        }

        onUpdate({ ...state, cages: [...state.cages, ...newCages] });
        resetForm();
        return;
      }
    }

    // Lógica padrão (Edição ou Cadastro Único)
    if (editingId) {
      const updatedCages = state.cages.map(c => 
        c.id === editingId ? {
          ...c,
          name: formData.name,
          dimensions: {
            length: Number(formData.length),
            width: Number(formData.width),
            depth: Number(formData.depth)
          },
          stockingDensity: Number(formData.stockingDensity),
          stockingCapacity: calculatedCapacity
        } : c
      );
      onUpdate({ ...state, cages: updatedCages });
      setEditingId(null);
    } else {
      const newCage: Cage = {
        id: crypto.randomUUID(),
        name: formData.name,
        dimensions: {
          length: Number(formData.length),
          width: Number(formData.width),
          depth: Number(formData.depth)
        },
        stockingDensity: Number(formData.stockingDensity),
        stockingCapacity: calculatedCapacity,
        status: 'Disponível'
      };
      onUpdate({ ...state, cages: [...state.cages, newCage] });
    }

    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedIds([]);
    setFormData({
      name: '', length: '', width: '', depth: '',
      stockingDensity: '', stockingCapacity: ''
    });
  };

  const startEdit = (cage: Cage) => {
    if (!hasPermission) return;
    setEditingId(cage.id);
    setFormData({
      name: cage.name,
      length: cage.dimensions.length.toString(),
      width: cage.dimensions.width.toString(),
      depth: cage.dimensions.depth.toString(),
      stockingDensity: (cage.stockingDensity || '').toString(),
      stockingCapacity: cage.stockingCapacity.toString()
    });
  };

  const removeCage = (id: string) => {
    if (!hasPermission) return;
    const cage = state.cages.find(c => c.id === id);
    if (cage?.status === 'Ocupada') {
      alert('Não é possível remover uma gaiola que está OCUPADA com peixes. Desocupe-a primeiro no menu Alojamento.');
      return;
    }
    if (!confirm(`Tem certeza que deseja remover a gaiola "${cage?.name}" permanentemente?`)) return;
    onUpdate({
      ...state,
      cages: state.cages.filter(c => c.id !== id)
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredCages = useMemo(() => {
    if (filterStatus === 'Todos') return state.cages;
    return state.cages.filter(c => c.status === filterStatus);
  }, [state.cages, filterStatus]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCages.map(c => c.id));
    }
  };

  const removeSelected = () => {
    if (!hasPermission) return;
    const occupiedSelected = state.cages.filter(c => selectedIds.includes(c.id) && c.status === 'Ocupada');
    if (occupiedSelected.length > 0) {
      alert(`Não é possível remover ${occupiedSelected.length} gaiolas que estão OCUPADAS. Desocupe-as primeiro.`);
      return;
    }
    if (!confirm(`Tem certeza que deseja remover as ${selectedIds.length} gaiolas selecionadas permanentemente?`)) return;
    onUpdate({
      ...state,
      cages: state.cages.filter(c => !selectedIds.includes(c.id))
    });
    setSelectedIds([]);
  };

  const filterSummary = useMemo(() => {
    if (filterStatus === 'Todos') return null;
    
    const totalCapacity = filteredCages.reduce((acc, c) => acc + c.stockingCapacity, 0);
    const models = filteredCages.reduce((acc: Record<string, number>, c) => {
      const modelKey = `${c.dimensions.length}x${c.dimensions.width}x${c.dimensions.depth}m`;
      acc[modelKey] = (acc[modelKey] || 0) + 1;
      return acc;
    }, {});

    return {
      totalCapacity,
      models,
      count: filteredCages.length
    };
  }, [filteredCages, filterStatus]);

  const getStatusIcon = (status: CageStatus) => {
    switch (status) {
      case 'Disponível': return <CheckCircle2 className="w-3 h-3" />;
      case 'Ocupada': return <Box className="w-3 h-3" />;
      case 'Manutenção': return <Settings className="w-3 h-3" />;
      case 'Limpeza': return <Eraser className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: CageStatus) => {
    switch (status) {
      case 'Disponível': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Ocupada': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Manutenção': return 'bg-red-100 text-red-700 border-red-200';
      case 'Limpeza': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pb-20">
      <div className="lg:col-span-1 lg:sticky lg:top-8">
        {hasPermission ? (
          <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${selectedIds.length > 0 ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 ? <Layers className="w-5 h-5 text-indigo-500" /> : editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                {selectedIds.length > 0 ? `Editar ${selectedIds.length} Gaiolas` : editingId ? 'Editar Gaiola' : 'Cadastrar Gaiola'}
              </div>
              {(editingId || selectedIds.length > 0) && (
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </h3>
            
            {selectedIds.length > 0 && !editingId && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <p className="text-[10px] font-bold text-indigo-700 uppercase leading-relaxed">
                  Modo de edição em massa. Os campos preenchidos abaixo serão aplicados a todas as {selectedIds.length} gaiolas selecionadas.
                </p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Identificação</label>
                <input 
                  type="text" 
                  required={selectedIds.length === 0}
                  disabled={selectedIds.length > 0 && !editingId}
                  placeholder={selectedIds.length > 0 && !editingId ? "Nomes não editáveis em massa" : "Ex: G01 ou G01 - G40"} 
                  className={`w-full px-4 py-3 border rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm ${selectedIds.length > 0 && !editingId ? 'bg-slate-100 border-slate-200 text-slate-400 italic' : 'bg-slate-50 border-slate-200'}`}
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
                {!editingId && selectedIds.length === 0 && (
                  <p className="mt-1 text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Dica: Use "-" para criar várias (ex: G01 - G10)
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Densidade (un/m³)</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="number" placeholder="Ex: 60" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={formData.stockingDensity} onChange={(e) => setFormData({...formData, stockingDensity: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Capacidade</label>
                  <div className="relative">
                    <input type="text" readOnly className="w-full px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-600 text-sm" value={selectedIds.length > 0 && !editingId ? "---" : `${calculatedCapacity} un`} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 flex items-center justify-between tracking-widest">
                  <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> Dimensões (metros)</span>
                  {volume > 0 && !editingId && selectedIds.length === 0 && <span className="text-indigo-500 font-black">{volume.toFixed(2)} m³</span>}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">C</span>
                    <input type="number" step="0.1" placeholder="0.0" className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" value={formData.length} onChange={(e) => setFormData({...formData, length: e.target.value})} />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">L</span>
                    <input type="number" step="0.1" placeholder="0.0" className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" value={formData.width} onChange={(e) => setFormData({...formData, width: e.target.value})} />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">P</span>
                    <input type="number" step="0.1" placeholder="0.0" className="w-full pl-8 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" value={formData.depth} onChange={(e) => setFormData({...formData, depth: e.target.value})} />
                  </div>
                </div>
              </div>

              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : selectedIds.length > 0 ? 'bg-indigo-900 shadow-indigo-900/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
                {editingId ? 'Salvar Alterações' : selectedIds.length > 0 ? 'Atualizar Selecionadas' : 'Confirmar Cadastro'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-slate-100 p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
            <Box className="w-12 h-12 text-slate-300" />
            <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura</h4>
            <p className="text-xs font-bold text-slate-400 uppercase">Sem permissão para editar.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        {/* Filtros de Status */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar Status:</span>
          </div>
          <button 
            onClick={() => setFilterStatus('Todos')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === 'Todos' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            Todos
          </button>
          {(['Disponível', 'Ocupada', 'Manutenção', 'Limpeza'] as CageStatus[]).map(status => (
            <button 
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterStatus === status ? getStatusColor(status) + ' shadow-md' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
            >
              {getStatusIcon(status)}
              {status}
            </button>
          ))}
        </div>

        {filterSummary && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border shadow-sm ${getStatusColor(filterStatus as CageStatus)}`}>
                  {getStatusIcon(filterStatus as CageStatus)}
                </div>
                <div>
                  <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">Resumo do Filtro: {filterStatus}</h4>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5">
                    {filterSummary.count} gaiolas encontradas • Capacidade Total: {filterSummary.totalCapacity.toLocaleString()} un
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filterSummary.models).map(([model, count]) => (
                  <div key={model} className="px-2 py-1 bg-white border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-700 uppercase">
                    {model}: {count} un
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {state.cages.length > 0 && hasPermission && (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between sticky top-4 z-20">
            <div className="flex items-center gap-4">
              <button 
                onClick={toggleSelectAll}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${selectedIds.length === filteredCages.length && filteredCages.length > 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}
              >
                {selectedIds.length === filteredCages.length && filteredCages.length > 0 ? 'Desmarcar Tudo' : 'Marcar Tudo'}
              </button>
              {selectedIds.length > 0 && (
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                  {selectedIds.length} selecionada(s)
                </span>
              )}
            </div>
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={removeSelected}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-100 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCages.map(cage => (
            <div 
              key={cage.id} 
              onClick={() => hasPermission && toggleSelect(cage.id)}
              className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all group cursor-pointer relative ${selectedIds.includes(cage.id) ? 'ring-2 ring-indigo-500 border-transparent shadow-indigo-100' : cage.status === 'Ocupada' ? 'border-blue-100 bg-blue-50/10' : 'border-slate-200 hover:border-indigo-200'}`}
            >
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedIds.includes(cage.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                    {selectedIds.includes(cage.id) && <Plus className="w-3 h-3 text-white rotate-45" />}
                  </div>
                  <Box className={`w-4 h-4 ${cage.status === 'Ocupada' ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="font-black text-slate-800 uppercase tracking-tighter">{cage.name}</span>
                </div>
                {hasPermission && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => startEdit(cage)} 
                      title="Editar"
                      className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => removeCage(cage.id)} 
                      title="Excluir"
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Status</span>
                  <div className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${getStatusColor(cage.status)}`}>
                    {getStatusIcon(cage.status)}
                    {cage.status}
                  </div>
                </div>

                {(cage.status === 'Manutenção' || cage.status === 'Limpeza') && cage.maintenanceStartDate && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Início</span>
                      <span className="text-[10px] font-black text-slate-700">{cage.maintenanceStartDate.split('-').reverse().join('/')}</span>
                    </div>
                    {cage.maintenanceEndDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Previsão</span>
                        <span className="text-[10px] font-black text-amber-600">{cage.maintenanceEndDate.split('-').reverse().join('/')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-slate-50 pt-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Capacidade</span>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-700 block">{cage.stockingCapacity} un</span>
                    {cage.stockingDensity && <span className="text-[9px] font-bold text-slate-400 uppercase">{cage.stockingDensity} peixes/m³</span>}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Volume</span>
                  <span className="text-xs font-bold text-indigo-600">{(cage.dimensions.length * cage.dimensions.width * cage.dimensions.depth).toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Medidas</span>
                  <span className="text-xs font-bold text-slate-600">{cage.dimensions.length}x{cage.dimensions.width}x{cage.dimensions.depth}m</span>
                </div>
              </div>
            </div>
          ))}
          {filteredCages.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Info className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma gaiola encontrada para este filtro.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CageInventory;
