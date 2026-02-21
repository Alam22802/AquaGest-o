
import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { 
  Cloud, Database, RefreshCw, CheckCircle2, Share2, Link as LinkIcon, 
  FileUp, Globe, AlertCircle, AlertTriangle, Copy, Import, Server, Save, 
  ExternalLink, Info, Activity, ShieldCheck, XCircle, Terminal
} from 'lucide-react';
import { exportData, getSupabase, ensureStateIntegrity, applyConfigFromLink } from '../store';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
}

const CloudSettings: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  if (!currentUser.isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <Cloud className="w-16 h-16 text-slate-200" />
        <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Acesso Restrito</h3>
        <p className="text-slate-400 font-bold uppercase text-xs max-w-md">Apenas o administrador mestre tem permissão para configurar a sincronização em nuvem.</p>
      </div>
    );
  }

  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');
  const [errorMessage, setErrorMessage] = useState('');
  const [config, setConfig] = useState({ url: '', key: '' });
  const [copiedLink, setCopiedLink] = useState(false);
  const [manualLink, setManualLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (state.supabaseConfig) {
      setConfig(state.supabaseConfig);
      testConnection(state.supabaseConfig);
    }
  }, [state.supabaseConfig]);

  const testConnection = async (conf = config) => {
    if (!conf.url || !conf.key) return;
    setIsTesting(true);
    setConnectionStatus('none');
    try {
      const supabase = getSupabase(conf);
      if (!supabase) throw new Error("Chaves inválidas");
      
      const { error } = await supabase.from('farm_data').select('id').limit(1).maybeSingle();
      
      if (error) {
        if (error.message.includes('relation "farm_data" does not exist')) {
          throw new Error("Tabela 'farm_data' não encontrada. Você executou o SQL?");
        }
        throw error;
      }
      setConnectionStatus('success');
    } catch (err: any) {
      setConnectionStatus('error');
      setErrorMessage(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfig = () => {
    if (!config.url || !config.url.startsWith('http')) {
      alert('URL do Supabase inválida. Deve começar com https://');
      return;
    }
    const newConfig = { ...config };
    localStorage.setItem('aquagestao_supabase_config', JSON.stringify(newConfig));
    onUpdate({ ...state, supabaseConfig: newConfig });
    testConnection(newConfig);
  };

  const handleManualLinkImport = () => {
    if (applyConfigFromLink(manualLink)) {
      alert('Configuração importada! O app irá reiniciar.');
      window.location.reload();
    } else {
      alert('Link de convite inválido.');
    }
  };

  const syncNow = async () => {
    const supabase = getSupabase(state.supabaseConfig);
    if (!supabase) {
      alert('Configure a conexão primeiro!');
      return;
    }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('farm_data').select('state').eq('id', 'singleton').maybeSingle();
      if (error) throw error;
      
      if (data?.state) {
        if (confirm('Dados encontrados na nuvem. Deseja mesclar com seus dados locais?')) {
          const mergedState = ensureStateIntegrity(state, data.state, 'remote');
          onUpdate(mergedState);
          alert('Sincronização concluída!');
        }
      } else {
        const { error: upsertError } = await supabase.from('farm_data').upsert({ id: 'singleton', state, last_sync: new Date().toISOString() });
        if (upsertError) throw upsertError;
        alert('Dados salvos na nuvem pela primeira vez!');
      }
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const copySql = () => {
    const sql = `create table if not exists farm_data (
  id text primary key,
  state jsonb,
  last_sync timestamp with time zone default now()
);
alter table farm_data enable row level security;
create policy "Allow All Access" on farm_data for all using (true) with check (true);`;
    navigator.clipboard.writeText(sql);
    alert('Código SQL copiado! Cole no SQL Editor do Supabase.');
  };

  const copyInviteLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const inviteUrl = `${baseUrl}?s_url=${encodeURIComponent(config.url)}&s_key=${encodeURIComponent(config.key)}`;
    // Fix: Removed incorrect navigator.clipboard.get() call as it is not a standard method and was unused
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      
      {/* STATUS DA CONEXÃO */}
      <div className={`p-6 rounded-[2.5rem] border flex items-center justify-between transition-all shadow-sm ${
        connectionStatus === 'success' ? 'bg-emerald-50 border-emerald-100' : 
        connectionStatus === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${
            connectionStatus === 'success' ? 'bg-emerald-500 text-white' : 
            connectionStatus === 'error' ? 'bg-red-500 text-white' : 'bg-slate-300 text-slate-500'
          }`}>
            {isTesting ? <RefreshCw className="w-6 h-6 animate-spin" /> : 
             connectionStatus === 'success' ? <ShieldCheck className="w-6 h-6" /> : 
             connectionStatus === 'error' ? <AlertTriangle className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">Status do Servidor</h4>
            <p className={`text-[10px] font-bold uppercase ${
              connectionStatus === 'success' ? 'text-emerald-600' : 
              connectionStatus === 'error' ? 'text-red-600' : 'text-slate-400'
            }`}>
              {isTesting ? 'Verificando...' : 
               connectionStatus === 'success' ? 'Sistema Online & Sincronizado' : 
               connectionStatus === 'error' ? `Falha: ${errorMessage}` : 'Aguardando Credenciais'}
            </p>
          </div>
        </div>
        {connectionStatus !== 'none' && (
          <button onClick={() => testConnection()} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHECKLIST DE ATIVAÇÃO */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-500" /> Checklist de Ativação
          </h3>
          <div className="space-y-4">
            <StepItem done={!!config.url} label="Criar conta no Supabase" />
            <StepItem done={connectionStatus !== 'error' || !errorMessage.includes('SQL')} label="Rodar Código SQL" />
            <StepItem done={connectionStatus === 'success'} label="Vincular Chaves API" />
            <StepItem done={state.users.length > 1} label="Convidar Equipe" />
          </div>
          
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">
              O "Next" (próximo passo) após configurar é compartilhar o link com sua equipe.
            </p>
          </div>
        </div>

        {/* CONFIGURAÇÕES PRINCIPAIS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-slate-900 text-white rounded-3xl shadow-lg">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">Configurar Banco</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Insira os dados do seu projeto</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Project URL</label>
                <input type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono text-xs focus:ring-2 focus:ring-blue-500/20" placeholder="https://xyz.supabase.co" value={config.url} onChange={(e) => setConfig({...config, url: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">API Anon Key</label>
                <input type="password" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono text-xs focus:ring-2 focus:ring-blue-500/20" placeholder="eyJhbGci..." value={config.key} onChange={(e) => setConfig({...config, key: e.target.value})} />
              </div>
              <button onClick={saveConfig} className="w-full bg-[#344434] text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl">
                <Save className="w-5 h-5 text-emerald-400" /> Salvar e Validar Conexão
              </button>
            </div>

            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black text-blue-700 uppercase">Esqueceu o código SQL?</span>
              </div>
              <button onClick={copySql} className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[9px] font-black uppercase border border-blue-200 shadow-sm active:scale-95">Copiar SQL</button>
            </div>
          </div>

          {/* COMPARTILHAMENTO */}
          <div className="bg-gradient-to-br from-[#344434] to-[#1a1f1a] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white/10 rounded-xl"><Share2 className="w-6 h-6 text-emerald-400" /></div>
                 <h3 className="text-lg font-black uppercase italic tracking-tight">Vincular Equipe</h3>
              </div>
              <p className="text-xs font-medium opacity-70 leading-relaxed max-w-sm">
                Gere o link e envie para os funcionários. O app deles se configurará automaticamente.
              </p>
              <button onClick={copyInviteLink} className="w-full bg-[#e4e4d4] text-[#344434] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-lg">
                {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <LinkIcon className="w-4 h-4" />}
                {copiedLink ? 'Link Copiado!' : 'Copiar Convite'}
              </button>
            </div>
            <Share2 className="absolute -right-10 -bottom-10 w-40 h-40 opacity-5 -rotate-12" />
          </div>
        </div>
      </div>

      {/* AÇÕES DE SINCRONIZAÇÃO E BACKUP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button onClick={syncNow} disabled={isSyncing || connectionStatus !== 'success'} className="flex flex-col items-center justify-center gap-4 p-8 bg-white border border-slate-200 text-blue-600 rounded-[2.5rem] font-black text-xs uppercase tracking-widest shadow-sm active:scale-95 group disabled:opacity-50">
          <div className="p-4 bg-blue-100 rounded-3xl group-hover:scale-110 transition-transform">
            <RefreshCw className={`w-8 h-8 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          Forçar Sincronização Nuvem
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => exportData(state)} className="flex flex-col items-center justify-center gap-3 p-4 bg-slate-800 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95">
            <Database className="w-6 h-6 opacity-30" /> Exportar JSON
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-4 bg-white border border-slate-200 text-slate-800 rounded-[2rem] font-black text-[10px] uppercase tracking-widest active:scale-95">
            <FileUp className="w-6 h-6 opacity-30" /> Importar JSON
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const content = ev.target?.result as string;
                    onUpdate(JSON.parse(content));
                    alert('Dados restaurados!');
                  } catch { alert('Erro no arquivo.'); }
                };
                reader.readAsText(file);
              }
            }} />
          </button>
        </div>
      </div>
    </div>
  );
};

const StepItem = ({ done, label }: { done: boolean, label: string }) => (
  <div className="flex items-center gap-3">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 border border-slate-200'}`}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
    </div>
    <span className={`text-[11px] font-black uppercase tracking-tight ${done ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
  </div>
);

export default CloudSettings;
