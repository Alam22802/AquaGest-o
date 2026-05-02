
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
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

type PCPSubTab = 'cadastros' | 'programacao';

const SlaughterPCP: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<PCPSubTab>('cadastros');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Forms states
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<PCPSupplier>>({});
  
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Partial<PCPSlaughterSchedule>>({
    expectedDate: new Date().toISOString().split('T')[0]
  });

  const suppliers = state.pcpSuppliers || [];
  const schedules = state.pcpSlaughterSchedules || [];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(searchTerm)) ||
      String(s.sequentialCode).includes(searchTerm)
    ).sort((a, b) => a.sequentialCode - b.sequentialCode);
  }, [suppliers, searchTerm]);

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

  const handleAddSchedule = () => {
    if (!newSchedule.supplierId || !newSchedule.expectedDate || !newSchedule.expectedWeight || !newSchedule.pricePerKg) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

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
  };

  return (
    <div className="space-y-6">
      {/* Sub-sub-tabs */}
      <div className="flex gap-4 border-b border-slate-200">
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
                onClick={() => setShowScheduleForm(true)}
                className="flex items-center justify-center gap-2 bg-[#344434] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Nova Programação
              </button>
            </div>

            {/* List */}
            <div className="overflow-x-auto bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Fornecedor</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Data Prevista</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Peso Previsto (kg)</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Valor/kg (R$)</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Total Est. (R$)</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {schedules.sort((a,b) => a.expectedDate.localeCompare(b.expectedDate)).map(schedule => {
                    const supplier = suppliers.find(s => s.id === schedule.supplierId);
                    return (
                      <tr key={schedule.id} className="hover:bg-slate-50/50 transition-colors group">
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
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                         <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma programação cadastrada</p>
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
                    <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight italic">Programar Abate</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Fornecedor *</label>
                        <select
                          value={newSchedule.supplierId || ''}
                          onChange={(e) => setNewSchedule({...newSchedule, supplierId: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
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
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Peso Previsto (kg) *</label>
                          <input
                            type="number"
                            value={newSchedule.expectedWeight || ''}
                            onChange={(e) => setNewSchedule({...newSchedule, expectedWeight: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Valor/kg (R$) *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newSchedule.pricePerKg || ''}
                            onChange={(e) => setNewSchedule({...newSchedule, pricePerKg: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={() => setShowScheduleForm(false)}
                        className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddSchedule}
                        className="flex-[2] bg-slate-900 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95"
                      >
                        Salvar Programação
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
