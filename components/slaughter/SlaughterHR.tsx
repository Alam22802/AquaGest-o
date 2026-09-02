
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AppState, SlaughterEmployee, SlaughterHRIndicator, SlaughterHREntry, SlaughterHRVacancy, User } from '../../types';
import { Users, UserPlus, UserMinus, Trash2, Edit3, X, Calendar, Search, TrendingUp, Heart, AlertCircle, Briefcase, BarChart as BarChartIcon, CheckSquare, Square, Plus, Layout, FileText, Loader2 } from 'lucide-react';
import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatNumber } from '../../utils/formatters';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

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

const HeadcountTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#344434] p-4 rounded-2xl shadow-xl border border-white/10 text-[#e4e4d4]">
        <p className="text-[11px] font-black mb-2 uppercase tracking-widest border-b border-white/10 pb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span 
                  className="text-[10px] font-black uppercase tracking-tighter text-white"
                >
                  {entry.name}:
                </span>
              </div>
              <span className="text-xs font-black">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const isDismissalType = (type: string | undefined | null): boolean => {
  if (!type) return false;
  const lower = type.toLowerCase().trim();
  return lower.includes('desligamento') || lower.includes('turnover') || lower.includes('saída') || lower.includes('saida');
};

interface TurnoverMetricsResult {
  rate: number;
  dismissalsCount: number;
  avgEmployees: number;
  activeAtStart: number;
  activeAtEnd: number;
}

/**
 * Turnover (%) = (Número de desligamentos / saídas ÷ Número médio de colaboradores) × 100
 * Onde:
 * - Número de saídas / desligamentos: total de saídas (lançamentos de Desligamento) ocorridas no período
 * - Número médio de colaboradores: (Colaboradores ativos no início + Colaboradores ativos no fim) ÷ 2
 */
const getMonthTurnoverMetrics = (
  targetMonth: number,
  targetYear: number,
  targetEmployeeId: string,
  employeesList: SlaughterEmployee[],
  entriesList: SlaughterHREntry[]
): TurnoverMetricsResult => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const startDateStr = `${targetYear}-${pad(targetMonth)}-01`;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const endDateStr = `${targetYear}-${pad(targetMonth)}-${pad(lastDay)}`;

  // Mapeamento de datas de desligamento (saída) dos colaboradores baseado nos lançamentos de Desligamento
  const dismissalDates = new Map<string, string>();
  entriesList.forEach(e => {
    if (isDismissalType(e.type) && e.date && Array.isArray(e.employeeIds)) {
      e.employeeIds.forEach(id => {
        const prev = dismissalDates.get(id);
        if (!prev || e.date > prev) {
          dismissalDates.set(id, e.date);
        }
      });
    }
  });

  // Lançamentos de desligamento (saídas) no mês/ano
  const monthlyTurnoverEntries = entriesList.filter(e => {
    if (!isDismissalType(e.type) || !e.date) return false;
    const [y, m] = e.date.split('-').map(Number);
    return m === targetMonth && y === targetYear;
  });

  // 1. Número de desligamentos / saídas no mês
  let dismissalsCount = 0;
  if (targetEmployeeId === 'all') {
    const dismissedIds = new Set<string>();
    monthlyTurnoverEntries.forEach(e => {
      e.employeeIds?.forEach(id => dismissedIds.add(id));
    });
    dismissalsCount = dismissedIds.size;
  } else {
    const wasDismissed = monthlyTurnoverEntries.some(e => e.employeeIds?.includes(targetEmployeeId));
    dismissalsCount = wasDismissed ? 1 : 0;
  }

  // Filtragem dos colaboradores a considerar
  const targetEmployees = targetEmployeeId === 'all'
    ? employeesList
    : employeesList.filter(e => e.id === targetEmployeeId);

  // Colaboradores ativos no início do mês (1º dia)
  const activeAtStart = targetEmployees.filter(e => {
    const adm = e.admissionDate || '2000-01-01';
    if (adm > startDateStr) return false;

    const dismissal = dismissalDates.get(e.id);
    if (dismissal) {
      return dismissal >= startDateStr;
    }
    return e.status === 'Ativo';
  }).length;

  // Colaboradores ativos no final do mês (último dia)
  const activeAtEnd = targetEmployees.filter(e => {
    const adm = e.admissionDate || '2000-01-01';
    if (adm > endDateStr) return false;

    const dismissal = dismissalDates.get(e.id);
    if (dismissal) {
      return dismissal > endDateStr;
    }
    return e.status === 'Ativo';
  }).length;

  // 2. Número médio de colaboradores: (Início + Fim) / 2
  const avgEmployees = (activeAtStart + activeAtEnd) / 2;

  // 3. Turnover (%) = (Número de desligamentos ÷ Número médio de colaboradores) × 100
  const rate = avgEmployees > 0 ? (dismissalsCount / avgEmployees) * 100 : 0;

  return {
    rate,
    dismissalsCount,
    avgEmployees,
    activeAtStart,
    activeAtEnd
  };
};

const SlaughterHR: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'sectors' | 'entries' | 'indicators'>('employees');
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
    birthDate: '',
    status: 'Ativo' as SlaughterEmployee['status']
  });

  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [showNewEntryTypeInput, setShowNewEntryTypeInput] = useState(false);
  const [newEntryTypeName, setNewEntryTypeName] = useState('');
  const [editingEntryType, setEditingEntryType] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionText?: string;
    onConfirm: () => void;
  } | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    employeeIds: [] as string[],
    type: 'Falta',
    date: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    days: '1',
    description: ''
  });

  useEffect(() => {
    const isAbsence = entryForm.type.toLowerCase().includes('falta') || entryForm.type.toLowerCase().includes('atestado');
    if (isAbsence) {
      try {
        const start = parseISO(entryForm.date);
        const end = parseISO(entryForm.endDate);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diff = differenceInDays(end, start) + 1;
          if (diff > 0) {
            if (diff.toString() !== entryForm.days) {
              setEntryForm(prev => ({ ...prev, days: diff.toString() }));
            }
          } else if (diff <= 0 && entryForm.endDate < entryForm.date) {
             // If end date is before start date, sync them
             setEntryForm(prev => ({ ...prev, endDate: prev.date, days: '1' }));
          } else {
            if (entryForm.days !== '1') {
              setEntryForm(prev => ({ ...prev, days: '1' }));
            }
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, [entryForm.date, entryForm.endDate, entryForm.type]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [peopleStatusFilter, setPeopleStatusFilter] = useState<'all' | 'Ativo' | 'Inativo'>('all');
  const [peopleSearch, setPeopleSearch] = useState('');

  // Sincronização e migração de 'Turnover' para 'Desligamento' nos tipos e lançamentos
  useEffect(() => {
    const rawTypes = state.slaughterHREntryTypes || [];
    const rawEntries = state.slaughterHREntries || [];
    let typesNeedUpdate = false;
    let entriesNeedUpdate = false;

    let newTypes = [...rawTypes];
    if (newTypes.includes('Turnover')) {
      newTypes = newTypes.map(t => t === 'Turnover' ? 'Desligamento' : t);
      typesNeedUpdate = true;
    }
    if (newTypes.length > 0 && !newTypes.includes('Desligamento')) {
      newTypes.push('Desligamento');
      typesNeedUpdate = true;
    }
    newTypes = Array.from(new Set(newTypes));

    const newEntries = rawEntries.map(e => {
      if (e.type === 'Turnover') {
        entriesNeedUpdate = true;
        return { ...e, type: 'Desligamento', updatedAt: Date.now() };
      }
      return e;
    });

    if (typesNeedUpdate || entriesNeedUpdate) {
      onUpdate({
        ...state,
        ...(typesNeedUpdate ? { 
          slaughterHREntryTypes: newTypes, 
          slaughterHREntryTypesUpdated: Date.now() 
        } : {}),
        ...(entriesNeedUpdate ? { 
          slaughterHREntries: newEntries 
        } : {})
      });
    }
  }, [state.slaughterHREntryTypes, state.slaughterHREntries, onUpdate, state]);

  useEffect(() => {
    const rawEmployees = state.slaughterEmployees || [];
    const rawEntries = state.slaughterHREntries || [];
    
    const dismissalEmployeeIds = new Set(
      rawEntries
        .filter(entry => isDismissalType(entry.type))
        .flatMap(entry => entry.employeeIds)
    );
    
    const needsUpdate = rawEmployees.some(emp => dismissalEmployeeIds.has(emp.id) && emp.status !== 'Inativo');
    
    if (needsUpdate) {
      const updatedEmployees = rawEmployees.map(emp => {
        if (dismissalEmployeeIds.has(emp.id) && emp.status !== 'Inativo') {
          return { ...emp, status: 'Inativo' as const, updatedAt: Date.now() };
        }
        return emp;
      });
      onUpdate({
        ...state,
        slaughterEmployees: updatedEmployees
      });
    }
  }, [state.slaughterEmployees, state.slaughterHREntries, onUpdate, state]);

  const employees = useMemo(() => {
    const rawEmployees = state.slaughterEmployees || [];
    const rawEntries = state.slaughterHREntries || [];
    
    const dismissalEmployeeIds = new Set(
      rawEntries
        .filter(entry => isDismissalType(entry.type))
        .flatMap(entry => entry.employeeIds)
    );
    
    return rawEmployees.map(emp => {
      if (dismissalEmployeeIds.has(emp.id) && emp.status !== 'Inativo') {
        return { ...emp, status: 'Inativo' as const };
      }
      return emp;
    });
  }, [state.slaughterEmployees, state.slaughterHREntries]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesStatus = peopleStatusFilter === 'all' || emp.status === peopleStatusFilter;
      const matchesSearch = !peopleSearch.trim() || 
        emp.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
        emp.registrationNumber.toLowerCase().includes(peopleSearch.toLowerCase()) ||
        emp.role.toLowerCase().includes(peopleSearch.toLowerCase()) ||
        emp.department.toLowerCase().includes(peopleSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [employees, peopleStatusFilter, peopleSearch]);
  const indicators = useMemo(() => state.slaughterHRIndicators || [], [state.slaughterHRIndicators]);
  const entries = useMemo(() => state.slaughterHREntries || [], [state.slaughterHREntries]);
  const vacancies = useMemo(() => state.slaughterHRVacancies || [], [state.slaughterHRVacancies]);
  const roles = useMemo(() => state.slaughterHRRoles || [], [state.slaughterHRRoles]);
  const departments = useMemo(() => state.slaughterHRDepartments || [], [state.slaughterHRDepartments]);
  const entryTypes = useMemo(() => {
    const defaultTypes = ['Falta', 'Atestado Médico', 'Acidente', 'Desligamento', 'Outros'];
    const raw = (state.slaughterHREntryTypes && state.slaughterHREntryTypes.length > 0)
      ? state.slaughterHREntryTypes
      : defaultTypes;
    const mapped = raw.map(t => t === 'Turnover' ? 'Desligamento' : t);
    if (!mapped.includes('Desligamento')) {
      mapped.push('Desligamento');
    }
    return Array.from(new Set(mapped));
  }, [state.slaughterHREntryTypes]);

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

    // Calculate metrics from entries for the current filtered month/year
    const monthStart = new Date(filterYear, filterMonth - 1, 1);
    const monthEnd = new Date(filterYear, filterMonth, 0);

    const getDaysInMonth = (entryDate: string, entryEndDate: string | undefined, m: number, y: number) => {
      const start = parseISO(entryDate);
      const end = entryEndDate ? parseISO(entryEndDate) : start;
      const mStart = new Date(y, m - 1, 1);
      const mEnd = new Date(y, m, 0);
      
      const overlapStart = start > mStart ? start : mStart;
      const overlapEnd = end < mEnd ? end : mEnd;
      
      if (overlapStart <= overlapEnd) {
        return differenceInDays(overlapEnd, overlapStart) + 1;
      }
      return 0;
    };

    const filteredEntries = entries.filter(entry => {
      const start = parseISO(entry.date);
      const end = entry.endDate ? parseISO(entry.endDate) : start;
      const matchesDate = (start <= monthEnd && end >= monthStart);
      const matchesEmployee = filterEmployeeId === 'all' || entry.employeeIds.includes(filterEmployeeId);
      return matchesDate && matchesEmployee;
    });

    const accidentsCount = entries
      .filter(e => {
        const [y, m] = e.date.split('-').map(Number);
        return m === filterMonth && y === filterYear && e.type.toLowerCase().includes('acidente');
      })
      .reduce((acc, e) => acc + e.employeeIds.length, 0);

    // Turnover calculation: Turnover (%) = (Número de desligamentos ÷ Número médio de colaboradores) × 100
    const currentTurnover = getMonthTurnoverMetrics(
      filterMonth,
      filterYear,
      filterEmployeeId,
      employees,
      entries
    );
    const turnoverCount = currentTurnover.dismissalsCount;
    const turnoverRate = currentTurnover.rate;
    
    // Headcount for the specific filtered month (estimate)
    const monthActiveCount = employees.filter(e => {
      const admission = parseISO(e.admissionDate);
      return admission <= monthEnd && e.status === 'Ativo';
    }).length;

    const filteredAbsentDays = filteredEntries
      .filter(e => e.type.toLowerCase().includes('atestado') || e.type.toLowerCase().includes('falta'))
      .reduce((acc, e) => {
        const daysInMonth = getDaysInMonth(e.date, e.endDate, filterMonth, filterYear);
        return acc + (daysInMonth * (filterEmployeeId === 'all' ? e.employeeIds.length : 1));
      }, 0);
    
    const filteredActiveCount = filterEmployeeId === 'all' ? monthActiveCount : 1;
    const totalWorkDays = filteredActiveCount * 22;
    const absenteeismRate = totalWorkDays > 0 ? (filteredAbsentDays / totalWorkDays) * 100 : 0;

    // Chart data for absenteeism (last 6 months) - derived from entries
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(filterYear, filterMonth - 1, 1);
      d.setMonth(d.getMonth() - i);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    }).reverse();

    const absenteeismData = last6Months.map(m => {
      const mStart = new Date(m.year, m.month - 1, 1);
      const mEnd = new Date(m.year, m.month, 0);

      const mEntries = entries.filter(e => {
        const start = parseISO(e.date);
        const end = e.endDate ? parseISO(e.endDate) : start;
        const matchesDate = (start <= mEnd && end >= mStart);
        const matchesEmployee = filterEmployeeId === 'all' || e.employeeIds.includes(filterEmployeeId);
        return matchesDate && matchesEmployee;
      });

      const mAbsentDays = mEntries
        .filter(e => e.type.toLowerCase().includes('atestado') || e.type.toLowerCase().includes('falta'))
        .reduce((acc, e) => {
          const daysInMonth = getDaysInMonth(e.date, e.endDate, m.month, m.year);
          return acc + (daysInMonth * (filterEmployeeId === 'all' ? e.employeeIds.length : 1));
        }, 0);
      
      const mActiveCount = filterEmployeeId === 'all' 
        ? employees.filter(e => {
            const admission = parseISO(e.admissionDate);
            const monthEnd = new Date(m.year, m.month, 0);
            return admission <= monthEnd && e.status === 'Ativo';
          }).length
        : 1;

      const mRate = (mActiveCount * 22) > 0 ? (mAbsentDays / (mActiveCount * 22)) * 100 : 0;
      return {
        name: `${format(new Date(2000, m.month - 1), 'MMM', { locale: ptBR })}/${m.year}`,
        value: mRate
      };
    });

    const turnoverData = last6Months.map(m => {
      const mMetrics = getMonthTurnoverMetrics(
        m.month,
        m.year,
        filterEmployeeId,
        employees,
        entries
      );
      return {
        name: `${format(new Date(2000, m.month - 1), 'MMM', { locale: ptBR })}/${m.year}`,
        value: mMetrics.rate,
        dismissals: mMetrics.dismissalsCount,
        avgEmployees: mMetrics.avgEmployees
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

    // Birthdays of the month
    const birthdays = employees.filter(e => {
      if (!e.birthDate) return false;
      const birthMonth = parseISO(e.birthDate).getMonth() + 1;
      return birthMonth === filterMonth && e.status === 'Ativo';
    }).map(e => ({
      name: e.name,
      day: parseISO(e.birthDate!).getDate(),
      department: e.department
    })).sort((a, b) => a.day - b.day);

    return { 
      active: activeCount, 
      totalVacanciesCount, 
      occupancyRate, 
      filteredIndicator: {
        turnover: turnoverRate,
        turnoverDetails: currentTurnover,
        accidents: accidentsCount,
        absenteeism: absenteeismRate
      }, 
      filteredEntries, 
      absenteeismData, 
      turnoverData,
      headcountData,
      birthdays
    };
  }, [employees, entries, vacancies, filterMonth, filterYear, departments, filterEmployeeId]);

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
    const target = vacancies.find(v => v.id === id);
    const desc = target ? ` de "${target.department} - ${target.role}"` : '';
    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Quadro de Vagas',
      message: `Deseja realmente excluir o quadro de vagas${desc}?`,
      actionText: 'Excluir Vagas',
      onConfirm: () => {
        onUpdate({ 
          ...state, 
          slaughterHRVacancies: (state.slaughterHRVacancies || []).filter(v => v.id !== id),
          deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
        });
        setConfirmDelete(null);
      }
    });
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.role) return;

    const newEmployee: SlaughterEmployee = {
      id: editingEmployeeId || generateId(),
      ...employeeForm,
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
      birthDate: '',
      status: 'Ativo'
    });
  };

  const removeEmployee = (id: string) => {
    const target = employees.find(e => e.id === id);
    const desc = target ? ` "${target.name}"` : '';
    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Colaborador',
      message: `Deseja realmente excluir o colaborador${desc}?`,
      actionText: 'Excluir Colaborador',
      onConfirm: () => {
        onUpdate({ 
          ...state, 
          slaughterEmployees: (state.slaughterEmployees || []).filter(e => e.id !== id),
          deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
        });
        setConfirmDelete(null);
      }
    });
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
      endDate: (entryForm.type.toLowerCase().includes('falta') || entryForm.type.toLowerCase().includes('atestado')) ? entryForm.endDate : entryForm.date,
      days: entryForm.days ? Number(entryForm.days) : undefined,
      description: entryForm.description,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedEntries = editingEntryId
      ? entries.map(ent => ent.id === editingEntryId ? newEntry : ent)
      : [...entries, newEntry];

    // Se o tipo do lançamento for Desligamento / Saída, altera o status do colaborador para 'Inativo'
    // Se o tipo do lançamento foi alterado DE Desligamento para outra coisa, ou se salvamos um novo, sincronizamos o status
    const oldEntry = editingEntryId ? entries.find(e => e.id === editingEntryId) : null;
    let updatedEmployees = employees;
    if (isDismissalType(newEntry.type)) {
      updatedEmployees = employees.map(emp => {
        if (newEntry.employeeIds.includes(emp.id)) {
          return { ...emp, status: 'Inativo' as const, updatedAt: Date.now() };
        }
        return emp;
      });
    } else if (oldEntry && isDismissalType(oldEntry.type)) {
      updatedEmployees = employees.map(emp => {
        if (oldEntry.employeeIds.includes(emp.id)) {
          const otherDismissals = updatedEntries.filter(e => e.id !== newEntry.id && e.employeeIds.includes(emp.id) && isDismissalType(e.type));
          if (otherDismissals.length === 0) {
            return { ...emp, status: 'Ativo' as const, updatedAt: Date.now() };
          }
        }
        return emp;
      });
    }

    onUpdate({ 
      ...state, 
      slaughterHREntries: updatedEntries,
      slaughterEmployees: updatedEmployees
    });
    setEditingEntryId(null);
    setEntryForm({
      employeeIds: [],
      type: 'Falta',
      date: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      days: '1',
      description: ''
    });
    setEmployeeSearch('');
  };

  const removeEntry = (id: string) => {
    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Lançamento',
      message: 'Deseja realmente excluir este lançamento?',
      actionText: 'Excluir Lançamento',
      onConfirm: () => {
        const entryToDelete = entries.find(e => e.id === id);
        let updatedEmployees = employees;
        if (entryToDelete && isDismissalType(entryToDelete.type)) {
          updatedEmployees = employees.map(emp => {
            if (entryToDelete.employeeIds.includes(emp.id)) {
              const otherDismissals = entries.filter(e => e.id !== id && e.employeeIds.includes(emp.id) && isDismissalType(e.type));
              if (otherDismissals.length === 0) {
                return { ...emp, status: 'Ativo' as const, updatedAt: Date.now() };
              }
            }
            return emp;
          });
        }

        onUpdate({ 
          ...state, 
          slaughterHREntries: (state.slaughterHREntries || []).filter(e => e.id !== id),
          slaughterEmployees: updatedEmployees,
          deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
        });
        setConfirmDelete(null);
      }
    });
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
    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Indicador',
      message: 'Deseja realmente excluir este indicador mensal?',
      actionText: 'Excluir Indicador',
      onConfirm: () => {
        onUpdate({ 
          ...state, 
          slaughterHRIndicators: (state.slaughterHRIndicators || []).filter(i => i.id !== id),
          deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
        });
        setConfirmDelete(null);
      }
    });
  };

  const updateRole = (oldRole: string, newRole: string) => {
    const trimmed = newRole.trim();
    if (!trimmed || roles.includes(trimmed)) return;
    const updatedRoles = roles.map(r => r === oldRole ? trimmed : r);
    const updatedEmployees = employees.map(emp => emp.role === oldRole ? { ...emp, role: trimmed, updatedAt: Date.now() } : emp);
    const updatedVacancies = vacancies.map(v => v.role === oldRole ? { ...v, role: trimmed, updatedAt: Date.now() } : v);
    const currentDeletedIds = state.deletedIds || [];
    const updatedDeletedIds = Array.from(new Set([
      ...currentDeletedIds.filter(id => id !== `role:${trimmed}` && id !== trimmed),
      `role:${oldRole}`
    ]));
    onUpdate({ 
      ...state, 
      slaughterHRRoles: updatedRoles, 
      slaughterHRRolesUpdated: Date.now(),
      slaughterEmployees: updatedEmployees,
      slaughterHRVacancies: updatedVacancies,
      deletedIds: updatedDeletedIds
    });
    setEditingRole(null);
    setNewRoleName('');
  };

  const deleteRole = (role: string) => {
    const linkedVacancies = vacancies.filter(v => v.role === role);
    const linkedEmployees = employees.filter(e => e.role === role);
    const details = [];
    if (linkedVacancies.length > 0) details.push(`${linkedVacancies.length} quadro(s) de vagas`);
    if (linkedEmployees.length > 0) details.push(`${linkedEmployees.length} colaborador(es)`);
    const warn = details.length > 0 ? ` Este cargo possui ${details.join(' e ')} vinculados que serão atualizados.` : '';

    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Cargo',
      message: `Deseja realmente excluir o cargo "${role}"?${warn}`,
      actionText: 'Excluir Cargo',
      onConfirm: () => {
        const remainingVacancies = vacancies.filter(v => v.role !== role);
        const removedVacancyIds = linkedVacancies.map(v => v.id);
        const updatedEmployees = employees.map(emp => emp.role === role ? { ...emp, role: '', updatedAt: Date.now() } : emp);
        const updatedRoles = roles.filter(r => r !== role);
        const updatedDeletedIds = Array.from(new Set([
          ...(state.deletedIds || []),
          `role:${role}`,
          role,
          ...removedVacancyIds
        ]));
        onUpdate({
          ...state,
          slaughterHRRoles: updatedRoles,
          slaughterHRRolesUpdated: Date.now(),
          slaughterHRVacancies: remainingVacancies,
          slaughterEmployees: updatedEmployees,
          deletedIds: updatedDeletedIds
        });
        setConfirmDelete(null);
      }
    });
  };

  const updateDepartment = (oldDept: string, newDept: string) => {
    const trimmed = newDept.trim();
    if (!trimmed || departments.includes(trimmed)) return;
    const updatedDepts = departments.map(d => d === oldDept ? trimmed : d);
    const updatedEmployees = employees.map(emp => emp.department === oldDept ? { ...emp, department: trimmed, updatedAt: Date.now() } : emp);
    const updatedVacancies = vacancies.map(v => v.department === oldDept ? { ...v, department: trimmed, updatedAt: Date.now() } : v);
    const currentDeletedIds = state.deletedIds || [];
    const updatedDeletedIds = Array.from(new Set([
      ...currentDeletedIds.filter(id => id !== `dept:${trimmed}` && id !== trimmed),
      `dept:${oldDept}`
    ]));
    onUpdate({ 
      ...state, 
      slaughterHRDepartments: updatedDepts, 
      slaughterHRDepartmentsUpdated: Date.now(),
      slaughterEmployees: updatedEmployees,
      slaughterHRVacancies: updatedVacancies,
      deletedIds: updatedDeletedIds
    });
    setEditingDept(null);
    setNewDeptName('');
  };

  const deleteDepartment = (dept: string) => {
    const linkedVacancies = vacancies.filter(v => v.department === dept);
    const linkedEmployees = employees.filter(e => e.department === dept);
    const details = [];
    if (linkedVacancies.length > 0) details.push(`${linkedVacancies.length} quadro(s) de vagas`);
    if (linkedEmployees.length > 0) details.push(`${linkedEmployees.length} colaborador(es)`);
    const warn = details.length > 0 ? ` Este setor possui ${details.join(' e ')} vinculados que serão atualizados.` : '';

    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Setor',
      message: `Deseja realmente excluir o setor "${dept}"?${warn}`,
      actionText: 'Excluir Setor',
      onConfirm: () => {
        const remainingVacancies = vacancies.filter(v => v.department !== dept);
        const removedVacancyIds = linkedVacancies.map(v => v.id);
        const updatedEmployees = employees.map(emp => emp.department === dept ? { ...emp, department: '', updatedAt: Date.now() } : emp);
        const updatedDepts = departments.filter(d => d !== dept);
        const updatedDeletedIds = Array.from(new Set([
          ...(state.deletedIds || []),
          `dept:${dept}`,
          dept,
          ...removedVacancyIds
        ]));
        onUpdate({
          ...state,
          slaughterHRDepartments: updatedDepts,
          slaughterHRDepartmentsUpdated: Date.now(),
          slaughterHRVacancies: remainingVacancies,
          slaughterEmployees: updatedEmployees,
          deletedIds: updatedDeletedIds
        });
        setConfirmDelete(null);
      }
    });
  };

  const updateEntryType = (oldType: string, newType: string) => {
    const trimmed = newType.trim();
    if (!trimmed || entryTypes.includes(trimmed)) return;
    const updatedTypes = entryTypes.map(t => t === oldType ? trimmed : t);
    const updatedEntries = entries.map(ent => ent.type === oldType ? { ...ent, type: trimmed, updatedAt: Date.now() } : ent);
    const currentDeletedIds = state.deletedIds || [];
    const updatedDeletedIds = Array.from(new Set([
      ...currentDeletedIds.filter(id => id !== `entryType:${trimmed}` && id !== trimmed),
      `entryType:${oldType}`
    ]));
    onUpdate({ 
      ...state, 
      slaughterHREntryTypes: updatedTypes,
      slaughterHREntryTypesUpdated: Date.now(),
      slaughterHREntries: updatedEntries,
      deletedIds: updatedDeletedIds
    });
    setEditingEntryType(null);
    setNewEntryTypeName('');
  };

  const deleteEntryType = (type: string) => {
    const linkedEntries = entries.filter(e => e.type === type);
    const warn = linkedEntries.length > 0 ? ` Existem ${linkedEntries.length} lançamento(s) deste tipo.` : '';

    setConfirmDelete({
      isOpen: true,
      title: 'Excluir Tipo de Lançamento',
      message: `Deseja realmente excluir o tipo de lançamento "${type}"?${warn}`,
      actionText: 'Excluir Tipo',
      onConfirm: () => {
        const updatedDeletedIds = Array.from(new Set([
          ...(state.deletedIds || []),
          `entryType:${type}`,
          type
        ]));
        onUpdate({
          ...state,
          slaughterHREntryTypes: entryTypes.filter(t => t !== type),
          slaughterHREntryTypesUpdated: Date.now(),
          deletedIds: updatedDeletedIds
        });
        setConfirmDelete(null);
      }
    });
  };

  const generatePDF = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const monthDate = new Date(filterYear, filterMonth - 1, 1);
      const rawMonthName = format(monthDate, 'MMMM', { locale: ptBR });
      const monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
      const emissionDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");

      // Draw standard top header banner
      const drawPageHeader = (pageTitle: string, pageSub: string) => {
        doc.setFillColor(52, 68, 52); // #344434
        doc.rect(0, 0, 210, 30, 'F');

        doc.setFillColor(228, 228, 212); // #e4e4d4 accent stripe
        doc.rect(0, 30, 210, 1.2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('AQUAGESTÃO PISCICULTURA • FRIGORÍFICO', 15, 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(228, 228, 212);
        doc.text(pageTitle, 15, 19);

        doc.setFontSize(7);
        doc.setTextColor(200, 215, 200);
        doc.text(`Período de Referência: ${monthName} de ${filterYear}   |   Emissão: ${emissionDate}   |   Responsável: ${currentUser?.name || 'Sistema'}`, 15, 25);
      };

      // Helper to capture a DOM element via html2canvas
      const captureDomElement = async (elementId: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        const el = document.getElementById(elementId);
        if (!el) return null;
        try {
          const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          return {
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height
          };
        } catch (e) {
          console.warn(`Falha na captura do elemento ${elementId}:`, e);
          return null;
        }
      };

      // ==========================================
      // PAGE 1: RESUMO DO MÊS, ANIVERSARIANTES E ABSENTEÍSMO
      // ==========================================
      drawPageHeader('Relatório Mensal de Indicadores de Recursos Humanos', `${monthName} / ${filterYear}`);

      let currentY = 38;

      // 1. Indicadores Consolidados
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text(`1. INDICADORES CONSOLIDADOS DO MÊS (${monthName.toUpperCase()}/${filterYear})`, 15, currentY);
      currentY += 4;

      const cardWidth = 42;
      const cardHeight = 22;
      const cardGap = 4;
      const startX = 15;

      const kpis = [
        {
          title: 'ABSENTEÍSMO',
          value: `${formatNumber(stats.filteredIndicator.absenteeism, 1)}%`,
          sub: 'Faltas e atestados do mês'
        },
        {
          title: 'TURNOVER',
          value: `${formatNumber(stats.filteredIndicator.turnover, 1)}%`,
          sub: `${stats.filteredIndicator.turnoverDetails.dismissalsCount} ${stats.filteredIndicator.turnoverDetails.dismissalsCount === 1 ? 'saída' : 'saídas'} (méd. ${formatNumber(stats.filteredIndicator.turnoverDetails.avgEmployees, 1)})`
        },
        {
          title: 'ACIDENTES',
          value: `${formatNumber(stats.filteredIndicator.accidents)}`,
          sub: 'Ocorrências no mês'
        },
        {
          title: 'QUADRO DE VAGAS',
          value: `${formatNumber(stats.active)} / ${formatNumber(stats.totalVacanciesCount)}`,
          sub: `${formatNumber(stats.occupancyRate, 1)}% taxa ocupação`
        }
      ];

      kpis.forEach((kpi, idx) => {
        const x = startX + idx * (cardWidth + cardGap);
        doc.setFillColor(248, 250, 248);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 2, 2, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.title, x + 3, currentY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(52, 68, 52);
        doc.text(kpi.value, x + 3, currentY + 12.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        doc.text(kpi.sub, x + 3, currentY + 18);
      });

      currentY += cardHeight + 8;

      // 2. Aniversariantes do Mês
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text(`2. ANIVERSARIANTES DE ${monthName.toUpperCase()}`, 15, currentY);
      currentY += 4;

      if (stats.birthdays.length > 0) {
        const birthdayRows = stats.birthdays.map(b => [
          `Dia ${b.day.toString().padStart(2, '0')}`,
          b.name,
          b.department || '-'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Dia', 'Colaborador', 'Setor / Departamento']],
          body: birthdayRows,
          theme: 'striped',
          headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
            1: { fontStyle: 'bold' },
            2: { cellWidth: 60 }
          },
          margin: { left: 15, right: 15 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 9, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, currentY, 180, 9, 'S');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Nenhum colaborador aniversariante registrado neste mês.', 20, currentY + 6);
        currentY += 15;
      }

      // 3. Gráfico de Absenteísmo
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text('3. EVOLUÇÃO DO ABSENTEÍSMO (%) - ÚLTIMOS 6 MESES', 15, currentY);
      currentY += 4;

      const absenteeismImg = await captureDomElement('hr-report-card-absenteeism');
      if (absenteeismImg) {
        const imgW = 180;
        const imgH = (absenteeismImg.height / absenteeismImg.width) * imgW;
        const finalH = Math.min(imgH, 65);
        doc.addImage(absenteeismImg.dataUrl, 'PNG', 15, currentY, imgW, finalH);
        currentY += finalH + 4;
      }

      const absHeaders = stats.absenteeismData.map(d => d.name);
      const absValues = stats.absenteeismData.map(d => `${formatNumber(d.value, 1)}%`);
      autoTable(doc, {
        startY: currentY,
        head: [['Indicador', ...absHeaders]],
        body: [['Absenteísmo (%)', ...absValues]],
        theme: 'grid',
        headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 7, halign: 'center' },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: 30 }
        },
        margin: { left: 15, right: 15 }
      });

      // ==========================================
      // PAGE 2: TURNOVER E HEADCOUNT
      // ==========================================
      doc.addPage();
      drawPageHeader('Relatório Mensal de Indicadores de RH - Continuação', 'Turnover e Headcount por Setor');
      currentY = 38;

      // 4. Turnover
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text('4. EVOLUÇÃO DO TURNOVER (%) - ÚLTIMOS 6 MESES', 15, currentY);
      currentY += 4;

      const turnoverImg = await captureDomElement('hr-report-card-turnover');
      if (turnoverImg) {
        const imgW = 180;
        const imgH = (turnoverImg.height / turnoverImg.width) * imgW;
        const finalH = Math.min(imgH, 62);
        doc.addImage(turnoverImg.dataUrl, 'PNG', 15, currentY, imgW, finalH);
        currentY += finalH + 4;
      }

      const turnHeaders = stats.turnoverData.map(d => d.name);
      const turnRates = stats.turnoverData.map(d => `${formatNumber(d.value, 1)}%`);
      const turnDismissals = stats.turnoverData.map(d => `${d.dismissals ?? 0}`);
      const turnAvgs = stats.turnoverData.map(d => `${formatNumber(d.avgEmployees ?? 0, 1)}`);
      autoTable(doc, {
        startY: currentY,
        head: [['Métrica', ...turnHeaders]],
        body: [
          ['Turnover (%)', ...turnRates],
          ['Desligamentos (Saídas)', ...turnDismissals],
          ['Média Colaboradores', ...turnAvgs]
        ],
        theme: 'grid',
        headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 7, halign: 'center' },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: 32 }
        },
        margin: { left: 15, right: 15 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      // 5. Headcount
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text('5. HEADCOUNT - VAGAS VS OCUPADAS POR SETOR', 15, currentY);
      currentY += 4;

      const headcountImg = await captureDomElement('hr-report-card-headcount');
      if (headcountImg) {
        const imgW = 180;
        const imgH = (headcountImg.height / headcountImg.width) * imgW;
        const finalH = Math.min(imgH, 55);
        doc.addImage(headcountImg.dataUrl, 'PNG', 15, currentY, imgW, finalH);
        currentY += finalH + 4;
      }

      const totalVagasAll = stats.headcountData.reduce((acc, h) => acc + h.vagas, 0);
      const totalOcupadasAll = stats.headcountData.reduce((acc, h) => acc + h.ocupadas, 0);
      const totalSaldoAll = Math.max(0, totalVagasAll - totalOcupadasAll);
      const totalTaxaAll = totalVagasAll > 0 ? (totalOcupadasAll / totalVagasAll) * 100 : 0;

      const headcountRows = stats.headcountData.map(h => {
        const saldo = Math.max(0, h.vagas - h.ocupadas);
        const taxa = h.vagas > 0 ? (h.ocupadas / h.vagas) * 100 : 0;
        return [
          h.name,
          h.vagas.toString(),
          h.ocupadas.toString(),
          saldo.toString(),
          `${formatNumber(taxa, 1)}%`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Setor / Departamento', 'Vagas Previstas', 'Vagas Ocupadas', 'Vagas Abertas (Saldo)', 'Taxa de Ocupação']],
        body: headcountRows,
        theme: 'striped',
        headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center', fontStyle: 'bold' },
          3: { halign: 'center' },
          4: { halign: 'center', fontStyle: 'bold', textColor: [52, 68, 52] }
        },
        foot: [[
          'TOTAL GERAL',
          totalVagasAll.toString(),
          totalOcupadasAll.toString(),
          totalSaldoAll.toString(),
          `${formatNumber(totalTaxaAll, 1)}%`
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
        margin: { left: 15, right: 15 }
      });

      // ==========================================
      // PAGE 3: OCORRÊNCIAS / LANÇAMENTOS DO MÊS (SE HOUVER)
      // ==========================================
      if (stats.filteredEntries.length > 0) {
        doc.addPage();
        drawPageHeader('Relatório Mensal de Indicadores de RH - Detalhamento', 'Ocorrências e Lançamentos do Mês');
        currentY = 38;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(52, 68, 52);
        doc.text(`6. REGISTRO DE OCORRÊNCIAS DO MÊS (${stats.filteredEntries.length} registro(s))`, 15, currentY);
        currentY += 4;

        const entriesRows = stats.filteredEntries.map(e => {
          const empNames = (e.employeeIds || []).map(id => {
            const emp = employees.find(emp => emp.id === id);
            return emp ? emp.name : 'Colaborador';
          }).join(', ');

          const dateFormatted = e.date ? format(parseISO(e.date), 'dd/MM/yyyy') : '-';
          const endDateFormatted = e.endDate && e.endDate !== e.date ? ` até ${format(parseISO(e.endDate), 'dd/MM/yyyy')}` : '';

          return [
            `${dateFormatted}${endDateFormatted}`,
            empNames || '-',
            e.type || '-',
            e.notes || '-'
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [['Data / Período', 'Colaborador(es)', 'Tipo de Ocorrência', 'Observações / Motivo']],
          body: entriesRows,
          theme: 'striped',
          headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
          columnStyles: {
            0: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 50, fontStyle: 'bold' },
            2: { cellWidth: 35 },
            3: { }
          },
          margin: { top: 35, bottom: 15, left: 15, right: 15 }
        });
      }

      // ==========================================
      // FOOTER AND HEADER FOR OVERFLOW PAGES
      // ==========================================
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (i > 3) {
          drawPageHeader('Relatório Mensal de Indicadores de RH - Ocorrências (Cont.)', 'Detalhamento das Ocorrências');
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(15, 287, 195, 287);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `AquaGestão Piscicultura • Frigorífico - Gestão de Recursos Humanos • Referência: ${monthName}/${filterYear}`,
          15,
          291
        );
        doc.text(
          `Página ${i} de ${totalPages}`,
          195,
          291,
          { align: 'right' }
        );
      }

      const cleanMonth = rawMonthName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      doc.save(`Relatorio_RH_${cleanMonth}_${filterYear}.pdf`);
    } catch (err: any) {
      console.error('Erro ao gerar relatório PDF de RH:', err);
      setPdfError(err?.message || 'Erro ao gerar o relatório PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('employees')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'employees' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Pessoas
        </button>
        <button 
          onClick={() => setActiveSubTab('sectors')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'sectors' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Cadastros
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
      </div>

      {activeSubTab === 'employees' && (
        <div className="space-y-12">
          {/* Employees Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 lg:sticky lg:top-8 h-fit z-10">
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
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.role}
                      onChange={e => setEmployeeForm({...employeeForm, role: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Setor</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.department}
                      onChange={e => setEmployeeForm({...employeeForm, department: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
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
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Nascimento</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={employeeForm.birthDate}
                      onChange={e => setEmployeeForm({...employeeForm, birthDate: e.target.value})}
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
              {/* Filtro de Status e Busca */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador por nome, cargo, setor ou matrícula..."
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none text-xs text-slate-700 shadow-sm focus:border-slate-300 transition-all placeholder:text-slate-400"
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap ml-1">Status:</span>
                  <select
                    className="w-full sm:w-40 px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none text-xs text-slate-700 shadow-sm focus:border-slate-300 transition-all cursor-pointer"
                    value={peopleStatusFilter}
                    onChange={(e) => setPeopleStatusFilter(e.target.value as any)}
                  >
                    <option value="all">Todos</option>
                    <option value="Ativo">Ativos</option>
                    <option value="Inativo">Inativos</option>
                  </select>
                </div>
              </div>

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
                  {filteredEmployees.map(emp => (
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
                              birthDate: emp.birthDate || '',
                              status: emp.status
                            });
                          }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeEmployee(emp.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {employees.length === 0 ? 'Nenhum colaborador cadastrado.' : 'Nenhum colaborador encontrado para os filtros aplicados.'}
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

      {activeSubTab === 'sectors' && (
        <div className="space-y-12">
          {/* 1. Vacancy Board Table (Quadro de cadastro de vagas) */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
                <Layout className="w-6 h-6" />
                Quadro de Vagas
              </h3>
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
                            // Scroll to form
                            const formElement = document.getElementById('vacancy-form');
                            formElement?.scrollIntoView({ behavior: 'smooth' });
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

          {/* 2. Registration Boxes (Setores and Cargos) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Box for Setores */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Layout className="w-6 h-6" />
                Cadastro de Setores
              </h3>
              <div className="space-y-6">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Novo setor..."
                    className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newDeptName.trim();
                        if (trimmed && !departments.includes(trimmed)) {
                          const currentDeletedIds = state.deletedIds || [];
                          const updatedDeletedIds = currentDeletedIds.filter(id => id !== `dept:${trimmed}` && id !== trimmed);
                          onUpdate({
                            ...state,
                            slaughterHRDepartments: [...departments, trimmed],
                            slaughterHRDepartmentsUpdated: Date.now(),
                            deletedIds: updatedDeletedIds
                          });
                          setNewDeptName('');
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const trimmed = newDeptName.trim();
                      if (trimmed && !departments.includes(trimmed)) {
                        const currentDeletedIds = state.deletedIds || [];
                        const updatedDeletedIds = currentDeletedIds.filter(id => id !== `dept:${trimmed}` && id !== trimmed);
                        onUpdate({
                          ...state,
                          slaughterHRDepartments: [...departments, trimmed],
                          slaughterHRDepartmentsUpdated: Date.now(),
                          deletedIds: updatedDeletedIds
                        });
                        setNewDeptName('');
                      }
                    }}
                    className="px-6 py-3.5 bg-[#344434] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-[#2a382a] transition-all shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {departments.map(dept => {
                    const linkedVacCount = vacancies.filter(v => v.department === dept).length;
                    const linkedEmpCount = employees.filter(e => e.department === dept && e.status === 'Ativo').length;
                    return (
                      <div key={dept} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                        {editingDept === dept ? (
                          <div className="flex gap-2 w-full">
                            <input 
                              type="text"
                              className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                              value={newDeptName}
                              onChange={e => setNewDeptName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') updateDepartment(dept, newDeptName);
                                if (e.key === 'Escape') setEditingDept(null);
                              }}
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
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-xs font-bold text-slate-700 truncate">{dept}</span>
                              {(linkedEmpCount > 0 || linkedVacCount > 0) && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                                  {linkedEmpCount > 0 ? `${linkedEmpCount} colab.` : ''}
                                  {linkedEmpCount > 0 && linkedVacCount > 0 ? ' • ' : ''}
                                  {linkedVacCount > 0 ? `${linkedVacCount} vagas` : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                              <button 
                                onClick={() => {
                                  setEditingDept(dept);
                                  setNewDeptName(dept);
                                }}
                                title="Editar setor"
                                className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteDepartment(dept)}
                                title="Excluir setor"
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {departments.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs font-bold">
                      Nenhum setor cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Box for Cargos */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Briefcase className="w-6 h-6" />
                Cadastro de Cargos
              </h3>
              <div className="space-y-6">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Novo cargo..."
                    className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newRoleName.trim();
                        if (trimmed && !roles.includes(trimmed)) {
                          const currentDeletedIds = state.deletedIds || [];
                          const updatedDeletedIds = currentDeletedIds.filter(id => id !== `role:${trimmed}` && id !== trimmed);
                          onUpdate({
                            ...state,
                            slaughterHRRoles: [...roles, trimmed],
                            slaughterHRRolesUpdated: Date.now(),
                            deletedIds: updatedDeletedIds
                          });
                          setNewRoleName('');
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const trimmed = newRoleName.trim();
                      if (trimmed && !roles.includes(trimmed)) {
                        const currentDeletedIds = state.deletedIds || [];
                        const updatedDeletedIds = currentDeletedIds.filter(id => id !== `role:${trimmed}` && id !== trimmed);
                        onUpdate({
                          ...state,
                          slaughterHRRoles: [...roles, trimmed],
                          slaughterHRRolesUpdated: Date.now(),
                          deletedIds: updatedDeletedIds
                        });
                        setNewRoleName('');
                      }
                    }}
                    className="px-6 py-3.5 bg-[#344434] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-[#2a382a] transition-all shrink-0"
                  >
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {roles.map(role => {
                    const linkedVacCount = vacancies.filter(v => v.role === role).length;
                    const linkedEmpCount = employees.filter(e => e.role === role && e.status === 'Ativo').length;
                    return (
                      <div key={role} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                        {editingRole === role ? (
                          <div className="flex gap-2 w-full">
                            <input 
                              type="text"
                              className="flex-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                              value={newRoleName}
                              onChange={e => setNewRoleName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') updateRole(role, newRoleName);
                                if (e.key === 'Escape') setEditingRole(null);
                              }}
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
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-xs font-bold text-slate-700 truncate">{role}</span>
                              {(linkedEmpCount > 0 || linkedVacCount > 0) && (
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                                  {linkedEmpCount > 0 ? `${linkedEmpCount} colab.` : ''}
                                  {linkedEmpCount > 0 && linkedVacCount > 0 ? ' • ' : ''}
                                  {linkedVacCount > 0 ? `${linkedVacCount} vagas` : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                              <button 
                                onClick={() => {
                                  setEditingRole(role);
                                  setNewRoleName(role);
                                }}
                                title="Editar cargo"
                                className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteRole(role)}
                                title="Excluir cargo"
                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {roles.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs font-bold">
                      Nenhum cargo cadastrado.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3. New Vacancy Form (Novo Quadro de Vagas) - LAST */}
          <div id="vacancy-form" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
              <Layout className="w-6 h-6" />
              {editingVacancyId ? 'Editar Quadro de Vagas' : 'Novo Quadro de Vagas'}
            </h3>
            <form onSubmit={handleSaveVacancy} className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <div className="flex gap-4">
                  <input 
                    type="number" required 
                    className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={vacancyForm.totalVacancies}
                    onChange={e => setVacancyForm({...vacancyForm, totalVacancies: e.target.value})}
                  />
                  <button type="submit" className="px-8 py-3.5 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-[#2a382a] transition-all whitespace-nowrap">
                    {editingVacancyId ? 'Salvar Alterações' : 'Cadastrar Vagas'}
                  </button>
                  {editingVacancyId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingVacancyId(null);
                        setVacancyForm({ department: '', role: '', totalVacancies: '' });
                      }}
                      className="px-4 py-3.5 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </form>
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
                        <option key={m} value={m}>{format(new Date(2000, m - 1), 'MMMM', { locale: ptBR })}</option>
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
            <div className="lg:col-span-1 lg:sticky lg:top-8 h-fit z-10">
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
                        .filter(emp => (emp.status === 'Ativo' || entryForm.employeeIds.includes(emp.id)) && (
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

                  <div className="space-y-4">
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
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = newEntryTypeName.trim();
                                if (trimmed && !entryTypes.includes(trimmed)) {
                                  const currentDeletedIds = state.deletedIds || [];
                                  const updatedDeletedIds = currentDeletedIds.filter(id => id !== `entryType:${trimmed}` && id !== trimmed);
                                  onUpdate({
                                    ...state,
                                    slaughterHREntryTypes: [...entryTypes, trimmed],
                                    slaughterHREntryTypesUpdated: Date.now(),
                                    deletedIds: updatedDeletedIds
                                  });
                                  setEntryForm({ ...entryForm, type: trimmed });
                                  setNewEntryTypeName('');
                                  setShowNewEntryTypeInput(false);
                                }
                              }
                            }}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              const trimmed = newEntryTypeName.trim();
                              if (trimmed && !entryTypes.includes(trimmed)) {
                                const currentDeletedIds = state.deletedIds || [];
                                const updatedDeletedIds = currentDeletedIds.filter(id => id !== `entryType:${trimmed}` && id !== trimmed);
                                onUpdate({
                                  ...state,
                                  slaughterHREntryTypes: [...entryTypes, trimmed],
                                  slaughterHREntryTypesUpdated: Date.now(),
                                  deletedIds: updatedDeletedIds
                                });
                                setEntryForm({ ...entryForm, type: trimmed });
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
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {(entryForm.type.toLowerCase().includes('falta') || entryForm.type.toLowerCase().includes('atestado')) 
                          ? 'Data Início' 
                          : isDismissalType(entryForm.type)
                            ? 'Data do Desligamento (Saída)'
                            : 'Data'}
                      </label>
                      <input 
                        type="date" required 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                        value={entryForm.date}
                        onChange={e => setEntryForm({...entryForm, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(entryForm.type.toLowerCase().includes('falta') || entryForm.type.toLowerCase().includes('atestado')) && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Fim</label>
                        <input 
                          type="date" required 
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                          value={entryForm.endDate}
                          onChange={e => setEntryForm({...entryForm, endDate: e.target.value})}
                        />
                      </div>
                    )}

                    {(entryForm.type.toLowerCase().includes('falta') || entryForm.type.toLowerCase().includes('atestado')) && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dias Totais</label>
                        <input 
                          type="number"
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                          value={entryForm.days}
                          onChange={e => {
                            const val = e.target.value;
                            const days = parseInt(val);
                            if (!isNaN(days) && days > 0) {
                              const start = parseISO(entryForm.date);
                              if (!isNaN(start.getTime())) {
                                const newEnd = addDays(start, days - 1);
                                setEntryForm(prev => ({ 
                                  ...prev, 
                                  days: val, 
                                  endDate: format(newEnd, 'yyyy-MM-dd') 
                                }));
                              }
                            } else {
                              setEntryForm(prev => ({ ...prev, days: val }));
                            }
                          }}
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

                    {isDismissalType(entryForm.type) && (
                      <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                        <div className="font-black flex items-center gap-1.5 mb-1 text-amber-800 uppercase tracking-wider text-[10px]">
                          <UserMinus className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Registro de Saída (Cálculo do Turnover)</span>
                        </div>
                        Este lançamento de <strong>Desligamento</strong> registra a saída do colaborador, define seu status como <strong>Inativo</strong> e computa a saída na apuração da taxa de <strong>Turnover</strong> do período.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-end pb-1">
                    <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                      {editingEntryId ? 'Salvar Alterações' : 'Lançar Evento'}
                    </button>
                  </div>
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
                        <td className="px-8 py-6 text-xs font-bold text-slate-500">
                          {format(parseISO(ent.date), 'dd/MM/yyyy')}
                          {ent.endDate && ent.endDate !== ent.date && (
                            <span className="text-slate-400 font-normal ml-1">
                              - {format(parseISO(ent.endDate), 'dd/MM/yyyy')}
                            </span>
                          )}
                        </td>
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
                            (ent.type === 'Atestado' || ent.type === 'Atestado Médico') ? 'bg-amber-50 text-amber-600' :
                            isDismissalType(ent.type) ? 'bg-rose-50 text-rose-700 border border-rose-200/60' :
                            'bg-blue-50 text-blue-600'
                          }`}>
                            {ent.type === 'Turnover' ? 'Desligamento' : ent.type} {ent.days ? `(${formatNumber(ent.days)}d)` : ''}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => {
                              setEditingEntryId(ent.id);
                              setEntryForm({
                                employeeIds: ent.employeeIds,
                                type: ent.type === 'Turnover' ? 'Desligamento' : ent.type,
                                date: ent.date,
                                endDate: ent.endDate || ent.date,
                                days: ent.days?.toString() || '1',
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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[#344434]" />
              Indicadores de RH
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                <select 
                  value={filterMonth} 
                  onChange={e => setFilterMonth(Number(e.target.value))}
                  className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                    </option>
                  ))}
                </select>
                <div className="w-[1px] h-4 bg-slate-200"></div>
                <select 
                  value={filterYear} 
                  onChange={e => setFilterYear(Number(e.target.value))}
                  className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600 px-3"
                >
                  {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={generatePDF}
                disabled={isGeneratingPdf}
                title="Exportar indicadores e gráficos do mês selecionado em formato PDF"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#344434] hover:bg-[#283528] active:scale-95 disabled:opacity-50 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer shrink-0"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#e4e4d4]" />
                    <span>Gerando PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-[#e4e4d4]" />
                    <span>Gerar PDF do Mês</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pdfError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{pdfError}</span>
              </div>
              <button onClick={() => setPdfError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 1. Resumo de Indicadores (Calculado dos Lançamentos) - Agora em segundo */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
              <BarChartIcon className="w-6 h-6 text-[#344434]" />
              Resumo de Indicadores (Calculado dos Lançamentos)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#e4e4d4]/20 p-6 rounded-3xl border border-[#344434]/5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Absenteísmo</div>
                <div className="text-2xl font-black text-[#344434]">{formatNumber(stats.filteredIndicator.absenteeism, 1)}%</div>
                <div className="text-[10px] text-slate-400 mt-1">Baseado em faltas e atestados do mês</div>
              </div>
              <div className="bg-[#e4e4d4]/20 p-6 rounded-3xl border border-[#344434]/5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Turnover</div>
                <div className="text-2xl font-black text-[#344434]">{formatNumber(stats.filteredIndicator.turnover, 1)}%</div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {stats.filteredIndicator.turnoverDetails.dismissalsCount} {stats.filteredIndicator.turnoverDetails.dismissalsCount === 1 ? 'saída' : 'saídas'} (méd. {formatNumber(stats.filteredIndicator.turnoverDetails.avgEmployees, 1)} colab.)
                </div>
              </div>
              <div className="bg-[#e4e4d4]/20 p-6 rounded-3xl border border-[#344434]/5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Acidentes</div>
                <div className="text-2xl font-black text-[#344434]">{formatNumber(stats.filteredIndicator.accidents)}</div>
                <div className="text-[10px] text-slate-400 mt-1">Total de acidentes no mês</div>
              </div>
              <div className="bg-[#e4e4d4]/20 p-6 rounded-3xl border border-[#344434]/5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quadro de Vagas</div>
                <div className="text-2xl font-black text-[#344434]">{formatNumber(stats.active)} / {formatNumber(stats.totalVacanciesCount)}</div>
                <div className="text-[10px] text-slate-400 mt-1">{formatNumber(stats.occupancyRate, 1)}% de ocupação</div>
              </div>
            </div>
          </div>

          {/* Aniversariantes do Mês */}
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
              <Heart className="w-6 h-6 text-red-500" />
              Aniversariantes do Mês
            </h3>
            {stats.birthdays.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.birthdays.map((b, i) => (
                  <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex flex-col items-center justify-center border border-slate-100">
                      <span className="text-[10px] font-black text-red-500 leading-none">{b.day}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{format(new Date(2000, filterMonth - 1), 'MMM', { locale: ptBR })}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-800 truncate">{b.name}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{b.department}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum aniversariante neste mês.</p>
              </div>
            )}
          </div>

          {/* 3. Gráficos Empilhados Verticalmente */}
          <div className="grid grid-cols-1 gap-8">
            <div id="hr-report-card-absenteeism" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-[#e4e4d4] text-[#344434] rounded-2xl shadow-sm">
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
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} />
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

            <div id="hr-report-card-turnover" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-[#e4e4d4] text-[#344434] rounded-2xl shadow-sm">
                  <UserMinus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">Turnover (%)</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Histórico dos últimos 6 meses • Saídas vs. Efetivo Médio</p>
                </div>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.turnoverData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}} 
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                      formatter={(value: number, _name: any, item: any) => [
                        `${formatNumber(value, 1)}% (${item?.payload?.dismissals ?? 0} ${item?.payload?.dismissals === 1 ? 'saída' : 'saídas'} / méd. ${formatNumber(item?.payload?.avgEmployees ?? 0, 1)} colab.)`,
                        "Turnover"
                      ]}
                    />
                    <Bar dataKey="value" name="Turnover" fill="#344434" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div id="hr-report-card-headcount" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-[#e4e4d4] text-[#344434] rounded-2xl shadow-sm">
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
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} width={100} />
                    <Tooltip content={<HeadcountTooltip />} />
                    <Bar dataKey="vagas" name="Vagas Totais" fill="#e4e4d4" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="ocupadas" name="Vagas Ocupadas" fill="#344434" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDelete && confirmDelete.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 transform transition-all space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">{confirmDelete.title}</h3>
            </div>
            
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              {confirmDelete.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
              >
                {confirmDelete.actionText || 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlaughterHR;
