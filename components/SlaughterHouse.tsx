
import React, { useState } from 'react';
import { AppState, User } from '../types';
import { Factory, DollarSign, Users, LayoutDashboard } from 'lucide-react';
import SlaughterOverview from './slaughter/SlaughterOverview';
import SlaughterFinance from './slaughter/SlaughterFinance';
import SlaughterHR from './slaughter/SlaughterHR';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

type SlaughterTab = 'overview' | 'finance' | 'hr';

const SlaughterHouse: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<SlaughterTab>('overview');

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'finance', label: 'Financeiro', icon: DollarSign },
    { id: 'hr', label: 'RH', icon: Users },
  ];

  const renderSubContent = () => {
    switch (activeSubTab) {
      case 'overview': return <SlaughterOverview state={state} onUpdate={onUpdate} currentUser={currentUser} />;
      case 'finance': return <SlaughterFinance state={state} onUpdate={onUpdate} currentUser={currentUser} />;
      case 'hr': return <SlaughterHR state={state} onUpdate={onUpdate} currentUser={currentUser} />;
      default: return <SlaughterOverview state={state} onUpdate={onUpdate} currentUser={currentUser} />;
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Sub-Navigation Header */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SlaughterTab)}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive 
                  ? 'bg-[#344434] text-white shadow-lg shadow-slate-900/20' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderSubContent()}
      </div>
    </div>
  );
};

export default SlaughterHouse;
