
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterExpense, User } from '../../types';
import { DollarSign, Plus, Trash2, Edit3, X, Calendar, Search, Filter, TrendingUp, TrendingDown, PieChart } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const SlaughterFinance: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [formData, setFormData] = useState({
    description: '',
    category: 'Outros' as SlaughterExpense['category'],
    value: '',
    date: new Date().toISOString().split('T')[0]
  });

  const expenses = useMemo(() => state.slaughterExpenses || [], [state.slaughterExpenses]);

  const filteredExpenses = useMemo(() => {
    if (filterCategory === 'all') return expenses;
    return expenses.filter(e => e.category === filterCategory);
  }, [expenses, filterCategory]);

  const stats = useMemo(() => {
    const total = expenses.reduce((acc, e) => acc + e.value, 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.value;
      return acc;
    }, {} as Record<string, number>);
    
    return { total, byCategory };
  }, [expenses]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.value) return;

    const newExpense: SlaughterExpense = {
      id: editingId || crypto.randomUUID(),
      description: formData.description,
      category: formData.category,
      value: Number(formData.value),
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
      date: new Date().toISOString().split('T')[0]
    });
  };

  const startEdit = (expense: SlaughterExpense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      category: expense.category,
      value: expense.value.toString(),
      date: expense.date
    });
  };

  const removeExpense = (id: string) => {
    if (!confirm('Deseja excluir este custo?')) return;
    onUpdate({ ...state, slaughterExpenses: expenses.filter(e => e.id !== id) });
  };

  return (
    <div className="space-y-8">
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

        <div className="md:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-6">
          {Object.entries(stats.byCategory).map(([cat, val]) => (
            <div key={cat} className="space-y-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
              <Plus className="w-6 h-6" />
              {editingId ? 'Editar Custo' : 'Novo Lançamento'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
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
                    <option value="Frete">Frete</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor (R$)</label>
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

        {/* Tabela */}
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
              <option value="Frete">Frete</option>
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
                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                      Nenhum custo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlaughterFinance;
