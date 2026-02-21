
import React, { useState, useEffect } from 'react';
import { User, AppState, NotificationSettings } from '../types';
import { UserPlus, Trash2, Shield, Phone, Mail, Key, Eye, Edit3, User as UserIcon, CheckCircle, XCircle, Clock, Bell, Settings2, Save, X, AlertTriangle, Cloud, Database, Copy, RefreshCw } from 'lucide-react';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const UserManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showDbConfigId, setShowDbConfigId] = useState<string | null>(null);
  
  if (!currentUser.isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Shield className="w-16 h-16 text-slate-200" />
        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Acesso Restrito</h3>
        <p className="text-slate-400 font-bold uppercase text-xs max-w-md">Apenas o administrador mestre tem permissão para gerenciar usuários e configurações de alertas.</p>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    canEdit: true,
    receiveNotifications: true
  });

  const [dbConfig, setDbConfig] = useState({
    url: '',
    key: ''
  });

  const masterUser = state.users.find(u => u.isMaster);
  const [masterEmail, setMasterEmail] = useState(masterUser?.email || '');
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(
    state.notificationSettings || {
      notifyMasterOnNewUser: true,
      notifyOnLowFeed: true,
      notifyOnWaterCritical: true,
      systemEmailSender: masterUser?.email || 'noreply@aquagestao.com'
    }
  );

  // Sincroniza o e-mail do mestre se houver mudança externa
  useEffect(() => {
    if (masterUser?.email) {
      setMasterEmail(masterUser.email);
    }
  }, [masterUser?.email]);

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.password || !formData.username) return;

    if (editingUserId) {
      // Editar usuário existente (incluindo o Mestre)
      onUpdate({
        ...state,
        users: state.users.map(u => u.id === editingUserId ? {
          ...u,
          name: formData.name,
          username: formData.username,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          canEdit: u.isMaster ? true : formData.canEdit, // Mestre sempre pode editar
          receiveNotifications: formData.receiveNotifications,
          updatedAt: Date.now()
        } : u)
      });
      setEditingUserId(null);
    } else {
      // Criar novo usuário
      const newUser: User = {
        id: crypto.randomUUID(),
        name: formData.name,
        username: formData.username,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        isApproved: true,
        canEdit: formData.canEdit,
        receiveNotifications: formData.receiveNotifications,
        updatedAt: Date.now(),
        // Replicar config do mestre por padrão
        supabaseConfig: state.supabaseConfig
      };

      onUpdate({
        ...state,
        users: [...state.users, newUser]
      });
    }
    
    setFormData({ name: '', username: '', phone: '', email: '', password: '', canEdit: true, receiveNotifications: true });
  };

  const handleSaveDbConfig = (userId: string) => {
    onUpdate({
      ...state,
      users: state.users.map(u => u.id === userId ? {
        ...u,
        supabaseConfig: dbConfig.url && dbConfig.key ? { ...dbConfig } : undefined,
        updatedAt: Date.now()
      } : u)
    });
    setShowDbConfigId(null);
    alert('Configuração de banco de dados atualizada para o usuário.');
  };

  const replicateMasterConfig = (userId: string) => {
    if (!state.supabaseConfig) {
      alert('Configuração do mestre não encontrada.');
      return;
    }
    onUpdate({
      ...state,
      users: state.users.map(u => u.id === userId ? {
        ...u,
        supabaseConfig: state.supabaseConfig,
        updatedAt: Date.now()
      } : u)
    });
    alert('Configuração do mestre replicada com sucesso.');
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      phone: user.phone || '',
      email: user.email,
      password: user.password,
      canEdit: user.canEdit,
      receiveNotifications: user.receiveNotifications
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEditDbConfig = (user: User) => {
    setShowDbConfigId(user.id);
    setDbConfig({
      url: user.supabaseConfig?.url || '',
      key: user.supabaseConfig?.key || ''
    });
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setFormData({ name: '', username: '', phone: '', email: '', password: '', canEdit: true, receiveNotifications: true });
  };

  const saveSystemSettings = () => {
    onUpdate({
      ...state,
      notificationSettings: {
        ...notifSettings,
        systemEmailSender: masterEmail,
        updatedAt: Date.now()
      },
      users: state.users.map(u => u.isMaster ? { ...u, email: masterEmail, updatedAt: Date.now() } : u)
    });
    alert('E-mail de notificações e configurações salvas com sucesso!');
  };

  const approveUser = (id: string) => {
    onUpdate({
      ...state,
      users: state.users.map(u => u.id === id ? { ...u, isApproved: true, updatedAt: Date.now() } : u)
    });
  };

  const removeUser = (id: string) => {
    const user = state.users.find(u => u.id === id);
    if (user?.isMaster) {
      alert('Não é possível remover o administrador mestre.');
      return;
    }
    if (!confirm(`Deseja remover permanentemente o usuário ${user?.name}?`)) return;
    
    // Marcar como deletado para a sincronização na nuvem
    const updatedDeletedIds = Array.from(new Set([...(state.deletedIds || []), id]));
    
    onUpdate({
      ...state,
      users: state.users.filter(u => u.id !== id),
      deletedIds: updatedDeletedIds
    });
  };

  const pendingUsers = state.users.filter(u => !u.isApproved);
  const approvedUsers = state.users.filter(u => u.isApproved);

  return (
    <div className="space-y-8 pb-20">
      {/* Modal de Configuração de Banco de Dados */}
      {showDbConfigId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter italic">
                  <Database className="w-6 h-6 text-blue-500" /> Configurar Banco de Dados
                </h3>
                <button onClick={() => setShowDbConfigId(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Supabase URL</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-blue-500/30 transition-all"
                    placeholder="https://xyz.supabase.co"
                    value={dbConfig.url}
                    onChange={(e) => setDbConfig({...dbConfig, url: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Supabase Anon Key</label>
                  <input 
                    type="password" 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-blue-500/30 transition-all"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={dbConfig.key}
                    onChange={(e) => setDbConfig({...dbConfig, key: e.target.value})}
                  />
                </div>
                
                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={() => handleSaveDbConfig(showDbConfigId)}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    Salvar Configuração
                  </button>
                  <button 
                    onClick={() => replicateMasterConfig(showDbConfigId)}
                    className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                  >
                    <Copy className="w-4 h-4" /> Replicar Configuração do Mestre
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configurações Globais de Alertas */}
      <div className="bg-[#344434] p-8 rounded-[2.5rem] shadow-2xl border border-white/5 text-[#e4e4d4] overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-lg font-black mb-6 flex items-center gap-3 uppercase tracking-tighter italic">
            <Settings2 className="w-6 h-6 text-emerald-400" /> Central de Alertas & Notificações
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black opacity-50 uppercase mb-2 tracking-[0.2em]">E-mail para Recebimento de Alertas (Master)</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity" />
                  <input 
                    type="email" 
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/10 rounded-2xl outline-none font-bold text-sm focus:bg-white/20 focus:border-white/30 transition-all text-white"
                    placeholder="exemplo@fazenda.com"
                    value={masterEmail}
                    onChange={(e) => setMasterEmail(e.target.value)}
                  />
                </div>
                <p className="text-[9px] font-bold opacity-40 mt-2 uppercase tracking-tight">Este e-mail receberá avisos de novos usuários e estoque baixo.</p>
              </div>
              <div className="space-y-3 p-5 bg-black/20 rounded-2xl border border-white/5">
                 <label className="block text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Gatilhos Ativos</label>
                 <label className="flex items-center gap-3 cursor-pointer group hover:opacity-100 opacity-70 transition-opacity">
                   <input type="checkbox" className="w-4 h-4 rounded-lg bg-white/10 border-white/20 text-emerald-500 focus:ring-0" checked={notifSettings.notifyMasterOnNewUser} onChange={e => setNotifSettings({...notifSettings, notifyMasterOnNewUser: e.target.checked})} />
                   <span className="text-[11px] font-black uppercase tracking-widest">Novos pedidos de cadastro</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group hover:opacity-100 opacity-70 transition-opacity">
                   <input type="checkbox" className="w-4 h-4 rounded-lg bg-white/10 border-white/20 text-emerald-500 focus:ring-0" checked={notifSettings.notifyOnLowFeed} onChange={e => setNotifSettings({...notifSettings, notifyOnLowFeed: e.target.checked})} />
                   <span className="text-[11px] font-black uppercase tracking-widest">Alertas de Estoque de Ração</span>
                 </label>
              </div>
            </div>
            <div className="flex flex-col justify-end">
              <button 
                onClick={saveSystemSettings}
                className="w-full bg-emerald-500 text-[#344434] py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/10 active:scale-95"
              >
                <Save className="w-5 h-5" /> Atualizar Configurações do Master
              </button>
            </div>
          </div>
        </div>
        <Bell className="absolute -right-10 -bottom-10 w-48 h-48 opacity-5 rotate-12" />
      </div>

      {/* Seção de Pendentes */}
      {pendingUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-lg shadow-amber-200/5">
          <h3 className="text-amber-800 font-black uppercase tracking-widest text-xs flex items-center gap-2 mb-4 italic">
            <Clock className="w-4 h-4 animate-pulse" /> Pendentes de Aprovação ({pendingUsers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingUsers.map(user => (
              <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm">{user.name}</h4>
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Pendente</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2"><UserIcon className="w-3 h-3 opacity-30"/> @{user.username}</div>
                    <div className="flex items-center gap-2"><Mail className="w-3 h-3 opacity-30"/> {user.email}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => approveUser(user.id)}
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-600/10"
                  >
                    <CheckCircle className="w-3 h-3" /> Aprovar
                  </button>
                  <button 
                    onClick={() => removeUser(user.id)}
                    className="flex-1 bg-slate-100 text-slate-400 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-500 transition-all"
                  >
                    <XCircle className="w-3 h-3" /> Negar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <div className={`bg-white p-8 rounded-[2rem] shadow-sm border transition-all ${editingUserId ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter italic">
                {editingUserId ? <Edit3 className="w-5 h-5 text-amber-500" /> : <UserPlus className="w-5 h-5 text-emerald-500" />}
                {editingUserId ? 'Editar Dados do Usuário' : 'Novo Cadastro Manual'}
              </h3>
              {editingUserId && (
                <button onClick={cancelEdit} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-all">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Nome Completo</label>
                <input type="text" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-emerald-500/30 transition-all" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Nome de Usuário (Login)</label>
                <input type="text" required disabled={!!editingUserId && state.users.find(u => u.id === editingUserId)?.isMaster} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm disabled:opacity-50" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">E-mail</label>
                <input type="email" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Senha de Acesso</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input type="text" required className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <input type="checkbox" id="man_notif" className="w-4 h-4 rounded text-[#344434] focus:ring-0" checked={formData.receiveNotifications} onChange={e => setFormData({...formData, receiveNotifications: e.target.checked})} />
                <label htmlFor="man_notif" className="text-[10px] font-black text-[#344434] uppercase tracking-widest cursor-pointer leading-none">Habilitar Alertas de E-mail</label>
              </div>

              {!state.users.find(u => u.id === editingUserId)?.isMaster && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Nível de Acesso</label>
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setFormData({...formData, canEdit: true})} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${formData.canEdit ? 'bg-[#344434] border-[#344434] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>EDITOR</button>
                     <button type="button" onClick={() => setFormData({...formData, canEdit: false})} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${!formData.canEdit ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>LEITOR</button>
                  </div>
                </div>
              )}

              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${editingUserId ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-[#344434] hover:bg-[#2a382a] shadow-slate-900/20'}`}>
                {editingUserId ? 'Confirmar Edição' : 'Cadastrar e Ativar'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Controle de Membros</h3>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{approvedUsers.length} Membros Ativos</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedUsers.map(user => (
              <div key={user.id} className={`bg-white p-6 rounded-[2rem] shadow-sm border transition-all ${editingUserId === user.id ? 'border-amber-400 ring-4 ring-amber-50' : 'border-slate-200 hover:border-[#344434]'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${user.isMaster ? 'bg-amber-500 shadow-amber-500/20' : (user.canEdit ? 'bg-[#344434] shadow-slate-900/20' : 'bg-slate-200 text-slate-500')}`}>
                      {user.isMaster ? <Shield className="w-6 h-6" /> : (user.canEdit ? <Edit3 className="w-6 h-6" /> : <Eye className="w-6 h-6" />)}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm leading-none mb-1">{user.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">@{user.username}</span>
                        {user.receiveNotifications && <Bell className="w-3 h-3 text-emerald-500" />}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEditDbConfig(user)} className={`p-2.5 rounded-xl transition-all ${user.supabaseConfig ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-300'} hover:bg-blue-100`} title="Configurar Banco de Dados">
                      <Database className="w-4 h-4" />
                    </button>
                    <button onClick={() => startEditUser(user)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all" title="Editar Usuário">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!user.isMaster && (
                      <button onClick={() => removeUser(user.id)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Remover Usuário">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Status de Sincronização */}
                <div className="mt-4 flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Cloud className={`w-3.5 h-3.5 ${user.lastSync ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Última Sincronia:</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-600 uppercase">
                    {user.lastSync ? new Date(user.lastSync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                  </span>
                </div>

                <div className="mt-4 pt-5 border-t border-slate-50 grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                    <Mail className="w-3.5 h-3.5 opacity-30"/> 
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 flex-1">
                      <Phone className="w-3.5 h-3.5 opacity-30"/> {user.phone || '(00) 00000-0000'}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-black text-slate-400">
                      <Key className="w-3 h-3 opacity-30"/> {user.password}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
