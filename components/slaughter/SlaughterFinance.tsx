
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterExpense, User, SlaughterSupplyInvoice, SlaughterSupplyItem } from '../../types';
import { DollarSign, Plus, Trash2, Edit3, X, Calendar, Search, Filter, TrendingUp, TrendingDown, PieChart, Receipt, Package, Truck, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

const SlaughterFinance: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'invoices'>('expenses');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // State for General Expenses
  const [formData, setFormData] = useState({
    description: '',
    category: 'Outros' as SlaughterExpense['category'],
    value: '',
    quantity: '',
    unitValue: '',
    date: new Date().toISOString().split('T')[0]
  });

  // State for Supply Invoices
  const [invoiceForm, setInvoiceForm] = useState({
    itemId: '',
    supplierId: '',
    invoiceNumber: '',
    quantity: '',
    unitValue: '',
    totalValue: '',
    date: new Date().toISOString().split('T')[0]
  });

  const expenses = useMemo(() => state.slaughterExpenses || [], [state.slaughterExpenses]);
  const invoices = useMemo(() => state.slaughterSupplyInvoices || [], [state.slaughterSupplyInvoices]);
  const items = useMemo(() => state.slaughterSupplyItems || [], [state.slaughterSupplyItems]);
  const suppliers = useMemo(() => state.slaughterSuppliers || [], [state.slaughterSuppliers]);

  const filteredExpenses = useMemo(() => {
    if (filterCategory === 'all') return expenses;
    return expenses.filter(e => e.category === filterCategory);
  }, [expenses, filterCategory]);

  const stats = useMemo(() => {
    const expenseTotal = expenses.reduce((acc, e) => acc + e.value, 0);
    const invoiceTotal = invoices.reduce((acc, i) => acc + i.totalValue, 0);
    const total = expenseTotal + invoiceTotal;

    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.value;
      return acc;
    }, {} as Record<string, number>);

    if (invoiceTotal > 0) {
      byCategory['Suprimentos'] = (byCategory['Suprimentos'] || 0) + invoiceTotal;
    }
    
    return { total, byCategory, expenseTotal, invoiceTotal };
  }, [expenses, invoices]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.value) return;

    const newExpense: SlaughterExpense = {
      id: editingId || generateId(),
      description: formData.description,
      category: formData.category,
      value: Number(formData.value),
      quantity: (formData.category === 'Água' || formData.category === 'Energia') ? Number(formData.quantity) : undefined,
      unitValue: (formData.category === 'Água' || formData.category === 'Energia') ? Number(formData.unitValue) : undefined,
      date: formData.date,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedExpenses = editingId 
      ? expenses.map(ex => ex.id === editingId ? newExpense : ex)
      : [newExpense, ...expenses];

    onUpdate({ ...state, slaughterExpenses: updatedExpenses });
    setEditingId(null);
    setFormData({
      description: '',
      category: 'Outros',
      value: '',
      quantity: '',
      unitValue: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.itemId || !invoiceForm.totalValue) return;

    const selectedItem = items.find(i => i.id === invoiceForm.itemId);
    if (!selectedItem) return;

    const newInvoice: SlaughterSupplyInvoice = {
      id: generateId(),
      itemId: invoiceForm.itemId,
      supplierId: invoiceForm.supplierId,
      invoiceNumber: invoiceForm.invoiceNumber,
      quantity: Number(invoiceForm.quantity),
      unitValue: Number(invoiceForm.unitValue),
      totalValue: Number(invoiceForm.totalValue),
      date: invoiceForm.date,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    // Update stock of the item
    const updatedItems = items.map(item => {
      if (item.id === invoiceForm.itemId) {
        return {
          ...item,
          currentStock: item.currentStock + Number(invoiceForm.quantity),
          updatedAt: Date.now()
        };
      }
      return item;
    });

    onUpdate({ 
      ...state, 
      slaughterSupplyInvoices: [newInvoice, ...invoices],
      slaughterSupplyItems: updatedItems
    });

    setInvoiceForm({
      itemId: '',
      supplierId: '',
      invoiceNumber: '',
      quantity: '',
      unitValue: '',
      totalValue: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const startEdit = (expense: SlaughterExpense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      category: expense.category,
      value: expense.value.toString(),
      quantity: (expense.quantity || '').toString(),
      unitValue: (expense.unitValue || '').toString(),
      date: expense.date
    });
  };

  const removeExpense = (id: string) => {
    if (!confirm('Deseja excluir este custo?')) return;
    onUpdate({ ...state, slaughterExpenses: expenses.filter(e => e.id !== id) });
  };

  const handleUnitCalculation = (field: 'qty' | 'unit', val: string) => {
    const qty = field === 'qty' ? Number(val) : Number(formData.quantity);
    const unit = field === 'unit' ? Number(val) : Number(formData.unitValue);
    
    if (qty && unit) {
      setFormData(prev => ({
        ...prev,
        quantity: field === 'qty' ? val : prev.quantity,
        unitValue: field === 'unit' ? val : prev.unitValue,
        value: (qty * unit).toFixed(2)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        quantity: field === 'qty' ? val : prev.quantity,
        unitValue: field === 'unit' ? val : prev.unitValue
      }));
    }
  };

  const handleInvoiceCalculation = (field: 'qty' | 'unit', val: string) => {
    const qty = field === 'qty' ? Number(val) : Number(invoiceForm.quantity);
    const unit = field === 'unit' ? Number(val) : Number(invoiceForm.unitValue);
    
    if (qty && unit) {
      setInvoiceForm(prev => ({
        ...prev,
        quantity: field === 'qty' ? val : prev.quantity,
        unitValue: field === 'unit' ? val : prev.unitValue,
        totalValue: (qty * unit).toFixed(2)
      }));
    } else {
      setInvoiceForm(prev => ({
        ...prev,
        quantity: field === 'qty' ? val : prev.quantity,
        unitValue: field === 'unit' ? val : prev.unitValue
      }));
    }
  };

  const selectedItemForInvoice = useMemo(() => 
    items.find(i => i.id === invoiceForm.itemId),
    [items, invoiceForm.itemId]
  );

  const lastItemValue = useMemo(() => {
    if (!invoiceForm.itemId) return 0;
    const itemInvoices = invoices
      .filter(inv => inv.itemId === invoiceForm.itemId)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return itemInvoices.length > 0 ? itemInvoices[0].unitValue : 0;
  }, [invoices, invoiceForm.itemId]);

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'expenses' ? 'bg-white text-[#344434] shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <TrendingDown className="w-4 h-4" /> Custos Gerais
        </button>
        <button 
          onClick={() => setActiveTab('invoices')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'invoices' ? 'bg-white text-[#344434] shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Receipt className="w-4 h-4" /> Notas de Suprimentos
        </button>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#344434] p-8 rounded-[2.5rem] text-white shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">Custo Total Acumulado</h3>
          </div>
          <div className="text-4xl font-black italic tracking-tighter">
            R$ {stats.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-6 overflow-x-auto">
          {Object.entries(stats.byCategory).map(([cat, val]) => (
            <div key={cat} className="space-y-1 min-w-[120px]">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cat}</div>
              <div className="text-lg font-black text-slate-800">R$ {val.toLocaleString('pt-BR')}</div>
            </div>
          ))}
          {Object.keys(stats.byCategory).length === 0 && (
            <div className="col-span-full flex items-center justify-center text-slate-300 italic text-sm">
              Nenhum custo registrado ainda.
            </div>
          )}
        </div>
      </div>

      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulário Custos Gerais */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Plus className="w-6 h-6" />
                {editingId ? 'Editar Custo' : 'Novo Lançamento'}
              </h3>
              <form onSubmit={handleSaveExpense} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value as any})}
                    >
                      <option value="Energia">Energia</option>
                      <option value="Água">Água</option>
                      <option value="Manutenção">Manutenção</option>
                      <option value="Insumos">Insumos</option>
                      <option value="Prestação de Serviços">Prestação de Serviços</option>
                      <option value="Salário">Salário</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Total (R$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                      value={formData.value}
                      onChange={e => setFormData({...formData, value: e.target.value})}
                    />
                  </div>
                </div>

                {(formData.category === 'Água' || formData.category === 'Energia') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {formData.category === 'Água' ? 'Qtd Litros' : 'Qtd KW'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                        value={formData.quantity}
                        onChange={e => handleUnitCalculation('qty', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {formData.category === 'Água' ? 'Valor/Litro' : 'Valor/KW'}
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                        value={formData.unitValue}
                        onChange={e => handleUnitCalculation('unit', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  {editingId ? 'Salvar Alterações' : 'Lançar Custo'}
                </button>
                {editingId && (
                  <button type="button" onClick={() => setEditingId(null)} className="w-full py-2 text-slate-400 font-black uppercase text-[10px]">
                    Cancelar Edição
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Tabela Custos Gerais */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center gap-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <select 
                className="bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer text-slate-600"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all">Todas as Categorias</option>
                <option value="Energia">Energia</option>
                <option value="Água">Água</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Insumos">Insumos</option>
                <option value="Prestação de Serviços">Prestação de Serviços</option>
                <option value="Salário">Salário</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Descrição</th>
                    <th className="px-8 py-5">Categoria</th>
                    <th className="px-8 py-5">Data</th>
                    <th className="px-8 py-5">Detalhes</th>
                    <th className="px-8 py-5">Valor</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6 font-bold text-slate-700">{expense.description}</td>
                      <td className="px-8 py-6">
                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full text-slate-500">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-xs text-slate-500">{format(parseISO(expense.date), 'dd/MM/yyyy')}</td>
                      <td className="px-8 py-6">
                        {expense.quantity && expense.unitValue ? (
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            {expense.quantity} {expense.category === 'Água' ? 'L' : 'KW'} x R$ {expense.unitValue.toFixed(2)}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-8 py-6 font-black text-slate-900">R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => startEdit(expense)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => removeExpense(expense.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhum custo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulário Notas de Suprimentos */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Receipt className="w-6 h-6" />
                Entrada de Nota
              </h3>
              <form onSubmit={handleSaveInvoice} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item de Suprimento</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={invoiceForm.itemId}
                    onChange={e => setInvoiceForm({...invoiceForm, itemId: e.target.value})}
                    required
                  >
                    <option value="">Selecione um item</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>[{item.code}] {item.name}</option>
                    ))}
                  </select>
                </div>

                {selectedItemForInvoice && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Atual</span>
                      <span className="text-sm font-black text-[#344434]">{selectedItemForInvoice.currentStock} {selectedItemForInvoice.unit}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Último Valor Unit.</span>
                      <span className="text-sm font-black text-slate-700">R$ {lastItemValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={invoiceForm.supplierId}
                    onChange={e => setInvoiceForm({...invoiceForm, supplierId: e.target.value})}
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº da Nota Fiscal</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={invoiceForm.invoiceNumber}
                    onChange={e => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                    <input 
                      type="number" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={invoiceForm.quantity}
                      onChange={e => handleInvoiceCalculation('qty', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Unitário</label>
                    <input 
                      type="number" step="0.01" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={invoiceForm.unitValue}
                      onChange={e => handleInvoiceCalculation('unit', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Total (R$)</label>
                  <input 
                    type="number" step="0.01" required 
                    className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl font-black outline-none text-sm text-[#344434]"
                    value={invoiceForm.totalValue}
                    readOnly
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={invoiceForm.date}
                    onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})}
                  />
                </div>

                <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Registrar Entrada
                </button>
              </form>
            </div>
          </div>

          {/* Tabela Notas de Suprimentos */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Item</th>
                    <th className="px-8 py-5">Fornecedor</th>
                    <th className="px-8 py-5">Nota</th>
                    <th className="px-8 py-5">Qtd</th>
                    <th className="px-8 py-5">Valor Total</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(invoice => {
                    const item = items.find(i => i.id === invoice.itemId);
                    const supplier = suppliers.find(s => s.id === invoice.supplierId);
                    return (
                      <tr key={invoice.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-700 text-xs">{item?.name || 'Item Desconhecido'}</div>
                          <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{format(parseISO(invoice.date), 'dd/MM/yyyy')}</div>
                        </td>
                        <td className="px-8 py-6 text-xs text-slate-500">{supplier?.name || '-'}</td>
                        <td className="px-8 py-6 text-xs font-bold text-slate-600">{invoice.invoiceNumber || '-'}</td>
                        <td className="px-8 py-6 text-xs font-black text-emerald-600">+{invoice.quantity} {item?.unit}</td>
                        <td className="px-8 py-6 font-black text-slate-900">R$ {invoice.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            <button onClick={() => {
                              if (confirm('Deseja excluir esta nota? O estoque não será reduzido automaticamente.')) {
                                onUpdate({ ...state, slaughterSupplyInvoices: invoices.filter(i => i.id !== invoice.id) });
                              }
                            }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhuma nota fiscal registrada.
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

export default SlaughterFinance;
