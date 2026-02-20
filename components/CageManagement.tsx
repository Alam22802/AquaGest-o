
import React, { useState, useMemo } from 'react';
import { Cage, AppState, User } from '../types';
import { Trash2, Box, Edit, X, Ruler, Users, Tag, Calendar, LayoutDashboard, Info, Layers, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CageManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cageId: '',
    lineId: '',
    batchId: '',
    initialFishCount: '',
    settlementDate: new Date().toISOString().split('T')[0],
    harvestDate: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const availableCages = useMemo(() => {
    return state.cages.filter(c => c.status === 'Disponível' || (editingId && c.id === editingId));
  }, [state.cages, editingId]);

  const selectedCageDef = useMemo(() => {
    return state.cages.find(c => c.id === formData.cageId);
  }, [state.cages, formData.cageId]);

  const selectedBatch = state.batches.find(b => b.id === formData.batchId);
  
  const batchUsedFish = state.cages
    .filter(c => c.batchId === formData.batchId && c.id !== editingId)
    .reduce((a, b) => a + (b.initialFishCount || 0), 0);
    
  const batchBalance = selectedBatch ? selectedBatch.initialQuantity - batchUsedFish : 0;
  const isOverBatchBalance = Number(formData.initialFishCount) > batchBalance;
  
  const isOverCageCapacity = selectedCageDef && Number(formData.initialFishCount) > selectedCageDef.stockingCapacity;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId || !formData.batchId || !formData.initialFishCount || !formData.lineId) return;
    
    if (isOverBatchBalance) {
      alert('Quantidade superior ao saldo disponível no lote!');
      return;
    }

    const updatedCages = state.cages.map(c => {
      if (c.id === formData.cageId) {
        return {
          ...c,
          lineId: formData.lineId,
          batchId: formData.batchId,
          initialFishCount: Number(formData.initialFishCount),
          settlementDate: formData.settlementDate,
          harvestDate: formData.harvestDate,
          status: 'Ocupada' as const
        };
      }
      if (editingId && c.id === editingId && c.id !== formData.cageId) {
        return {
          ...c,
          batchId: undefined,
          initialFishCount: undefined,
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Disponível' as const
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      cageId: '', lineId: '', batchId: '', initialFishCount: '',
      settlementDate: new Date().toISOString().split('T')[0], harvestDate: ''
    });
  };

  const startEdit = (cage: Cage) => {
    if (!hasPermission) return;
    setEditingId(cage.id);
    setFormData({
      cageId: cage.id,
      lineId: cage.lineId || '',
      batchId: cage.batchId || '',
      initialFishCount: (cage.initialFishCount || '').toString(),
      settlementDate: cage.settlementDate || format(new Date(), 'yyyy-MM-dd'),
      harvestDate: cage.harvestDate || ''
    });
  };

  const releaseCage = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja desocupar esta gaiola? Ela retornará para o inventário como "Disponível".')) return;
    onUpdate({
      ...state,
      cages: state.cages.map(c => c.id === id ? {
        ...c,
        batchId: undefined,
        initialFishCount: undefined,
        settlementDate: undefined,
        harvestDate: undefined,
        status: 'Disponível'
      } : c)
    });
  };

  const occupiedCages = state.cages.filter(c => c.status === 'Ocupada');

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
              {editingId ? 'Editar Alojamento' : 'Novo Alojamento'}
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Selecionar Gaiola</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.cageId} onChange={(e) => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Escolha a gaiola...</option>
                {availableCages.map(c => (
                  <option key={c.id} value={c.id}>{c.name} (Cap: {c.stockingCapacity})</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Linha de Localização</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.lineId} onChange={(e) => setFormData({...formData, lineId: e.target.value})}>
                <option value="">Selecione a linha...</option>
                {state.lines.map(line => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Vincular ao Lote</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.batchId} onChange={(e) => setFormData({...formData, batchId: e.target.value})}>
                <option value="">Selecione o lote...</option>
                {state.batches.map(b => {
                  const used = state.cages.filter(c => c.batchId === b.id && c.id !== editingId).reduce((x, y) => x + (y.initialFishCount || 0), 0);
                  return <option key={b.id} value={b.id}>{b.name} (Saldo: {b.initialQuantity - used})</option>;
                })}
              </select>
            </div>

            {selectedCageDef && (
              <div className="col-span-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Ruler className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Dimensões</div>
                    <div className="text-xs font-bold text-slate-700">{selectedCageDef.dimensions.length}x{selectedCageDef.dimensions.width}x{selectedCageDef.dimensions.depth}m</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Capacidade Planejada</div>
                    <div className="text-xs font-bold text-slate-700">{selectedCageDef.stockingCapacity} un</div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Quantidade de Peixes</label>
              <input type="number" required placeholder="Qtd alojada" className={`w-full px-4 py-3 bg-white border rounded-2xl outline-none font-bold ${isOverCageCapacity || isOverBatchBalance ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`} value={formData.initialFishCount} onChange={(e) => setFormData({...formData, initialFishCount: e.target.value})} />
              {isOverCageCapacity && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Atenção: Acima da capacidade!</p>}
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Previsão de Despesca</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.harvestDate} onChange={(e) => setFormData({...formData, harvestDate: e.target.value})} />
            </div>

            <button type="submit" disabled={isOverBatchBalance || !formData.cageId || !formData.lineId} className={`col-span-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${isOverBatchBalance || !formData.cageId || !formData.lineId ? 'bg-slate-300' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}>
              {editingId ? 'Salvar Alterações' : 'Confirmar Alojamento'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <Eye className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para alojar novos peixes ou editar alojamentos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {occupiedCages.map(cage => {
          const batch = state.batches.find(b => b.id === cage.batchId);
          const line = state.lines.find(l => l.id === cage.lineId);
          const mortalities = state.mortalityLogs.filter(m => m.cageId === cage.id).reduce((a, b) => a + b.count, 0);
          const currentCount = (cage.initialFishCount || 0) - mortalities;
          
          return (
            <div key={cage.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden group hover:border-blue-200 transition-all">
              <div className="p-4 bg-blue-50/30 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-black text-slate-800 uppercase tracking-tighter block">{cage.name}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{line?.name || 'Setor não definido'}</span>
                  </div>
                </div>
                {hasPermission && (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(cage)} className="p-2 text-slate-300 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => releaseCage(cage.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote Vinculado</span>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">{batch?.name || '---'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Vivo</span>
                    <span className="text-xl font-black text-emerald-600 leading-none mt-1">{currentCount} un</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicial</span>
                    <span className="text-xs font-bold text-slate-500">{cage.initialFishCount} un</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {occupiedCages.length === 0 && (
          <div className="col-span-full py-24 text-center">
            <Info className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <h4 className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum alojamento ativo encontrado.</h4>
          </div>
        )}
      </div>
    </div>
  );
};

export default CageManagement;
