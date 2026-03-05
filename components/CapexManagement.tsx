
import React, { useState, useMemo } from 'react';
import { AppState, User, InvestmentPortfolio, CapexProject, CapexInvoice } from '../types';
import { 
  Wallet, Briefcase, FileText, Plus, Edit, Trash2, X, 
  Calendar, User as UserIcon, DollarSign, Layers, 
  ArrowRight, TrendingDown, CheckCircle2, AlertCircle,
  Search, Filter, ChevronRight, Truck, ClipboardList, Building2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CapexManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'planning' | 'execution'>(currentUser.isMaster ? 'planning' : 'execution');
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

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
    investmentArea: ''
  });

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
      const balance = p.totalValue - executedValue;
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
      id: editingPortfolioId || crypto.randomUUID(),
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

    const newProject: CapexProject = {
      id: editingProjectId || crypto.randomUUID(),
      portfolioId: projectForm.portfolioId,
      name: projectForm.name,
      costCenter: projectForm.costCenter,
      plannedValue: Number(projectForm.plannedValue),
      startDate: projectForm.startDate,
      endDate: projectForm.endDate,
      responsible: projectForm.responsible,
      investmentArea: projectForm.investmentArea,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedProjects = editingProjectId 
      ? (state.capexProjects || []).map(p => p.id === editingProjectId ? newProject : p)
      : [...(state.capexProjects || []), newProject];

    onUpdate({ ...state, capexProjects: updatedProjects });
    setEditingProjectId(null);
    setProjectForm({ portfolioId: '', name: '', costCenter: '', plannedValue: '', startDate: new Date().toISOString().split('T')[0], endDate: '', responsible: '', investmentArea: '' });
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;

    const newInvoice: CapexInvoice = {
      id: editingInvoiceId || crypto.randomUUID(),
      portfolioId: invoiceForm.portfolioId,
      projectId: invoiceForm.projectId,
      invoiceNumber: invoiceForm.invoiceNumber,
      supplier: invoiceForm.supplier,
      cnpj: invoiceForm.cnpj,
      items: invoiceForm.items,
      type: invoiceForm.type,
      value: Number(invoiceForm.value),
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

  const removePortfolio = (id: string) => {
    if (!hasPermission || !confirm('Excluir esta carteira? Todos os projetos vinculados perderão a referência.')) return;
    onUpdate({ ...state, portfolios: (state.portfolios || []).filter(p => p.id !== id) });
  };

  const removeProject = (id: string) => {
    if (!hasPermission || !confirm('Excluir este projeto?')) return;
    onUpdate({ ...state, capexProjects: (state.capexProjects || []).filter(p => p.id !== id) });
  };

  const removeInvoice = (id: string) => {
    if (!hasPermission || !confirm('Excluir este lançamento de nota?')) return;
    onUpdate({ ...state, capexInvoices: (state.capexInvoices || []).filter(i => i.id !== id) });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sub-Tabs */}
      <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit mx-auto mb-8">
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
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'execution' || !currentUser.isMaster ? 'bg-[#344434] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          <FileText className="w-4 h-4" /> Execução (Notas)
        </button>
      </div>

      {(activeSubTab === 'planning' && currentUser.isMaster) ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Carteiras de Investimento */}
          <div className="space-y-6">
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor Total (R$)</label>
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
                      <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Total Carteira</span>
                      <span className="text-sm font-black text-slate-700">R$ {p.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100">
                      <span className="text-[9px] font-black text-blue-400 uppercase block mb-1">Saldo Disponível</span>
                      <span className="text-sm font-black text-blue-700">R$ {p.balance.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(100, p.executionPercentage)}%` }} />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">{p.projectsCount} Projetos Vinculados</span>
                    <span className="text-[9px] font-black text-blue-600 uppercase">{p.executionPercentage.toFixed(1)}% Executado</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cadastro de Projetos */}
          <div className="space-y-6">
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Valor Previsto (R$)</label>
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
                <button type="submit" className="col-span-2 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">
                  {editingProjectId ? 'Salvar Projeto' : 'Cadastrar Projeto'}
                </button>
              </form>
            </div>

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
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingProjectId(proj.id); setProjectForm({portfolioId: proj.portfolioId, name: proj.name, costCenter: proj.costCenter, plannedValue: proj.plannedValue.toString(), startDate: proj.startDate, endDate: proj.endDate || '', responsible: proj.responsible, investmentArea: proj.investmentArea}); }} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => removeProject(proj.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Previsto Projeto</span>
                        <span className="text-sm font-black text-slate-700">R$ {proj.plannedValue.toLocaleString()}</span>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">Saldo Projeto</span>
                        <span className="text-sm font-black text-emerald-700">R$ {proj.balance.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, proj.executionPercentage)}%` }} />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase">Resp: {proj.responsible}</span>
                      <span className="text-[9px] font-black text-emerald-600 uppercase">{proj.executionPercentage.toFixed(1)}% Utilizado</span>
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
                  {state.portfolios?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Projeto Vinculado</label>
                <select required disabled={!invoiceForm.portfolioId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50" value={invoiceForm.projectId} onChange={e => setInvoiceForm({...invoiceForm, projectId: e.target.value})}>
                  <option value="">Selecionar Projeto...</option>
                  {state.capexProjects?.filter(p => p.portfolioId === invoiceForm.portfolioId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                          R$ {inv.value.toLocaleString()}
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
