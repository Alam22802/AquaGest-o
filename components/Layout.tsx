
import React, { useState } from 'react';
import { 
  LayoutDashboard, Layers, Box, Utensils, FishOff, Waves, Package, Users, LogOut, Cloud, Scale, Tag, Droplets, Settings, ClipboardList, BookOpen, Menu, X, Home, Bell, Factory
} from 'lucide-react';
import { User, AppState } from '../types.ts';

interface Props {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  state: AppState;
}

const Layout: React.FC<Props> = ({ children, activeTab, setActiveTab, currentUser, onLogout, state }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const pendingUsersCount = state?.users?.filter(u => !u.isApproved).length || 0;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'water', label: 'Qualidade Água', icon: <Droplets className="w-5 h-5" /> },
    { id: 'inventory', label: 'Cadastro Gaiolas', icon: <Box className="w-5 h-5" /> },
    { id: 'maintenance', label: 'Manutenção', icon: <Settings className="w-5 h-5" /> },
    { id: 'protocols', label: 'Modelos de Produção', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'batches', label: 'Lotes (Estoque)', icon: <Tag className="w-5 h-5" /> },
    { id: 'lines', label: 'Linhas/Setores', icon: <Layers className="w-5 h-5" /> },
    { id: 'cages', label: 'Alojamento', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'feed', label: 'Estoque Ração', icon: <Package className="w-5 h-5" /> },
    { id: 'feeding', label: 'Trato Diário', icon: <Utensils className="w-5 h-5" /> },
    { id: 'biometry', label: 'Biometria', icon: <Scale className="w-5 h-5" /> },
    { id: 'mortality', label: 'Mortalidade', icon: <FishOff className="w-5 h-5" /> },
    { id: 'slaughter', label: 'Frigorífico', icon: <Factory className="w-5 h-5" /> },
    { id: 'cloud', label: 'Backup/Nuvem', icon: <Cloud className="w-5 h-5" /> },
    { 
      id: 'users', 
      label: 'Usuários', 
      icon: (
        <div className="relative">
          <Users className="w-5 h-5" />
          {currentUser.isMaster && pendingUsersCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce border border-[#344434]">
              {pendingUsersCount}
            </span>
          )}
        </div>
      ), 
      masterOnly: true 
    },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.masterOnly && !currentUser.isMaster) return false;
    return true;
  });

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setIsMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#344434] text-[#e4e4d4] transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl
        md:relative md:translate-x-0 
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div 
          className="p-6 flex flex-col items-center gap-2 border-b border-black/10 shrink-0 relative"
          style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
               <Waves className="w-6 h-6 text-[#e4e4d4]" />
            </div>
            <h1 className="text-xl font-black text-[#e4e4d4] tracking-tighter italic">AquaGestão</h1>
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-[#e4e4d4] opacity-60">CostaFoods Brasil</span>
          
          <button 
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden absolute right-4 top-4 p-2 text-[#e4e4d4]/50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto scrollbar-hide">
          {filteredMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-[#e4e4d4] text-[#344434] shadow-lg shadow-black/20 font-black' 
                  : 'hover:bg-white/5 text-[#e4e4d4] opacity-80 hover:opacity-100'
              }`}
            >
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-black/10 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-[#e4e4d4] opacity-60 hover:opacity-100 hover:bg-red-500/10 transition-all rounded-xl font-bold" onClick={onLogout}>
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Sair</span>
          </button>
        </div>
      </aside>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header 
          className="bg-white border-b border-slate-200 p-4 flex items-center justify-between md:hidden shrink-0"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 bg-slate-50 rounded-xl text-slate-600 active:scale-95 transition-all relative"
            >
              <Menu className="w-6 h-6" />
              {currentUser.isMaster && pendingUsersCount > 0 && (
                <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <button 
              onClick={() => handleNavClick('dashboard')}
              className={`p-2 rounded-xl active:scale-95 transition-all ${activeTab === 'dashboard' ? 'bg-[#344434] text-white' : 'bg-slate-50 text-slate-600'}`}
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">AquaGestão</h1>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CostaFoods Brasil</p>
          </div>
          <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-lg shadow-md ${currentUser.isMaster ? 'bg-amber-600' : 'bg-[#344434]'}`}>
            {currentUser.name.charAt(0)}
          </div>
        </header>

        <header className="hidden md:flex p-8 justify-between items-center shrink-0">
          <div>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Piscicultura Inteligente • CostaFoods</h2>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">Controle de Produção</h1>
          </div>
          <div className="flex items-center gap-4">
            {currentUser.isMaster && pendingUsersCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-pulse cursor-pointer" onClick={() => setActiveTab('users')}>
                <Bell className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase">{pendingUsersCount} Pendentes</span>
              </div>
            )}
            <div className="text-right">
              <p className="text-xs font-black text-slate-800">{currentUser.name}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">@{currentUser.username}</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl text-[#e4e4d4] flex items-center justify-center font-black text-xl shadow-xl ${currentUser.isMaster ? 'bg-amber-600' : 'bg-[#344434]'}`}>
              {currentUser.name.charAt(0)}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
