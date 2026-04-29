
import React, { useState } from 'react';
import { 
  Settings, Wrench, AlertOctagon, Plus, Trash2, Calendar, Clock, 
  ChevronRight, Filter, Download, ArrowUpRight, ArrowDownRight,
  ClipboardList, HardDrive, ListOrdered, User, AlertTriangle
} from 'lucide-react';
import { AppState, CostCenter, PCMEquipment, PCMStoppageReason, PCMProductionStoppage, PCMPlannedImprovement, User as AppUser } from '../types.ts';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }
};

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: AppUser;
}

const PCMManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'registration' | 'stoppages' | 'improvements'>('stoppages');
  const [regSubTab, setRegSubTab] = useState<'ccs' | 'equipments' | 'reasons'>('ccs');

  // Registration states
  const [ccName, setCcName] = useState('');
  const [ccCode, setCcCode] = useState('');
  const [eqName, setEqName] = useState('');
  const [eqCC, setEqCC] = useState('');
  const [reasonName, setReasonName] = useState('');

  // Stoppage states
  const [stoppageCC, setStoppageCC] = useState('');
  const [stoppageEq, setStoppageEq] = useState('');
  const [stoppageReason, setStoppageReason] = useState('');
  const [stoppageStart, setStoppageStart] = useState('');
  const [stoppageEnd, setStoppageEnd] = useState('');
  const [stoppageDesc, setStoppageDesc] = useState('');

  // Improvement states
  const [impCC, setImpCC] = useState('');
  const [impEq, setImpEq] = useState('');
  const [impReason, setImpReason] = useState('');
  const [impUrgent, setImpUrgent] = useState(false);
  const [impStart, setImpStart] = useState('');
  const [impEnd, setImpEnd] = useState('');
  const [impDesc, setImpDesc] = useState('');

  const canEdit = currentUser.isMaster || currentUser.canEdit;

  // Handlers for Registration
  const addCC = () => {
    if (!ccName || !ccCode) return;
    const newCCs = [...(state.costCenters || []), { id: generateId(), name: ccName, code: ccCode, userId: currentUser.id }];
    onUpdate({ ...state, costCenters: newCCs });
    setCcName('');
    setCcCode('');
  };

  const addEq = () => {
    if (!eqName || !eqCC) return;
    
    // Generate sequential code: EQ-001
    const count = (state.pcmEquipments || []).length + 1;
    const autoCode = `EQ-${String(count).padStart(3, '0')}`;
    
    const newEqs = [...(state.pcmEquipments || []), { 
      id: generateId(), 
      name: eqName, 
      code: autoCode, 
      costCenterId: eqCC, 
      userId: currentUser.id 
    }];
    onUpdate({ ...state, pcmEquipments: newEqs });
    setEqName('');
    setEqCC('');
  };

  const addReason = () => {
    if (!reasonName) return;
    const newReasons = [...(state.pcmStoppageReasons || []), { id: generateId(), name: reasonName, userId: currentUser.id }];
    onUpdate({ ...state, pcmStoppageReasons: newReasons });
    setReasonName('');
  };

  const removeCC = (id: string) => {
    onUpdate({ ...state, costCenters: (state.costCenters || []).filter(c => c.id !== id) });
  };

  const removeEq = (id: string) => {
    onUpdate({ ...state, pcmEquipments: (state.pcmEquipments || []).filter(e => e.id !== id) });
  };

  const removeReason = (id: string) => {
    onUpdate({ ...state, pcmStoppageReasons: (state.pcmStoppageReasons || []).filter(r => r.id !== id) });
  };

  // Handlers for Stoppages
  const addStoppage = () => {
    if (!stoppageCC || !stoppageEq || !stoppageReason || !stoppageStart || !stoppageEnd) return;
    const newStoppages = [...(state.pcmProductionStoppages || []), {
      id: generateId(),
      costCenterId: stoppageCC,
      equipmentId: stoppageEq,
      reasonId: stoppageReason,
      startDateTime: stoppageStart,
      endDateTime: stoppageEnd,
      description: stoppageDesc,
      userId: currentUser.id
    }];
    onUpdate({ ...state, pcmProductionStoppages: newStoppages });
    setStoppageCC('');
    setStoppageEq('');
    setStoppageReason('');
    setStoppageStart('');
    setStoppageEnd('');
    setStoppageDesc('');
  };

  const removeStoppage = (id: string) => {
    onUpdate({ ...state, pcmProductionStoppages: (state.pcmProductionStoppages || []).filter(s => s.id !== id) });
  };

  // Handlers for Improvements
  const addImprovement = () => {
    if (!impCC || !impEq || !impReason || !impStart || !impEnd) return;
    const newImps = [...(state.pcmPlannedImprovements || []), {
      id: generateId(),
      costCenterId: impCC,
      equipmentId: impEq,
      reason: impReason,
      isUrgent: impUrgent,
      plannedStartDate: impStart,
      plannedEndDate: impEnd,
      description: impDesc,
      status: 'Pendente',
      userId: currentUser.id
    }] as PCMPlannedImprovement[];
    onUpdate({ ...state, pcmPlannedImprovements: newImps });
    setImpCC('');
    setImpEq('');
    setImpReason('');
    setImpUrgent(false);
    setImpStart('');
    setImpEnd('');
    setImpDesc('');
  };

  const updateImpStatus = (id: string, status: PCMPlannedImprovement['status']) => {
    const updated = (state.pcmPlannedImprovements || []).map(i => i.id === id ? { ...i, status } : i);
    onUpdate({ ...state, pcmPlannedImprovements: updated });
  };

  const removeImp = (id: string) => {
    onUpdate({ ...state, pcmPlannedImprovements: (state.pcmPlannedImprovements || []).filter(i => i.id !== id) });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header section with Tabs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-900 text-[#e4e4d4] shadow-lg shadow-slate-200">
              <ClipboardList className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">PCM</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão de Manutenção e Melhorias</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-[20px] shadow-inner">
            <button 
              onClick={() => setActiveTab('stoppages')}
              className={`px-6 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'stoppages' ? 'bg-[#344434] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Paradas de Produção
            </button>
            <button 
              onClick={() => setActiveTab('improvements')}
              className={`px-6 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'improvements' ? 'bg-[#344434] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Melhorias Programadas
            </button>
            <button 
              onClick={() => setActiveTab('registration')}
              className={`px-6 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'registration' ? 'bg-[#344434] text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Cadastro Geral
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'registration' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
            <button 
              onClick={() => setRegSubTab('ccs')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${regSubTab === 'ccs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Centros de Custo
            </button>
            <button 
              onClick={() => setRegSubTab('equipments')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${regSubTab === 'equipments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Equipamentos
            </button>
            <button 
              onClick={() => setRegSubTab('reasons')}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${regSubTab === 'reasons' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Motivos de Parada
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-4">
                {regSubTab === 'ccs' && (
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-2">
                       <ListOrdered className="w-4 h-4 text-slate-400" /> Novo Centro de Custo
                    </h3>
                    <input 
                      type="text" placeholder="Nome do Setor" value={ccName} onChange={e => setCcName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                    />
                    <input 
                      type="text" placeholder="Código reduzido" value={ccCode} onChange={e => setCcCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                    />
                    <button onClick={addCC} className="w-full bg-[#344434] text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-black/10">
                      <Plus className="w-4 h-4" /> Cadastrar CC
                    </button>
                  </div>
                )}

                {regSubTab === 'equipments' && (
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-2">
                       <HardDrive className="w-4 h-4 text-slate-400" /> Novo Equipamento
                    </h3>
                    <input 
                      type="text" placeholder="Nome do Equipamento" value={eqName} onChange={e => setEqName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                    />
                    <select 
                      value={eqCC} onChange={e => setEqCC(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                    >
                      <option value="">Vincular Centro Custo</option>
                      {state.costCenters?.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                    </select>
                    <div className="p-3 bg-[#344434]/5 rounded-2xl border border-dashed border-[#344434]/20">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Código Automático</p>
                      <p className="text-xs font-black text-[#344434]">EQ-{String((state.pcmEquipments?.length || 0) + 1).padStart(3, '0')}</p>
                    </div>
                    <button onClick={addEq} className="w-full bg-[#344434] text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-black/10">
                      <Plus className="w-4 h-4" /> Cadastrar Equipamento
                    </button>
                  </div>
                )}

                {regSubTab === 'reasons' && (
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-2">
                       <AlertOctagon className="w-4 h-4 text-slate-400" /> Novo Motivo
                    </h3>
                    <input 
                      type="text" placeholder="Descrição do Motivo" value={reasonName} onChange={e => setReasonName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                    />
                    <button onClick={addReason} className="w-full bg-[#344434] text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-black/10">
                      <Plus className="w-4 h-4" /> Cadastrar Motivo
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* List/Report Column */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relatório de Cadastros</span>
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-300" />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        {regSubTab === 'ccs' && (
                          <>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Setor / CC</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                          </>
                        )}
                        {regSubTab === 'equipments' && (
                          <>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">TAG</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Equipamento</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">C. Custo</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                          </>
                        )}
                        {regSubTab === 'reasons' && (
                          <>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {regSubTab === 'ccs' && (state.costCenters || []).map(cc => (
                        <tr key={cc.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-black text-xs text-[#344434]">{cc.code}</td>
                          <td className="px-6 py-4 font-bold text-xs text-slate-600 uppercase">{cc.name}</td>
                          <td className="px-6 py-4">
                            {canEdit && (
                              <button onClick={() => removeCC(cc.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {regSubTab === 'equipments' && (state.pcmEquipments || []).map(eq => {
                        const cc = state.costCenters?.find(c => c.id === eq.costCenterId);
                        return (
                          <tr key={eq.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-black text-xs text-[#344434]">{eq.code}</td>
                            <td className="px-6 py-4 font-bold text-xs text-slate-600 uppercase">{eq.name}</td>
                            <td className="px-6 py-4 font-black text-[10px] text-slate-400 uppercase">{cc?.name || '-'}</td>
                            <td className="px-6 py-4">
                              {canEdit && (
                                <button onClick={() => removeEq(eq.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {regSubTab === 'reasons' && (state.pcmStoppageReasons || []).map(sr => (
                        <tr key={sr.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-xs text-slate-600 uppercase">{sr.name}</td>
                          <td className="px-6 py-4">
                            {canEdit && (
                              <button onClick={() => removeReason(sr.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {((regSubTab === 'ccs' && (!state.costCenters || state.costCenters.length === 0)) ||
                    (regSubTab === 'equipments' && (!state.pcmEquipments || state.pcmEquipments.length === 0)) ||
                    (regSubTab === 'reasons' && (!state.pcmStoppageReasons || state.pcmStoppageReasons.length === 0))) && (
                    <div className="p-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      Nenhum registro encontrado para {regSubTab}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'stoppages' && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Form */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-900"><Wrench className="w-5 h-5" /></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter italic">Lançar Parada</h3>
                </div>

                {canEdit ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Centro de Custo</label>
                      <select 
                        value={stoppageCC} onChange={e => setStoppageCC(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                      >
                        <option value="">Selecione o CC</option>
                        {state.costCenters?.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Equipamento</label>
                      <select 
                        value={stoppageEq} onChange={e => setStoppageEq(e.target.value)}
                        disabled={!stoppageCC}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all disabled:opacity-50"
                      >
                        <option value="">Selecione o Equipamento</option>
                        {state.pcmEquipments?.filter(eq => eq.costCenterId === stoppageCC).map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.name} ({eq.code})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Motivo da Parada</label>
                      <select 
                        value={stoppageReason} onChange={e => setStoppageReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                      >
                        <option value="">Selecione o Motivo</option>
                        {state.pcmStoppageReasons?.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Início</label>
                        <input 
                          type="datetime-local" value={stoppageStart} onChange={e => setStoppageStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Previsão Fim</label>
                        <input 
                          type="datetime-local" value={stoppageEnd} onChange={e => setStoppageEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Observações</label>
                      <textarea 
                        value={stoppageDesc} onChange={e => setStoppageDesc(e.target.value)}
                        placeholder="Detalhes técnicos da parada..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all h-24 resize-none"
                      />
                    </div>

                    <button onClick={addStoppage} className="w-full bg-[#344434] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/20">
                      <Plus className="w-5 h-5" /> Registrar Parada
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase">Sem permissão para registro</p>
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            <div className="xl:col-span-3 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl text-slate-400"><HistoryIcon className="w-4 h-4" /></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter italic">Histórico de Paradas</h3>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total: {state.pcmProductionStoppages?.length || 0} registros</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.pcmProductionStoppages?.sort((a, b) => new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime()).map(s => {
                  const cc = state.costCenters?.find(c => c.id === s.costCenterId);
                  const eq = state.pcmEquipments?.find(e => e.id === s.equipmentId);
                  const reason = state.pcmStoppageReasons?.find(r => r.id === s.reasonId);
                  const start = new Date(s.startDateTime);
                  const end = new Date(s.endDateTime);
                  const durationMs = end.getTime() - start.getTime();
                  const durationHrs = Math.floor(durationMs / (1000 * 60 * 60));
                  const durationMins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <div key={s.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 relative group transition-all hover:shadow-md">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black px-2 py-0.5 bg-red-50 text-red-600 rounded-full uppercase tracking-widest border border-red-100">Parado</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cc?.name}</span>
                          </div>
                          <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter italic">{eq?.name}</h4>
                          <p className="text-[11px] font-bold text-slate-500 uppercase">{reason?.name}</p>
                        </div>
                        {canEdit && (
                          <button onClick={() => removeStoppage(s.id)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Início</p>
                          <p className="text-xs font-black text-slate-700">{start.toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> Duração</p>
                          <p className="text-xs font-black text-[#344434]">{durationHrs}h {durationMins}m</p>
                        </div>
                      </div>

                      {s.description && (
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-auto">
                          <p className="text-[10px] font-bold text-slate-500 italic uppercase leading-relaxed line-clamp-2">{s.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(!state.pcmProductionStoppages || state.pcmProductionStoppages.length === 0) && (
                <div className="p-20 text-center bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HistoryIcon className="w-8 h-8 text-slate-200" />
                  </div>
                  <h4 className="text-lg font-black text-slate-300 uppercase tracking-widest italic">Nenhuma parada registrada</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'improvements' && (
        <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Form */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-50 rounded-xl text-slate-900"><ArrowUpRight className="w-5 h-5" /></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter italic">Solicitar Melhoria</h3>
                </div>

                {canEdit ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Setor / CC</label>
                      <select 
                        value={impCC} onChange={e => setImpCC(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                      >
                        <option value="">Selecione o CC</option>
                        {state.costCenters?.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Equipamento Alvo</label>
                      <select 
                        value={impEq} onChange={e => setImpEq(e.target.value)}
                        disabled={!impCC}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all disabled:opacity-50"
                      >
                        <option value="">Selecione o Equipamento</option>
                        {state.pcmEquipments?.filter(eq => eq.costCenterId === impCC).map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Motivo / Título</label>
                      <input 
                        type="text" value={impReason} onChange={e => setImpReason(e.target.value)}
                        placeholder="Ex: Instalação de sensores..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-3 px-2 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <input 
                        type="checkbox" checked={impUrgent} onChange={e => setImpUrgent(e.target.checked)}
                        className="w-5 h-5 rounded-lg accent-[#344434]"
                      />
                      <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">Urgente? / Alta Prioridade</label>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Início Previsto</label>
                        <input 
                          type="date" value={impStart} onChange={e => setImpStart(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Conclusão Prevista</label>
                        <input 
                          type="date" value={impEnd} onChange={e => setImpEnd(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Justificativa / Escopo</label>
                      <textarea 
                        value={impDesc} onChange={e => setImpDesc(e.target.value)}
                        placeholder="Quais melhorias serão feitas..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#344434]/20 transition-all h-24 resize-none"
                      />
                    </div>

                    <button onClick={addImprovement} className="w-full bg-[#344434] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/20">
                      <Plus className="w-5 h-5" /> Enviar Solicitação
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-400 uppercase">Sem permissão para registro</p>
                  </div>
                )}
              </div>
            </div>

            {/* List */}
            <div className="xl:col-span-3 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl text-slate-400"><TrendingDown className="w-4 h-4 rotate-180" /></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter italic">Quadro de Melhorias</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.pcmPlannedImprovements?.sort((a, b) => b.isUrgent ? 1 : -1).map(imp => {
                  const cc = state.costCenters?.find(c => c.id === imp.costCenterId);
                  const eq = state.pcmEquipments?.find(e => e.id === imp.equipmentId);
                  
                  return (
                    <div key={imp.id} className={`bg-white p-6 rounded-3xl border ${imp.isUrgent ? 'border-red-200 shadow-md ring-1 ring-red-50' : 'border-slate-200 shadow-sm'} flex flex-col gap-5 relative transition-all hover:scale-[1.01]`}>
                      <div className="flex justify-between items-start">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${
                              imp.status === 'Concluído' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              imp.status === 'Em Andamento' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {imp.status}
                            </span>
                            {imp.isUrgent && (
                              <span className="text-[9px] font-black px-2 py-0.5 bg-red-600 text-white rounded-full uppercase tracking-widest flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Urgente
                              </span>
                            )}
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{cc?.name}</span>
                          </div>
                          <h4 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-tight">{imp.reason}</h4>
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                            <span className="text-[#344434] opacity-50"><HardDrive className="w-3 h-3 inline mr-1" /> {eq?.name}</span>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex flex-col gap-1 items-end">
                            <button onClick={() => removeImp(imp.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all mb-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <select 
                              value={imp.status} onChange={e => updateImpStatus(imp.id, e.target.value as any)}
                              className="text-[9px] font-black uppercase bg-slate-50 border border-slate-200 rounded-lg p-1 px-2 focus:outline-none"
                            >
                              <option value="Pendente">Pendente</option>
                              <option value="Em Andamento">Em Andamento</option>
                              <option value="Concluído">Concluído</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-900 rounded-[24px] p-5 grid grid-cols-2 gap-6 shadow-inner">
                        <div className="space-y-1">
                          <p className="text-[9px] font-black text-[#e4e4d4]/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">Início Prev.</p>
                          <p className="text-xs font-black text-[#e4e4d4]">{new Date(imp.plannedStartDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="space-y-1 border-l border-[#e4e4d4]/10 pl-6">
                          <p className="text-[9px] font-black text-[#e4e4d4]/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">Fim Prev.</p>
                          <p className="text-xs font-black text-[#e4e4d4]">{new Date(imp.plannedEndDate).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>

                      {imp.description && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escopo da Melhoria</p>
                          <p className="text-[11px] font-bold text-slate-600 uppercase leading-relaxed italic">{imp.description}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {(!state.pcmPlannedImprovements || state.pcmPlannedImprovements.length === 0) && (
                <div className="p-24 text-center bg-[#344434]/5 rounded-3xl border border-dashed border-[#344434]/20 shadow-inner">
                  <div className="w-20 h-20 bg-[#344434]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ArrowUpRight className="w-10 h-10 text-[#344434]/20" />
                  </div>
                  <h4 className="text-xl font-black text-[#344434]/20 uppercase tracking-widest italic">Nenhuma melhoria planejada</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple helper icon
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const TrendingDown = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

export default PCMManagement;
