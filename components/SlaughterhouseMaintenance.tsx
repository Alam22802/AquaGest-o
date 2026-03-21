
import React, { useState, useMemo } from 'react';
import { AppState, User, ColdStorageLog, UtilityLog } from '../types';
import { Thermometer, Droplets, Zap, Plus, Trash2, Calendar, Info, CheckCircle2, AlertTriangle, History, Search } from 'lucide-react';
import { format } from 'date-fns';

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

const SlaughterhouseMaintenance: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'temperature' | 'utilities'>('temperature');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Temperature Form State
  const [tempData, setTempData] = useState({
    date: new Date().toISOString().split('T')[0],
    chamberName: '',
    temperature: ''
  });

  // Utility Form State
  const [utilityData, setUtilityData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'energy' as 'water' | 'energy',
    reading: '',
    horimetro: ''
  });

  // Utility Filter State
  const [utilityFilter, setUtilityFilter] = useState({
    type: 'all' as 'all' | 'energy' | 'water',
    startDate: '',
    endDate: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSaveTemp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!tempData.chamberName || !tempData.temperature) return;

    const newLog: ColdStorageLog = {
      id: generateId(),
      date: tempData.date,
      chamberName: tempData.chamberName,
      temperature: Number(tempData.temperature),
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      updatedAt: Date.now()
    };

    onUpdate({
      ...state,
      coldStorageLogs: [newLog, ...(state.coldStorageLogs || [])]
    });

    setTempData({ ...tempData, chamberName: '', temperature: '' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveUtility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!utilityData.reading) return;

    const newLog: UtilityLog = {
      id: generateId(),
      date: utilityData.date,
      type: utilityData.type,
      reading: Number(utilityData.reading),
      horimetro: utilityData.type === 'water' ? Number(utilityData.horimetro) : undefined,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      updatedAt: Date.now()
    };

    onUpdate({
      ...state,
      utilityLogs: [newLog, ...(state.utilityLogs || [])]
    });

    setUtilityData({ ...utilityData, reading: '', horimetro: '' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const removeTempLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de temperatura?')) return;
    onUpdate({
      ...state,
      coldStorageLogs: (state.coldStorageLogs || []).filter(l => l.id !== id)
    });
  };

  const removeUtilityLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de consumo?')) return;
    onUpdate({
      ...state,
      utilityLogs: (state.utilityLogs || []).filter(l => l.id !== id)
    });
  };

  const filteredTempLogs = useMemo(() => {
    const logs = [...(state.coldStorageLogs || [])];
    return logs
      .filter(l => l.chamberName.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));
  }, [state.coldStorageLogs, searchTerm]);

  const filteredUtilityLogs = useMemo(() => {
    let logs = [...(state.utilityLogs || [])];
    
    if (utilityFilter.type !== 'all') {
      logs = logs.filter(l => l.type === utilityFilter.type);
    }
    
    if (utilityFilter.startDate) {
      logs = logs.filter(l => l.date >= utilityFilter.startDate);
    }
    
    if (utilityFilter.endDate) {
      logs = logs.filter(l => l.date <= utilityFilter.endDate);
    }

    return logs.sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));
  }, [state.utilityLogs, utilityFilter]);

  const getConsumption = (currentLog: UtilityLog) => {
    const allLogs = state.utilityLogs || [];
    const sameTypeLogs = allLogs
      .filter(l => l.type === currentLog.type)
      .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp.localeCompare(a.timestamp));
    
    const currentIndex = sameTypeLogs.findIndex(l => l.id === currentLog.id);
    if (currentIndex === -1 || currentIndex === sameTypeLogs.length - 1) return null;
    
    const previousLog = sameTypeLogs[currentIndex + 1];
    return currentLog.reading - previousLog.reading;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Sub-tabs Header */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveSubTab('temperature')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'temperature' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Thermometer className="w-4 h-4" />
          Temperaturas
        </button>
        <button 
          onClick={() => setActiveSubTab('utilities')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'utilities' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Droplets className="w-4 h-4" />
          Consumo Água/Energia
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Form Column */}
        <div className="lg:col-span-1 lg:sticky lg:top-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter italic">
              {activeSubTab === 'temperature' ? (
                <><Thermometer className="w-6 h-6 text-blue-600" /> Registro de Temperatura</>
              ) : (
                <><Zap className="w-6 h-6 text-amber-500" /> Registro de Consumo</>
              )}
            </h3>

            {activeSubTab === 'temperature' ? (
              <form onSubmit={handleSaveTemp} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Câmara Fria *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Câmara 01 - Estocagem"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={tempData.chamberName}
                    onChange={e => setTempData({ ...tempData, chamberName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Temperatura (°C) *</label>
                  <input 
                    type="number" 
                    step="0.1"
                    required
                    placeholder="-18.0"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={tempData.temperature}
                    onChange={e => setTempData({ ...tempData, temperature: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Data</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-sm"
                    value={tempData.date}
                    onChange={e => setTempData({ ...tempData, date: e.target.value })}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!hasPermission}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  Salvar Temperatura
                </button>
              </form>
            ) : (
              <form onSubmit={handleSaveUtility} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Tipo de Consumo *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUtilityData({ ...utilityData, type: 'energy' })}
                      className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${utilityData.type === 'energy' ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white text-slate-400 border-slate-200 hover:border-amber-200'}`}
                    >
                      <Zap className="w-3 h-3" /> Energia
                    </button>
                    <button
                      type="button"
                      onClick={() => setUtilityData({ ...utilityData, type: 'water' })}
                      className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${utilityData.type === 'water' ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-white text-slate-400 border-slate-200 hover:border-blue-200'}`}
                    >
                      <Droplets className="w-3 h-3" /> Água
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                    Leitura Atual ({utilityData.type === 'energy' ? 'kWh' : 'm³'}) *
                  </label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={utilityData.reading}
                    onChange={e => setUtilityData({ ...utilityData, reading: e.target.value })}
                  />
                </div>

                {utilityData.type === 'water' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Horímetro (h)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      placeholder="0.0"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                      value={utilityData.horimetro}
                      onChange={e => setUtilityData({ ...utilityData, horimetro: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Data</label>
                  <input 
                    type="date" 
                    required
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-sm"
                    value={utilityData.date}
                    onChange={e => setUtilityData({ ...utilityData, date: e.target.value })}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!hasPermission}
                  className={`w-full py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all active:scale-95 disabled:opacity-50 ${utilityData.type === 'energy' ? 'bg-amber-600 shadow-amber-600/20 hover:bg-amber-700' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}
                >
                  Salvar Leitura
                </button>
              </form>
            )}

            {saveSuccess && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Sucesso!</span>
              </div>
            )}
          </div>
        </div>

        {/* History Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  Histórico de {activeSubTab === 'temperature' ? 'Temperaturas' : 'Consumo'}
                </h3>
              </div>
              
              {activeSubTab === 'temperature' ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Filtrar câmara..."
                    className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10 w-full md:w-48"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                    value={utilityFilter.type}
                    onChange={e => setUtilityFilter({ ...utilityFilter, type: e.target.value as any })}
                  >
                    <option value="all">Todos Tipos</option>
                    <option value="energy">Energia</option>
                    <option value="water">Água</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input 
                      type="date"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={utilityFilter.startDate}
                      onChange={e => setUtilityFilter({ ...utilityFilter, startDate: e.target.value })}
                    />
                    <span className="text-[10px] font-black text-slate-400">A</span>
                    <input 
                      type="date"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                      value={utilityFilter.endDate}
                      onChange={e => setUtilityFilter({ ...utilityFilter, endDate: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    {activeSubTab === 'temperature' ? (
                      <>
                        <th className="px-6 py-4">Câmara</th>
                        <th className="px-6 py-4 text-right">Temperatura</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4 text-right">Leitura</th>
                        <th className="px-6 py-4 text-right">Consumo</th>
                        <th className="px-6 py-4 text-right">Horímetro</th>
                      </>
                    )}
                    <th className="px-6 py-4">Lançado por</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSubTab === 'temperature' ? (
                    filteredTempLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-slate-800 uppercase italic">{log.chamberName}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xs font-black ${log.temperature > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {log.temperature.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                          {state.users.find(u => u.id === log.userId)?.name || '---'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasPermission && (
                            <button 
                              onClick={() => removeTempLog(log.id)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredUtilityLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {log.type === 'energy' ? (
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Droplets className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span className="text-xs font-black text-slate-800 uppercase italic">
                              {log.type === 'energy' ? 'Energia' : 'Água'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-black text-slate-800">
                            {log.reading.toLocaleString('pt-BR')} {log.type === 'energy' ? 'kWh' : 'm³'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-black text-emerald-600">
                            {getConsumption(log) !== null ? `+${getConsumption(log)?.toLocaleString('pt-BR')}` : '---'} {log.type === 'energy' ? 'kWh' : 'm³'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-black text-slate-800">
                            {log.horimetro ? `${log.horimetro.toLocaleString('pt-BR')} h` : '---'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                          {state.users.find(u => u.id === log.userId)?.name || '---'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasPermission && (
                            <button 
                              onClick={() => removeUtilityLog(log.id)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  {((activeSubTab === 'temperature' && filteredTempLogs.length === 0) || 
                    (activeSubTab === 'utilities' && filteredUtilityLogs.length === 0)) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <AlertTriangle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum registro encontrado.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Info className="w-32 h-32" />
            </div>
            <h4 className="text-lg font-black uppercase tracking-tighter italic mb-4 flex items-center gap-2">
              <Info className="w-5 h-5" />
              Dicas de Manutenção
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
              <div className="space-y-2">
                <p className="text-blue-200">Temperaturas:</p>
                <p>Câmaras de congelados devem operar entre -18°C e -22°C.</p>
                <p>Câmaras de resfriados devem operar entre 0°C e 4°C.</p>
              </div>
              <div className="space-y-2">
                <p className="text-blue-200">Consumo:</p>
                <p>Monitore picos de consumo de energia para identificar falhas em compressores.</p>
                <p>Vazamentos de água podem ser detectados por leituras anormais fora do horário de produção.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlaughterhouseMaintenance;
