
import React, { useState, useMemo } from 'react';
import { AppState, SlaughterSupplyItem, SlaughterSupplyRequest, User, SlaughterSupplier } from '../../types';
import { Package, Plus, Trash2, Edit3, X, Search, ShoppingCart, ClipboardList, AlertTriangle, CheckCircle2, Clock, Truck } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const SlaughterSupplies: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'requests' | 'suppliers'>('inventory');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'Embalagem' as SlaughterSupplyItem['category'],
    currentStock: '',
    minStock: '',
    unit: 'un'
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    cnpj: '',
    contact: '',
    phone: ''
  });

  const items = useMemo(() => state.slaughterSupplyItems || [], [state.slaughterSupplyItems]);
  const suppliers = useMemo(() => state.slaughterSuppliers || [], [state.slaughterSuppliers]);
  const requests = useMemo(() => state.slaughterSupplyRequests || [], [state.slaughterSupplyRequests]);

  const generateCode = (prefix: 'I' | 'F', list: { code: string }[]) => {
    const codes = list
      .map(i => i.code)
      .filter(c => c.startsWith(prefix))
      .map(c => parseInt(c.substring(1)))
      .filter(n => !isNaN(n));
    
    const nextNum = codes.length > 0 ? Math.max(...codes) + 1 : 1;
    return `${prefix}${nextNum.toString().padStart(3, '0')}`;
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name) return;

    const existingItem = editingItemId ? items.find(i => i.id === editingItemId) : null;
    const code = existingItem?.code || generateCode('I', items);

    const newItem: SlaughterSupplyItem = {
      id: editingItemId || crypto.randomUUID(),
      code,
      name: itemForm.name,
      category: itemForm.category,
      currentStock: Number(itemForm.currentStock),
      minStock: Number(itemForm.minStock),
      unit: itemForm.unit,
      updatedAt: Date.now()
    };

    const updatedItems = editingItemId 
      ? items.map(i => i.id === editingItemId ? newItem : i)
      : [...items, newItem];

    onUpdate({ ...state, slaughterSupplyItems: updatedItems });
    setEditingItemId(null);
    setItemForm({
      name: '',
      category: 'Embalagem',
      currentStock: '',
      minStock: '',
      unit: 'un'
    });
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name) return;

    const existingSupplier = editingSupplierId ? suppliers.find(s => s.id === editingSupplierId) : null;
    const code = existingSupplier?.code || generateCode('F', suppliers);

    const newSupplier: SlaughterSupplier = {
      id: editingSupplierId || crypto.randomUUID(),
      code,
      name: supplierForm.name,
      cnpj: supplierForm.cnpj,
      contact: supplierForm.contact,
      phone: supplierForm.phone,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedSuppliers = editingSupplierId
      ? suppliers.map(s => s.id === editingSupplierId ? newSupplier : s)
      : [...suppliers, newSupplier];

    onUpdate({ ...state, slaughterSuppliers: updatedSuppliers });
    setEditingSupplierId(null);
    setSupplierForm({
      name: '',
      cnpj: '',
      contact: '',
      phone: ''
    });
  };

  const handleRequestStatus = (id: string, status: SlaughterSupplyRequest['status']) => {
    const updatedRequests = requests.map(r => r.id === id ? { ...r, status, updatedAt: Date.now() } : r);
    onUpdate({ ...state, slaughterSupplyRequests: updatedRequests });
  };

  const [requestForm, setRequestForm] = useState({
    itemId: '',
    supplierId: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleSaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.itemId || !requestForm.quantity) return;

    const newRequest: SlaughterSupplyRequest = {
      id: crypto.randomUUID(),
      itemId: requestForm.itemId,
      supplierId: requestForm.supplierId || undefined,
      quantity: Number(requestForm.quantity),
      requesterId: currentUser.id,
      status: 'Pendente',
      date: requestForm.date,
      updatedAt: Date.now()
    };

    onUpdate({ ...state, slaughterSupplyRequests: [...requests, newRequest] });
    setRequestForm({
      itemId: '',
      supplierId: '',
      quantity: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const stats = useMemo(() => {
    const lowStock = items.filter(i => i.currentStock <= i.minStock).length;
    const pendingRequests = requests.filter(r => r.status === 'Pendente').length;
    return { lowStock, pendingRequests };
  }, [items, requests]);

  return (
    <div className="space-y-8">
      {/* Alertas de Suprimentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-[2rem] border flex items-center gap-4 shadow-sm ${stats.lowStock > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
          <div className={`p-3 rounded-xl ${stats.lowStock > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Itens com Estoque Baixo</div>
            <div className={`text-xl font-black ${stats.lowStock > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{stats.lowStock}</div>
          </div>
        </div>
        <div className={`p-6 rounded-[2rem] border flex items-center gap-4 shadow-sm ${stats.pendingRequests > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
          <div className={`p-3 rounded-xl ${stats.pendingRequests > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Solicitações Pendentes</div>
            <div className={`text-xl font-black ${stats.pendingRequests > 0 ? 'text-blue-600' : 'text-slate-800'}`}>{stats.pendingRequests}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveSubTab('inventory')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'inventory' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Estoque de Itens
        </button>
        <button 
          onClick={() => setActiveSubTab('suppliers')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'suppliers' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Fornecedores
        </button>
        <button 
          onClick={() => setActiveSubTab('requests')}
          className={`pb-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'requests' ? 'border-b-2 border-[#344434] text-[#344434]' : 'text-slate-400'}`}
        >
          Solicitações e Requisições
        </button>
      </div>

      {activeSubTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Package className="w-6 h-6" />
                {editingItemId ? 'Editar Item' : 'Novo Item'}
              </h3>
              <form onSubmit={handleSaveItem} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Item</label>
                  <input 
                    type="text" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                    value={itemForm.name}
                    onChange={e => setItemForm({...itemForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={itemForm.category}
                    onChange={e => setItemForm({...itemForm, category: e.target.value as any})}
                  >
                    <option value="Embalagem">Embalagem</option>
                    <option value="Químicos">Químicos</option>
                    <option value="EPI">EPI</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estoque Atual</label>
                    <input 
                      type="number" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={itemForm.currentStock}
                      onChange={e => setItemForm({...itemForm, currentStock: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estoque Mínimo</label>
                    <input 
                      type="number" required 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                      value={itemForm.minStock}
                      onChange={e => setItemForm({...itemForm, minStock: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidade (un, kg, L)</label>
                  <input 
                    type="text" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={itemForm.unit}
                    onChange={e => setItemForm({...itemForm, unit: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  {editingItemId ? 'Salvar Alterações' : 'Cadastrar Item'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Código</th>
                    <th className="px-8 py-5">Item</th>
                    <th className="px-8 py-5">Categoria</th>
                    <th className="px-8 py-5">Estoque</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-[#344434] bg-[#344434]/5 px-2 py-1 rounded-md border border-[#344434]/10">
                          {item.code}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Unidade: {item.unit}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-slate-100 rounded-full text-slate-500">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`text-xs font-black ${item.currentStock <= item.minStock ? 'text-red-500' : 'text-slate-700'}`}>
                          {item.currentStock} / {item.minStock}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {item.currentStock <= item.minStock ? (
                          <span className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase tracking-widest">
                            <AlertTriangle className="w-3 h-3" /> Crítico
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3" /> Normal
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {
                            setEditingItemId(item.id);
                            setItemForm({
                              name: item.name,
                              category: item.category,
                              currentStock: item.currentStock.toString(),
                              minStock: item.minStock.toString(),
                              unit: item.unit
                            });
                          }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => {
                            if (confirm('Deseja excluir este item?')) {
                              onUpdate({ ...state, slaughterSupplyItems: items.filter(i => i.id !== item.id) });
                            }
                          }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhum item em estoque.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'suppliers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <Truck className="w-6 h-6" />
                {editingSupplierId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <form onSubmit={handleSaveSupplier} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome / Razão Social</label>
                  <input 
                    type="text" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                    value={supplierForm.name}
                    onChange={e => setSupplierForm({...supplierForm, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={supplierForm.cnpj}
                    onChange={e => setSupplierForm({...supplierForm, cnpj: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contato</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={supplierForm.contact}
                    onChange={e => setSupplierForm({...supplierForm, contact: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  {editingSupplierId ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Código</th>
                    <th className="px-8 py-5">Fornecedor</th>
                    <th className="px-8 py-5">CNPJ</th>
                    <th className="px-8 py-5">Contato</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map(supplier => (
                    <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-[#344434] bg-[#344434]/5 px-2 py-1 rounded-md border border-[#344434]/10">
                          {supplier.code}
                        </span>
                      </td>
                      <td className="px-8 py-6 font-bold text-slate-800">{supplier.name}</td>
                      <td className="px-8 py-6 text-xs text-slate-500">{supplier.cnpj || '-'}</td>
                      <td className="px-8 py-6">
                        <div className="text-xs font-bold text-slate-700">{supplier.contact || '-'}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{supplier.phone}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {
                            setEditingSupplierId(supplier.id);
                            setSupplierForm({
                              name: supplier.name,
                              cnpj: supplier.cnpj || '',
                              contact: supplier.contact || '',
                              phone: supplier.phone || ''
                            });
                          }} className="p-2 text-slate-300 hover:text-amber-500 transition-colors"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => {
                            if (confirm('Deseja excluir este fornecedor?')) {
                              onUpdate({ ...state, slaughterSuppliers: suppliers.filter(s => s.id !== supplier.id) });
                            }
                          }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhum fornecedor cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'requests' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-xl font-black text-slate-800 mb-8 uppercase tracking-tighter italic flex items-center gap-3">
                <ShoppingCart className="w-6 h-6" />
                Nova Solicitação
              </h3>
              <form onSubmit={handleSaveRequest} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={requestForm.itemId}
                    onChange={e => setRequestForm({...requestForm, itemId: e.target.value})}
                    required
                  >
                    <option value="">Selecione um item</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>[{item.code}] {item.name} ({item.currentStock} {item.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fornecedor (Opcional)</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={requestForm.supplierId}
                    onChange={e => setRequestForm({...requestForm, supplierId: e.target.value})}
                  >
                    <option value="">Selecione um fornecedor</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade</label>
                  <input 
                    type="number" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={requestForm.quantity}
                    onChange={e => setRequestForm({...requestForm, quantity: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date" required 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none text-xs"
                    value={requestForm.date}
                    onChange={e => setRequestForm({...requestForm, date: e.target.value})}
                  />
                </div>
                <button type="submit" className="w-full py-4 bg-[#344434] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-[#2a382a] transition-all">
                  Enviar Solicitação
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Item Solicitado</th>
                    <th className="px-8 py-5">Fornecedor</th>
                    <th className="px-8 py-5">Quantidade</th>
                    <th className="px-8 py-5">Data</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map(req => {
                    const item = items.find(i => i.id === req.itemId);
                    const supplier = suppliers.find(s => s.id === req.supplierId);
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="font-bold text-slate-700">{item?.name || 'Item Desconhecido'}</div>
                          {item && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.code}</div>}
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-600">{supplier?.name || '-'}</div>
                          {supplier && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{supplier.code}</div>}
                        </td>
                        <td className="px-8 py-6 text-xs font-black text-slate-600">{req.quantity} {item?.unit}</td>
                        <td className="px-8 py-6 text-xs text-slate-500">{format(parseISO(req.date), 'dd/MM/yyyy')}</td>
                        <td className="px-8 py-6">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 w-fit ${
                            req.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-600' : 
                            req.status === 'Rejeitado' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {req.status === 'Pendente' && <Clock className="w-3 h-3" />}
                            {req.status === 'Aprovado' && <CheckCircle2 className="w-3 h-3" />}
                            {req.status === 'Rejeitado' && <X className="w-3 h-3" />}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center gap-2">
                            {req.status === 'Pendente' && (
                              <>
                                <button onClick={() => handleRequestStatus(req.id, 'Aprovado')} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
                                <button onClick={() => handleRequestStatus(req.id, 'Rejeitado')} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                              </>
                            )}
                            <button onClick={() => {
                              if (confirm('Deseja excluir esta solicitação?')) {
                                onUpdate({ ...state, slaughterSupplyRequests: requests.filter(r => r.id !== req.id) });
                              }
                            }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Nenhuma solicitação pendente.
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

export default SlaughterSupplies;
