
import React, { useState, useMemo } from 'react';
import { AppState, User, ColdStorageLog, UtilityLog, ColdChamber } from '../types';
import { Thermometer, Droplets, Zap, Plus, Trash2, Calendar, Info, CheckCircle2, AlertTriangle, History, Search, Warehouse, Clock, Edit, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { mmToPt } from 'jspdf';

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
  const [activeSubTab, setActiveSubTab] = useState<'temperature' | 'utilities' | 'chambers'>('temperature');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Chamber Form State
  const [chamberData, setChamberData] = useState({
    name: '',
    description: ''
  });
  const [editingChamberId, setEditingChamberId] = useState<string | null>(null);

  // Temperature Form State
  const [tempData, setTempData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: format(new Date(), 'HH:mm'),
    chamberId: '',
    temperature: ''
  });

  // Utility Form State
  const [utilityData, setUtilityData] = useState({
    id: '',
    date: new Date().toISOString().split('T')[0],
    type: 'energy' as 'water' | 'energy',
    reading: '',
    horimetro: '',
    hidrometro: ''
  });

  // Utility Filter State
  const [utilityFilter, setUtilityFilter] = useState({
    type: 'all' as 'all' | 'energy' | 'water'
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSaveTemp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!tempData.chamberId || !tempData.temperature) return;

    const newLog: ColdStorageLog = {
      id: generateId(),
      date: tempData.date,
      time: tempData.time,
      chamberId: tempData.chamberId,
      temperature: tempData.temperature,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      updatedAt: Date.now()
    };

    onUpdate({
      ...state,
      coldStorageLogs: [newLog, ...(state.coldStorageLogs || [])]
    });

    setTempData({ ...tempData, temperature: '', time: format(new Date(), 'HH:mm') });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveChamber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!chamberData.name) return;

    if (editingChamberId) {
      const updatedChambers = (state.coldChambers || []).map(c => 
        c.id === editingChamberId ? { ...c, ...chamberData, updatedAt: Date.now() } : c
      );
      onUpdate({ ...state, coldChambers: updatedChambers });
      setEditingChamberId(null);
    } else {
      const newChamber: ColdChamber = {
        id: generateId(),
        name: chamberData.name,
        description: chamberData.description,
        userId: currentUser.id,
        updatedAt: Date.now()
      };
      onUpdate({
        ...state,
        coldChambers: [...(state.coldChambers || []), newChamber]
      });
    }

    setChamberData({ name: '', description: '' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const removeChamber = (id: string) => {
    if (!hasPermission) return;
    const hasLogs = (state.coldStorageLogs || []).some(l => l.chamberId === id);
    if (hasLogs) {
      alert('Não é possível excluir uma câmara que possui registros de temperatura.');
      return;
    }
    if (!confirm('Deseja excluir esta câmara fria?')) return;
    onUpdate({
      ...state,
      coldChambers: (state.coldChambers || []).filter(c => c.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const handleSaveUtility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!utilityData.reading) return;

    if (utilityData.id) {
      // Update existing log
      const updatedLogs = (state.utilityLogs || []).map(l => 
        l.id === utilityData.id ? {
          ...l,
          date: utilityData.date,
          type: utilityData.type,
          reading: Number(utilityData.reading),
          horimetro: utilityData.type === 'water' && utilityData.horimetro ? Number(utilityData.horimetro) : undefined,
          hidrometro: utilityData.type === 'water' ? utilityData.hidrometro : undefined,
          updatedAt: Date.now()
        } : l
      );
      onUpdate({ ...state, utilityLogs: updatedLogs });
    } else {
      // Create new log
      const newLog: UtilityLog = {
        id: generateId(),
        date: utilityData.date,
        type: utilityData.type,
        reading: Number(utilityData.reading),
        horimetro: utilityData.type === 'water' && utilityData.horimetro ? Number(utilityData.horimetro) : undefined,
        hidrometro: utilityData.type === 'water' ? utilityData.hidrometro : undefined,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
        updatedAt: Date.now()
      };

      onUpdate({
        ...state,
        utilityLogs: [newLog, ...(state.utilityLogs || [])]
      });
    }

    setUtilityData({ id: '', date: new Date().toISOString().split('T')[0], type: utilityData.type, reading: '', horimetro: '', hidrometro: '' });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const removeTempLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de temperatura?')) return;
    onUpdate({
      ...state,
      coldStorageLogs: (state.coldStorageLogs || []).filter(l => l.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const removeUtilityLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de consumo?')) return;
    onUpdate({
      ...state,
      utilityLogs: (state.utilityLogs || []).filter(l => l.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const filteredTempLogs = useMemo(() => {
    let logs = [...(state.coldStorageLogs || [])];
    
    if (dateFilter.startDate) {
      logs = logs.filter(l => l.date >= dateFilter.startDate);
    }
    
    if (dateFilter.endDate) {
      logs = logs.filter(l => l.date <= dateFilter.endDate);
    }

    return logs
      .filter(l => {
        const chamber = (state.coldChambers || []).find(c => c.id === l.chamberId);
        return !searchTerm || (chamber?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const comparison = a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.timestamp.localeCompare(b.timestamp);
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [state.coldStorageLogs, state.coldChambers, searchTerm, dateFilter, sortOrder]);

  const filteredUtilityLogs = useMemo(() => {
    let logs = [...(state.utilityLogs || [])];
    
    if (dateFilter.startDate) {
      logs = logs.filter(l => l.date >= dateFilter.startDate);
    }
    
    if (dateFilter.endDate) {
      logs = logs.filter(l => l.date <= dateFilter.endDate);
    }

    if (utilityFilter.type !== 'all') {
      logs = logs.filter(l => l.type === utilityFilter.type);
    }
    
    return logs.sort((a, b) => {
      const comparison = a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp);
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [state.utilityLogs, utilityFilter, dateFilter, sortOrder]);

  const handleGeneratePDF = () => {
    if (!state.coldStorageLogs || state.coldStorageLogs.length === 0) return;

    const doc = new jsPDF();
    const title = 'Relatório de Monitoramento de Temperaturas';
    const dateRange = dateFilter.startDate && dateFilter.endDate 
      ? `Período: ${format(new Date(dateFilter.startDate + 'T12:00:00'), 'dd/MM/yyyy')} até ${format(new Date(dateFilter.endDate + 'T12:00:00'), 'dd/MM/yyyy')}`
      : 'Período: Histórico Completo';

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

    let currentY = 45;

    // Group logs by chamber
    const chambers = state.coldChambers || [];
    chambers.forEach((chamber, index) => {
      const chamberLogs = (state.coldStorageLogs || [])
        .filter(l => l.chamberId === chamber.id)
        .filter(l => {
          if (dateFilter.startDate && l.date < dateFilter.startDate) return false;
          if (dateFilter.endDate && l.date > dateFilter.endDate) return false;
          return true;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      if (chamberLogs.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Câmara: ${chamber.name}`, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [['Data', 'Hora', 'Temperatura', 'Responsável']],
          body: chamberLogs.map(log => [
            format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy'),
            log.time,
            !isNaN(Number(log.temperature)) ? `${log.temperature} °C` : log.temperature,
            state.users.find(u => u.id === log.userId)?.name || '---'
          ]),
          theme: 'striped',
          headStyles: { fillStyle: 'fill', fillColor: [51, 65, 85] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    doc.save(`relatorio_temperaturas_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const handleGenerateUtilityPDF = () => {
    if (!state.utilityLogs || state.utilityLogs.length === 0) return;

    const doc = new jsPDF();
    const title = 'Relatório de Consumo de Utilitários (Água/Energia)';
    const dateRange = dateFilter.startDate && dateFilter.endDate 
      ? `Período: ${format(new Date(dateFilter.startDate + 'T12:00:00'), 'dd/MM/yyyy')} até ${format(new Date(dateFilter.endDate + 'T12:00:00'), 'dd/MM/yyyy')}`
      : 'Período: Histórico Completo';

    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(dateRange, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 35);

    let currentY = 45;

    const types: ('energy' | 'water')[] = ['energy', 'water'];
    types.forEach((type) => {
      // Filter logs by type and current filters
      const typeLogs = (state.utilityLogs || [])
        .filter(l => l.type === type)
        .filter(l => {
          if (dateFilter.startDate && l.date < dateFilter.startDate) return false;
          if (dateFilter.endDate && l.date > dateFilter.endDate) return false;
          if (utilityFilter.type !== 'all' && l.type !== utilityFilter.type) return false;
          return true;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp));

      if (typeLogs.length > 0) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Tipo: ${type === 'energy' ? 'Energia' : 'Água'}`, 14, currentY);
        currentY += 5;

        const columns = type === 'water' 
          ? [
              { header: 'Data', dataKey: 'date' },
              { header: 'Leitura', dataKey: 'reading' },
              { header: 'Consumo', dataKey: 'consumption' },
              { header: 'Hidrômetro', dataKey: 'hidrometro' },
              { header: 'Horímetro', dataKey: 'horimetro' },
              { header: 'Responsável', dataKey: 'user' }
            ]
          : [
              { header: 'Data', dataKey: 'date' },
              { header: 'Leitura', dataKey: 'reading' },
              { header: 'Consumo', dataKey: 'consumption' },
              { header: 'Horímetro', dataKey: 'horimetro' },
              { header: 'Responsável', dataKey: 'user' }
            ];

        autoTable(doc, {
          startY: currentY,
          columns: columns,
          body: typeLogs.map(log => {
            const consumption = getConsumption(log);
            const horimetroDiff = getHorimetroDiff(log);
            const row: any = {
              date: format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy'),
              reading: log.reading.toLocaleString('pt-BR'),
              consumption: consumption !== null ? `+${consumption.toLocaleString('pt-BR')}` : '---',
              horimetro: log.horimetro 
                ? (() => {
                    const hNum = Number(log.horimetro);
                    const diff = getHorimetroDiff(log);
                    let diffStr = '';
                    if (diff !== null) {
                      const absDiff = Math.abs(diff);
                      const dh = Math.floor(absDiff / 60);
                      const dm = Math.round(absDiff % 60);
                      const sign = diff >= 0 ? '+' : '-';
                      diffStr = ` (${sign}${dh.toString().padStart(2, '0')}:${dm.toString().padStart(2, '0')} h)`;
                    }
                    return `${hNum.toLocaleString('pt-BR')}${diffStr}`;
                  })()
                : '---',
              user: state.users.find(u => u.id === log.userId)?.name || '---'
            };
            if (type === 'water') row.hidrometro = log.hidrometro || '---';
            return row;
          }),
          theme: 'striped',
          headStyles: { fillStyle: 'fill', fillColor: type === 'energy' ? [217, 119, 6] : [37, 99, 235] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    doc.save(`relatorio_utilitarios_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

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

  const getHorimetroDiff = (currentLog: UtilityLog) => {
    const currentH = currentLog.horimetro !== null && currentLog.horimetro !== undefined ? Number(currentLog.horimetro) : null;
    if (currentH === null || isNaN(currentH)) return null;

    const allLogs = state.utilityLogs || [];
    const sameTypeLogs = [...allLogs]
      .filter(l => l.type === currentLog.type)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.timestamp || '').localeCompare(a.timestamp || ''));
    
    const currentIndex = sameTypeLogs.findIndex(l => l.id === currentLog.id);
    if (currentIndex === -1) return null;
    
    const previousLogs = sameTypeLogs.slice(currentIndex + 1);
    const previousLog = previousLogs.find(l => {
      const h = l.horimetro !== null && l.horimetro !== undefined ? Number(l.horimetro) : null;
      return h !== null && !isNaN(h);
    });
    
    if (!previousLog) return null;
    const prevH = Number(previousLog.horimetro);
    return currentH - prevH;
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
        <button 
          onClick={() => setActiveSubTab('chambers')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === 'chambers' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Warehouse className="w-4 h-4" />
          Câmaras Frias
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
                  <select 
                    required
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={tempData.chamberId}
                    onChange={e => setTempData({ ...tempData, chamberId: e.target.value })}
                  >
                    <option value="">Selecione a câmara...</option>
                    {(state.coldChambers || []).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {(state.coldChambers || []).length === 0 && (
                    <p className="text-[9px] text-amber-600 font-bold uppercase mt-1">
                      Nenhuma câmara cadastrada. Vá na aba "Câmaras Frias".
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Horário</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="time" 
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-sm"
                        value={tempData.time}
                        onChange={e => setTempData({ ...tempData, time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Temperatura / Status *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: -18.0 ou Desligado"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={tempData.temperature}
                    onChange={e => setTempData({ ...tempData, temperature: e.target.value })}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!hasPermission || (state.coldChambers || []).length === 0}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  Salvar Temperatura
                </button>
              </form>
            ) : activeSubTab === 'chambers' ? (
              <form onSubmit={handleSaveChamber} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome da Câmara *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: Câmara 01 - Estocagem"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                    value={chamberData.name}
                    onChange={e => setChamberData({ ...chamberData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Descrição / Observações</label>
                  <textarea 
                    placeholder="Opcional..."
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm min-h-[100px]"
                    value={chamberData.description}
                    onChange={e => setChamberData({ ...chamberData, description: e.target.value })}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={!hasPermission}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  {editingChamberId ? 'Salvar Alterações' : 'Cadastrar Câmara'}
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

                {utilityData.type === 'water' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">HIDROMETRO</label>
                    <input 
                      type="text" 
                      placeholder="Nº do Registro"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                      value={utilityData.hidrometro}
                      onChange={e => setUtilityData({ ...utilityData, hidrometro: e.target.value })}
                    />
                  </div>
                )}

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
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Horímetro (min)</label>
                    <input 
                      type="number" 
                      step="1"
                      placeholder="Minutos"
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
                  {utilityData.id ? 'Salvar Alterações' : 'Salvar Leitura'}
                </button>
                {utilityData.id && (
                  <button 
                    type="button"
                    onClick={() => setUtilityData({ id: '', date: new Date().toISOString().split('T')[0], type: utilityData.type, reading: '', horimetro: '', hidrometro: '' })}
                    className="w-full py-3 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 transition-colors"
                  >
                    Cancelar Edição
                  </button>
                )}
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
                  Histórico de {activeSubTab === 'temperature' ? 'Temperaturas' : activeSubTab === 'chambers' ? 'Câmaras Frias' : 'Consumo'}
                </h3>
              </div>
              {activeSubTab !== 'chambers' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="date"
                      className="bg-transparent text-[10px] font-bold outline-none text-slate-600"
                      value={dateFilter.startDate}
                      onChange={e => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                    />
                    <span className="text-[10px] font-black text-slate-300">ATÉ</span>
                    <input 
                      type="date"
                      className="bg-transparent text-[10px] font-bold outline-none text-slate-600"
                      value={dateFilter.endDate}
                      onChange={e => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                    />
                    {(dateFilter.startDate || dateFilter.endDate) && (
                      <button 
                        onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                  >
                    <Clock className="w-3 h-3" />
                    {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
                  </button>

                  {activeSubTab === 'temperature' && (
                    <button
                      onClick={handleGeneratePDF}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                      <FileText className="w-3 h-3" />
                      Gerar PDF
                    </button>
                  )}
                </div>
              )}
              
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
              ) : activeSubTab === 'utilities' ? (
                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/10"
                    value={utilityFilter.type}
                    onChange={e => setUtilityFilter({ ...utilityFilter, type: e.target.value as any })}
                  >
                    <option value="all">Todos Tipos</option>
                    <option value="energy">Energia</option>
                    <option value="water">Água</option>
                  </select>

                  <button
                    onClick={handleGenerateUtilityPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                  >
                    <FileText className="w-3 h-3" />
                    Gerar PDF
                  </button>
                </div>
              ) : null}
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
                        <th className="px-6 py-4 text-right">Leitura (m³)</th>
                        <th className="px-6 py-4 text-right">Consumo (m³)</th>
                        <th className="px-6 py-4 text-right">Hidrômetro</th>
                        <th className="px-6 py-4 text-right">Horímetro (min)</th>
                      </>
                    )}
                    <th className="px-6 py-4">Lançado por</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeSubTab === 'temperature' ? (
                    filteredTempLogs.map(log => {
                      const chamber = (state.coldChambers || []).find(c => c.id === log.chamberId);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-bold text-slate-600">
                            <div className="flex flex-col">
                              <span>{format(new Date(log.date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                              <span className="text-[9px] font-black text-slate-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {log.time}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-black text-slate-800 uppercase italic">
                              {chamber?.name || (log.chamberId?.startsWith('chamber-') ? log.chamberId.replace('chamber-', '').toUpperCase() : '---')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`text-xs font-black ${!isNaN(Number(log.temperature)) && Number(log.temperature) > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {!isNaN(Number(log.temperature)) 
                                ? `${Number(log.temperature).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`
                                : log.temperature
                              }
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
                      );
                    })
                  ) : activeSubTab === 'chambers' ? (
                    (state.coldChambers || []).map(chamber => (
                      <tr key={chamber.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-600" colSpan={2}>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 uppercase italic">{chamber.name}</span>
                            {chamber.description && <span className="text-[10px] text-slate-400 font-bold">{chamber.description}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {(state.coldStorageLogs || []).filter(l => l.chamberId === chamber.id).length} registros
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                          {state.users.find(u => u.id === chamber.userId)?.name || '---'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasPermission && (
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditingChamberId(chamber.id);
                                  setChamberData({ name: chamber.name, description: chamber.description || '' });
                                  setActiveSubTab('chambers');
                                }}
                                className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => removeChamber(chamber.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
                            {log.reading.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-black text-emerald-600">
                            {getConsumption(log) !== null ? `+${getConsumption(log)?.toLocaleString('pt-BR')}` : '---'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-xs font-black text-slate-800">
                            {log.hidrometro || '---'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {(() => {
                            const currentH = log.horimetro !== null && log.horimetro !== undefined ? Number(log.horimetro) : null;
                            if (currentH === null || isNaN(currentH)) return <span className="text-xs font-black text-slate-800">---</span>;
                            
                            const diff = getHorimetroDiff(log);
                            
                            let formattedDiff = '';
                            if (diff !== null) {
                              const absDiff = Math.abs(diff);
                              const h = Math.floor(absDiff / 60);
                              const m = Math.round(absDiff % 60);
                              const sign = diff >= 0 ? '+' : '-';
                              formattedDiff = `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} h`;
                            }
                            
                            return (
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-slate-800">{currentH.toLocaleString('pt-BR')}</span>
                                {diff !== null && (
                                  <span className={`text-[10px] font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    ({formattedDiff})
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">
                          {(() => {
                            const user = state.users.find(u => u.id === log.userId);
                            if (!user) return '---';
                            const nameParts = user.name.split(' ');
                            return nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` : user.name;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasPermission && (
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => {
                                  setUtilityData({
                                    id: log.id,
                                    date: log.date,
                                    type: log.type,
                                    reading: log.reading.toString(),
                                    horimetro: log.horimetro ? log.horimetro.toString() : '',
                                    hidrometro: log.hidrometro || ''
                                  });
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="p-2 text-slate-300 hover:text-blue-600 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => removeUtilityLog(log.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
