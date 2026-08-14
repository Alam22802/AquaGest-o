
import React, { useState, useEffect } from 'react';
import { User, AppState, NotificationSettings } from '../types';
import { UserPlus, Trash2, Shield, Phone, Mail, Key, Eye, Edit3, User as UserIcon, CheckCircle, XCircle, Clock, Bell, Settings2, Save, X, AlertTriangle, Cloud, Database, Copy, RefreshCw, Share2, Link as LinkIcon, CheckCircle2, Layers } from 'lucide-react';
import { generateInviteLink, forceAdminMassSync } from '../store';

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
    receiveNotifications: true,
    allowedTabs: [] as string[]
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

  const [copiedInviteLink, setCopiedInviteLink] = useState(false);
  const [isSyncingMass, setIsSyncingMass] = useState(false);
  const [tempPassModalData, setTempPassModalData] = useState<{
    userId: string;
    userName: string;
    username: string;
    phone?: string;
    email?: string;
    tempPass: string;
    isCustom?: boolean;
  } | null>(null);
  const [copiedTempPass, setCopiedTempPass] = useState(false);
  const [customPasswordUser, setCustomPasswordUser] = useState<User | null>(null);
  const [customPasswordValue, setCustomPasswordValue] = useState('');

  // Sincroniza o e-mail do mestre se houver mudança externa
  useEffect(() => {
    if (masterUser?.email) {
      setMasterEmail(masterUser.email);
    }
  }, [masterUser?.email]);

  const handleCopyInviteLink = () => {
    const inviteUrl = generateInviteLink(state.supabaseConfig);
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInviteLink(true);
    setTimeout(() => setCopiedInviteLink(false), 3500);
  };

  const handleForceMassSync = async () => {
    if (!confirm('Deseja realizar a Sincronização em Massa com o Login Admin?\n\nEsta ação enviará todos os dados atuais do Administrador Mestre para a nuvem como fonte única da verdade. Todos os outros usuários passarão a ver exatamente as mesmas informações do Admin.')) {
      return;
    }

    setIsSyncingMass(true);
    try {
      const res = await forceAdminMassSync(state, state.supabaseConfig);
      if (res.success) {
        onUpdate({
          ...state,
          lastSync: Date.now()
        });
      }
      alert(res.message);
    } catch (err: any) {
      alert('Erro ao realizar sincronização em massa: ' + (err?.message || err));
    } finally {
      setIsSyncingMass(false);
    }
  };

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
          isApproved: true, // Ensure it's approved when saved from the form
          canEdit: u.isMaster ? true : formData.canEdit, // Mestre sempre pode editar
          allowedTabs: u.isMaster ? undefined : formData.allowedTabs,
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
        allowedTabs: formData.allowedTabs,
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
    
    setFormData({ 
      name: '', 
      username: '', 
      phone: '', 
      email: '', 
      password: '', 
      canEdit: true, 
      receiveNotifications: true,
      allowedTabs: []
    });
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
      receiveNotifications: user.receiveNotifications,
      allowedTabs: user.allowedTabs || []
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
    setFormData({ 
      name: '', 
      username: '', 
      phone: '', 
      email: '', 
      password: '', 
      canEdit: true, 
      receiveNotifications: true,
      allowedTabs: []
    });
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

  const approveUser = (user: User) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      username: user.username,
      phone: user.phone || '',
      email: user.email,
      password: user.password,
      canEdit: true, // Default to editor on approval
      receiveNotifications: user.receiveNotifications,
      allowedTabs: user.allowedTabs || ['dashboard', 'feeding', 'biometry', 'mortality'] // Default tabs for new users
    });
    // Mark as approved in the form data so it saves as approved
    // We'll handle the actual isApproved: true in handleSaveUser
    alert('Configure as permissões e abas permitidas para aprovar o usuário.');
  };

  const generateTempPassword = (id: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let tempPass = '';
    for (let i = 0; i < 6; i++) {
      tempPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    onUpdate({
      ...state,
      users: state.users.map(u => u.id === id ? { 
        ...u, 
        password: tempPass, 
        needsPasswordReset: true, 
        passwordResetRequested: false,
        updatedAt: Date.now() 
      } : u)
    });
    
    const user = state.users.find(u => u.id === id);
    if (user) {
      setTempPassModalData({
        userId: user.id,
        userName: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        tempPass: tempPass,
        isCustom: false
      });
      setCopiedTempPass(false);
    }
  };

  const handleSaveCustomPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPasswordUser || !customPasswordValue.trim()) return;

    const newPass = customPasswordValue.trim();

    onUpdate({
      ...state,
      users: state.users.map(u => u.id === customPasswordUser.id ? {
        ...u,
        password: newPass,
        needsPasswordReset: true,
        passwordResetRequested: false,
        updatedAt: Date.now()
      } : u)
    });

    setTempPassModalData({
      userId: customPasswordUser.id,
      userName: customPasswordUser.name,
      username: customPasswordUser.username,
      phone: customPasswordUser.phone,
      email: customPasswordUser.email,
      tempPass: newPass,
      isCustom: true
    });
    setCopiedTempPass(false);
    setCustomPasswordUser(null);
    setCustomPasswordValue('');
  };

  const handleCopyTempPass = (pass: string) => {
    navigator.clipboard.writeText(pass);
    setCopiedTempPass(true);
    setTimeout(() => setCopiedTempPass(false), 3000);
  };

  const handleSendWhatsApp = (userPhone: string | undefined, userName: string, pass: string) => {
    const cleanPhone = (userPhone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(`Olá ${userName},\n\nSua nova senha de acesso ao sistema *AquaGestão* é:\n🔑 *${pass}*\n\nAo fazer o primeiro login com essa senha, o sistema solicitará que você cadastre sua nova senha definitiva.`);
    const waUrl = cleanPhone.length >= 10 ? `https://wa.me/${phoneWithCountry}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank');
  };

  const unlockUserAccess = (id: string) => {
    onUpdate({
      ...state,
      users: state.users.map(u => u.id === id ? {
        ...u,
        blockedDueToInactivity: false,
        accessUnlockRequested: false,
        isApproved: true,
        lastLoginAt: new Date().toISOString(),
        updatedAt: Date.now()
      } : u)
    });
    const user = state.users.find(u => u.id === id);
    alert(`Acesso do usuário ${user?.name || ''} liberado com sucesso!`);
  };

  const removeUser = (id: string) => {
    const user = state.users.find(u => u.id === id);
    if (user?.isMaster) {
      alert('Não é possível remover o administrador mestre.');
      return;
    }
    if (!confirm(`Deseja remover o usuário ${user?.name}? Ele perderá o acesso ao sistema, mas os lançamentos históricos serão preservados.`)) return;
    
    // Marcar como deletado para a sincronização na nuvem
    const updatedDeletedIds = Array.from(new Set([...(state.deletedIds || []), id]));
    
    onUpdate({
      ...state,
      users: state.users.filter(u => u.id !== id),
      deletedIds: updatedDeletedIds
    });
  };

  const pendingUsers = state.users.filter(u => !u.isApproved);
  const resetRequests = state.users.filter(u => u.passwordResetRequested);
  const blockedUsers = state.users.filter(u => u.blockedDueToInactivity || u.accessUnlockRequested);
  const approvedUsers = state.users.filter(u => u.isApproved && !u.blockedDueToInactivity);

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

      {/* Modal de Senha Gerada / Definida */}
      {tempPassModalData && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-emerald-100">
            <div className="bg-emerald-600 p-6 text-white text-center relative">
              <button 
                onClick={() => setTempPassModalData(null)}
                className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2 text-white shadow-inner">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black uppercase tracking-tight">Nova Senha de Acesso Pronta</h3>
              <p className="text-xs text-emerald-100 font-bold mt-1">
                {tempPassModalData.userName} (@{tempPassModalData.username})
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Senha de Acesso</span>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl font-black tracking-widest font-mono text-slate-800 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm select-all">
                    {tempPassModalData.tempPass}
                  </span>
                  <button
                    onClick={() => handleCopyTempPass(tempPassModalData.tempPass)}
                    className={`p-3 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all ${
                      copiedTempPass ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-700'
                    }`}
                    title="Copiar Senha"
                  >
                    {copiedTempPass ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span className="text-[10px] uppercase font-bold">{copiedTempPass ? 'Copiada!' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  Ao realizar o login com esta senha, o sistema exigirá que o usuário cadastre sua senha definitiva.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleSendWhatsApp(tempPassModalData.phone, tempPassModalData.userName, tempPassModalData.tempPass)}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Share2 className="w-4 h-4" /> Enviar no WhatsApp
                </button>

                <button
                  onClick={() => setTempPassModalData(null)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Digitar Nova Senha Manual */}
      {customPasswordUser && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-7">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5 uppercase tracking-tighter italic">
                  <Key className="w-5 h-5 text-amber-500" /> Definir Senha Manualmente
                </h3>
                <button 
                  onClick={() => { setCustomPasswordUser(null); setCustomPasswordValue(''); }} 
                  className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4 font-bold">
                Defina uma nova senha para <span className="text-slate-800 font-black">{customPasswordUser.name}</span> (@{customPasswordUser.username}).
              </p>

              <form onSubmit={handleSaveCustomPassword} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1 tracking-widest">Nova Senha</label>
                  <input
                    type="text"
                    required
                    placeholder="Digite a nova senha..."
                    value={customPasswordValue}
                    onChange={(e) => setCustomPasswordValue(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:bg-white focus:border-amber-500/40 transition-all"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Salvar e Notificar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      generateTempPassword(customPasswordUser.id);
                      setCustomPasswordUser(null);
                      setCustomPasswordValue('');
                    }}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Ou Gerar Senha Aleatória
                  </button>
                </div>
              </form>
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

      {/* Ações do Administrador: Sincronismo em Massa e Link de Convite (24h) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Sincronismo em Massa */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-8 rounded-[2.5rem] text-white shadow-2xl border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between space-y-6">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight italic">Sincronismo em Massa</h3>
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Login Admin • Espelhamento Global</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[9px] font-black uppercase tracking-widest">
                Visão Única
              </span>
            </div>

            <p className="text-xs font-medium text-slate-300 leading-relaxed">
              Replica e força os dados do **Administrador Mestre** para a nuvem e servidor central. Utilize esta função para garantir que todos os funcionários e usuários vejam exatamente as mesmas informações e relatórios.
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <button
              onClick={handleForceMassSync}
              disabled={isSyncingMass}
              className="w-full py-4 px-6 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/25 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingMass ? 'animate-spin' : ''}`} />
              {isSyncingMass ? 'Sincronizando em Massa...' : 'Sincronizar Todos os Usuários com Dados Admin'}
            </button>
          </div>
          
          <Layers className="absolute -right-8 -bottom-8 w-40 h-40 opacity-5 -rotate-12 pointer-events-none" />
        </div>

        {/* Card 2: Link de Convite (Validade 24h) */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl border border-emerald-500/20 relative overflow-hidden flex flex-col justify-between space-y-6">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                  <Share2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight italic">Convite para Novos Usuários</h3>
                  <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest">Link com Validade de 24h</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expira em 24h
              </span>
            </div>

            <p className="text-xs font-medium text-slate-300 leading-relaxed">
              Gere o link de compartilhamento para que novos operadores e funcionários vinculem automaticamente a nuvem ao abrir a URL. **Se não for utilizado dentro de 24 horas, o link expira automaticamente.**
            </p>
          </div>

          <div className="relative z-10 pt-2">
            <button
              onClick={handleCopyInviteLink}
              className={`w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                copiedInviteLink
                  ? 'bg-emerald-400 text-slate-950 shadow-emerald-400/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
              }`}
            >
              {copiedInviteLink ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  Link Copiado! (Validade de 24 Horas)
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Copiar Link de Convite (Válido por 24h)
                </>
              )}
            </button>
          </div>

          <Share2 className="absolute -right-8 -bottom-8 w-40 h-40 opacity-5 -rotate-12 pointer-events-none" />
        </div>

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
                    onClick={() => approveUser(user)}
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

      {/* Seção de Recuperação de Senha */}
      {resetRequests.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 shadow-lg shadow-red-200/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-red-800 font-black uppercase tracking-widest text-xs flex items-center gap-2 italic">
              <AlertTriangle className="w-4 h-4 animate-pulse" /> Solicitações de Nova Senha ({resetRequests.length})
            </h3>
            <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-3 py-1 rounded-full uppercase tracking-wider">
              Ação Requerida
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resetRequests.map(user => (
              <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm">{user.name}</h4>
                    <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Esqueci Senha</span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2"><UserIcon className="w-3 h-3 opacity-30"/> @{user.username}</div>
                    <div className="flex items-center gap-2"><Mail className="w-3 h-3 opacity-30"/> {user.email}</div>
                    {user.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3 opacity-30"/> {user.phone}</div>}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => generateTempPassword(user.id)}
                      className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-red-700 shadow-lg shadow-red-600/10 transition-all active:scale-95"
                      title="Gerar senha temporária automática"
                    >
                      <RefreshCw className="w-3 h-3" /> Gerar Senha
                    </button>
                    <button 
                      onClick={() => { setCustomPasswordUser(user); setCustomPasswordValue(''); }}
                      className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-slate-700 shadow-sm transition-all active:scale-95"
                      title="Digitar uma senha específica para o usuário"
                    >
                      <Key className="w-3 h-3" /> Digitar Senha
                    </button>
                    <button 
                      onClick={() => {
                        onUpdate({
                          ...state,
                          users: state.users.map(u => u.id === user.id ? { ...u, passwordResetRequested: false, updatedAt: Date.now() } : u)
                        });
                      }}
                      className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"
                      title="Dispensar solicitação"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Usuários Bloqueados por Inatividade */}
      {blockedUsers.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-[2rem] p-6 shadow-lg shadow-rose-200/5">
          <h3 className="text-rose-800 font-black uppercase tracking-widest text-xs flex items-center gap-2 mb-4 italic">
            <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" /> Usuários Bloqueados por Inatividade / Solicitando Liberação ({blockedUsers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blockedUsers.map(user => (
              <div key={user.id} className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm">{user.name}</h4>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${user.accessUnlockRequested ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>
                      {user.accessUnlockRequested ? 'Solicitou Liberação' : 'Inativo > 30 Dias'}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500 font-bold">
                    <div className="flex items-center gap-2"><UserIcon className="w-3 h-3 opacity-30"/> @{user.username}</div>
                    <div className="flex items-center gap-2"><Mail className="w-3 h-3 opacity-30"/> {user.email}</div>
                    <div className="flex items-center gap-2 text-rose-600"><Clock className="w-3 h-3 opacity-60"/> Úl. Acesso: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('pt-BR') : 'Sem registro'}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => unlockUserAccess(user.id)}
                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-600/10"
                  >
                    <CheckCircle className="w-3 h-3" /> Liberar Acesso
                  </button>
                  <button 
                    onClick={() => removeUser(user.id)}
                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
                    title="Excluir Usuário"
                  >
                    <Trash2 className="w-4 h-4" />
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
                  <input type="password" required className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <input type="checkbox" id="man_notif" className="w-4 h-4 rounded text-[#344434] focus:ring-0" checked={formData.receiveNotifications} onChange={e => setFormData({...formData, receiveNotifications: e.target.checked})} />
                <label htmlFor="man_notif" className="text-[10px] font-black text-[#344434] uppercase tracking-widest cursor-pointer leading-none">Habilitar Alertas de E-mail</label>
              </div>

              {!state.users.find(u => u.id === editingUserId)?.isMaster && (
                <>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Nível de Acesso</label>
                    <div className="flex gap-3">
                       <button type="button" onClick={() => setFormData({...formData, canEdit: true})} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${formData.canEdit ? 'bg-[#344434] border-[#344434] text-white' : 'bg-white border-slate-200 text-slate-400'}`}>EDITOR</button>
                       <button type="button" onClick={() => setFormData({...formData, canEdit: false})} className={`flex-1 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${!formData.canEdit ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>LEITOR</button>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Acesso às Abas</label>
                      {(() => {
                        const allTabs = [
                          'biometry', 'inventory', 'feed', 'slaughter', 'capex', 
                          'lines', 'batches', 'maintenance', 'protocols', 'mortality', 
                          'cages', 'feeding', 'cloud'
                        ];
                        const isAllSelected = allTabs.every(id => (formData.allowedTabs || []).includes(id));
                        return (
                          <button 
                            type="button"
                            onClick={() => {
                              if (isAllSelected) {
                                setFormData({...formData, allowedTabs: []});
                              } else {
                                setFormData({...formData, allowedTabs: allTabs});
                              }
                            }}
                            className={`text-[9px] font-black uppercase tracking-tighter px-2 py-1 rounded-md transition-all ${isAllSelected ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                          >
                            {isAllSelected ? 'Desmarcar Tudo' : 'Marcar Tudo'}
                          </button>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                      {[
                        { id: 'biometry', label: 'Biometria' },
                        { id: 'inventory', label: 'Cadastro Gaiolas' },
                        { id: 'feed', label: 'Estoque Ração' },
                        { id: 'slaughter', label: 'Frigorífico' },
                        { id: 'capex', label: 'Investimentos CAPEX' },
                        { id: 'lines', label: 'Linhas/Setores' },
                        { id: 'batches', label: 'Lotes (Estoque)' },
                        { id: 'maintenance', label: 'Manutenção' },
                        { id: 'protocols', label: 'Modelos de Produção' },
                        { id: 'mortality', label: 'Mortalidade' },
                        { id: 'cages', label: 'Povoamento' },
                        { id: 'feeding', label: 'Trato Diário' },
                        { id: 'cloud', label: 'Backup/Nuvem' }
                      ].map(tab => (
                        <label key={tab.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-500 transition-all">
                          <input 
                            type="checkbox" 
                            className="w-3 h-3 rounded text-emerald-500 focus:ring-0"
                            checked={(formData.allowedTabs || []).includes(tab.id)}
                            onChange={e => {
                              const currentTabs = formData.allowedTabs || [];
                              const newTabs = e.target.checked 
                                ? [...currentTabs, tab.id]
                                : currentTabs.filter(t => t !== tab.id);
                              setFormData({...formData, allowedTabs: newTabs});
                            }}
                          />
                          <span className="text-[9px] font-black text-slate-600 uppercase truncate">{tab.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-slate-800 uppercase tracking-tighter text-sm leading-none">{user.name}</h4>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${user.canEdit ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                          {user.canEdit ? 'Editor' : 'Leitor'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">@{user.username}</span>
                        {user.receiveNotifications && <Bell className="w-3 h-3 text-emerald-500" />}
                      </div>
                      {!user.isMaster && user.allowedTabs && user.allowedTabs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {user.allowedTabs.map(tabId => (
                            <span key={tabId} className="text-[7px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              {tabId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => { setCustomPasswordUser(user); setCustomPasswordValue(''); }} 
                      className="p-2.5 bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" 
                      title="Redefinir / Alterar Senha"
                    >
                      <Key className="w-4 h-4" />
                    </button>
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
                      <Key className="w-3 h-3 opacity-30"/> {user.password.replace(/./g, '*')}
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
