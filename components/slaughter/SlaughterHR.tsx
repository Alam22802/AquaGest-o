
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterEmployee, SlaughterHRIndicator, User } from '../../types';
import { Users, UserPlus, Trash2, Edit3, X, Calendar, Search, TrendingUp, Heart, AlertCircle, Briefcase } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const SlaughterHR: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'indicators'>('employees');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: '',
    department: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'Ativo' as SlaughterEmployee['status']
  });

  const employees = useMemo(() => state.slaughterEmployees || [], [state.slaughterEmployees]);
  const indicators = useMemo(() => state.slaughterHRIndicators || [], [state.slaughterHRIndicators]);

  const stats = useMemo(() => {
    const active = employees.filter(e => e.status === 'Ativo').length;
    
    // Last indicator
    const lastIndicator = indicators.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    })[0];

    return { active, lastIndicator };
  }, [employees, indicators]);

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.role) return;

    const newEmployee: SlaughterEmployee = {
      id: editingEmployeeId || crypto.randomUUID(),
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
      {/* Cards de Indicadores de RH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-5 h-5" /></div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colaboradores Ativos</div>
            <div className="text-xl font-black text-slate-800">{stats.active}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><TrendingUp className="w-5 h-5" /></div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Turnover (Mês)</div>
            <div className="text-xl font-black text-slate-800">{stats.lastIndicator?.turnover || 0}%</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl"><Heart className="w-5 h-5" /></div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Acidentes (Ano)</div>
            <div className="text-xl font-black text-slate-800">{stats.lastIndicator?.accidents || 0}</div>
          </div>
        </div>
      </div>

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
          Indicadores Mensais
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
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    type="text" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                    value={employeeForm.name}
                    onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                  />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <TrendingUp className="w-6 h-6" />
                {editingIndicatorId ? 'Editar Indicador' : 'Novo Indicador'}
              </h3>
              <form onSubmit={handleSaveIndicator} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mês</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={indicatorForm.month}
                      onChange={e => setIndicatorForm({...indicatorForm, month: Number(e.target.value)})}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>{format(new Date(2000, m - 1), 'MMMM', { locale: undefined })}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano</label>
                    <input 
                      type="number" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={indicatorForm.year}
                      onChange={e => setIndicatorForm({...indicatorForm, year: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turnover (%)</label>
                  <input 
                    type="number" step="0.01" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={indicatorForm.turnover}
                    onChange={e => setIndicatorForm({...indicatorForm, turnover: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Absenteísmo (%)</label>
                  <input 
                    type="number" step="0.01" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={indicatorForm.absenteeism}
                    onChange={e => setIndicatorForm({...indicatorForm, absenteeism: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Acidentes</label>
                  <input 
                    type="number" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={indicatorForm.accidents}
                    onChange={e => setIndicatorForm({...indicatorForm, accidents: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  {editingIndicatorId ? 'Salvar Alterações' : 'Lançar Indicadores'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Período</th>
                    <th className="px-8 py-5 text-center">Turnover</th>
                    <th className="px-8 py-5 text-center">Absenteísmo</th>
                    <th className="px-8 py-5 text-center">Acidentes</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {indicators.sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month)).map(ind => (
                    <tr key={ind.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-800 uppercase text-xs">
                          {format(new Date(2000, ind.month - 1), 'MMMM')} / {ind.year}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center font-black text-slate-600">{ind.turnover}%</td>
                      <td className="px-8 py-6 text-center font-black text-slate-600">{ind.absenteeism}%</td>
                      <td className="px-8 py-6 text-center font-black text-red-500">{ind.accidents}</td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {
                            setEditingIndicatorId(ind.id);
                            setIndicatorForm({
                              month: ind.month,
                              year: ind.year,
                              turnover: ind.turnover.toString(),
                              absenteeism: ind.absenteeism.toString(),
                              accidents: ind.accidents.toString()
                            });
                          }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeIndicator(ind.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {indicators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhum indicador registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaughterHR;
