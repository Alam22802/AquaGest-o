
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterEmployee, SlaughterHRIndicator, SlaughterHREntry, User } from '../../types';
import { Users, UserPlus, Trash2, Edit3, X, Calendar, Search, TrendingUp, Heart, AlertCircle, Briefcase, BarChart as BarChartIcon, CheckSquare, Square } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const SlaughterHR: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'indicators'>('employees');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    registrationNumber: '',
    name: '',
    role: '',
    department: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'Ativo' as SlaughterEmployee['status']
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    employeeIds: [] as string[],
    type: 'Falta' as SlaughterHREntry['type'],
    date: new Date().toISOString().split('T')[0],
    days: '',
    description: ''
  });
  const [employeeSearch, setEmployeeSearch] = useState('');

  const employees = useMemo(() => state.slaughterEmployees || [], [state.slaughterEmployees]);
  const indicators = useMemo(() => state.slaughterHRIndicators || [], [state.slaughterHRIndicators]);
  const entries = useMemo(() => state.slaughterHREntries || [], [state.slaughterHREntries]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === 'Ativo').length;
    
    // Filter indicators by month/year
    const filteredIndicator = indicators.find(ind => ind.month === filterMonth && ind.year === filterYear);

    // Filter entries by month/year
    const filteredEntries = entries.filter(entry => {
      const d = new Date(entry.date);
      return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
    });

    // Chart data for absenteeism (last 6 months)
    const sortedIndicators = [...indicators].sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    const absenteeismData = sortedIndicators.slice(0, 6).reverse().map(ind => ({
      name: `${format(new Date(2000, ind.month - 1), 'MMM')}/${ind.year}`,
      value: ind.absenteeism
    }));

    // Headcount data (active employees per department)
    const deptHeadcount = employees.filter(e => e.status === 'Ativo').reduce((acc, emp) => {
      const dept = emp.department || 'Outros';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const headcountData = Object.entries(deptHeadcount).map(([name, value]) => ({ name, value }));

    return { active, filteredIndicator, filteredEntries, absenteeismData, headcountData };
  }, [employees, indicators, entries, filterMonth, filterYear]);

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.role) return;

    const newEmployee: SlaughterEmployee = {
      id: editingEmployeeId || crypto.randomUUID(),
      registrationNumber: employeeForm.registrationNumber,
      name: employeeForm.name,
      role: employeeForm.role,
      department: employeeForm.department,
      admissionDate: employeeForm.admissionDate,
      status: employeeForm.status,
      updatedAt: Date.now()
    };

    const updatedEmployees = editingEmployeeId 
      ? employees.map(emp => emp.id === editingEmployeeId ? newEmployee : emp)
      : [...employees, newEmployee];

    onUpdate({ ...state, slaughterEmployees: updatedEmployees });
    setEditingEmployeeId(null);
    setEmployeeForm({
      registrationNumber: '',
      name: '',
      role: '',
      department: '',
      admissionDate: new Date().toISOString().split('T')[0],
      status: 'Ativo'
    });
  };

  const removeEmployee = (id: string) => {
    if (!confirm('Deseja excluir este colaborador?')) return;
    onUpdate({ ...state, slaughterEmployees: employees.filter(e => e.id !== id) });
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryForm.employeeIds.length === 0) {
      alert('Selecione pelo menos um colaborador.');
      return;
    }

    const newEntry: SlaughterHREntry = {
      id: editingEntryId || crypto.randomUUID(),
      employeeIds: entryForm.employeeIds,
      type: entryForm.type,
      date: entryForm.date,
      days: entryForm.days ? Number(entryForm.days) : undefined,
      description: entryForm.description,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedEntries = editingEntryId
      ? entries.map(ent => ent.id === editingEntryId ? newEntry : ent)
      : [...entries, newEntry];

    onUpdate({ ...state, slaughterHREntries: updatedEntries });
    setEditingEntryId(null);
    setEntryForm({
      employeeIds: [],
      type: 'Falta',
      date: new Date().toISOString().split('T')[0],
      days: '',
      description: ''
    });
    setEmployeeSearch('');
  };

  const removeEntry = (id: string) => {
    if (!confirm('Deseja excluir este lançamento?')) return;
    onUpdate({ ...state, slaughterHREntries: entries.filter(e => e.id !== id) });
  };

  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [indicatorForm, setIndicatorForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    turnover: '',
    absenteeism: '',
    accidents: ''
  });

  const handleSaveIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const newIndicator: SlaughterHRIndicator = {
      id: editingIndicatorId || crypto.randomUUID(),
      month: Number(indicatorForm.month),
      year: Number(indicatorForm.year),
      turnover: Number(indicatorForm.turnover),
      absenteeism: Number(indicatorForm.absenteeism),
      accidents: Number(indicatorForm.accidents),
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedIndicators = editingIndicatorId 
      ? indicators.map(ind => ind.id === editingIndicatorId ? newIndicator : ind)
      : [...indicators, newIndicator];

    onUpdate({ ...state, slaughterHRIndicators: updatedIndicators });
    setEditingIndicatorId(null);
    setIndicatorForm({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      turnover: '',
      absenteeism: '',
      accidents: ''
    });
  };

  const removeIndicator = (id: string) => {
    if (!confirm('Deseja excluir este indicador?')) return;
    onUpdate({ ...state, slaughterHRIndicators: indicators.filter(i => i.id !== id) });
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveSubTab('employees')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'employees' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Colaboradores
        </button>
        <button 
          onClick={() => setActiveSubTab('indicators')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'indicators' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Lançamentos e Indicadores
        </button>
      </div>

      {activeSubTab === 'employees' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <UserPlus className="w-6 h-6" />
                {editingEmployeeId ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <form onSubmit={handleSaveEmployee} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.registrationNumber}
                      onChange={e => setEmployeeForm({...employeeForm, registrationNumber: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.name}
                      onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.role}
                      onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.department}
                      onChange={e => setEmployeeForm({...employeeForm, department: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.status}
                      onChange={e => setEmployeeForm({...employeeForm, status: e.target.value as any})}
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Admissão</label>
                    <input 
                      type="date" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.admissionDate}
                      onChange={e => setEmployeeForm({...employeeForm, admissionDate: e.target.value})}
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  {editingEmployeeId ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Matrícula</th>
                    <th className="px-8 py-5">Colaborador</th>
                    <th className="px-8 py-5">Cargo / Depto</th>
                    <th className="px-8 py-5">Admissão</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="text-xs font-black text-slate-400 tracking-widest uppercase">{emp.registrationNumber}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-800">{emp.name}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xs font-bold text-slate-600">{emp.role}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{emp.department}</div>
                      </td>
                      <td className="px-8 py-6 text-xs text-slate-500">{format(parseISO(emp.admissionDate), 'dd/MM/yyyy')}</td>
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${emp.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {
                            setEditingEmployeeId(emp.id);
                            setEmployeeForm({
                              registrationNumber: emp.registrationNumber || '',
                              name: emp.name,
                              role: emp.role,
                              department: emp.department,
                              admissionDate: emp.admissionDate,
                              status: emp.status
                            });
                          }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeEmployee(emp.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhum colaborador cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ativos</div>
                <div className="text-sm font-black text-slate-800">{stats.active}</div>
              </div>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-2xl flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Turnover</div>
                <div className="text-sm font-black text-slate-800">{stats.filteredIndicator?.turnover || 0}%</div>
              </div>
            </div>
            <div className="bg-red-50/50 p-4 rounded-2xl flex items-center gap-3">
              <Heart className="w-4 h-4 text-red-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Acidentes</div>
                <div className="text-sm font-black text-slate-800">{stats.filteredIndicator?.accidents || 0}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-slate-100 rounded-xl text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar Lançamentos e Indicadores</h4>
                <div className="flex items-center gap-2 mt-1">
                  <select 
                    value={filterMonth} 
                    onChange={e => setFilterMonth(Number(e.target.value))}
                    className="bg-transparent border-none text-xs font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{format(new Date(2000, m - 1), 'MMMM')}</option>
                    ))}
                  </select>
                  <span className="text-slate-300">/</span>
                  <select 
                    value={filterYear} 
                    onChange={e => setFilterYear(Number(e.target.value))}
                    className="bg-transparent border-none text-xs font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600"
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Absenteísmo (%)</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Histórico dos últimos 6 meses</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.absenteeismData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" name="Absenteísmo" fill="#344434" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Headcount por Depto</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Distribuição de Colaboradores Ativos</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.headcountData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} width={100} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" name="Colaboradores" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                  <Briefcase className="w-6 h-6" />
                  {editingEntryId ? 'Editar Lançamento' : 'Novo Lançamento'}
                </h3>
                <form onSubmit={handleSaveEntry} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Colaboradores</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text"
                        placeholder="Buscar por nome ou matrícula..."
                        className="w-full pl-11 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                        value={employeeSearch}
                        onChange={e => setEmployeeSearch(e.target.value)}
                      />
                    </div>
                    <div className="mt-2 max-h-48 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
                      {employees
                        .filter(emp => emp.status === 'Ativo' && (
                          emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                          emp.registrationNumber.includes(employeeSearch)
                        ))
                        .map(emp => (
                          <div 
                            key={emp.id}
                            onClick={() => {
                              const isSelected = entryForm.employeeIds.includes(emp.id);
                              setEntryForm({
                                ...entryForm,
                                employeeIds: isSelected 
                                  ? entryForm.employeeIds.filter(id => id !== emp.id)
                                  : [...entryForm.employeeIds, emp.id]
                              });
                            }}
                            className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            {entryForm.employeeIds.includes(emp.id) ? (
                              <CheckSquare className="w-4 h-4 text-[#344434]" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-slate-800">{emp.name}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{emp.registrationNumber}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">
                      {entryForm.employeeIds.length} selecionados
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                      <select 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                        value={entryForm.type}
                        onChange={e => setEntryForm({...entryForm, type: e.target.value as any})}
                      >
                        <option value="Falta">Falta</option>
                        <option value="Atestado">Atestado</option>
                        <option value="Acidente">Acidente</option>
                        <option value="Turnover">Turnover (Desligamento)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                      <input 
                        type="date" required 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                        value={entryForm.date}
                        onChange={e => setEntryForm({...entryForm, date: e.target.value})}
                      />
                    </div>
                  </div>

                  {entryForm.type === 'Atestado' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dias de Atestado</label>
                      <input 
                        type="number" required 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                        value={entryForm.days}
                        onChange={e => setEntryForm({...entryForm, days: e.target.value})}
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observação</label>
                    <textarea 
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs h-20 resize-none"
                      value={entryForm.description}
                      onChange={e => setEntryForm({...entryForm, description: e.target.value})}
                    />
                  </div>

                  <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                    {editingEntryId ? 'Salvar Alterações' : 'Lançar Evento'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lançamentos do Período</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Data</th>
                      <th className="px-8 py-5">Colaborador(es)</th>
                      <th className="px-8 py-5">Tipo</th>
                      <th className="px-8 py-5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.filteredEntries.sort((a, b) => b.date.localeCompare(a.date)).map(ent => (
                      <tr key={ent.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6 text-xs font-bold text-slate-500">{format(parseISO(ent.date), 'dd/MM/yyyy')}</td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-800">
                            {ent.employeeIds.length === 1 
                              ? employees.find(e => e.id === ent.employeeIds[0])?.name 
                              : `${ent.employeeIds.length} Colaboradores`}
                          </div>
                          {ent.description && <div className="text-[9px] text-slate-400 italic mt-0.5">{ent.description}</div>}
                        </td>
                        <td className="px-8 py-6">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                            ent.type === 'Acidente' ? 'bg-red-50 text-red-600' :
                            ent.type === 'Atestado' ? 'bg-amber-50 text-amber-600' :
                            ent.type === 'Turnover' ? 'bg-slate-100 text-slate-600' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {ent.type} {ent.days ? `(${ent.days}d)` : ''}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => {
                              setEditingEntryId(ent.id);
                              setEntryForm({
                                employeeIds: ent.employeeIds,
                                type: ent.type,
                                date: ent.date,
                                days: ent.days?.toString() || '',
                                description: ent.description || ''
                              });
                            }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                            <button onClick={() => removeEntry(ent.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {stats.filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                          Nenhum lançamento no período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Absenteísmo (%)</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Histórico dos últimos 6 meses</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.absenteeismData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" name="Absenteísmo" fill="#344434" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Headcount por Depto</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Distribuição de Colaboradores Ativos</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.headcountData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} width={100} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="value" name="Colaboradores" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaughterHR;
