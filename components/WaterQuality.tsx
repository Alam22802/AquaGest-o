
import React, { useState, useMemo } from 'react';
import { AppState, WaterLog, User } from '../types';
import { Thermometer, Droplets, Wind, Plus, Trash2, Edit3, X, ArrowUpDown, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const WaterQuality: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: format(new Date(), 'HH:mm'),
    temperature: '',
    ph: '',
    oxygen: '',
    transparency: ''
  });

  const sortedLogs = useMemo(() => {
    return [...state.waterLogs].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.time}:00`).getTime();
      const dateTimeB = new Date(`${b.date}T${b.time}:00`).getTime();
      return sortOrder === 'desc' ? dateTimeB - dateTimeA : dateTimeA - dateTimeB;
    });
  }, [state.waterLogs, sortOrder]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      onUpdate({
        ...state,
        waterLogs: state.waterLogs.map(l => l.id === editingId ? { ...l, date: formData.date, time: formData.time, temperature: Number(formData.temperature), ph: Number(formData.ph), oxygen: Number(formData.oxygen), transparency: Number(formData.transparency) } : l)
      });
      setEditingId(null);
    } else {
      const newLog: WaterLog = {
        id: crypto.randomUUID(),
        date: formData.date,
        time: formData.time,
        temperature: Number(formData.temperature),
        ph: Number(formData.ph),
        oxygen: Number(formData.oxygen),
        transparency: Number(formData.transparency),
        userId: currentUser.id
      };
      onUpdate({ ...state, waterLogs: [newLog, ...state.waterLogs] });
    }
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ date: new Date().toISOString().split('T')[0], time: format(new Date(), 'HH:mm'), temperature: '', ph: '', oxygen: '', transparency: '' });
  };

  const startEdit = (log: WaterLog) => {
    setEditingId(log.id);
    setFormData({ date: log.date, time: log.time, temperature: log.temperature.toString(), ph: log.ph.toString(), oxygen: log.oxygen.toString(), transparency: log.transparency.toString() });
  };

  const removeLog = (id: string) => {
    if (!confirm('Excluir esta medição?')) return;
    onUpdate({ ...state, waterLogs: state.waterLogs.filter(l => l.id !== id) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className={`bg-white p-6 rounded-3xl border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50 shadow-sm' : 'border-slate-200 shadow-sm'}`}>
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
            <div className="flex items-center gap-2">
              <Droplets className={`w-5 h-5 ${editingId ? 'text-amber-500' : 'text-blue-500'}`} />
              {editingId ? 'Editar Medição' : 'Registrar Medição'}
            </div>
            {editingId && <button onClick={resetForm}><X className="w-5 h-5 text-slate-400" /></button>}
          </h3>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <input type="time" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputItem label="Temp (°C)" value={formData.temperature} onChange={val => setFormData({...formData, temperature: val})} icon={<Thermometer className="w-3 h-3" />} />
              <InputItem label="pH" value={formData.ph} onChange={val => setFormData({...formData, ph: val})} icon={<Wind className="w-3 h-3" />} />
              <InputItem label="O2 (mg/L)" value={formData.oxygen} onChange={val => setFormData({...formData, oxygen: val})} icon={<Wind className="w-3 h-3" />} />
              <InputItem label="Visib (cm)" value={formData.transparency} onChange={val => setFormData({...formData, transparency: val})} icon={<Droplets className="w-3 h-3" />} />
            </div>
            <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              {editingId ? 'Salvar Edição' : 'Salvar Medição'}
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Água</h3>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
          </button>
        </div>
        <div className="space-y-3">
          {sortedLogs.map(log => {
            const user = state.users.find(u => u.id === log.userId);
            return (
              <div key={log.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 hover:border-blue-200 transition-colors">
                <div className="flex items-center gap-4 flex-1 w-full">
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 text-center min-w-[70px]">
                    <div className="text-[10px] font-black uppercase">{format(new Date(log.date + 'T12:00:00'), 'dd/MM')}</div>
                    <div className="text-xs font-bold text-slate-600 italic">{log.time}</div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 flex-1">
                    <LogStat label="Temp" value={`${log.temperature}°`} />
                    <LogStat label="pH" value={log.ph} />
                    <LogStat label="O2" value={`${log.oxygen}mg`} />
                    <LogStat label="Lançado por" value={`@${user?.username || '---'}`} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(log)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => removeLog(log.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const InputItem = ({ label, value, onChange, icon }: any) => (
  <div>
    <label className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{icon} {label}</label>
    <input type="number" step="0.1" required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none" value={value} onChange={e => onChange(e.target.value)} />
  </div>
);

const LogStat = ({ label, value }: any) => (
  <div>
    <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</div>
    <div className="text-[11px] font-black text-slate-800">{value}</div>
  </div>
);

export default WaterQuality;
