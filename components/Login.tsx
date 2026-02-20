
import React, { useState } from 'react';
import { User, AppState } from '../types';
import { Lock, User as UserIcon, LogIn, ArrowLeft, Clock, Eye, EyeOff, ShieldCheck, Cloud, RefreshCw, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { loadState, applyConfigFromLink } from '../store';

interface Props {
  state: AppState;
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
}

const Login: React.FC<Props> = ({ state, onLogin, onRegister }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const isCloudActive = !!state.supabaseConfig?.url;

  const [regData, setRegData] = useState({
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    receiveNotifications: true
  });

  const handleSync = async () => {
    setIsSyncing(true);
    setError('');
    try {
      await loadState();
      window.location.reload();
    } catch (e) {
      setError('Erro ao sincronizar com a nuvem. Verifique sua internet.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplyInviteLink = () => {
    if (applyConfigFromLink(inviteLink)) {
      setSuccessMessage('Configuração de nuvem aplicada! Reiniciando...');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setError('Link de convite inválido. Certifique-se de copiar o link completo.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    const foundUser = state.users.find(u => 
      u.username.trim().toLowerCase() === cleanUser && 
      u.password.trim() === cleanPass
    );

    if (foundUser) {
      if (!foundUser.isApproved) {
        setError('Acesso pendente. Peça ao Administrador para aprovar seu cadastro.');
        return;
      }
      onLogin(foundUser);
    } else {
      setError('Usuário ou senha incorretos.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (regData.password !== regData.confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    if (state.users.some(u => u.username.toLowerCase() === regData.username.toLowerCase())) {
      setError('Este nome de usuário já está em uso.');
      return;
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name: regData.name,
      username: regData.username.toLowerCase(),
      phone: regData.phone,
      email: regData.email,
      password: regData.password,
      isApproved: false, 
      canEdit: true,
      receiveNotifications: regData.receiveNotifications,
      updatedAt: Date.now()
    };

    onRegister(newUser);
    setSuccessMessage('Solicitação enviada com sucesso! Aguarde aprovação.');
    setIsRegistering(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1f1a] p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10">
        
        <div className="bg-[#344434] p-10 text-center relative">
          <div className="flex flex-col items-center">
             <div className="text-[#e4e4d4] text-[9px] font-black mb-3 tracking-[0.35em] uppercase opacity-60">COSTAFOODS BRASIL</div>
             <h1 className="text-4xl font-black text-[#e4e4d4] uppercase tracking-tighter italic leading-none">AquaGestão</h1>
          </div>
          
          {isCloudActive ? (
             <button onClick={handleSync} className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/10 rounded-2xl text-[#e4e4d4] hover:bg-white/20 transition-all border border-white/5 active:scale-95">
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-black uppercase tracking-widest">Sincronizar</span>
             </button>
          ) : (
             <button 
              onClick={() => setShowLinkInput(!showLinkInput)}
              className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-amber-500/20 rounded-2xl text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
             >
                <LinkIcon className="w-3.5 h-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Vincular Nuvem</span>
             </button>
          )}

          {isRegistering && (
            <button onClick={() => setIsRegistering(false)} className="absolute left-6 top-10 text-[#e4e4d4] opacity-50 p-2"><ArrowLeft className="w-6 h-6" /></button>
          )}
        </div>
        
        <div className="p-8">
          {showLinkInput && !isCloudActive && (
            <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-3xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Colar Link de Convite
              </h4>
              <p className="text-[9px] font-bold text-blue-600 uppercase">Se você salvou na tela inicial e perdeu a conexão, cole o link enviado pelo administrador aqui.</p>
              <input 
                type="text" 
                placeholder="Cole o link completo aqui..." 
                className="w-full px-4 py-3 bg-white border border-blue-100 rounded-2xl text-xs font-bold outline-none"
                value={inviteLink}
                onChange={e => setInviteLink(e.target.value)}
              />
              <button onClick={handleApplyInviteLink} className="w-full bg-blue-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                Ativar Nuvem no Celular
              </button>
            </div>
          )}

          {!isCloudActive && !isRegistering && !showLinkInput && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-3">
              <Cloud className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-amber-800 uppercase leading-tight">Modo Local (PWA iOS)</p>
                <p className="text-[9px] font-bold text-amber-700 mt-1 uppercase">
                  O iOS isola o app da tela inicial. Clique em "Vincular Nuvem" e cole o link de convite para sincronizar.
                </p>
              </div>
            </div>
          )}

          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100 mb-6 flex items-center gap-3 animate-pulse">{error}</div>}
          {successMessage && <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl text-xs font-bold border border-emerald-100 mb-6 flex items-center gap-3">{successMessage}</div>}

          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" required autoCapitalize="none" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" placeholder="Usuário" value={username} onChange={e => setUsername(e.target.value)} />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type={showPassword ? "text" : "password"} required className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" className="w-full bg-[#344434] text-[#e4e4d4] py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                Acessar Sistema
              </button>

              <div className="flex flex-col items-center gap-4 pt-4">
                <button type="button" onClick={() => setIsRegistering(true)} className="text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-[#344434]">
                  Solicitar Cadastro
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <h2 className="text-lg font-black text-slate-800 text-center mb-4 uppercase italic">Novo Cadastro</h2>
              <input type="text" required placeholder="Nome Completo" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
              <input type="email" required placeholder="E-mail" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required placeholder="Usuário" autoCapitalize="none" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.username} onChange={e => setRegData({...regData, username: e.target.value})} />
                <input type="text" required placeholder="Celular" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.phone} onChange={e => setRegData({...regData, phone: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="password" required placeholder="Senha" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.password} onChange={e => setRegData({...regData, password: e.target.value})} />
                <input type="password" required placeholder="Repetir" className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm" value={regData.confirmPassword} onChange={e => setRegData({...regData, confirmPassword: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-[#344434] text-[#e4e4d4] py-5 rounded-2xl font-black text-sm uppercase tracking-widest mt-4">Enviar Cadastro</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
