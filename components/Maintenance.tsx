
import React, { useState } from 'react';
import { AppState, CageStatus } from '../types';
import { Settings, CheckCircle2, AlertTriangle, Eraser, Calendar, Clock, ArrowRight, Box } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

const Maintenance: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [formData, setFormData] = useState({
    cageId: '',
    status: 'Manutenção' as CageStatus,
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId) return;

    const updatedCages = state.cages.map(c => {
      if (c.id === formData.cageId) {
        return {
          ...c,
          status: formData.status,
          maintenanceStartDate: formData.status === 'Manutenção' || formData.status === 'Limpeza' ? formData.startDate : undefined,
          maintenanceEndDate: formData.status === 'Manutenção' || formData.status === 'Limpeza' ? formData.endDate : undefined
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setFormData({ ...formData, cageId: '', endDate: '' });
    alert('Status da gaiola atualizado com sucesso!');
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

  const getStatusIcon = (status: CageStatus) => {
    switch (status) {
      case 'Disponível': return <CheckCircle2 className="w-3 h-3" />;
      case 'Ocupada': return <Box className="w-3 h-3" />;
      case 'Manutenção': return <Settings className="w-3 h-3" />;
      case 'Limpeza': return <Eraser className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter">
            <Settings className="w-5 h-5 text-red-500" />
            Gerenciar Status da Gaiola
          </h3>
          
          <form onSubmit={handleUpdateStatus} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Escolher Gaiola</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold" value={formData.cageId} onChange={(e) => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Selecione...</option>
                {state.cages.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Novo Momento/Status</label>
              <div className="grid grid-cols-2 gap-2">
                {['Disponível', 'Manutenção', 'Limpeza'].map((s) => (
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
        <div className="bg-slate-100 p-12 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-xl mx-auto">
          <Settings className="w-12 h-12 text-slate-300" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-xs font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar o status das gaiolas.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.cages.map(cage => (
          <div key={cage.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="font-black text-slate-800 uppercase tracking-tighter">{cage.name}</span>
              <div className={`p-1.5 rounded-lg border flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${getStatusColor(cage.status)}`}>
                {getStatusIcon(cage.status)}
                {cage.status}
              </div>
            </div>
            <div className="p-5">
              {(cage.status === 'Manutenção' || cage.status === 'Limpeza') && cage.maintenanceStartDate ? (
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
                  Gaiola operacional ou em alojamento.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Maintenance;
