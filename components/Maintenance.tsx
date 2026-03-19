
import React, { useState } from 'react';
import { AppState, CageStatus, User } from '../types';
import { Settings, CheckCircle2, AlertTriangle, Eraser, Calendar, Clock, ArrowRight, Box, Eye, Warehouse } from 'lucide-react';
import { format } from 'date-fns';
import SlaughterhouseMaintenance from './SlaughterhouseMaintenance';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const Maintenance: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'cages' | 'slaughterhouse'>('cages');
  const [selectedCageIds, setSelectedCageIds] = useState<string[]>([]);
  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    status: 'Manutenção' as CageStatus,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const toggleCageSelection = (id: string) => {
    setSelectedCageIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllCages = () => {
    if (selectedCageIds.length === state.cages.length) {
      setSelectedCageIds([]);
    } else {
      setSelectedCageIds(state.cages.map(c => c.id));
    }
  };

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    
    const targetIds = selectedCageIds.length > 0 ? selectedCageIds : (formData.cageId ? [formData.cageId] : []);
    if (targetIds.length === 0) {
      alert('Selecione ao menos uma gaiola.');
      return;
    }

    const updatedCages = state.cages.map(c => {
      if (targetIds.includes(c.id)) {
        return {
          ...c,
          status: formData.status,
          maintenanceStartDate: ['Manutenção', 'Limpeza', 'Avaliação'].includes(formData.status) ? formData.startDate : undefined,
          maintenanceEndDate: ['Manutenção', 'Limpeza', 'Avaliação'].includes(formData.status) ? formData.endDate : undefined
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setFormData({ ...formData, cageId: '', endDate: '' });
    setSelectedCageIds([]);
    alert(`${targetIds.length} status de gaiola(s) atualizado(s) com sucesso!`);
  };

  const getStatusColor = (status: CageStatus) => {
    switch (status) {
      case 'Disponível': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Ocupada': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Manutenção': return 'bg-red-100 text-red-700 border-red-200';
      case 'Limpeza': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Avaliação': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Sucata': return 'bg-slate-200 text-slate-700 border-slate-300';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: CageStatus) => {
    switch (status) {
      case 'Disponível': return <CheckCircle2 className="w-3 h-3" />;
      case 'Ocupada': return <Box className="w-3 h-3" />;
      case 'Manutenção': return <Settings className="w-3 h-3" />;
      case 'Limpeza': return <Eraser className="w-3 h-3" />;
      case 'Avaliação': return <Eye className="w-3 h-3" />;
      case 'Sucata': return <Trash2 className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('cages')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cages' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Settings className="w-4 h-4" />
          Manutenção de Gaiolas
        </button>
        <button 
          onClick={() => setActiveTab('slaughterhouse')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'slaughterhouse' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Warehouse className="w-4 h-4" />
          Utilidades
        </button>
      </div>

      {activeTab === 'slaughterhouse' ? (
        <SlaughterhouseMaintenance state={state} onUpdate={onUpdate} currentUser={currentUser} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start pb-20">
          <div className="lg:col-span-1 lg:sticky lg:top-4">
            {hasPermission ? (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <Settings className="w-5 h-5 text-red-500" />
                Gerenciar Status da Gaiola
              </h3>
                             <form onSubmit={handleUpdateStatus} className="space-y-4">
                {selectedCageIds.length > 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-4">
                    <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
                      Editando {selectedCageIds.length} gaiola(s) em massa
                    </p>
                    <button 
                      type="button"
                      onClick={() => setSelectedCageIds([])}
                      className="text-[10px] font-bold text-amber-600 underline uppercase mt-1"
                    >
                      Cancelar seleção em massa
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-1">Escolher Gaiola</label>
                    <select required={selectedCageIds.length === 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold" value={formData.cageId} onChange={(e) => setFormData({...formData, cageId: e.target.value})}>
                      <option value="">Selecione...</option>
                      {state.cages.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.dimensions ? `${c.dimensions.length}x${c.dimensions.width}x${c.dimensions.depth}m` : 'S/D'}) - {c.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1">Novo Momento/Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Disponível', 'Manutenção', 'Limpeza', 'Avaliação', 'Sucata'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({...formData, status: s as CageStatus})}
                        className={`px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${formData.status === s ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/20' : 'bg-white text-slate-400 border-slate-200 hover:border-red-200'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {(formData.status === 'Manutenção' || formData.status === 'Limpeza') && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-1">Data de Entrada</label>
                      <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-1">Previsão de Retorno</label>
                      <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                    </div>
                  </div>
                )}

                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all mt-4">
                  Atualizar Status da Gaiola
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-100 p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
              <Settings className="w-12 h-12 text-slate-300" />
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
              <p className="text-xs font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar o status das gaiolas.</p>
            </div>
          )}
        </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={selectAllCages}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                {selectedCageIds.length === state.cages.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {state.cages.map(cage => (
                <div 
                  key={cage.id} 
                  onClick={() => hasPermission && toggleCageSelection(cage.id)}
                  className={`bg-white rounded-3xl shadow-sm border transition-all cursor-pointer overflow-hidden hover:shadow-md ${selectedCageIds.includes(cage.id) ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200'}`}
                >
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {hasPermission && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedCageIds.includes(cage.id) ? 'bg-red-500 border-red-500' : 'bg-white border-slate-300'}`}>
                          {selectedCageIds.includes(cage.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 uppercase tracking-tighter leading-none">{cage.name}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          {cage.dimensions ? `${cage.dimensions.length}x${cage.dimensions.width}x${cage.dimensions.depth}m` : 'Dimensões não definidas'}
                        </span>
                      </div>
                    </div>
                    <div className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${getStatusColor(cage.status)}`}>
                      {getStatusIcon(cage.status)}
                      {cage.status}
                    </div>
                  </div>
                  <div className="p-5">
                    {['Manutenção', 'Limpeza', 'Avaliação'].includes(cage.status) && cage.maintenanceStartDate ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase">Entrada:</span>
                          <span className="text-xs font-black text-slate-700">{format(new Date(cage.maintenanceStartDate + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                        </div>
                        {cage.maintenanceEndDate && (
                          <div className="flex items-center gap-2 text-amber-600">
                            <Clock className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase">Previsão:</span>
                            <span className="text-xs font-black">{format(new Date(cage.maintenanceEndDate + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                        {cage.status === 'Sucata' ? 'Gaiola descartada/sucata.' : 'Gaiola operacional ou em povoamento.'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;
