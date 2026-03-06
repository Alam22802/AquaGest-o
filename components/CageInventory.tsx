
import React, { useState, useMemo } from 'react';
import { AppState, Cage, User } from '../types';
import { Plus, Trash2, Box, Edit, X, Ruler, Users, Info, Layers } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CageInventory: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pb-20">
      <div className="lg:col-span-1 sticky top-4">
        {hasPermission ? (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5 text-indigo-500" />
              {editingId ? 'Editar Cadastro de Gaiola' : 'Cadastrar Nova Gaiola'}
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>
          
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Identificação da Gaiola</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: G01 ou G01 - G40" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
              {!editingId && (
                <p className="mt-1 text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Dica: Use "-" para criar várias (ex: G01 - G10)
                </p>
              )}
            </div>
            
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Densidade (Peixes por m³)</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="number" required placeholder="Ex: 60" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.stockingDensity} onChange={(e) => setFormData({...formData, stockingDensity: e.target.value})} />
              </div>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Capacidade Calculada</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 uppercase">Total</div>
                <input type="text" readOnly className="w-full pl-16 pr-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-600" value={`${calculatedCapacity} un`} />
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> Dimensões Físicas (metros)</span>
                {volume > 0 && <span className="text-indigo-500 font-black">Volume: {volume.toFixed(2)} m³</span>}
              </label>
              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Comp</span>
                  <input type="number" step="0.1" required placeholder="0.0" className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.length} onChange={(e) => setFormData({...formData, length: e.target.value})} />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Larg</span>
                  <input type="number" step="0.1" required placeholder="0.0" className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.width} onChange={(e) => setFormData({...formData, width: e.target.value})} />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Prof</span>
                  <input type="number" step="0.1" required placeholder="0.0" className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.depth} onChange={(e) => setFormData({...formData, depth: e.target.value})} />
                </div>
              </div>
            </div>

            <button type="submit" className={`col-span-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
              {editingId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
          <Box className="w-12 h-12 text-slate-300" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-xs font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar o inventário de gaiolas.</p>
        </div>
      )}
    </div>

      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.cages.map(cage => (
          <div key={cage.id} className={`bg-white rounded-3xl shadow-sm border overflow-hidden transition-all group ${cage.status === 'Ocupada' ? 'border-blue-100 bg-blue-50/10' : 'border-slate-200 hover:border-indigo-200'}`}>
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Box className={`w-4 h-4 ${cage.status === 'Ocupada' ? 'text-blue-500' : 'text-slate-400'}`} />
                <span className="font-black text-slate-800 uppercase tracking-tighter">{cage.name}</span>
              </div>
              {hasPermission && (
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEdit(cage)} 
                    title="Editar"
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeCage(cage.id)} 
                    title="Excluir permanentemente"
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
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${cage.status === 'Ocupada' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {cage.status}
                </span>
              </div>
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
        {state.cages.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Info className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma gaiola cadastrada no inventário.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CageInventory;
