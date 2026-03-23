
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AppState, SlaughterEmployee, SlaughterHRIndicator, SlaughterHREntry, SlaughterHRVacancy, User } from '../../types';
import { Users, UserPlus, Trash2, Edit3, X, Calendar, Search, TrendingUp, Heart, AlertCircle, Briefcase, BarChart as BarChartIcon, CheckSquare, Square, Plus, Layout } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatNumber } from '../../utils/formatters';

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

const SlaughterHR: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'registration' | 'entries' | 'indicators'>('registration');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    registrationNumber: '',
    name: '',
    role: '',
    department: '',
    admissionDate: new Date().toISOString().split('T')[0],
    status: 'Ativo' as SlaughterEmployee['status']
  });

  const [showNewRoleInput, setShowNewRoleInput] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [showNewDeptInput, setShowNewDeptInput] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [showNewEntryTypeInput, setShowNewEntryTypeInput] = useState(false);
  const [newEntryTypeName, setNewEntryTypeName] = useState('');
  const [editingEntryType, setEditingEntryType] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    employeeIds: [] as string[],
    type: 'Falta',
    date: new Date().toISOString().split('T')[0],
    days: '',
    description: ''
  });
  const [employeeSearch, setEmployeeSearch] = useState('');

  const employees = useMemo(() => state.slaughterEmployees || [], [state.slaughterEmployees]);
  const indicators = useMemo(() => state.slaughterHRIndicators || [], [state.slaughterHRIndicators]);
  const entries = useMemo(() => state.slaughterHREntries || [], [state.slaughterHREntries]);
  const vacancies = useMemo(() => state.slaughterHRVacancies || [], [state.slaughterHRVacancies]);
  const roles = useMemo(() => state.slaughterHRRoles || [], [state.slaughterHRRoles]);
  const departments = useMemo(() => state.slaughterHRDepartments || [], [state.slaughterHRDepartments]);
  const entryTypes = useMemo(() => state.slaughterHREntryTypes || [], [state.slaughterHREntryTypes]);

  const [vacancyForm, setVacancyForm] = useState({
    department: '',
    role: '',
    totalVacancies: ''
  });
  const [editingVacancyId, setEditingVacancyId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Ativo');
    const activeCount = activeEmployees.length;
    
    const totalVacanciesCount = vacancies.reduce((acc, v) => acc + v.totalVacancies, 0);
    const occupancyRate = totalVacanciesCount > 0 ? (activeCount / totalVacanciesCount) * 100 : 0;

    // Filter indicators by month/year
    const filteredIndicator = indicators.find(ind => ind.month === filterMonth && ind.year === filterYear);

    // Filter entries by month/year and employee
    const filteredEntries = entries.filter(entry => {
      const d = new Date(entry.date);
      const matchesDate = (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
      const matchesEmployee = filterEmployeeId === 'all' || entry.employeeIds.includes(filterEmployeeId);
      return matchesDate && matchesEmployee;
    });

    // Calculate metrics from entries for the current filtered month/year
    const monthEntries = entries.filter(entry => {
      const d = new Date(entry.date);
      return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
    });

    const accidentsCount = monthEntries.filter(e => e.type === 'Acidente').length;
    const turnoverCount = monthEntries.filter(e => e.type === 'Turnover').length;
    const turnoverRate = activeCount > 0 ? (turnoverCount / activeCount) * 100 : 0;

    const absentDays = monthEntries
      .filter(e => e.type === 'Atestado' || e.type === 'Falta')
      .reduce((acc, e) => acc + (e.days || 1), 0);
    const totalWorkDays = activeCount * 22;
    const absenteeismRate = totalWorkDays > 0 ? (absentDays / totalWorkDays) * 100 : 0;

    // Chart data for absenteeism (last 6 months) - derived from entries
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    }).reverse();

    const absenteeismData = last6Months.map(m => {
      const mEntries = entries.filter(e => {
        const d = new Date(e.date);
        return (d.getMonth() + 1) === m.month && d.getFullYear() === m.year;
      });
      const mAbsentDays = mEntries
        .filter(e => e.type === 'Atestado' || e.type === 'Falta')
        .reduce((acc, e) => acc + (e.days || 1), 0);
      const mRate = (activeCount * 22) > 0 ? (mAbsentDays / (activeCount * 22)) * 100 : 0;
      return {
        name: `${format(new Date(2000, m.month - 1), 'MMM')}/${m.year}`,
        value: mRate
      };
    });

    // Headcount data (active employees per sector vs vacancies)
    const headcountData = departments.map(dept => {
      const occupied = activeEmployees.filter(e => e.department === dept).length;
      const total = vacancies.filter(v => v.department === dept).reduce((acc, v) => acc + v.totalVacancies, 0);
      return {
        name: dept,
        ocupadas: occupied,
        vagas: total
      };
    });

    return { 
      active: activeCount, 
      totalVacanciesCount, 
      occupancyRate, 
      filteredIndicator: {
        turnover: turnoverRate,
        accidents: accidentsCount,
        absenteeism: absenteeismRate
      }, 
      filteredEntries, 
      absenteeismData, 
      headcountData 
    };
  }, [employees, entries, vacancies, filterMonth, filterYear, departments]);

  const handleSaveVacancy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacancyForm.department || !vacancyForm.role || !vacancyForm.totalVacancies) return;

    const newVacancy: SlaughterHRVacancy = {
      id: editingVacancyId || generateId(),
      department: vacancyForm.department,
      role: vacancyForm.role,
      totalVacancies: Number(vacancyForm.totalVacancies),
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedVacancies = editingVacancyId
      ? vacancies.map(v => v.id === editingVacancyId ? newVacancy : v)
      : [...vacancies, newVacancy];

    onUpdate({ ...state, slaughterHRVacancies: updatedVacancies });
    setEditingVacancyId(null);
    setVacancyForm({ department: '', role: '', totalVacancies: '' });
  };

  const removeVacancy = (id: string) => {
    if (!confirm('Deseja excluir este quadro de vagas?')) return;
    onUpdate({ ...state, slaughterHRVacancies: vacancies.filter(v => v.id !== id) });
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.role) return;

    const newEmployee: SlaughterEmployee = {
      id: editingEmployeeId || generateId(),
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
      id: editingEntryId || generateId(),
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

  useEffect(() => {
    const existing = indicators.find(ind => ind.month === filterMonth && ind.year === filterYear);
    if (existing) {
      setEditingIndicatorId(existing.id);
      setIndicatorForm({
        month: existing.month,
        year: existing.year,
        turnover: existing.turnover.toString(),
        absenteeism: existing.absenteeism.toString(),
        accidents: existing.accidents.toString()
      });
    } else {
      setEditingIndicatorId(null);
      setIndicatorForm({
        month: filterMonth,
        year: filterYear,
        turnover: '',
        absenteeism: '',
        accidents: ''
      });
    }
  }, [filterMonth, filterYear, indicators]);

  const handleSaveIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const newIndicator: SlaughterHRIndicator = {
      id: editingIndicatorId || generateId(),
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

  const updateRole = (oldRole: string, newRole: string) => {
    if (!newRole.trim() || roles.includes(newRole.trim())) return;
    const updatedRoles = roles.map(r => r === oldRole ? newRole.trim() : r);
    const updatedEmployees = employees.map(emp => emp.role === oldRole ? { ...emp, role: newRole.trim() } : emp);
    const updatedVacancies = vacancies.map(v => v.role === oldRole ? { ...v, role: newRole.trim() } : v);
    onUpdate({ 
      ...state, 
      slaughterHRRoles: updatedRoles, 
      slaughterEmployees: updatedEmployees,
      slaughterHRVacancies: updatedVacancies
    });
    setEditingRole(null);
    setNewRoleName('');
  };

  const deleteRole = (role: string) => {
    if (!confirm(`Deseja excluir o cargo "${role}"?`)) return;
    onUpdate({ ...state, slaughterHRRoles: roles.filter(r => r !== role) });
  };

  const updateDepartment = (oldDept: string, newDept: string) => {
    if (!newDept.trim() || departments.includes(newDept.trim())) return;
    const updatedDepts = departments.map(d => d === oldDept ? newDept.trim() : d);
    const updatedEmployees = employees.map(emp => emp.department === oldDept ? { ...emp, department: newDept.trim() } : emp);
    const updatedVacancies = vacancies.map(v => v.department === oldDept ? { ...v, department: newDept.trim() } : v);
    onUpdate({ 
      ...state, 
      slaughterHRDepartments: updatedDepts, 
      slaughterEmployees: updatedEmployees,
      slaughterHRVacancies: updatedVacancies
    });
    setEditingDept(null);
    setNewDeptName('');
  };

  const deleteDepartment = (dept: string) => {
    if (!confirm(`Deseja excluir o setor "${dept}"?`)) return;
    onUpdate({ ...state, slaughterHRDepartments: departments.filter(d => d !== dept) });
  };

  const updateEntryType = (oldType: string, newType: string) => {
    if (!newType.trim() || entryTypes.includes(newType.trim())) return;
    const updatedTypes = entryTypes.map(t => t === oldType ? newType.trim() : t);
    const updatedEntries = entries.map(ent => ent.type === oldType ? { ...ent, type: newType.trim() } : ent);
    onUpdate({ 
      ...state, 
      slaughterHREntryTypes: updatedTypes,
      slaughterHREntries: updatedEntries
    });
    setEditingEntryType(null);
    setNewEntryTypeName('');
  };

  const deleteEntryType = (type: string) => {
    if (!confirm(`Deseja excluir o tipo de lançamento "${type}"?`)) return;
    onUpdate({ ...state, slaughterHREntryTypes: entryTypes.filter(t => t !== type) });
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('registration')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'registration' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Cadastro
        </button>
        <button 
          onClick={() => setActiveSubTab('entries')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'entries' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Lançamentos
        </button>
        <button 
          onClick={() => setActiveSubTab('indicators')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'indicators' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Indicadores
        </button>
        <div className="flex-1" />
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${showSettings ? 'text-[#344434]' : 'text-slate-400'}`}
        >
          <Layout className="w-4 h-4" />
          Configurações
        </button>
      </div>

      {showSettings && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Cargos
            </h4>
            <div className="space-y-2">
              {roles.map(role => (
                <div key={role} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 group">
                  {editingRole === role ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        type="text"
                        className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => updateRole(role, newRoleName)}
                        className="px-2 py-1 bg-[#344434] text-white rounded-lg text-[9px] font-black uppercase"
                      >
                        OK
                      </button>
                      <button 
                        onClick={() => setEditingRole(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-700">{role}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingRole(role);
                            setNewRoleName(role);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => deleteRole(role)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Layout className="w-4 h-4" />
              Setores
            </h4>
            <div className="space-y-2">
              {departments.map(dept => (
                <div key={dept} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 group">
                  {editingDept === dept ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        type="text"
                        className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => updateDepartment(dept, newDeptName)}
                        className="px-2 py-1 bg-[#344434] text-white rounded-lg text-[9px] font-black uppercase"
                      >
                        OK
                      </button>
                      <button 
                        onClick={() => setEditingDept(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-700">{dept}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingDept(dept);
                            setNewDeptName(dept);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => deleteDepartment(dept)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Tipos de Lançamento
            </h4>
            <div className="space-y-2">
              {entryTypes.map(type => (
                <div key={type} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 group">
                  {editingEntryType === type ? (
                    <div className="flex gap-2 w-full">
                      <input 
                        type="text"
                        className="flex-1 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        value={newEntryTypeName}
                        onChange={e => setNewEntryTypeName(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => updateEntryType(type, newEntryTypeName)}
                        className="px-2 py-1 bg-[#344434] text-white rounded-lg text-[9px] font-black uppercase"
                      >
                        OK
                      </button>
                      <button 
                        onClick={() => setEditingEntryType(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-700">{type}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingEntryType(type);
                            setNewEntryTypeName(type);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => deleteEntryType(type)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'registration' && (
        <div className="space-y-12">
          {/* Employees Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <UserPlus className="w-6 h-6" />
                {editingEmployeeId ? 'Editar Colaborador' : 'Novo Colaborador'}
              </h3>
              <form onSubmit={handleSaveEmployee} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.registrationNumber}
                      onChange={e => setEmployeeForm({...employeeForm, registrationNumber: e.target.value})}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      type="text" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.name}
                      onChange={e => setEmployeeForm({...employeeForm, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs min-w-0"
                        value={employeeForm.role}
                        onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        {roles.map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <button 
                        type="button"
                        onClick={() => setShowNewRoleInput(!showNewRoleInput)}
                        className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {showNewRoleInput && (
                      <div className="flex gap-2 mt-2">
                        <input 
                          type="text"
                          placeholder="Novo cargo..."
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-xs min-w-0"
                          value={newRoleName}
                          onChange={e => setNewRoleName(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (newRoleName.trim() && !roles.includes(newRoleName.trim())) {
                              onUpdate({
                                ...state,
                                slaughterHRRoles: [...roles, newRoleName.trim()]
                              });
                              setEmployeeForm({ ...employeeForm, role: newRoleName.trim() });
                              setNewRoleName('');
                              setShowNewRoleInput(false);
                            }
                          }}
                          className="px-3 py-1 bg-[#344434] text-white rounded-xl font-black uppercase text-[9px] shrink-0"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Setor</label>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs min-w-0"
                        value={employeeForm.department}
                        onChange={e => setEmployeeForm({...employeeForm, department: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                      <button 
                        type="button"
                        onClick={() => setShowNewDeptInput(!showNewDeptInput)}
                        className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {showNewDeptInput && (
                      <div className="flex gap-2 mt-2">
                        <input 
                          type="text"
                          placeholder="Novo setor..."
                          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-xs min-w-0"
                          value={newDeptName}
                          onChange={e => setNewDeptName(e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            if (newDeptName.trim() && !departments.includes(newDeptName.trim())) {
                              onUpdate({
                                ...state,
                                slaughterHRDepartments: [...departments, newDeptName.trim()]
                              });
                              setEmployeeForm({ ...employeeForm, department: newDeptName.trim() });
                              setNewDeptName('');
                              setShowNewDeptInput(false);
                            }
                          }}
                          className="px-3 py-1 bg-[#344434] text-white rounded-xl font-black uppercase text-[9px] shrink-0"
                        >
                          OK
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <th className="px-8 py-5">Cargo / Setor</th>
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

        {/* Vacancy Board Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                  <Layout className="w-6 h-6" />
                  {editingVacancyId ? 'Editar Quadro' : 'Novo Quadro de Vagas'}
                </h3>
                <form onSubmit={handleSaveVacancy} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Setor</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={vacancyForm.department}
                      onChange={e => setVacancyForm({...vacancyForm, department: e.target.value})}
                      required
                    >
                      <option value="">Selecione...</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={vacancyForm.role}
                      onChange={e => setVacancyForm({...vacancyForm, role: e.target.value})}
                      required
                    >
                      <option value="">Selecione...</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total de Vagas</label>
                    <input 
                      type="number" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={vacancyForm.totalVacancies}
                      onChange={e => setVacancyForm({...vacancyForm, totalVacancies: e.target.value})}
                    />
                  </div>
                  <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                    {editingVacancyId ? 'Salvar Alterações' : 'Cadastrar Vagas'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Distribuição de Vagas</h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-5">Setor</th>
                      <th className="px-8 py-5">Cargo</th>
                      <th className="px-8 py-5">Vagas</th>
                      <th className="px-8 py-5">Preenchidas</th>
                      <th className="px-8 py-5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vacancies.map(v => {
                      const filled = employees.filter(e => e.department === v.department && e.role === v.role && e.status === 'Ativo').length;
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-6 text-xs font-bold text-slate-800">{v.department}</td>
                          <td className="px-8 py-6 text-xs text-slate-600">{v.role}</td>
                          <td className="px-8 py-6 text-xs font-black text-slate-400">{v.totalVacancies}</td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2">
                              <div className="text-xs font-bold text-slate-800">{filled}</div>
                              <div className="text-[10px] font-black text-slate-400">({formatNumber((filled / v.totalVacancies) * 100, 0)}%)</div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => {
                                setEditingVacancyId(v.id);
                                setVacancyForm({
                                  department: v.department,
                                  role: v.role,
                                  totalVacancies: v.totalVacancies.toString()
                                });
                              }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={() => removeVacancy(v.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {vacancies.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                          Nenhum quadro de vagas cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'entries' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Período</h4>
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

              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Colaborador</h4>
                  <select 
                    value={filterEmployeeId} 
                    onChange={e => setFilterEmployeeId(e.target.value)}
                    className="bg-transparent border-none text-xs font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 mt-1"
                  >
                    <option value="all">Todos os Colaboradores</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
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
                <form onSubmit={handleSaveEntry} className="space-y-6">
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
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">{emp.name}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{emp.registrationNumber}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">
                      {entryForm.employeeIds.length} selecionados
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                      <div className="flex gap-2">
                        <select 
                          className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs min-w-0"
                          value={entryForm.type}
                          onChange={e => setEntryForm({...entryForm, type: e.target.value})}
                        >
                          {entryTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setShowNewEntryTypeInput(!showNewEntryTypeInput)}
                          className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {showNewEntryTypeInput && (
                        <div className="flex gap-2 mt-2">
                          <input 
                            type="text"
                            placeholder="Novo tipo..."
                            className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none text-xs min-w-0"
                            value={newEntryTypeName}
                            onChange={e => setNewEntryTypeName(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (newEntryTypeName.trim() && !entryTypes.includes(newEntryTypeName.trim())) {
                                onUpdate({
                                  ...state,
                                  slaughterHREntryTypes: [...entryTypes, newEntryTypeName.trim()]
                                });
                                setEntryForm({ ...entryForm, type: newEntryTypeName.trim() });
                                setNewEntryTypeName('');
                                setShowNewEntryTypeInput(false);
                              }
                            }}
                            className="px-3 py-1 bg-[#344434] text-white rounded-xl font-black uppercase text-[9px] shrink-0"
                          >
                            OK
                          </button>
                        </div>
                      )}
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
                            {ent.employeeIds.length === 1 || filterEmployeeId !== 'all'
                              ? (filterEmployeeId !== 'all' 
                                  ? employees.find(e => e.id === filterEmployeeId)?.name 
                                  : employees.find(e => e.id === ent.employeeIds[0])?.name)
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
                            {ent.type} {ent.days ? `(${formatNumber(ent.days)}d)` : ''}
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
        </div>
      )}

      {activeSubTab === 'indicators' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="bg-blue-50/50 p-4 rounded-2xl flex items-center gap-3">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quadro de Vagas</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-sm font-black text-slate-800">{formatNumber(stats.active)} / {formatNumber(stats.totalVacanciesCount)}</div>
                  <div className="text-[10px] font-bold text-blue-600">{formatNumber(stats.occupancyRate, 1)}%</div>
                </div>
              </div>
            </div>
            <div className="bg-amber-50/50 p-4 rounded-2xl flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Turnover</div>
                <div className="text-sm font-black text-slate-800">{formatNumber(stats.filteredIndicator?.turnover || 0, 1)}%</div>
              </div>
            </div>
            <div className="bg-red-50/50 p-4 rounded-2xl flex items-center gap-3">
              <Heart className="w-4 h-4 text-red-600" />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Acidentes</div>
                <div className="text-sm font-black text-slate-800">{formatNumber(stats.filteredIndicator?.accidents || 0)}</div>
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
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                      formatter={(value: number) => [formatNumber(value, 1) + '%', "Absenteísmo"]}
                    />
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
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">HEADCOUNT</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Vagas vs Ocupadas por Setor</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.headcountData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} width={100} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                    />
                    <Bar dataKey="vagas" name="Vagas Totais" fill="#e2e8f0" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="ocupadas" name="Vagas Ocupadas" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                  <BarChartIcon className="w-6 h-6" />
                  Resumo de Indicadores (Calculado dos Lançamentos)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Absenteísmo</div>
                    <div className="text-2xl font-black text-slate-800">{formatNumber(stats.filteredIndicator.absenteeism, 1)}%</div>
                    <div className="text-[10px] text-slate-400 mt-1">Baseado em faltas e atestados do mês</div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Turnover</div>
                    <div className="text-2xl font-black text-slate-800">{formatNumber(stats.filteredIndicator.turnover, 1)}%</div>
                    <div className="text-[10px] text-slate-400 mt-1">Baseado em desligamentos do mês</div>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Acidentes</div>
                    <div className="text-2xl font-black text-slate-800">{formatNumber(stats.filteredIndicator.accidents)}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Total de acidentes no mês</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaughterHR;
