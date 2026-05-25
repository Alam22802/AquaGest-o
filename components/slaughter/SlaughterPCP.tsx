
import React, { useState, useMemo } from 'react';
import { AppState, User, PCPSupplier, PCPSlaughterSchedule } from '../../types';
import { 
  Users, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle,
  TrendingUp,
  Scale,
  DollarSign,
  Edit,
  Clock,
  Filter,
  CheckSquare,
  Square,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

type PCPSubTab = 'programacao' | 'cadastros';

const SlaughterPCP: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<PCPSubTab>('programacao');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Forms states
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<PCPSupplier>>({});
  
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState<Partial<PCPSlaughterSchedule>>({
    expectedDate: new Date().toISOString().split('T')[0]
  });

  // Filter States for Slaughter Schedules
  const [filterDate, setFilterDate] = useState('');
  const [filterProducerId, setFilterProducerId] = useState('');
  const [showOnlyRecent, setShowOnlyRecent] = useState(false);
  
  // Multiple Selection State
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());

  const suppliers = state.pcpSuppliers || [];
  const schedules = state.pcpSlaughterSchedules || [];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(searchTerm)) ||
      String(s.sequentialCode).includes(searchTerm)
    ).sort((a, b) => a.sequentialCode - b.sequentialCode);
  }, [suppliers, searchTerm]);

  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    // Filter by producer
    if (filterProducerId) {
      result = result.filter(s => s.supplierId === filterProducerId);
    }

    // Filter by date
    if (filterDate) {
      result = result.filter(s => s.expectedDate === filterDate);
    }

    // Sort strategy and/or limit based on "últimos lançamentos"
    if (showOnlyRecent) {
      // Sort by updatedAt desc to put latest registered/updated schedules first
      result.sort((a, b) => {
        const timeA = a.updatedAt || 0;
        const timeB = b.updatedAt || 0;
        return timeB - timeA;
      });
    } else {
      // Standard sort by expected date
      result.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    }

    return result;
  }, [schedules, filterProducerId, filterDate, showOnlyRecent]);

  const handleAddSupplier = () => {
    if (!newSupplier.name) return;

    const lastCode = suppliers.reduce((max, s) => Math.max(max, s.sequentialCode || 0), 0);
    
    const supplier: PCPSupplier = {
      id: crypto.randomUUID(),
      sequentialCode: lastCode + 1,
      name: newSupplier.name,
      cnpj: newSupplier.cnpj || '',
      contact: newSupplier.contact || '',
      phone: newSupplier.phone || '',
      address: newSupplier.address || '',
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    onUpdate({
      ...state,
      pcpSuppliers: [...suppliers, supplier]
    });

    setNewSupplier({});
    setShowSupplierForm(false);
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    
    // Check if supplier is used in any schedule
    const isUsed = schedules.some(s => s.supplierId === id);
    if (isUsed) {
      alert('Este fornecedor possui programações de abate vinculadas e não pode ser excluído.');
      return;
    }

    onUpdate({
      ...state,
      pcpSuppliers: suppliers.filter(s => s.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const handleStartEditSchedule = (schedule: PCPSlaughterSchedule) => {
    setEditingScheduleId(schedule.id);
    setNewSchedule({
      supplierId: schedule.supplierId,
      expectedDate: schedule.expectedDate,
      expectedWeight: schedule.expectedWeight,
      pricePerKg: schedule.pricePerKg
    });
    setShowScheduleForm(true);
  };

  const handleCancelScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingScheduleId(null);
    setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
  };

  const handleToggleSelectAll = () => {
    const allSelected = filteredSchedules.length > 0 && filteredSchedules.every(s => selectedScheduleIds.has(s.id));
    if (allSelected) {
      const next = new Set(selectedScheduleIds);
      filteredSchedules.forEach(s => next.delete(s.id));
      setSelectedScheduleIds(next);
    } else {
      const next = new Set(selectedScheduleIds);
      filteredSchedules.forEach(s => next.add(s.id));
      setSelectedScheduleIds(next);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const next = new Set(selectedScheduleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedScheduleIds(next);
  };

  const handleBulkDelete = () => {
    if (selectedScheduleIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja excluir as ${selectedScheduleIds.size} programações selecionadas?`)) return;

    const idsArr = Array.from(selectedScheduleIds);
    onUpdate({
      ...state,
      pcpSlaughterSchedules: schedules.filter(s => !selectedScheduleIds.has(s.id)),
      deletedIds: [...(state.deletedIds || []), ...idsArr]
    });
    setSelectedScheduleIds(new Set());
  };

  const handleAddSchedule = () => {
    if (!newSchedule.supplierId || !newSchedule.expectedDate || !newSchedule.expectedWeight || !newSchedule.pricePerKg) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    if (editingScheduleId) {
      const updatedSchedules = schedules.map(s => {
        if (s.id === editingScheduleId) {
          return {
            ...s,
            supplierId: newSchedule.supplierId!,
            expectedDate: newSchedule.expectedDate!,
            expectedWeight: Number(newSchedule.expectedWeight),
            pricePerKg: Number(newSchedule.pricePerKg),
            updatedAt: Date.now()
          };
        }
        return s;
      });

      onUpdate({
        ...state,
        pcpSlaughterSchedules: updatedSchedules
      });

      setEditingScheduleId(null);
    } else {
      const schedule: PCPSlaughterSchedule = {
        id: crypto.randomUUID(),
        supplierId: newSchedule.supplierId,
        expectedDate: newSchedule.expectedDate,
        expectedWeight: Number(newSchedule.expectedWeight),
        pricePerKg: Number(newSchedule.pricePerKg),
        userId: currentUser.id,
        updatedAt: Date.now()
      };

      onUpdate({
        ...state,
        pcpSlaughterSchedules: [...schedules, schedule]
      });
    }

    setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
    setShowScheduleForm(false);
  };

  const handleDeleteSchedule = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta programação?')) return;
    onUpdate({
      ...state,
      pcpSlaughterSchedules: schedules.filter(s => s.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
    
    // Remote from selection if there
    if (selectedScheduleIds.has(id)) {
      const next = new Set(selectedScheduleIds);
      next.delete(id);
      setSelectedScheduleIds(next);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-sub-tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('programacao')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeSubTab === 'programacao' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Programação Abate
          </div>
          {activeSubTab === 'programacao' && (
            <motion.div layoutId="pcp-tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-[#344434] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('cadastros')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeSubTab === 'cadastros' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Cadastros
          </div>
          {activeSubTab === 'cadastros' && (
            <motion.div layoutId="pcp-tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-[#344434] rounded-t-full" />
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'cadastros' ? (
          <motion.div
            key="cadastros"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome, código ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                />
              </div>
              <button
                onClick={() => setShowSupplierForm(true)}
                className="flex items-center justify-center gap-2 bg-[#344434] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Adicionar Fornecedor
              </button>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map(supplier => (
                <div key={supplier.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight text-slate-500">
                      Cód: {supplier.sequentialCode}
                    </div>
                    <button
                      onClick={() => handleDeleteSupplier(supplier.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mb-1">{supplier.name}</h3>
                  <div className="space-y-2">
                    {supplier.cnpj && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">CNPJ:</span> {supplier.cnpj}
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">Tel:</span> {supplier.phone}
                      </div>
                    )}
                    {supplier.contact && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">Contato:</span> {supplier.contact}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredSuppliers.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum fornecedor encontrado</p>
                </div>
              )}
            </div>

            {/* Modal Supplier Form */}
            {showSupplierForm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight italic">Novo Fornecedor</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Nome / Razão Social *</label>
                        <input
                          type="text"
                          value={newSupplier.name || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">CNPJ</label>
                          <input
                            type="text"
                            value={newSupplier.cnpj || ''}
                            onChange={(e) => setNewSupplier({...newSupplier, cnpj: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Telefone</label>
                          <input
                            type="text"
                            value={newSupplier.phone || ''}
                            onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Contato</label>
                        <input
                          type="text"
                          value={newSupplier.contact || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Endereço</label>
                        <input
                          type="text"
                          value={newSupplier.address || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={() => setShowSupplierForm(false)}
                        className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddSupplier}
                        disabled={!newSupplier.name}
                        className="flex-[2] bg-slate-900 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        Salvar Fornecedor
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="programacao"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             {/* Header / Actions */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Programação do Dia</h2>
              <button
                onClick={() => {
                  setEditingScheduleId(null);
                  setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
                  setShowScheduleForm(true);
                }}
                className="flex items-center justify-center gap-2 bg-[#344434] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Nova Programação
              </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Filtrar por Data
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Filtrar por Produtor
                </label>
                <select
                  value={filterProducerId}
                  onChange={(e) => setFilterProducerId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all animate-none"
                >
                  <option value="">Todos os Produtores</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Ordenação / Lançamentos
                </label>
                <button
                  type="button"
                  onClick={() => setShowOnlyRecent(!showOnlyRecent)}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    showOnlyRecent 
                      ? 'bg-[#344434] text-white border-[#344434] shadow-md shadow-emerald-900/10' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Últimos Lançamentos
                </button>
              </div>

              {/* Reset Filters */}
              {(filterDate || filterProducerId || showOnlyRecent) ? (
                <button
                  onClick={() => {
                    setFilterDate('');
                    setFilterProducerId('');
                    setShowOnlyRecent(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-[#344434] hover:bg-slate-100 transition-all border border-[#344434]/15 flex items-center justify-center gap-2 h-[38px] w-full"
                >
                  Limpar Filtros
                </button>
              ) : (
                <div className="hidden md:block h-[38px]" />
              )}
            </div>

            {/* Batch actions bar when items are selected */}
            {selectedScheduleIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-emerald-600 text-white text-xs font-mono font-black px-3 py-1.5 rounded-lg">
                    {selectedScheduleIds.size} SELECIONADOS
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 text-xs">
                    <span className="font-bold">Peso Total:</span>
                    <span className="font-black text-emerald-800 text-sm">
                      {Array.from(selectedScheduleIds).reduce((sum, id) => {
                        const s = schedules.find(item => item.id === id);
                        return sum + (s ? s.expectedWeight : 0);
                      }, 0).toLocaleString()} kg
                    </span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden md:block" />
                  <div className="flex items-center gap-2 text-slate-700 text-xs">
                    <span className="font-bold">Valor Total Estimado:</span>
                    <span className="font-black text-emerald-800 text-sm">
                      R$ {Array.from(selectedScheduleIds).reduce((sum, id) => {
                        const s = schedules.find(item => item.id === id);
                        return sum + (s ? (s.expectedWeight * s.pricePerKg) : 0);
                      }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedScheduleIds(new Set())}
                    className="px-4 py-2 hover:bg-[#344434]/5 rounded-xl text-xs font-bold text-slate-500 transition-all uppercase tracking-wider"
                  >
                    Desmarcar Todos
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider shadow-lg shadow-red-600/15 hover:scale-105 transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Seleção
                  </button>
                </div>
              </motion.div>
            )}

            {/* List */}
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-5 py-5 text-left w-12">
                      <button 
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Selecionar Todos"
                      >
                        {filteredSchedules.length > 0 && filteredSchedules.every(s => selectedScheduleIds.has(s.id)) ? (
                          <CheckSquare className="w-4 h-4 text-[#344434]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Data Prevista</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Peso Previsto (kg)</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Valor/kg (R$)</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Total Est. (R$)</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSchedules.map(schedule => {
                    const supplier = suppliers.find(s => s.id === schedule.supplierId);
                    const isSelected = selectedScheduleIds.has(schedule.id);
                    return (
                      <tr key={schedule.id} className={`hover:bg-slate-50/50 transition-colors group ${isSelected ? 'bg-emerald-50/20' : ''}`}>
                        <td className="px-5 py-4 w-12">
                          <button 
                            type="button"
                            onClick={() => handleToggleSelectRow(schedule.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#344434]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                              {supplier?.sequentialCode || '?'}
                            </div>
                            <span className="font-bold text-slate-900">{supplier?.name || 'Desconhecido'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className="font-mono text-sm font-bold text-slate-600">
                             {new Date(schedule.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <Scale className="w-4 h-4 text-slate-400" />
                             <span className="font-black text-slate-900">{schedule.expectedWeight.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-slate-600 font-bold">
                           R$ {schedule.pricePerKg.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 font-black text-slate-900">
                           R$ {(schedule.expectedWeight * schedule.pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStartEditSchedule(schedule)}
                              className="p-2 text-slate-400 hover:text-[#344434] hover:bg-slate-100 rounded-xl transition-all"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(schedule.id)}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-20 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma programação encontrada para os filtros aplicados</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Schedule Form */}
            {showScheduleForm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight italic">
                      {editingScheduleId ? 'Editar Programação' : 'Programar Abate'}
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Fornecedor *</label>
                        <select
                          value={newSchedule.supplierId || ''}
                          onChange={(e) => setNewSchedule({...newSchedule, supplierId: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                        >
                          <option value="">Selecione um fornecedor</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>[{s.sequentialCode}] {s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Data do Abate *</label>
                        <input
                          type="date"
                          value={newSchedule.expectedDate || ''}
                          onChange={(e) => setNewSchedule({...newSchedule, expectedDate: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Peso Previsto (kg) *</label>
                          <input
                            type="number"
                            value={newSchedule.expectedWeight || ''}
                            onChange={(e) => setNewSchedule({...newSchedule, expectedWeight: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Valor/kg (R$) *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newSchedule.pricePerKg || ''}
                            onChange={(e) => setNewSchedule({...newSchedule, pricePerKg: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={handleCancelScheduleForm}
                        className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddSchedule}
                        className="flex-[2] bg-[#344434] text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95"
                      >
                        {editingScheduleId ? 'Salvar Alterações' : 'Salvar Programação'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SlaughterPCP;
