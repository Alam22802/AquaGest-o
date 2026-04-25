
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterLog, User } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { Factory, Trash2, Edit3, X, ArrowUpDown, Calendar, Clock, Scale, ClipboardCheck, User as UserIcon, Search, CheckCircle, TrendingUp, ChevronDown, BarChart as BarChartIcon } from 'lucide-react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

// Sub-component for the summary board to prevent re-renders on form input
const SlaughterSummary = React.memo(({ stats, startDate, endDate, onStartDateChange, onEndDateChange }: { 
  stats: {
    totalGta: number;
    totalRecep: number;
    totalPacked: number;
    totalRendering: number;
    yieldPercentage: number;
    count: number;
    waterConsumptionPerKg: number;
    energyCostPerKg: number;
    laborPerKg: number;
    freightPerKgLive: number;
    totalSlaughterCondemnation: number;
    totalInvoiceValue: number;
    revenuePerKg: number;
    costPerKgProduced: number;
    totalTransportCondemnation: number;
    renderingYield: number;
    avgSlaughterPerDay: number;
    avgFinishedProductPerDay: number;
  }, 
  startDate: string, 
  endDate: string, 
  onStartDateChange: (val: string) => void, 
  onEndDateChange: (val: string) => void 
}) => {
  return (
    <div className="bg-[#344434] p-8 rounded-[2.5rem] text-[#e4e4d4] shadow-2xl shadow-black/20 relative overflow-hidden group border border-white/5">
       <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
             <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Inteligência de Abate</h3>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Resultados Finais</h2>
             </div>
             
             <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 opacity-50" />
                   <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Apuração:</span>
                </div>
                <div className="flex items-center gap-2">
                   <input 
                      type="date" 
                      value={startDate} 
                      onChange={e => onStartDateChange(e.target.value)}
                      className="bg-transparent border-none text-[11px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-white"
                   />
                   <span className="opacity-30">/</span>
                   <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => onEndDateChange(e.target.value)}
                      className="bg-transparent border-none text-[11px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-white"
                   />
                </div>
             </div>
          </div>

          {/* Linha 1: Produção */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-8 mb-8 pb-8 border-b border-white/5">
             <div className="space-y-2 border-l-2 border-white/10 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Total Recepção</div>
                <div className="text-2xl font-black flex items-baseline gap-1">
                   {formatNumber(stats.totalRecep, 0)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-emerald-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Total Embalado</div>
                <div className="text-2xl font-black text-emerald-400 flex items-baseline gap-1">
                   {formatNumber(stats.totalPacked, 0)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-blue-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Rendimento</div>
                <div className="text-2xl font-black text-blue-300 flex items-baseline gap-1">
                   {formatNumber(stats.yieldPercentage, 1)}
                   <span className="text-[10px] opacity-40">%</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/10 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Filé Congelado</div>
                <div className="text-2xl font-black flex items-baseline gap-1">
                   {formatNumber(stats.totalGta, 0)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/10 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Média Abate Dia</div>
                <div className="text-2xl font-black flex items-baseline gap-1">
                   {formatNumber(stats.avgSlaughterPerDay, 0)}
                   <span className="text-[10px] opacity-40">kg/dia</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-emerald-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Média Prod. Acabado Dia</div>
                <div className="text-2xl font-black text-emerald-400 flex items-baseline gap-1">
                   {formatNumber(stats.avgFinishedProductPerDay, 0)}
                   <span className="text-[10px] opacity-40">kg/dia</span>
                </div>
             </div>
          </div>

          {/* Linha 2: Condenações */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/5">
             <div className="space-y-2 border-l-2 border-red-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Condenações Frig.</div>
                <div className="text-xl font-black text-red-400 flex items-baseline gap-1">
                   {formatNumber(stats.totalSlaughterCondemnation)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-orange-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Condenações Transp.</div>
                <div className="text-xl font-black text-orange-400 flex items-baseline gap-1">
                   {formatNumber(stats.totalTransportCondemnation)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-amber-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Graxaria</div>
                <div className="text-xl font-black text-amber-400 flex items-baseline gap-1">
                   {formatNumber(stats.totalRendering, 0)}
                   <span className="text-[10px] opacity-40">kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-amber-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">Rendimento Graxaria</div>
                <div className="text-xl font-black text-amber-200 flex items-baseline gap-1">
                   {formatNumber(stats.renderingYield, 1)}
                   <span className="text-[10px] opacity-40">%</span>
                </div>
             </div>
          </div>

          {/* Linha 3: Financeiro */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-8">
             <div className="space-y-2 border-l-2 border-amber-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">VALOR TOTAL MP PEIXE VIVO</div>
                <div className="text-xl font-black text-amber-100 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.totalInvoiceValue, 2)}
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-amber-500/30 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">kilo MP PEIXE VIVO</div>
                <div className="text-xl font-black text-amber-100 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.totalRecep > 0 ? stats.totalInvoiceValue / stats.totalRecep : 0, 2)}
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/20 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">FRETE KG VIVO</div>
                <div className="text-xl font-black text-white/90 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.freightPerKgLive, 2)}
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/20 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">MÃO DE OBRA/KG</div>
                <div className="text-xl font-black text-white/90 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.laborPerKg, 2)}
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-indigo-500/50 pl-6 bg-indigo-500/5 rounded-r-xl py-2 -ml-2">
                <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">CUSTO KG PRODUZIDO</div>
                <div className="text-xl font-black text-indigo-200 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.costPerKgProduced, 2)}
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/20 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">CONSUMO AGUA/KG</div>
                <div className="text-xl font-black text-white/90 flex items-baseline gap-1">
                   {formatNumber(stats.waterConsumptionPerKg, 2)}
                   <span className="text-[10px] opacity-40">L/kg</span>
                </div>
             </div>
             <div className="space-y-2 border-l-2 border-white/20 pl-6">
                <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">CUSTO ENERGIA/KG</div>
                <div className="text-xl font-black text-white/90 flex items-baseline gap-1">
                   <span className="text-[10px] opacity-40">R$</span>
                   {formatNumber(stats.energyCostPerKg, 2)}
                </div>
             </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-4 text-[9px] font-black uppercase tracking-widest opacity-40">
             <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                {stats.count} Lotes Processados no Período
             </div>
          </div>
       </div>
       <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-700">
          <Factory className="w-64 h-64" />
       </div>
    </div>
  );
});

const SlaughterChart = React.memo(({ data, month, year, onMonthChange, onYearChange, months, years, title, dataKey, color, unit }: {
  data: any[],
  month: number,
  year: number,
  onMonthChange: (val: number) => void,
  onYearChange: (val: number) => void,
  months: string[],
  years: number[],
  title: string,
  dataKey: string,
  color: string,
  unit: string
}) => {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
         <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl shadow-sm ${color === '#344434' ? 'bg-slate-50 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
               <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">{title}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Evolução Diária</p>
            </div>
         </div>

         <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           <select 
             value={month} 
             onChange={e => onMonthChange(Number(e.target.value))}
             className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
           >
             {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
           </select>
           <div className="w-[1px] h-4 bg-slate-200"></div>
           <select 
             value={year} 
             onChange={e => onYearChange(Number(e.target.value))}
             className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
           >
             {years.map(y => <option key={y} value={y}>{y}</option>)}
           </select>
         </div>
      </div>

      <div className="h-[300px] w-full">
         <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
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
                 tickFormatter={(val) => `${val}${unit}`}
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
               <Bar dataKey={dataKey} name={title} radius={[6, 6, 0, 0]}>
                 {data.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={color} />
                 ))}
               </Bar>
            </BarChart>
         </ResponsiveContainer>
      </div>
    </div>
  );
});

const SlaughterTable = React.memo(({ logs, users, hasPermission, onEdit, onDelete }: {
  logs: SlaughterLog[],
  users: User[],
  hasPermission: boolean,
  onEdit: (log: SlaughterLog) => void,
  onDelete: (id: string) => void
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm overflow-x-auto print:border-none print:shadow-none">
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-black">DADOS DESPESCA VS REAL</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Relatório Detalhado de Abates</p>
      </div>
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <tr>
            <th className="px-8 py-5">Lote / Produtor</th>
            <th className="px-8 py-5">Pesos (Filé/Recep)</th>
            <th className="px-8 py-5">Embalado (kg)</th>
            <th className="px-8 py-5">Graxaria (kg)</th>
            <th className="px-8 py-5">Frete / kg</th>
            <th className="px-8 py-5">Condenações</th>
            <th className="px-8 py-5">Valor Nota</th>
            <th className="px-8 py-5">Registrado por</th>
            {hasPermission && <th className="px-8 py-5 text-center">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map(log => {
            const user = users.find(u => u.id === log.userId);
            return (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
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
                       <span className="text-xs font-black text-slate-800">{formatNumber(log.gtaWeight || 0, 2)}kg</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase w-10">RECEP:</span>
                       <span className="text-xs font-black text-emerald-600">{formatNumber(log.receptionWeight || 0, 2)}kg</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="font-black text-blue-600 text-xs">{log.packedQuantity ? `${formatNumber(log.packedQuantity)} kg` : '---'}</div>
                  {log.receptionWeight > 0 && (
                    <div className="text-[10px] font-black text-emerald-600 mt-1 uppercase tracking-widest">
                      Rend: {formatNumber((log.packedQuantity / log.receptionWeight) * 100, 1)}%
                    </div>
                  )}
                  <div className="text-[9px] font-black text-slate-400 uppercase mt-1">LOTE EMB: {log.packagingBatch || 'N/A'}</div>
                </td>
                <td className="px-8 py-6">
                  <div className="font-black text-amber-600 text-xs">{log.renderingWeight ? `${formatNumber(log.renderingWeight)} kg` : '---'}</div>
                </td>
                <td className="px-8 py-6">
                  <div className="text-xs font-black text-slate-700">R$ {formatNumber(log.freightValue || 0, 2)}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                    R$ {log.receptionWeight && log.freightValue ? formatNumber(log.freightValue / log.receptionWeight, 2) : '0.00'}/kg
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="text-[10px] font-black text-red-500 uppercase">Frig: {formatNumber(log.slaughterCondemnation || 0)}kg</div>
                  <div className="text-[10px] font-black text-orange-500 uppercase">Transp: {formatNumber(log.transportCondemnation || 0)}kg</div>
                </td>
                <td className="px-8 py-6">
                  <div className="text-xs font-black text-amber-600">R$ {formatNumber(log.invoiceValue || 0, 2)}</div>
                  {log.packedQuantity > 0 && (
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                      R$ {formatNumber((log.invoiceValue || 0) / log.packedQuantity, 2)}/kg
                    </div>
                  )}
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <UserIcon className="w-3 h-3" /> @{user?.username || 'desconhecido'}
                  </div>
                </td>
                {hasPermission && (
                  <td className="px-8 py-6 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => onEdit(log)} className="p-3 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => onDelete(log.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
          {logs.length === 0 && (
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
  );
});

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

const SlaughterOverview: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterProducer, setFilterProducer] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [summaryStartDate, setSummaryStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [summaryEndDate, setSummaryEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [chartMonth, setChartMonth] = useState(new Date().getMonth());
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);

  const allBatches = useMemo(() => {
    const logs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];
    const batches = Array.from(new Set(logs.map(l => l.slaughterBatch).filter(Boolean)));
    return batches.sort((a, b) => a.localeCompare(b));
  }, [state.slaughterLogs]);

  const toggleBatch = (batch: string) => {
    setSelectedBatches(prev => 
      prev.includes(batch) 
        ? prev.filter(b => b !== batch) 
        : [...prev, batch]
    );
  };

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
    renderingWeight: '',
    packagingBatch: '',
    freightValue: '',
    transportCondemnation: '',
    slaughterCondemnation: '',
    invoiceValue: ''
  });

  const slaughterStats = useMemo(() => {
    const logs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];
    const expenses = Array.isArray(state.slaughterExpenses) ? state.slaughterExpenses : [];
    
    const start = startOfDay(parseISO(summaryStartDate));
    const end = endOfDay(parseISO(summaryEndDate));

    const filteredLogs = logs.filter(log => {
      try {
        return isWithinInterval(parseISO(log.date), { start, end });
      } catch {
        return false;
      }
    });

    const filteredExpenses = expenses.filter(exp => {
      try {
        return isWithinInterval(parseISO(exp.date), { start, end });
      } catch {
        return false;
      }
    });

    const filteredUtilityLogs = (state.utilityLogs || []).filter(log => {
      try {
        return isWithinInterval(parseISO(log.date), { start, end });
      } catch {
        return false;
      }
    });

    const totalGta = filteredLogs.reduce((acc, l) => acc + (l.gtaWeight || 0), 0);
    const totalRecep = filteredLogs.reduce((acc, l) => acc + (l.receptionWeight || 0), 0);
    const totalPacked = filteredLogs.reduce((acc, l) => acc + (l.packedQuantity || 0), 0);
    const totalRendering = filteredLogs.reduce((acc, l) => acc + (l.renderingWeight || 0), 0);
    const yieldPercentage = totalRecep > 0 ? (totalPacked / totalRecep) * 100 : 0;

    const waterExpenses = filteredExpenses.filter(e => e.category === 'Água');
    const totalWaterValue = waterExpenses.reduce((acc, e) => acc + e.value, 0);
    
    // Calculate total water consumed from utility logs (readings)
    const waterUtilityLogs = (state.utilityLogs || [])
      .filter(l => l.type === 'water')
      .sort((a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp));

    // Create a map of IDs to indices for O(1) lookup during calculations to avoid O(N^2) complexity
    const waterLogIndices = new Map(waterUtilityLogs.map((l, i) => [l.id, i]));

    const totalWaterConsumed = filteredUtilityLogs
      .filter(l => l.type === 'water')
      .reduce((acc, log) => {
        const currentIndex = waterLogIndices.get(log.id);
        if (currentIndex === undefined || currentIndex <= 0) return acc;
        
        const previousLog = waterUtilityLogs[currentIndex - 1];
        const consumption = log.reading - previousLog.reading;
        return acc + (consumption > 0 ? consumption : 0);
      }, 0);

    const waterConsumptionPerKg = totalRecep > 0 ? (totalWaterConsumed * 1000) / totalRecep : 0;

    const totalEnergyValue = filteredExpenses.filter(e => e.category === 'Energia').reduce((acc, e) => acc + e.value, 0);
    const energyCostPerKg = totalPacked > 0 ? totalEnergyValue / totalPacked : 0;

    const totalSalaryValue = filteredExpenses.filter(e => e.category === 'Folha de Pagamento').reduce((acc, e) => acc + e.value, 0);
    const laborPerKg = totalPacked > 0 ? (totalSalaryValue / totalPacked) : 0;

    const totalFreightValue = filteredLogs.reduce((acc, l) => acc + (l.freightValue || 0), 0);
    const freightPerKgLive = totalRecep > 0 ? totalFreightValue / totalRecep : 0;

    const totalSlaughterCondemnation = filteredLogs.reduce((acc, l) => acc + (l.slaughterCondemnation || 0), 0);
    const totalTransportCondemnation = filteredLogs.reduce((acc, l) => acc + (l.transportCondemnation || 0), 0);
    const renderingYield = totalRecep > 0 ? (totalRendering / totalRecep) * 100 : 0;

    const totalInvoiceValue = filteredLogs.reduce((acc, l) => acc + (l.invoiceValue || 0), 0);
    const revenuePerKg = totalPacked > 0 ? totalInvoiceValue / totalPacked : 0;
    
    // Custo KG Produzido = (Total Invoices + Freight + Labor) / Total Packed
    const totalCost = totalInvoiceValue + totalFreightValue + totalSalaryValue;
    const costPerKgProduced = totalPacked > 0 ? totalCost / totalPacked : 0;

    const uniqueSlaughterDays = new Set(filteredLogs.map(log => log.date)).size;
    const daysToDivide = Math.max(1, uniqueSlaughterDays);
    const avgSlaughterPerDay = totalRecep / daysToDivide;
    const avgFinishedProductPerDay = totalPacked / daysToDivide;

    return { 
      totalGta, 
      totalRecep, 
      totalPacked, 
      totalRendering,
      yieldPercentage, 
      count: filteredLogs.length,
      waterConsumptionPerKg,
      energyCostPerKg,
      laborPerKg,
      freightPerKgLive,
      totalSlaughterCondemnation,
      totalInvoiceValue,
      revenuePerKg,
      costPerKgProduced,
      totalTransportCondemnation,
      renderingYield,
      avgSlaughterPerDay,
      avgFinishedProductPerDay
    };
  }, [state.slaughterLogs, state.slaughterExpenses, state.utilityLogs, summaryStartDate, summaryEndDate]);

  const dailyYieldData = useMemo(() => {
    const baseDate = new Date(chartYear, chartMonth, 1);
    const start = startOfMonth(baseDate);
    const end = endOfMonth(baseDate);
    const days = eachDayOfInterval({ start, end });

    const logs = Array.isArray(state.slaughterLogs) ? state.slaughterLogs : [];
    const logsByDate = new Map<string, SlaughterLog[]>();
    logs.forEach(log => {
      if (!log.date) return;
      if (selectedBatches.length > 0 && !selectedBatches.includes(log.slaughterBatch)) return;
      if (!logsByDate.has(log.date)) {
        logsByDate.set(log.date, []);
      }
      logsByDate.get(log.date)!.push(log);
    });

    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayLogs = logsByDate.get(dateKey) || [];
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
    }); 
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
          packedQuantity: Number(formData.packedQuantity) || 0,
          renderingWeight: Number(formData.renderingWeight) || 0,
          freightValue: Number(formData.freightValue) || 0,
          transportCondemnation: Number(formData.transportCondemnation) || 0,
          slaughterCondemnation: Number(formData.slaughterCondemnation) || 0,
          invoiceValue: Number(formData.invoiceValue) || 0,
          revenuePerKg: (Number(formData.packedQuantity) || 0) > 0 ? (Number(formData.invoiceValue) || 0) / (Number(formData.packedQuantity) || 0) : 0
        } : log
      );
      
      onUpdate({
        ...state,
        slaughterLogs: updatedLogs
      });
      setEditingId(null);
    } else {
      const newLog: SlaughterLog = {
        id: generateId(),
        producer: formData.producer,
        date: formData.date,
        gtaWeight: Number(formData.gtaWeight) || 0,
        packingList: Number(formData.packingList) || 0,
        receptionWeight: Number(formData.receptionWeight) || 0,
        startTime: formData.startTime,
        slaughterBatch: formData.slaughterBatch,
        endTime: formData.endTime,
        packedQuantity: Number(formData.packedQuantity) || 0,
        renderingWeight: Number(formData.renderingWeight) || 0,
        packagingBatch: formData.packagingBatch,
        freightValue: Number(formData.freightValue) || 0,
        transportCondemnation: Number(formData.transportCondemnation) || 0,
        slaughterCondemnation: Number(formData.slaughterCondemnation) || 0,
        invoiceValue: Number(formData.invoiceValue) || 0,
        revenuePerKg: (Number(formData.packedQuantity) || 0) > 0 ? (Number(formData.invoiceValue) || 0) / (Number(formData.packedQuantity) || 0) : 0,
        userId: currentUser.id,
        timestamp: new Date().toISOString(),
        updatedAt: Date.now()
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
      renderingWeight: '',
      packagingBatch: '',
      freightValue: '',
      transportCondemnation: '',
      slaughterCondemnation: '',
      invoiceValue: ''
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
      renderingWeight: (log.renderingWeight || 0).toString(),
      packagingBatch: log.packagingBatch || '',
      freightValue: (log.freightValue || 0).toString(),
      transportCondemnation: (log.transportCondemnation || 0).toString(),
      slaughterCondemnation: (log.slaughterCondemnation || 0).toString(),
      invoiceValue: (log.invoiceValue || 0).toString()
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

    if (filterProducer) {
      logs = logs.filter(log => 
        log.producer?.toLowerCase().includes(filterProducer.toLowerCase())
      );
    }

    if (selectedBatches.length > 0) {
      logs = logs.filter(log => selectedBatches.includes(log.slaughterBatch));
    }

    return logs.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.slaughterLogs, filterStartDate, filterEndDate, sortOrder, filterProducer]);

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, []);

  return (
    <div className="space-y-8">
      <SlaughterSummary 
        stats={slaughterStats} 
        startDate={summaryStartDate} 
        endDate={summaryEndDate} 
        onStartDateChange={setSummaryStartDate} 
        onEndDateChange={setSummaryEndDate} 
      />

      <div className="grid grid-cols-1 gap-8">
        <SlaughterChart 
          data={dailyYieldData} 
          month={chartMonth} 
          year={chartYear} 
          onMonthChange={setChartMonth} 
          onYearChange={setChartYear} 
          months={months} 
          years={years}
          title="Rendimento Diário (%)"
          dataKey="yield"
          color="#344434"
          unit="%"
        />

        <SlaughterChart 
          data={dailyYieldData} 
          month={chartMonth} 
          year={chartYear} 
          onMonthChange={setChartMonth} 
          onYearChange={setChartYear} 
          months={months} 
          years={years}
          title="Peso Recebido Diário (kg)"
          dataKey="recep"
          color="#3b82f6"
          unit="kg"
        />
      </div>

      {hasPermission ? (
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
          <h3 className="text-xl font-black text-slate-800 mb-8 flex items-center justify-between uppercase tracking-tighter italic">
            <div className="flex items-center gap-3">
              <Factory className={`w-6 h-6 ${editingId ? 'text-amber-500' : 'text-slate-900'}`} />
              {editingId ? 'Editar Abate' : 'Novo Registro'}
            </div>
            {editingId && <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-400" /></button>}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 items-end">
            <div className="space-y-1 group md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Produtor *</label>
              <input type="text" required placeholder="Nome do produtor" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-slate-900/10 transition-all text-xs" value={formData.producer} onChange={e => setFormData({...formData, producer: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Data</label>
              <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Lote Abate *</label>
              <input type="text" required placeholder="Lote" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.slaughterBatch} onChange={e => setFormData({...formData, slaughterBatch: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Recepção (kg)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.receptionWeight} onChange={e => setFormData({...formData, receptionWeight: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Embalado (kg)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.packedQuantity} onChange={e => setFormData({...formData, packedQuantity: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Graxaria (kg)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.renderingWeight} onChange={e => setFormData({...formData, renderingWeight: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Filé Cong. (kg)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.gtaWeight} onChange={e => setFormData({...formData, gtaWeight: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Romaneio (kg)</label>
              <input type="number" step="0.01" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.packingList} onChange={e => setFormData({...formData, packingList: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Início</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Término</label>
              <input type="time" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Lote Embalagem</label>
              <input type="text" placeholder="Cód. Embalagem" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.packagingBatch} onChange={e => setFormData({...formData, packagingBatch: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Valor Frete (R$)</label>
              <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.freightValue} onChange={e => setFormData({...formData, freightValue: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Valor da Nota (R$)</label>
              <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.invoiceValue} onChange={e => setFormData({...formData, invoiceValue: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Cond. Frig. (kg)</label>
              <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.slaughterCondemnation} onChange={e => setFormData({...formData, slaughterCondemnation: e.target.value})} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">Cond. Transp. (kg)</label>
              <input type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs" value={formData.transportCondemnation} onChange={e => setFormData({...formData, transportCondemnation: e.target.value})} />
            </div>

            <div className="lg:col-span-1">
              <button type="submit" className={`w-full py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-[#344434] shadow-slate-900/20 hover:bg-[#2a382a]'}`}>
                {editingId ? 'Salvar' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
          <Factory className="w-12 h-12 text-slate-300" />
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Modo Leitura</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase">Sem permissão para editar.</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
             <div className="p-3 bg-slate-100 rounded-xl"><Search className="w-5 h-5 text-slate-400" /></div>
             <input 
               type="text" 
               placeholder="Filtrar por produtor..." 
               className="text-xs font-black bg-slate-50 border-none rounded-lg p-2 outline-none w-full md:w-48" 
               value={filterProducer} 
               onChange={e => setFilterProducer(e.target.value)} 
             />
             <div className="flex gap-2 items-center">
               <input type="date" className="text-xs font-black bg-slate-50 border-none rounded-lg p-2 outline-none" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
               <span className="text-slate-300 self-center">até</span>
               <input type="date" className="text-xs font-black bg-slate-50 border-none rounded-lg p-2 outline-none" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
             </div>
             {(filterStartDate || filterEndDate || filterProducer) && (
               <button onClick={() => {setFilterStartDate(''); setFilterEndDate(''); setFilterProducer('');}} className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 text-[10px] font-black uppercase"><X className="w-4 h-4" /> Limpar</button>
             )}
          </div>
          <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="w-full lg:w-auto flex items-center justify-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-50 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors">
            <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Mais Recentes' : 'Mais Antigos'}
          </button>
        </div>

        <SlaughterTable 
          logs={filteredLogs} 
          users={state.users} 
          hasPermission={hasPermission} 
          onEdit={startEdit} 
          onDelete={removeLog} 
        />
      </div>
    </div>
  );
};

export default SlaughterOverview;
