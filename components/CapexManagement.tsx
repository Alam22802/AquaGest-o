
import React, { useState, useMemo } from 'react';
import { AppState, User, InvestmentPortfolio, CapexProject, CapexInvoice, CapexStage } from '../types';
import { 
  Wallet, Briefcase, FileText, Plus, Edit, Trash2, X, 
  Calendar, User as UserIcon, DollarSign, Layers, 
  ArrowRight, TrendingDown, CheckCircle2, AlertCircle,
  Search, Filter, ChevronRight, Truck, ClipboardList, Building2, TrendingUp,
  ChevronUp, ChevronDown, CheckSquare, Square, Save
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatNumber } from '../utils/formatters';

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

const CapexManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'planning' | 'execution'>('overview');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const calculateDateProgress = (startDate: string, endDate: string) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  };

  // Form States
  const [portfolioForm, setPortfolioForm] = useState({
    name: '',
    totalValue: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    manager: ''
  });

  const [projectForm, setProjectForm] = useState({
    portfolioId: '',
    name: '',
    costCenter: '',
    plannedValue: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    responsible: '',
    investmentArea: '',
    stages: [] as CapexStage[]
  });

  const [newStage, setNewStage] = useState<Partial<CapexStage>>({
    name: '',
    startDate: '',
    endDate: '',
    responsible: '',
    plannedValue: 0,
    progress: 0
  });
  const [selectedStages, setSelectedStages] = useState<string[]>([]);

  const [invoiceForm, setInvoiceForm] = useState({
    portfolioId: '',
    projectId: '',
    invoiceNumber: '',
    supplier: '',
    cnpj: '',
    items: '',
    type: 'Aquisição' as 'Prestação de Serviço' | 'Aquisição',
    value: '',
    date: new Date().toISOString().split('T')[0],
    deliveryDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  // Calculations
  const portfolioStats = useMemo(() => {
    const portfolios = state.portfolios || [];
    const projects = state.capexProjects || [];
    const invoices = state.capexInvoices || [];

    return portfolios.map(p => {
      const portfolioProjects = projects.filter(proj => proj.portfolioId === p.id);
      const portfolioInvoices = invoices.filter(inv => inv.portfolioId === p.id);
      
      const allocatedValue = portfolioProjects.reduce((acc, curr) => acc + curr.plannedValue, 0);
      const executedValue = portfolioInvoices.reduce((acc, curr) => acc + curr.value, 0);
      const balance = p.totalValue - allocatedValue;
      const executionPercentage = p.totalValue > 0 ? (executedValue / p.totalValue) * 100 : 0;

      return {
        ...p,
        allocatedValue,
        executedValue,
        balance,
        executionPercentage,
        projectsCount: portfolioProjects.length
      };
    });
  }, [state.portfolios, state.capexProjects, state.capexInvoices]);

  const projectStats = useMemo(() => {
    const projects = state.capexProjects || [];
    const invoices = state.capexInvoices || [];

    return projects.map(p => {
      const projectInvoices = invoices.filter(inv => inv.projectId === p.id);
      const executedValue = projectInvoices.reduce((acc, curr) => acc + curr.value, 0);
      const balance = p.plannedValue - executedValue;
      const executionPercentage = p.plannedValue > 0 ? (executedValue / p.plannedValue) * 100 : 0;

      return {
        ...p,
        executedValue,
        balance,
        executionPercentage
      };
    });
  }, [state.capexProjects, state.capexInvoices]);

  // Handlers
  const handleSavePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    const newPortfolio: InvestmentPortfolio = {
      id: editingPortfolioId || generateId(),
      name: portfolioForm.name,
      totalValue: Number(portfolioForm.totalValue),
      startDate: portfolioForm.startDate,
      endDate: portfolioForm.endDate,
      manager: portfolioForm.manager,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedPortfolios = editingPortfolioId 
      ? (state.portfolios || []).map(p => p.id === editingPortfolioId ? newPortfolio : p)
      : [...(state.portfolios || []), newPortfolio];

    onUpdate({ ...state, portfolios: updatedPortfolios });
    setEditingPortfolioId(null);
    setPortfolioForm({ name: '', totalValue: '', startDate: new Date().toISOString().split('T')[0], endDate: '', manager: '' });
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    const portfolio = (state.portfolios || []).find(p => p.id === projectForm.portfolioId);
    if (!portfolio) return;

    // Calcular o saldo atual da carteira (Orçamento Inicial - Soma dos outros projetos)
    const otherProjects = (state.capexProjects || []).filter(p => p.portfolioId === projectForm.portfolioId && p.id !== editingProjectId);
    const allocatedValue = otherProjects.reduce((acc, curr) => acc + curr.plannedValue, 0);
    const availableBalance = portfolio.totalValue - allocatedValue;

    const newValue = Number(projectForm.plannedValue);

    // Validar soma das etapas
    const stagesTotal = projectForm.stages.reduce((acc, curr) => acc + curr.plannedValue, 0);
    if (stagesTotal > newValue) {
      alert(`A soma dos valores das etapas (R$ ${formatNumber(stagesTotal)}) não pode ultrapassar o valor total do projeto (R$ ${formatNumber(newValue)})!`);
      return;
    }

    const newProject: CapexProject = {
      id: editingProjectId || generateId(),
      portfolioId: projectForm.portfolioId,
      name: projectForm.name,
      costCenter: projectForm.costCenter,
      plannedValue: newValue,
      startDate: projectForm.startDate,
      endDate: projectForm.endDate,
      responsible: projectForm.responsible,
      investmentArea: projectForm.investmentArea,
      stages: projectForm.stages,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedProjects = editingProjectId 
      ? (state.capexProjects || []).map(p => p.id === editingProjectId ? newProject : p)
      : [...(state.capexProjects || []), newProject];

    onUpdate({ ...state, capexProjects: updatedProjects });
    setEditingProjectId(null);
    setProjectForm({ 
      portfolioId: '', 
      name: '', 
      costCenter: '', 
      plannedValue: '', 
      startDate: new Date().toISOString().split('T')[0], 
      endDate: '', 
      responsible: '', 
      investmentArea: '',
      stages: []
    });
    setNewStage({
      name: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      responsible: '',
      plannedValue: 0,
      progress: 0
    });
    setSelectedStages([]);
  };

  const handleAddStage = () => {
    if (!newStage.name) return;
    
    const stage: CapexStage = {
      id: generateId(),
      name: newStage.name || '',
      startDate: newStage.startDate || projectForm.startDate,
      endDate: newStage.endDate || projectForm.endDate,
      responsible: newStage.responsible || projectForm.responsible,
      plannedValue: Number(newStage.plannedValue) || 0,
      progress: Number(newStage.progress) || 0
    };
    
    setProjectForm({
      ...projectForm,
      stages: [...projectForm.stages, stage]
    });
    
    setNewStage({
      name: '',
      startDate: projectForm.startDate,
      endDate: projectForm.endDate,
      responsible: projectForm.responsible,
      plannedValue: 0,
      progress: 0
    });
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const newStages = [...projectForm.stages];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newStages.length) return;
    
    const temp = newStages[index];
    newStages[index] = newStages[newIndex];
    newStages[newIndex] = temp;
    
    setProjectForm({ ...projectForm, stages: newStages });
  };

  const toggleStageSelection = (id: string) => {
    setSelectedStages(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const removeSelectedStages = () => {
    if (selectedStages.length === 0) return;
    if (!confirm(`Excluir ${selectedStages.length} etapa(s) selecionada(s)?`)) return;
    
    const newStages = projectForm.stages.filter(s => !selectedStages.includes(s.id));
    setProjectForm({ ...projectForm, stages: newStages });
    setSelectedStages([]);
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    const project = (state.capexProjects || []).find(p => p.id === invoiceForm.projectId);
    if (!project) return;

    // Calcular o saldo atual do CAPEX (Valor Inicial - Soma das outras notas)
    const otherInvoices = (state.capexInvoices || []).filter(i => i.projectId === invoiceForm.projectId && i.id !== editingInvoiceId);
    const executedValue = otherInvoices.reduce((acc, curr) => acc + curr.value, 0);
    const availableBalance = project.plannedValue - executedValue;

    const newValue = Number(invoiceForm.value);

    // Verificar se há saldo no CAPEX
    if (newValue > availableBalance) {
      alert(`Saldo insuficiente no CAPEX! Saldo disponível: R$ ${formatNumber(availableBalance)}`);
      return;
    }

    const newInvoice: CapexInvoice = {
      id: editingInvoiceId || generateId(),
      portfolioId: invoiceForm.portfolioId,
      projectId: invoiceForm.projectId,
      invoiceNumber: invoiceForm.invoiceNumber,
      supplier: invoiceForm.supplier,
      cnpj: invoiceForm.cnpj,
      items: invoiceForm.items,
      type: invoiceForm.type,
      value: newValue,
      date: invoiceForm.date,
      deliveryDate: invoiceForm.deliveryDate,
      description: invoiceForm.description,
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      updatedAt: Date.now()
    };

    const updatedInvoices = editingInvoiceId 
      ? (state.capexInvoices || []).map(i => i.id === editingInvoiceId ? newInvoice : i)
      : [...(state.capexInvoices || []), newInvoice];

    onUpdate({ ...state, capexInvoices: updatedInvoices });
    setEditingInvoiceId(null);
    setInvoiceForm({ 
      portfolioId: '', 
      projectId: '', 
      invoiceNumber: '', 
      supplier: '', 
      cnpj: '', 
      items: '', 
      type: 'Aquisição', 
      value: '', 
      date: new Date().toISOString().split('T')[0], 
      deliveryDate: new Date().toISOString().split('T')[0], 
      description: '' 
    });
  };

  const handleUpdateStageDates = (projectId: string, stageId: string, actualStartDate?: string, actualEndDate?: string) => {
    const updatedProjects = (state.capexProjects || []).map(p => {
      if (p.id === projectId) {
        const updatedStages = (p.stages || []).map(s => {
          if (s.id === stageId) {
            return { ...s, actualStartDate, actualEndDate };
          }
          return s;
        });
        return { ...p, stages: updatedStages, updatedAt: Date.now() };
      }
      return p;
    });
    onUpdate({ ...state, capexProjects: updatedProjects });
  };

  const removePortfolio = (id: string) => {
    if (!hasPermission || !confirm('Excluir esta carteira? Todos os projetos vinculados perderão a referência.')) return;
    onUpdate({ 
      ...state, 
      portfolios: (state.portfolios || []).filter(p => p.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const removeProject = (id: string) => {
    if (!hasPermission || !confirm('Excluir este projeto?')) return;
    onUpdate({ 
      ...state, 
      capexProjects: (state.capexProjects || []).filter(p => p.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const removeInvoice = (id: string) => {
    if (!hasPermission || !confirm('Excluir este lançamento de nota?')) return;
    onUpdate({ 
      ...state, 
      capexInvoices: (state.capexInvoices || []).filter(i => i.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sub-Tabs */}
      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit mx-auto mb-8">
        <button 
          onClick={() => setActiveSubTab('overview')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'overview' ? 'bg-[#344434] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          <TrendingDown className="w-4 h-4" /> Visão Geral
        </button>
        {currentUser.isMaster && (
          <button 
            onClick={() => setActiveSubTab('planning')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'planning' ? 'bg-[#344434] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
          >
            <Layers className="w-4 h-4" /> Planejamento
          </button>
        )}
        <button 
          onClick={() => setActiveSubTab('execution')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'execution' ? 'bg-[#344434] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          <FileText className="w-4 h-4" /> Execução (Notas)
        </button>
      </div>

      {activeSubTab === 'overview' ? (
        <div className="space-y-8">
          {/* Seleção de Filtros */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Filtrar por Carteira</label>
              <select 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-[#344434] transition-all"
                value={selectedPortfolioId}
                onChange={(e) => {
                  setSelectedPortfolioId(e.target.value);
                  setSelectedProjectId('');
                }}
              >
                <option value="">Todas as Carteiras</option>
                {state.portfolios?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Filtrar por Projeto</label>
              <select 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-[#344434] transition-all disabled:opacity-50"
                value={selectedProjectId}
                disabled={!selectedPortfolioId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">Todos os Projetos</option>
                {state.capexProjects?.filter(p => p.portfolioId === selectedPortfolioId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {selectedProjectId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Card de Resumo do Projeto */}
              {(() => {
                const project = projectStats.find(p => p.id === selectedProjectId);
                const invoices = (state.capexInvoices || []).filter(i => i.projectId === selectedProjectId);
                if (!project) return null;

                const now = new Date();
                const start = new Date(project.startDate);
                const end = project.endDate ? new Date(project.endDate) : new Date();
                const totalTime = end.getTime() - start.getTime();
                const elapsedTime = now.getTime() - start.getTime();
                const timeProgress = totalTime > 0 ? Math.max(0, Math.min(100, (elapsedTime / totalTime) * 100)) : 0;
                
                const isLate = now > end && project.executionPercentage < 100;

                return (
                  <>
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-8">
                            <div>
                              <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">
                                {project.investmentArea}
                              </span>
                              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">{project.name}</h2>
                              <p className="text-xs font-bold text-slate-400 uppercase mt-2">Centro de Custo: {project.costCenter} • Responsável: {project.responsible}</p>
                              
                              <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Início Realizado</div>
                                    <div className="text-[10px] font-black text-slate-700">{format(parseISO(project.startDate), 'dd/MM/yyyy')}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                                    <Truck className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Previsão Conclusão</div>
                                    <div className="text-[10px] font-black text-slate-700">{project.endDate ? format(parseISO(project.endDate), 'dd/MM/yyyy') : 'Não Definida'}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status do Projeto</p>
                              <div className={`text-sm font-black uppercase italic ${project.executionPercentage > 100 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {project.executionPercentage > 100 ? 'Orçamento Estourado' : (project.executionPercentage === 100 ? 'Concluído' : 'Em Execução')}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamento Previsto</span>
                              </div>
                              <div className="text-2xl font-black text-slate-800">R$ {formatNumber(project.plannedValue)}</div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <div className="flex items-center gap-2 mb-2">
                                <ArrowRight className="w-4 h-4 text-blue-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Executado</span>
                              </div>
                              <div className="text-2xl font-black text-blue-600">R$ {formatNumber(project.executedValue)}</div>
                            </div>
                            <div className={`p-6 rounded-3xl border ${project.balance < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Wallet className={`w-4 h-4 ${project.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${project.balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>Saldo Disponível</span>
                              </div>
                              <div className={`text-2xl font-black ${project.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>R$ {formatNumber(project.balance)}</div>
                            </div>
                          </div>

                          <div className="mt-8 space-y-6">
                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <TrendingDown className="w-4 h-4" /> Aderência Orçamentária
                                </span>
                                <span className={`text-xs font-black ${project.executionPercentage > 100 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {formatNumber(project.executionPercentage, 1)}% Utilizado
                                </span>
                              </div>
                              <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${project.executionPercentage > 100 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                                  style={{ width: `${Math.min(100, project.executionPercentage)}%` }} 
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Calendar className="w-4 h-4" /> Aderência Cronograma
                                </span>
                                <span className={`text-xs font-black ${isLate ? 'text-red-500' : 'text-blue-500'}`}>
                                  {formatNumber(timeProgress, 1)}% do Tempo Decorrido
                                </span>
                              </div>
                              <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 ${isLate ? 'bg-red-500' : 'bg-blue-500'}`} 
                                  style={{ width: `${timeProgress}%` }} 
                                />
                              </div>
                              <div className="flex justify-between mt-2 text-[9px] font-black text-slate-400 uppercase">
                                <span>Início: {format(parseISO(project.startDate), 'dd/MM/yyyy')}</span>
                                <span>Fim: {project.endDate ? format(parseISO(project.endDate), 'dd/MM/yyyy') : 'Indeterminado'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Layers className="absolute -right-10 -bottom-10 w-64 h-64 text-slate-50 opacity-[0.03] pointer-events-none" />
                      </div>

                      {/* Etapas do Projeto */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                           <Layers className="w-5 h-5 text-emerald-500" /> Cronograma de Etapas
                        </h3>
                        <div className="space-y-4">
                          {(project.stages || []).map(stage => {
                            const isLateStage = stage.actualEndDate && stage.endDate && new Date(stage.actualEndDate) > new Date(stage.endDate);
                            const isStarted = !!stage.actualStartDate;
                            const isFinished = !!stage.actualEndDate;

                            return (
                              <div key={stage.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 hover:border-emerald-200 transition-all group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-black text-slate-800 uppercase tracking-tight">{stage.name}</h4>
                                      {isFinished ? (
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isLateStage ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                          {isLateStage ? 'Concluído com Atraso' : 'Concluído no Prazo'}
                                        </span>
                                      ) : isStarted ? (
                                        <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                          Em Andamento
                                        </span>
                                      ) : (
                                        <span className="text-[8px] font-black bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                          Aguardando
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Previsto</span>
                                        <div className="text-[10px] font-bold text-slate-600">
                                          {format(parseISO(stage.startDate), 'dd/MM/yy')} - {format(parseISO(stage.endDate), 'dd/MM/yy')}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Responsável</span>
                                        <div className="text-[10px] font-bold text-slate-600 uppercase">{stage.responsible}</div>
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Valor Previsto</span>
                                        <div className="text-[10px] font-bold text-emerald-600">R$ {formatNumber(stage.plannedValue)}</div>
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">
                                          {currentUser.isMaster ? 'Progresso' : 'Andamento (Data)'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-500 ${currentUser.isMaster ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                              style={{ width: `${currentUser.isMaster ? stage.progress : calculateDateProgress(stage.startDate, stage.endDate)}%` }} 
                                            />
                                          </div>
                                          <span className={`text-[10px] font-black ${currentUser.isMaster ? 'text-emerald-600' : 'text-blue-600'}`}>
                                            {currentUser.isMaster ? stage.progress : calculateDateProgress(stage.startDate, stage.endDate)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {currentUser.isMaster ? (
                                    <div className="flex flex-col gap-2 min-w-[200px]">
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Início Real</label>
                                          <input 
                                            type="date" 
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                            value={stage.actualStartDate || ''}
                                            onChange={e => handleUpdateStageDates(project.id, stage.id, e.target.value, stage.actualEndDate)}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Fim Real</label>
                                          <input 
                                            type="date" 
                                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                            value={stage.actualEndDate || ''}
                                            onChange={e => handleUpdateStageDates(project.id, stage.id, stage.actualStartDate, e.target.value)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1 min-w-[200px] bg-white p-3 rounded-2xl border border-slate-100">
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Início Real</span>
                                        <span className="text-[10px] font-bold text-slate-600">{stage.actualStartDate ? format(parseISO(stage.actualStartDate), 'dd/MM/yyyy') : 'Não iniciado'}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Fim Real</span>
                                        <span className="text-[10px] font-bold text-slate-600">{stage.actualEndDate ? format(parseISO(stage.actualEndDate), 'dd/MM/yyyy') : 'Não concluído'}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {(project.stages || []).length === 0 && (
                            <div className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest italic border border-dashed border-slate-200 rounded-3xl">
                              Nenhuma etapa cadastrada para este projeto.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Tabela de Notas Recentes do Projeto (Moved to sidebar) */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                           <ClipboardList className="w-4 h-4 text-amber-500" /> Últimos Lançamentos
                        </h3>
                        <div className="space-y-3">
                          {invoices.slice(0, 8).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
                                  <FileText className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                  <div className="text-[10px] font-black text-slate-800 uppercase tracking-tight">NF {inv.invoiceNumber}</div>
                                  <div className="text-[8px] font-bold text-slate-400 uppercase">{format(parseISO(inv.date), 'dd/MM/yy')}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-black text-slate-800">R$ {formatNumber(inv.value)}</div>
                                <div className="text-[7px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded-full">{inv.type}</div>
                              </div>
                            </div>
                          ))}
                          {invoices.length === 0 && (
                            <div className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum lançamento.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : selectedPortfolioId ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Card de Resumo da Carteira */}
              {(() => {
                const portfolio = portfolioStats.find(p => p.id === selectedPortfolioId);
                const projects = (state.capexProjects || []).filter(p => p.portfolioId === selectedPortfolioId);
                const invoices = (state.capexInvoices || []).filter(i => i.portfolioId === selectedPortfolioId);
                if (!portfolio) return null;

                return (
                  <>
                    <div className="lg:col-span-2 space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                          <div className="flex justify-between items-start mb-8">
                            <div>
                              <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">
                                Carteira de Investimento
                              </span>
                              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">{portfolio.name}</h2>
                              <p className="text-xs font-bold text-slate-400 uppercase mt-2">Gestor: {portfolio.manager} • {portfolio.projectsCount} Projetos Ativos</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execução Global</p>
                              <div className="text-sm font-black text-blue-600 uppercase italic">
                                {formatNumber(portfolio.executionPercentage, 1)}% Realizado
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <div className="flex items-center gap-2 mb-2">
                                <Wallet className="w-4 h-4 text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamento Inicial</span>
                              </div>
                              <div className="text-2xl font-black text-slate-800">R$ {formatNumber(portfolio.totalValue)}</div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                              <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Alocado</span>
                              </div>
                              <div className="text-2xl font-black text-emerald-600">R$ {formatNumber(portfolio.allocatedValue)}</div>
                            </div>
                            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                              <div className="flex items-center gap-2 mb-2">
                                <DollarSign className="w-4 h-4 text-blue-400" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Saldo Livre</span>
                              </div>
                              <div className="text-2xl font-black text-blue-600">R$ {formatNumber(portfolio.balance)}</div>
                            </div>
                          </div>

                          <div className="mt-8">
                            <div className="flex justify-between items-end mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Progresso Financeiro da Carteira
                              </span>
                              <span className="text-xs font-black text-blue-600">
                                R$ {formatNumber(portfolio.executedValue)} Executados
                              </span>
                            </div>
                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                                style={{ width: `${Math.min(100, portfolio.executionPercentage)}%` }} 
                              />
                            </div>
                            <div className="flex justify-between mt-2 text-[9px] font-black text-slate-400 uppercase">
                              <span>Início: {format(parseISO(portfolio.startDate), 'dd/MM/yyyy')}</span>
                              <span>Fim: {portfolio.endDate ? format(parseISO(portfolio.endDate), 'dd/MM/yyyy') : 'Indeterminado'}</span>
                            </div>
                          </div>
                        </div>
                        <Building2 className="absolute -right-10 -bottom-10 w-64 h-64 text-slate-50 opacity-[0.03] pointer-events-none" />
                      </div>

                      {/* Lista de Projetos da Carteira */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                          <Layers className="w-5 h-5 text-emerald-500" /> Projetos Vinculados
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {projects.map(proj => {
                            const stats = projectStats.find(s => s.id === proj.id);
                            return (
                              <div key={proj.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer" onClick={() => setSelectedProjectId(proj.id)}>
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="text-xs font-black text-slate-800 uppercase truncate pr-2">{proj.name}</h4>
                                  <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Alocado</div>
                                    <div className="text-xs font-black text-slate-700">R$ {formatNumber(proj.plannedValue)}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Execução</div>
                                    <div className="text-xs font-black text-emerald-600">{formatNumber(stats?.executionPercentage, 1)}%</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {projects.length === 0 && (
                            <div className="col-span-2 text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum projeto cadastrado nesta carteira.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Resumo Financeiro */}
                      <div className="bg-blue-600 p-8 rounded-[2.5rem] shadow-xl text-white">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 opacity-60">Resumo Financeiro</h3>
                        <div className="space-y-8">
                          <div>
                            <div className="text-3xl font-black italic tracking-tighter mb-1">
                              R$ {formatNumber(portfolio.totalValue)}
                            </div>
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-50">Orçamento Total</div>
                          </div>
                          <div className="h-px bg-white/10" />
                          <div>
                            <div className="text-3xl font-black italic tracking-tighter mb-1">
                              R$ {formatNumber(portfolio.allocatedValue)}
                            </div>
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-50">Total Comprometido</div>
                          </div>
                          <div className="h-px bg-white/10" />
                          <div>
                            <div className="text-3xl font-black italic tracking-tighter mb-1">
                              R$ {formatNumber(portfolio.executedValue)}
                            </div>
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-50">Total Liquidado (Notas)</div>
                          </div>
                        </div>
                      </div>

                      {/* Notas Recentes da Carteira */}
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Últimas Notas (Carteira)</h3>
                        <div className="space-y-3">
                              {invoices.slice(0, 3).map(inv => (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[100px]">{inv.supplier}</div>
                                  <div className="text-[10px] font-black text-blue-600">R$ {formatNumber(inv.value)}</div>
                                </div>
                              ))}
                          {invoices.length === 0 && (
                            <div className="text-center py-4 text-slate-400 font-bold uppercase text-[8px] tracking-widest italic">Sem lançamentos.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white rounded-[3rem] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                <Search className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Aguardando Seleção</h3>
              <p className="text-slate-400 font-bold uppercase text-[10px] max-w-xs">Selecione uma carteira e um projeto acima para visualizar o compilado de informações e aderência.</p>
            </div>
          )}
        </div>
      ) : (activeSubTab === 'planning' && currentUser.isMaster) ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Carteiras de Investimento */}
          <div className="space-y-6">
            {currentUser.isMaster && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
                  <Wallet className="w-5 h-5 text-blue-500" />
                  {editingPortfolioId ? 'Editar Carteira' : 'Nova Carteira de Investimento'}
                </h3>
                <form onSubmit={handleSavePortfolio} className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Pacote</label>
                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={portfolioForm.name} onChange={e => setPortfolioForm({...portfolioForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Orçamento Inicial (R$)</label>
                    <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={portfolioForm.totalValue} onChange={e => setPortfolioForm({...portfolioForm, totalValue: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Gestor Responsável</label>
                    <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={portfolioForm.manager} onChange={e => setPortfolioForm({...portfolioForm, manager: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Início</label>
                    <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={portfolioForm.startDate} onChange={e => setPortfolioForm({...portfolioForm, startDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Fim</label>
                    <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500" value={portfolioForm.endDate} onChange={e => setPortfolioForm({...portfolioForm, endDate: e.target.value})} />
                  </div>
                  <button type="submit" className="col-span-2 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                    {editingPortfolioId ? 'Salvar Alterações' : 'Cadastrar Carteira'}
                  </button>
                </form>
              </div>
            )}

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Carteiras Ativas</h4>
              {portfolioStats.map(p => (
                <div key={p.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="font-black text-slate-800 uppercase tracking-tight">{p.name}</h5>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestor: {p.manager}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingPortfolioId(p.id); setPortfolioForm({name: p.name, totalValue: p.totalValue.toString(), startDate: p.startDate, endDate: p.endDate || '', manager: p.manager}); }} className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => removePortfolio(p.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Orçamento Inicial</span>
                        <span className="text-sm font-black text-slate-700">R$ {formatNumber(p.totalValue)}</span>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                        <span className="text-[9px] font-black text-blue-400 uppercase block mb-1">Saldo Disponível</span>
                        <span className="text-sm font-black text-blue-700">R$ {formatNumber(p.balance)}</span>
                      </div>
                    </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, p.executionPercentage)}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">{p.projectsCount} Projetos Vinculados</span>
                    <span className="text-[9px] font-black text-blue-600 uppercase">{formatNumber(p.executionPercentage, 1)}% Executado</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cadastro de Projetos */}
          <div className="space-y-6">
            {currentUser.isMaster && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
                <Briefcase className="w-5 h-5 text-emerald-500" />
                {editingProjectId ? 'Editar Projeto' : 'Novo Projeto CAPEX'}
              </h3>
              <form onSubmit={handleSaveProject} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Carteira de Investimento</label>
                  <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.portfolioId} onChange={e => setProjectForm({...projectForm, portfolioId: e.target.value})}>
                    <option value="">Selecionar Carteira...</option>
                    {state.portfolios?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Projeto</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.name} onChange={e => setProjectForm({...projectForm, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Centro de Custo</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.costCenter} onChange={e => setProjectForm({...projectForm, costCenter: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor do CAPEX (R$)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.plannedValue} onChange={e => setProjectForm({...projectForm, plannedValue: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Área de Investimento</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.investmentArea} onChange={e => setProjectForm({...projectForm, investmentArea: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Responsável</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.responsible} onChange={e => setProjectForm({...projectForm, responsible: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Início</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.startDate} onChange={e => setProjectForm({...projectForm, startDate: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Fim</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={projectForm.endDate} onChange={e => setProjectForm({...projectForm, endDate: e.target.value})} />
                </div>

                {/* Gestão de Etapas (Admin Only) */}
                <div className="col-span-2 space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-500" /> Gestão de Etapas
                      </h4>
                      {projectForm.stages.length > 0 && (
                        <button 
                          type="button"
                          onClick={() => {
                            if (selectedStages.length === projectForm.stages.length) {
                              setSelectedStages([]);
                            } else {
                              setSelectedStages(projectForm.stages.map(s => s.id));
                            }
                          }}
                          className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 hover:text-emerald-600 transition-colors"
                        >
                          {selectedStages.length === projectForm.stages.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          {selectedStages.length === projectForm.stages.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                      )}
                    </div>
                    {selectedStages.length > 0 && (
                      <button 
                        type="button"
                        onClick={removeSelectedStages}
                        className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-lg transition-all hover:bg-red-100"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir Selecionados ({selectedStages.length})
                      </button>
                    )}
                  </div>

                  {/* Caixa de Entrada de Nova Etapa */}
                  <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Nova Etapa</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Nome da Etapa</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          placeholder="Ex: Fundação, Alvenaria, Pintura..."
                          value={newStage.name} 
                          onChange={e => setNewStage({...newStage, name: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Início</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          value={newStage.startDate || projectForm.startDate} 
                          onChange={e => setNewStage({...newStage, startDate: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Fim</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          value={newStage.endDate || projectForm.endDate} 
                          onChange={e => setNewStage({...newStage, endDate: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Responsável</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          value={newStage.responsible || projectForm.responsible} 
                          onChange={e => setNewStage({...newStage, responsible: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Valor Previsto (R$)</label>
                        <input 
                          type="number" 
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          value={newStage.plannedValue} 
                          onChange={e => setNewStage({...newStage, plannedValue: Number(e.target.value)})} 
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={handleAddStage}
                      disabled={!newStage.name}
                      className="w-full py-3 bg-emerald-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" /> Salvar Etapa e Adicionar Próxima
                    </button>
                  </div>

                  {/* Lista de Etapas Lançadas */}
                  <div className="space-y-3">
                    {projectForm.stages.map((stage, index) => (
                      <div key={stage.id} className={`group bg-white p-4 rounded-3xl border transition-all ${selectedStages.includes(stage.id) ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                        <div className="flex items-start gap-4">
                          {/* Seleção e Reordenação */}
                          <div className="flex flex-col gap-2 pt-1">
                            <button 
                              type="button"
                              onClick={() => toggleStageSelection(stage.id)}
                              className={`p-1 rounded-md transition-colors ${selectedStages.includes(stage.id) ? 'text-emerald-500' : 'text-slate-300 hover:text-slate-400'}`}
                            >
                              {selectedStages.includes(stage.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                            <div className="flex flex-col gap-0.5">
                              <button 
                                type="button"
                                onClick={() => moveStage(index, 'up')}
                                disabled={index === 0}
                                className="p-1 text-slate-300 hover:text-emerald-500 disabled:opacity-0 transition-all"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => moveStage(index, 'down')}
                                disabled={index === projectForm.stages.length - 1}
                                className="p-1 text-slate-300 hover:text-emerald-500 disabled:opacity-0 transition-all"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Conteúdo da Etapa */}
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Nome da Etapa</label>
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                                  value={stage.name} 
                                  onChange={e => {
                                    const newStages = [...projectForm.stages];
                                    newStages[index].name = e.target.value;
                                    setProjectForm({...projectForm, stages: newStages});
                                  }} 
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Início</label>
                                <input 
                                  type="date" 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                                  value={stage.startDate} 
                                  onChange={e => {
                                    const newStages = [...projectForm.stages];
                                    newStages[index].startDate = e.target.value;
                                    setProjectForm({...projectForm, stages: newStages});
                                  }} 
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Fim</label>
                                <input 
                                  type="date" 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                                  value={stage.endDate} 
                                  onChange={e => {
                                    const newStages = [...projectForm.stages];
                                    newStages[index].endDate = e.target.value;
                                    setProjectForm({...projectForm, stages: newStages});
                                  }} 
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Responsável</label>
                                <input 
                                  type="text" 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                                  value={stage.responsible} 
                                  onChange={e => {
                                    const newStages = [...projectForm.stages];
                                    newStages[index].responsible = e.target.value;
                                    setProjectForm({...projectForm, stages: newStages});
                                  }} 
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Valor (R$)</label>
                                <input 
                                  type="number" 
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                                  value={stage.plannedValue} 
                                  onChange={e => {
                                    const newStages = [...projectForm.stages];
                                    newStages[index].plannedValue = Number(e.target.value);
                                    setProjectForm({...projectForm, stages: newStages});
                                  }} 
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-[8px] font-black text-slate-400 uppercase">Andamento</label>
                                <span className="text-[9px] font-black text-emerald-600">{stage.progress}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" 
                                max="100"
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                                value={stage.progress} 
                                onChange={e => {
                                  const newStages = [...projectForm.stages];
                                  newStages[index].progress = Number(e.target.value);
                                  setProjectForm({...projectForm, stages: newStages});
                                }} 
                              />
                            </div>
                          </div>

                          {/* Ações Individuais */}
                          <div className="flex flex-col gap-1 pt-1">
                            <button 
                              type="button"
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Salvar Alterações"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={() => {
                                const newStages = projectForm.stages.filter((_, i) => i !== index);
                                setProjectForm({...projectForm, stages: newStages});
                              }}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Excluir Etapa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {projectForm.stages.length === 0 && (
                      <div className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest italic border border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                        Nenhuma etapa lançada. Utilize a caixa acima para adicionar.
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex gap-3">
                  <button type="submit" className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">
                    {editingProjectId ? 'Salvar Projeto' : 'Cadastrar Projeto'}
                  </button>
                  {editingProjectId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingProjectId(null);
                        setProjectForm({ 
                          portfolioId: '', 
                          name: '', 
                          costCenter: '', 
                          plannedValue: '', 
                          startDate: new Date().toISOString().split('T')[0], 
                          endDate: '', 
                          responsible: '', 
                          investmentArea: '',
                          stages: []
                        });
                        setNewStage({
                          name: '',
                          startDate: new Date().toISOString().split('T')[0],
                          endDate: '',
                          responsible: '',
                          plannedValue: 0,
                          progress: 0
                        });
                        setSelectedStages([]);
                      }}
                      className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Projetos em Andamento</h4>
              {projectStats.map(proj => {
                const portfolio = state.portfolios?.find(p => p.id === proj.portfolioId);
                return (
                  <div key={proj.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-black text-slate-800 uppercase tracking-tight">{proj.name}</h5>
                          <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest">{proj.costCenter}</span>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Carteira: {portfolio?.name || '---'}</p>
                      </div>
                      {currentUser.isMaster && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { 
                            setEditingProjectId(proj.id); 
                            setProjectForm({
                              portfolioId: proj.portfolioId, 
                              name: proj.name, 
                              costCenter: proj.costCenter, 
                              plannedValue: proj.plannedValue.toString(), 
                              startDate: proj.startDate, 
                              endDate: proj.endDate || '', 
                              responsible: proj.responsible, 
                              investmentArea: proj.investmentArea,
                              stages: proj.stages || []
                            }); 
                            setNewStage({
                              name: '',
                              startDate: proj.startDate,
                              endDate: proj.endDate || '',
                              responsible: proj.responsible,
                              plannedValue: 0,
                              progress: 0
                            });
                          }} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => removeProject(proj.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Valor Inicial CAPEX</span>
                        <span className="text-sm font-black text-slate-700">R$ {formatNumber(proj.plannedValue)}</span>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">Saldo CAPEX</span>
                        <span className="text-sm font-black text-emerald-700">R$ {formatNumber(proj.balance)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, proj.executionPercentage)}%` }} />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Resp: {proj.responsible}</span>
                      <span className="text-[9px] font-black text-emerald-600 uppercase">{formatNumber(proj.executionPercentage, 1)}% Utilizado</span>
                    </div>

                    {/* Stages view for everyone in Planning tab */}
                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
                      <h6 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Etapas do Projeto</h6>
                      {(proj.stages || []).map(stage => (
                        <div key={stage.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-black text-slate-700 uppercase">{stage.name}</span>
                            <span className="text-[8px] font-bold text-slate-500">{format(parseISO(stage.startDate), 'dd/MM/yy')} - {format(parseISO(stage.endDate), 'dd/MM/yy')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${currentUser.isMaster ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                style={{ width: `${currentUser.isMaster ? stage.progress : calculateDateProgress(stage.startDate, stage.endDate)}%` }} 
                              />
                            </div>
                            <span className={`text-[9px] font-black ${currentUser.isMaster ? 'text-emerald-600' : 'text-blue-600'}`}>
                              {currentUser.isMaster ? stage.progress : calculateDateProgress(stage.startDate, stage.endDate)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Cadastro de Nota Fiscal */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
              <FileText className="w-5 h-5 text-amber-500" />
              {editingInvoiceId ? 'Editar Nota Fiscal' : 'Lançamento Manual de Nota Fiscal'}
            </h3>
            <form onSubmit={handleSaveInvoice} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Carteira de Investimento</label>
                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.portfolioId} onChange={e => setInvoiceForm({...invoiceForm, portfolioId: e.target.value, projectId: ''})}>
                  <option value="">Selecionar Carteira...</option>
                  {(state.portfolios || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Projeto Vinculado</label>
                <select required disabled={!invoiceForm.portfolioId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50" value={invoiceForm.projectId} onChange={e => setInvoiceForm({...invoiceForm, projectId: e.target.value})}>
                  <option value="">Selecionar Projeto...</option>
                  {(state.capexProjects || []).filter(p => p.portfolioId === invoiceForm.portfolioId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Número da Nota</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})} />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fornecedor / Razão Social</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="text" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.supplier} onChange={e => setInvoiceForm({...invoiceForm, supplier: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">CNPJ do Fornecedor</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.cnpj} onChange={e => setInvoiceForm({...invoiceForm, cnpj: e.target.value})} />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Itens da Nota (Resumo)</label>
                <div className="relative">
                  <ClipboardList className="absolute left-4 top-4 w-4 h-4 text-slate-300" />
                  <textarea required rows={2} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.items} onChange={e => setInvoiceForm({...invoiceForm, items: e.target.value})} />
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Tipo de Lançamento</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setInvoiceForm({...invoiceForm, type: 'Aquisição'})}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border ${invoiceForm.type === 'Aquisição' ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    Aquisição
                  </button>
                  <button 
                    type="button"
                    onClick={() => setInvoiceForm({...invoiceForm, type: 'Prestação de Serviço'})}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all border ${invoiceForm.type === 'Prestação de Serviço' ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    Serviço
                  </button>
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor Total (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="number" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.value} onChange={e => setInvoiceForm({...invoiceForm, value: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data de Emissão</label>
                <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.date} onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})} />
              </div>

              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data de Entrega</label>
                <div className="relative">
                  <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="date" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.deliveryDate} onChange={e => setInvoiceForm({...invoiceForm, deliveryDate: e.target.value})} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações Adicionais</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500" value={invoiceForm.description} onChange={e => setInvoiceForm({...invoiceForm, description: e.target.value})} />
              </div>

              <button type="submit" className="md:col-span-3 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-600/20 active:scale-95 transition-all mt-2 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {editingInvoiceId ? 'Salvar Alterações' : 'Confirmar Lançamento de Nota'}
              </button>
            </form>
          </div>

          {/* Relatório de Lançamentos */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Histórico de Lançamentos</h4>
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Data Inclusão</th>
                    <th className="px-6 py-4">Nota / Tipo</th>
                    <th className="px-6 py-4">Fornecedor</th>
                    <th className="px-6 py-4">Carteira / Projeto</th>
                    <th className="px-6 py-4">Valor (R$)</th>
                    <th className="px-6 py-4">Entrega</th>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.capexInvoices || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(inv => {
                    const portfolio = state.portfolios?.find(p => p.id === inv.portfolioId);
                    const project = state.capexProjects?.find(p => p.id === inv.projectId);
                    const user = state.users.find(u => u.id === inv.userId);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                          {format(parseISO(inv.timestamp), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-800 uppercase tracking-tighter">NF {inv.invoiceNumber}</div>
                          <div className={`text-[8px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-widest ${inv.type === 'Aquisição' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {inv.type}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-700 uppercase tracking-tight text-[10px]">{inv.supplier}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{inv.cnpj}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-blue-600 uppercase tracking-tight">{portfolio?.name}</div>
                          <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">{project?.name}</div>
                        </td>
                        <td className="px-6 py-4 font-black text-slate-800">
                          R$ {formatNumber(inv.value)}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500">
                          {format(parseISO(inv.deliveryDate), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">
                          @{user?.username || '---'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => { 
                              setEditingInvoiceId(inv.id); 
                              setInvoiceForm({
                                portfolioId: inv.portfolioId, 
                                projectId: inv.projectId, 
                                invoiceNumber: inv.invoiceNumber, 
                                supplier: inv.supplier,
                                cnpj: inv.cnpj,
                                items: inv.items,
                                type: inv.type,
                                value: inv.value.toString(), 
                                date: inv.date, 
                                deliveryDate: inv.deliveryDate,
                                description: inv.description
                              }); 
                            }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => removeInvoice(inv.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(state.capexInvoices || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum lançamento de nota fiscal encontrado.</td>
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

export default React.memo(CapexManagement);
