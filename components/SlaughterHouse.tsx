
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterLog, User } from '../types';
import { Factory, Trash2, Edit3, X, ArrowUpDown, Calendar, Clock, Scale, ClipboardCheck, User as UserIcon, Search, CheckCircle, TrendingUp, ChevronDown, BarChart as BarChartIcon } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const SlaughterHouse: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estados para o quadro de apuração consolidada
  const [summaryStartDate, setSummaryStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [summaryEndDate, setSummaryEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Estados para o gráfico de rendimento mensal
  const [chartMonth, setChartMonth] = useState(new Date().getMonth());
  const [chartYear, setChartYear] = useState(new Date().getFullYear());

  const [formData, setFormData] = useState({
    producer: '',
    date: new Date().toISOString().split('T')[0],
    gtaWeight: '',
    packingList: '',
    receptionWeight: '',
    startTime: format(new Date(), 'HH:mm'),
    slaughterBatch: '',
    endTime: '',
    packedQuantity: '',
    packagingBatch: ''
  });

  // Cálculo dos Resultados Finais baseado no período selecionado
  const slaughterStats = useMemo(() => {
    const logs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];
    const start = startOfDay(parseISO(summaryStartDate));
    const end = endOfDay(parseISO(summaryEndDate));

    const filtered = logs.filter(log => {
      try {
        return isWithinInterval(parseISO(log.date), { start, end });
      } catch {
        return false;
      }
    });

    const totalGta = filtered.reduce((acc, l) => acc + (l.gtaWeight || 0), 0);
    const totalRecep = filtered.reduce((acc, l) => acc + (l.receptionWeight || 0), 0);
    const totalPacked = filtered.reduce((acc, l) => acc + (l.packedQuantity || 0), 0);
    const yieldPercentage = totalRecep > 0 ? (totalPacked / totalRecep) * 100 : 0;

    return { totalGta, totalRecep, totalPacked, yieldPercentage, count: filtered.length };
  }, [state.slaughterLogs, summaryStartDate, summaryEndDate]);

  // Dados para o gráfico de rendimento diário
  const dailyYieldData = useMemo(() => {
    const baseDate = new Date(chartYear, chartMonth, 1);
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    const days = eachDayOfInterval({ start, end });

    const logs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];

    return days.map(day => {
      const dayLogs = logs.filter(log => isSameDay(parseISO(log.date), day));
      
      const dayRecep = dayLogs.reduce((acc, l) => acc + (l.receptionWeight || 0), 0);
      const dayPacked = dayLogs.reduce((acc, l) => acc + (l.packedQuantity || 0), 0);
      const yieldPct = dayRecep > 0 ? (dayPacked / dayRecep) * 100 : 0;

      return {
        name: format(day, 'dd'),
        fullDate: format(day, "dd/MM/yyyy"),
        yield: Number(yieldPct.toFixed(1)),
        recep: dayRecep,
        packed: dayPacked
      };
    }).filter(d => d.recep > 0); 
  }, [state.slaughterLogs, chartMonth, chartYear]);

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.producer.trim()) {
      alert('Por favor, informe o nome do Produtor.');
      return;
    }
    if (!formData.slaughterBatch.trim()) {
      alert('Por favor, informe o Lote de Abate.');
      return;
    }

    const currentLogs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];

    if (editingId) {
      const updatedLogs = currentLogs.map(log => 
        log.id === editingId ? { 
          ...log, 
          producer: formData.producer,
          date: formData.date,
          slaughterBatch: formData.slaughterBatch,
          startTime: formData.startTime,
          endTime: formData.endTime,
          packagingBatch: formData.packagingBatch,
          gtaWeight: Number(formData.gtaWeight) || 0,
          receptionWeight: Number(formData.receptionWeight) || 0,
          packingList: Number(formData.packingList) || 0,
          packedQuantity: Number(formData.packedQuantity) || 0
        } : log
      );
      
      onUpdate({
        ...state,
        slaughterLogs: updatedLogs
      });
      setEditingId(null);
    } else {
      const newLog: SlaughterLog = {
        id: crypto.randomUUID(),
        producer: formData.producer,
        date: formData.date,
        gtaWeight: Number(formData.gtaWeight) || 0,
        packingList: Number(formData.packingList) || 0,
        receptionWeight: Number(formData.receptionWeight) || 0,
        startTime: formData.startTime,
        slaughterBatch: formData.slaughterBatch,
        endTime: formData.endTime,
        packedQuantity: Number(formData.packedQuantity) || 0,
        packagingBatch: formData.packagingBatch,
        userId: currentUser.id,
        timestamp: new Date().toISOString()
      };
      
      onUpdate({ 
        ...state, 
        slaughterLogs: [newLog, ...currentLogs] 
      });
    }
    
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      producer: '',
      date: new Date().toISOString().split('T')[0],
      gtaWeight: '',
      packingList: '',
      receptionWeight: '',
      startTime: format(new Date(), 'HH:mm'),
      slaughterBatch: '',
      endTime: '',
      packedQuantity: '',
      packagingBatch: ''
    });
  };

  const startEdit = (log: SlaughterLog) => {
    if (!hasPermission) return;
    setEditingId(log.id);
    setFormData({
      producer: log.producer,
      date: log.date,
      gtaWeight: (log.gtaWeight || 0).toString(),
      packingList: (log.packingList || 0).toString(),
      receptionWeight: (log.receptionWeight || 0).toString(),
      startTime: log.startTime || '',
      slaughterBatch: log.slaughterBatch || '',
      endTime: log.endTime || '',
      packedQuantity: (log.packedQuantity || 0).toString(),
      packagingBatch: log.packagingBatch || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeLog = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja excluir este registro de frigorífico?')) return;
    onUpdate({ 
      ...state, 
      slaughterLogs: (state.slaughterLogs || []).filter(l => l.id !== id) 
    });
  };

  const filteredLogs = useMemo(() => {
    let logs = Array.isArray(state.slaughterLogs) ? [...state.slaughterLogs] : [];

    if (filterStartDate && filterEndDate) {
      try {
        const start = startOfDay(parseISO(filterStartDate));
        const end = endOfDay(parseISO(filterEndDate));
        logs = logs.filter(log => log.date && isWithinInterval(parseISO(log.date), { start, end }));
      } catch (e) {
        console.error('Erro ao filtrar por data:', e);
      }
    }

    return logs.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.slaughterLogs, filterStartDate, filterEndDate, sortOrder]);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, []);

  return (
    <div className="space-y-8 pb-24">
      {/* Quadro de Resultados Finais - Consolidado */}
      <div className="bg-[#344434] p-8 rounded-[2.5rem] text-[#e4e4d4] shadow-2xl shadow-black/20 relative overflow-hidden group border border-white/5">
         <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
               <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Inteligência de Abate</h3>
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Resultados Finais</h2>
               </div>
               
               {/* Seletor de Período do Quadro */}
               <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex items-center gap-2">
                     <Calendar className="w-4 h-4 opacity-50" />
                     <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Apuração:</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <input 
                        type="date" 
                        value={summaryStartDate} 
                        onChange={e => setSummaryStartDate(e.target.value)}
                        className="bg-transparent border-none text-[11px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-white"
                     />
                     <span className="opacity-30">/</span>
                     <input 
                        type="date" 
                        value={summaryEndDate} 
                        onChange={e => setSummaryEndDate(e.target.value)}
                        className="bg-transparent border-none text-[11px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-white"
                     />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
               <div className="space-y-2 border-l-2 border-white/10 pl-6">
                  <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Total Recepção</div>
                  <div className="text-2xl font-black flex items-baseline gap-1">
                     {slaughterStats.totalRecep.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                     <span className="text-[10px] opacity-40">kg</span>
                  </div>
               </div>
               <div className="space-y-2 border-l-2 border-emerald-500/30 pl-6">
                  <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Total Embalado</div>
                  <div className="text-2xl font-black text-emerald-400 flex items-baseline gap-1">
                     {slaughterStats.totalPacked.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                     <span className="text-[10px] opacity-40">kg</span>
                  </div>
               </div>
               <div className="space-y-2 border-l-2 border-blue-500/30 pl-6">
                  <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Rendimento</div>
                  <div className="text-2xl font-black text-blue-300 flex items-baseline gap-1">
                     {slaughterStats.yieldPercentage.toFixed(1)}
                     <span className="text-[10px] opacity-40">%</span>
                  </div>
               </div>
               <div className="space-y-2 border-l-2 border-white/10 pl-6">
                  <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Total Filé Congelado</div>
                  <div className="text-2xl font-black flex items-baseline gap-1">
                     {slaughterStats.totalGta.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                     <span className="text-[10px] opacity-40">kg</span>
                  </div>
               </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-4 text-[9px] font-black uppercase tracking-widest opacity-40">
               <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  {slaughterStats.count} Lotes Processados no Período
               </div>
            </div>
         </div>
         <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-700">
            <Factory className="w-64 h-64" />
         </div>
      </div>

      {/* Gráfico de Rendimento Diário */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
                 <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Rendimento Diário (%)</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Eficiência de Produção por Dia</p>
              </div>
           </div>

           <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
             <select 
               value={chartMonth} 
               onChange={e => setChartMonth(Number(e.target.value))}
               className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
             >
               {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
             </select>
             <div className="w-[1px] h-4 bg-slate-200"></div>
             <select 
               value={chartYear} 
               onChange={e => setChartYear(Number(e.target.value))}
               className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
             >
               {years.map(y => <option key={y} value={y}>{y}</option>)}
             </select>
           </div>
        </div>

        <div className="h-[300px] w-full">
           <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyYieldData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                 <XAxis 
                   dataKey="name" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}}
                   label={{ value: 'Dia do Mês', position: 'insideBottom', offset: -5, fontSize: 8, fontWeight: 900, fill: '#cbd5e1' }}
                 />
                 <YAxis 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}}
                   domain={[0, 100]}
                   tickFormatter={(val) => `${val}%`}
                 />
                 <Tooltip 
                   cursor={{fill: '#f8fafc'}}
                   contentStyle={{
                     borderRadius: '20px',
                     border: 'none',
                     boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                     padding: '12px'
                   }}
                   itemStyle={{
                     fontSize: '11px',
                     fontWeight: 900,
                     textTransform: 'uppercase'
                   }}
                   labelStyle={{
                     fontSize: '10px',
                     fontWeight: 900,
                     textTransform: 'uppercase',
                     color: '#64748b',
                     marginBottom: '4px'
                   }}
                 />
                 <Bar dataKey="yield" name="Rendimento" radius={[6, 6, 0, 0]}>
                   {dailyYieldData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill="#344434" />
                   ))}
                 </Bar>
              </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      {saveSuccess && (
        <div className="fixed top-24 right-8 z-50 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span className="font-black text-xs uppercase tracking-widest">Sincronizando com a Nuvem...</span>
        </div>
      )}

      {/* Formulário de Registro */}
      {hasPermission ? (
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center justify-between uppercase tracking-tighter italic">
            <div className="flex items-center gap-3">
              <Factory className={`w-6 h-6 ${editingId ? 'text-amber-500' : 'text-slate-900'}`} />
              {editingId ? 'Editar Registro de Abate' : 'Novo Registro - Frigorífico'}
            </div>
            {editingId && <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-400" /></button>}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1 group">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Produtor *</label>
              <input type="text" required placeholder="Nome do produtor" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-slate-900/10 transition-all" value={formData.producer} onChange={e => setFormData({...formData, producer: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Data do Abate</label>
              <input type="date" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Lote Abate *</label>
              <input type="text" required placeholder="Identificação do lote" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.slaughterBatch} onChange={e => setFormData({...formData, slaughterBatch: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Peso Filé Congelado (kg)</label>
              <div className="relative">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.01" placeholder="0.00" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.gtaWeight} onChange={e => setFormData({...formData, gtaWeight: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Peso Recepção (kg)</label>
              <div className="relative">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.01" placeholder="0.00" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.receptionWeight} onChange={e => setFormData({...formData, receptionWeight: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Romaneio (kg)</label>
              <div className="relative">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.01" placeholder="0.00" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.packingList} onChange={e => setFormData({...formData, packingList: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Início Abate</label>
                <input type="time" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Término Abate</label>
                <input type="time" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Embalado (kg)</label>
              <div className="relative">
                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="number" step="0.01" placeholder="0.00" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.packedQuantity} onChange={e => setFormData({...formData, packedQuantity: e.target.value})} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Lote Embalagem</label>
              <input type="text" placeholder="Cód. Embalagem" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" value={formData.packagingBatch} onChange={e => setFormData({...formData, packagingBatch: e.target.value})} />
            </div>

            <button type="submit" className={`md:col-span-2 lg:col-span-3 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-4 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-[#344434] shadow-slate-900/20 hover:bg-[#2a382a]'}`}>
              {editingId ? 'Salvar Alterações' : 'Registrar no Frigorífico'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-12 rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
          <Factory className="w-12 h-12 text-slate-300" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-xs font-bold text-slate-400 uppercase">Você não possui permissão para registrar ou editar dados de abate.</p>
        </div>
      )}

      {/* Histórico e Filtros da Tabela */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200">
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="p-3 bg-slate-100 rounded-xl"><Search className="w-5 h-5 text-slate-400" /></div>
             <div className="flex gap-2">
               <input type="date" className="text-xs font-black bg-slate-50 border-none rounded-lg p-2 outline-none" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
               <span className="text-slate-300 self-center">até</span>
               <input type="date" className="text-xs font-black bg-slate-50 border-none rounded-lg p-2 outline-none" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
             </div>
             {(filterStartDate || filterEndDate) && (
               <button onClick={() => {setFilterStartDate(''); setFilterEndDate('');}} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" /></button>
             )}
          </div>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="w-full md:w-auto flex items-center justify-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-50 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors">
            <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Lote / Produtor</th>
                <th className="px-8 py-5">Pesos (Filé/Recep)</th>
                <th className="px-8 py-5">Horário Abate</th>
                <th className="px-8 py-5">Embalado (kg)</th>
                <th className="px-8 py-5">Registrado por</th>
                {hasPermission && <th className="px-8 py-5 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => {
                const user = state.users.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-800 uppercase tracking-tighter italic leading-none">{log.slaughterBatch || 'N/A'}</div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{log.producer || 'Desconhecido'}</div>
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-bold">
                        <Calendar className="w-3 h-3" /> {log.date ? format(parseISO(log.date), 'dd/MM/yyyy') : '--/--/----'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase w-10">FILÉ:</span>
                           <span className="text-xs font-black text-slate-800">{(log.gtaWeight || 0).toFixed(2)}kg</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-[9px] font-black text-slate-400 uppercase w-10">RECEP:</span>
                           <span className="text-xs font-black text-emerald-600">{(log.receptionWeight || 0).toFixed(2)}kg</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                         <Clock className="w-3 h-3 text-slate-300" />
                         <span>{log.startTime || '--:--'} às {log.endTime || '--:--'}</span>
                      </div>
                      <div className="text-[9px] font-black text-slate-400 uppercase mt-1">ROM: {log.packingList ? `${log.packingList} kg` : 'N/A'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-blue-600 text-xs">{log.packedQuantity ? `${log.packedQuantity} kg` : '---'}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase mt-1">LOTE EMB: {log.packagingBatch || 'N/A'}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <UserIcon className="w-3 h-3" /> @{user?.username || 'desconhecido'}
                      </div>
                    </td>
                    {hasPermission && (
                      <td className="px-8 py-6 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => startEdit(log)} className="p-3 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeLog(log.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <Factory className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Nenhum registro encontrado para este período.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SlaughterHouse;
