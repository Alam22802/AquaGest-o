import React, { useState, useMemo } from 'react';
import { AppState, ClosedBatchRecord, User } from '../types';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { buildBatchSnapshot } from '../utils/batchSnapshot';
import { 
  FileText, 
  TrendingUp, 
  Scale, 
  FishOff, 
  DollarSign, 
  CheckCircle2, 
  Printer, 
  Lock, 
  Activity, 
  Archive,
  Search,
  Layers,
  History,
  Trash2
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface Props {
  state: AppState;
  currentUser: User;
  onUpdate?: (newState: AppState) => void;
}

const safeDateFormat = (dateStr: string | undefined, formatStr: string) => {
  if (!dateStr) return '---';
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return '---';
    return format(date, formatStr);
  } catch (e) {
    return '---';
  }
};

export const ClosedBatchHistory: React.FC<Props> = ({ state, currentUser, onUpdate }) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const handleDeleteHistoryRecord = (recordId: string) => {
    if (!currentUser.isMaster || !onUpdate) return;
    if (!confirm('Deseja excluir este registro histórico visual permanentemente?')) return;

    const updatedHistory = (state.closedBatchHistory || []).filter(r => r.id !== recordId && r.batchId !== recordId);
    onUpdate({
      ...state,
      closedBatchHistory: updatedHistory,
      deletedIds: Array.from(new Set([...(state.deletedIds || []), recordId]))
    });
    if (selectedRecordId === recordId) {
      setSelectedRecordId('');
    }
  };

  // Combine closed batches currently in state.batches and historical records in state.closedBatchHistory
  const historicalRecords = useMemo(() => {
    const recordsMap = new Map<string, ClosedBatchRecord>();

    // 1. From saved closedBatchHistory (includes deleted batches archived in history)
    (state.closedBatchHistory || []).forEach(record => {
      recordsMap.set(record.batchId || record.id, record);
    });

    // 2. From active batches that have isClosed === true
    (state.batches || [])
      .filter(b => b.isClosed)
      .forEach(batch => {
        // If not already in recordsMap or to keep it up to date
        const snapshot = buildBatchSnapshot(batch, state);
        recordsMap.set(batch.id, snapshot);
      });

    return Array.from(recordsMap.values()).sort((a, b) => {
      const dateA = a.closedAt || a.settlementDate || '';
      const dateB = b.closedAt || b.settlementDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [state.batches, state.closedBatchHistory, state.harvestLogs, state.feedingLogs, state.mortalityLogs, state.biometryLogs, state.slaughterLogs, state.batchExpenses, state.batchRevenues]);

  const selectedRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return historicalRecords.find(r => r.id === selectedRecordId || r.batchId === selectedRecordId) || null;
  }, [selectedRecordId, historicalRecords]);

  const filteredEntries = useMemo(() => {
    if (!selectedRecord || !selectedRecord.entries) return [];
    return selectedRecord.entries.filter(e => {
      const matchCategory = !filterCategory || e.category === filterCategory;
      const matchItem = !filterItem || e.description.toLowerCase().includes(filterItem.toLowerCase());
      return matchCategory && matchItem;
    });
  }, [selectedRecord, filterCategory, filterItem]);

  const categories = useMemo(() => {
    if (!selectedRecord || !selectedRecord.entries) return [];
    return Array.from(new Set(selectedRecord.entries.map(e => e.category))).filter(Boolean).sort();
  }, [selectedRecord]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="batch-history-subpage" className="space-y-8 animate-in fade-in duration-500 print:p-0 print:m-0 print:w-full">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 ${printOrientation};
            margin: 5mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
            height: auto !important;
            font-size: ${printOrientation === 'landscape' ? '12pt' : '11pt'} !important;
          }
          .print-grid-4 {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 0.5rem !important;
            width: 100% !important;
          }
          .print-grid-3 {
            display: grid !important;
            grid-template-columns: ${printOrientation === 'landscape' ? 'repeat(3, 1fr)' : 'repeat(1, 1fr)'} !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          .print-grid-2 {
            display: grid !important;
            grid-template-columns: ${printOrientation === 'landscape' ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)'} !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            border-radius: 1rem !important;
            box-shadow: none !important;
            margin-bottom: 1rem !important;
            padding: 1.25rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            background: white !important;
          }
          .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-bg-slate { background-color: #f8fafc !important; }
          .print-bg-blue { background-color: #eff6ff !important; }
          .print-bg-emerald { background-color: #ecfdf5 !important; }
          .print-text-blue { color: #2563eb !important; }
          .print-text-emerald { color: #059669 !important; }
          .print-text-red { color: #dc2626 !important; }
          .print-header {
            display: block !important;
            visibility: visible !important;
          }
          table { width: 100% !important; }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}} />

      {/* Subpage Header & Selection Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tighter italic flex items-center gap-3">
            <History className="w-8 h-8 text-indigo-600" />
            Histórico de Lotes
          </h2>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Consulta e indicadores básicos de lotes finalizados e arquivados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedRecord && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Impressão:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPrintOrientation('portrait')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${printOrientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Orientação Retrato"
                  >
                    Vertical
                  </button>
                  <button
                    onClick={() => setPrintOrientation('landscape')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${printOrientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Orientação Paisagem"
                  >
                    Horizontal
                  </button>
                </div>
              </div>
              
              <button 
                onClick={handlePrint}
                className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs outline-none hover:bg-slate-50 uppercase tracking-widest shadow-sm flex items-center gap-2 text-slate-700"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>

              {currentUser.isMaster && onUpdate && selectedRecord.isDeletedFromSystem && (
                <button
                  onClick={() => handleDeleteHistoryRecord(selectedRecord.id)}
                  className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl font-black text-xs outline-none uppercase tracking-widest shadow-sm flex items-center gap-2 transition-all"
                  title="Remover este registro do histórico visual"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir do Histórico
                </button>
              )}
            </div>
          )}

          <div className="relative min-w-[280px]">
            <select 
              className="w-full px-6 py-3.5 bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-2xl font-black text-sm outline-none uppercase tracking-wider shadow-sm transition-all"
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
            >
              <option value="">-- Selecionar Lote Histórico --</option>
              {historicalRecords.map(rec => (
                <option key={rec.id} value={rec.id}>
                  {rec.batchName} ({safeDateFormat(rec.settlementDate, 'dd/MM/yyyy')}) {rec.isDeletedFromSystem ? '• [Arquivado]' : '• [Fechado]'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedRecord ? (
        <div className="space-y-8">
          {/* Print Header */}
          <div className="hidden print:block print-header border-b-4 border-slate-900 pb-8 mb-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center">
                  <FileText className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter text-black leading-none">AquaGestão</h1>
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-widest mt-1">Histórico de Fechamento de Lote</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data de Emissão</span>
                <p className="text-lg font-black text-slate-900">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-4 gap-4 print-grid-4">
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Identificação do Lote</span>
                <span className="text-2xl font-black text-slate-900 uppercase italic leading-tight">{selectedRecord.batchName}</span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Data Povoamento</span>
                <span className="text-xl font-black text-slate-900">{safeDateFormat(selectedRecord.settlementDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Período de Cultivo</span>
                <span className="text-xl font-black text-slate-900">
                  {selectedRecord.totalDays} dias
                </span>
              </div>
              <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-200">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Status no Histórico</span>
                <span className="text-xl font-black uppercase italic text-emerald-600">
                  {selectedRecord.isDeletedFromSystem ? 'ARQUIVADO' : 'CONCLUÍDO'}
                </span>
              </div>
            </div>
          </div>

          {/* 1. QUADRO 1: Resumo financeiro e produtivo do lote finalizado */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2 print:px-0">
              <div className="p-2.5 bg-indigo-50 rounded-xl print:bg-slate-100">
                <Layers className="w-5 h-5 text-indigo-600 print:text-indigo-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">
                  Resumo Financeiro e Produtivo do Lote Finalizado
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Indicadores Consolidados de Produção, Despesca e Custos
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 print-grid-3 gap-8 print-container">
              {/* Coluna 1 & 2: Visão Geral e Comparativo Despesca vs Real */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print-grid-2">
                  {/* Visão Geral do Lote */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Visão Geral do Lote
                      </h4>
                      <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {selectedRecord.closedAt ? `Fechado em ${safeDateFormat(selectedRecord.closedAt, 'dd/MM/yyyy')}` : 'Finalizado'}
                        </span>
                      </div>
                    </div>
                  
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Peso Médio Inicial</span>
                        <span className="text-xl font-black text-slate-700 italic">{formatNumber(selectedRecord.initialAvgWeight, 1)}g</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Estoque Inicial</span>
                        <span className="text-xl font-black text-slate-800 italic">{formatNumber(selectedRecord.initialQuantity)} un</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Mortalidade Total</span>
                        <span className="text-xl font-black text-red-600 italic">{formatNumber(selectedRecord.mortality)} un</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Peixes Despescados</span>
                        <span className="text-xl font-black text-blue-600 italic">{formatNumber(selectedRecord.harvestedFish)} un</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Ração Consumida Total</span>
                        <span className="text-xl font-black text-amber-600 italic">{formatNumber(selectedRecord.totalFeedKg, 1)}kg</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">FCA Previsto</span>
                        <span className="text-xl font-black text-indigo-600 italic">{formatNumber(selectedRecord.fcaTheoretical, 2)}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Biomassa Pré-Despesca</span>
                        <span className="text-xl font-black text-emerald-600 italic">{formatNumber(selectedRecord.biomassBeforeHarvest, 1)}kg</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Sobrevivência Prevista</span>
                        <span className="text-xl font-black text-emerald-600 italic">{formatNumber(selectedRecord.survivalRate, 1)}%</span>
                      </div>
                    </div>

                    {/* Consumo Estratificado por Modelo */}
                    <div className="pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Consumo Estratificado de Ração</h5>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(selectedRecord.feedBreakdown || []).map(fe => (
                          <div key={fe.name} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[8px] font-black text-slate-600 uppercase block truncate" title={fe.name}>{fe.name}</span>
                            <span className="text-xs font-black text-slate-700 italic">{formatNumber(fe.amountKg, 1)}kg</span>
                          </div>
                        ))}
                        {(!selectedRecord.feedBreakdown || selectedRecord.feedBreakdown.length === 0) && (
                          <span className="text-[10px] font-bold text-slate-300 uppercase italic col-span-full">Nenhum registro de trato</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Biomassa Inicial</span>
                        <span className="text-sm font-black text-slate-600 uppercase">
                          {formatNumber((selectedRecord.initialQuantity * selectedRecord.initialAvgWeight) / 1000, 1)}kg
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Período de Cultivo</span>
                        <span className="text-sm font-black text-blue-600 uppercase">{selectedRecord.totalDays} dias</span>
                      </div>
                    </div>
                  </div>

                  {/* Dados Despesca VS Real */}
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 print-card print-bg-slate print-text-blue print-no-break">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 italic">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 print-text-blue" />
                      DADOS DESPESCA VS REAL
                    </h4>

                    <div className="space-y-6">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 print:border-slate-200 print:bg-white print:text-slate-900">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest print:text-slate-500">Taxa de Assertividade do Lote</span>
                          <span className="text-lg font-black text-indigo-400 italic print:text-blue-600">{formatNumber(selectedRecord.accuracy, 1)}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden print:bg-slate-100">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-1000 print:bg-blue-600" 
                            style={{ width: `${Math.min(100, selectedRecord.accuracy)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6 print-grid-2">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Sobrevivência Prevista</span>
                          <span className="text-lg font-black italic text-emerald-400 print:text-emerald-600">{formatNumber(selectedRecord.survivalRate, 1)}%</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Sobrevivência Real</span>
                          <span className="text-lg font-black italic text-blue-400 print:text-blue-600">{formatNumber(selectedRecord.survivalRateReal, 1)}%</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">FCA Previsto</span>
                          <span className="text-lg font-black italic text-indigo-400 print:text-blue-600">{formatNumber(selectedRecord.fcaTheoretical, 2)}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">FCA Real</span>
                          <span className="text-lg font-black italic text-amber-400 print:text-amber-600">{formatNumber(selectedRecord.fcaReal, 2)}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Peixes Despescados</span>
                          <span className="text-lg font-black italic text-cyan-400 print:text-blue-600">{formatNumber(selectedRecord.harvestedFish)} un</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Peso Total Deck</span>
                          <span className="text-lg font-black italic text-cyan-400 print:text-blue-600">{formatNumber(selectedRecord.harvestedWeight, 1)}kg</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Peixes Previstos</span>
                          <span className="text-lg font-black italic text-blue-400 print:text-blue-600">{formatNumber(selectedRecord.expectedFish)} un</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest block print:text-slate-500">Peso Recepção</span>
                          <span className="text-lg font-black italic text-blue-400 print:text-blue-600">{formatNumber(selectedRecord.totalReceptionWeight, 1)}kg</span>
                        </div>

                        <div className="col-span-2 pt-4 border-t border-white/10 print:border-slate-200 flex justify-between items-center">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest print:text-slate-500">GPD (Crescimento Diário)</span>
                          <span className="text-lg font-black italic text-cyan-400 print:text-blue-600">{formatNumber(selectedRecord.gpd, 2)}g/dia</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna 3: Análise de Custos */}
              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                  <h4 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Análise de Custos
                  </h4>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1">Peso Recepção Frigorífico (kg)</span>
                      <span className="text-xl font-black text-slate-800 italic">{formatNumber(selectedRecord.totalReceptionWeight, 1)} kg</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest block">Detalhamento dos Custos</span>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Consumo Ração:</span>
                        <span className="font-black text-amber-700">
                          {formatCurrency((selectedRecord.feedBreakdown || []).reduce((acc, f) => acc + f.cost, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Total Despesas:</span>
                        <span className="font-black text-slate-700">{formatCurrency(selectedRecord.totalExpenses)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500">Receita Total:</span>
                        <span className="font-black text-blue-700">{formatCurrency(selectedRecord.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-600">Resultado Líquido:</span>
                        <span className={`font-black ${selectedRecord.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(selectedRecord.totalProfit)}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100">
                      <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest block mb-1">Custo Total Acumulado</span>
                      <span className="text-2xl font-black text-blue-950 italic">{formatCurrency(selectedRecord.totalExpenses)}</span>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1">Custo por KG</span>
                      <span className="text-2xl font-black text-emerald-700 italic">{formatCurrency(selectedRecord.costPerKg)}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 text-center">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      {selectedRecord.isDeletedFromSystem ? 'Registro Histórico Arquivado' : 'Lote Finalizado no Sistema'}
                    </p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                      Visualização exclusiva para consulta e auditoria
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. QUADRO 2: Evolução do Lote (Gráficos) */}
          <div className="space-y-6 print-container print-no-break">
            <div className="flex items-center gap-3 px-2 print:px-0">
              <div className="p-2.5 bg-blue-50 rounded-xl print:bg-slate-100">
                <Activity className="w-5 h-5 text-blue-600 print:text-blue-700" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight italic">
                  Evolução do Lote (Gráficos)
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Trajetória biométrica de peso e histórico de mortalidade
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print-grid-2">
              {/* Gráfico 1: Evolução de Peso */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">
                      Evolução de Peso (g)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
                      GPD: {formatNumber(selectedRecord.gpd, 2)} g/dia
                    </span>
                    <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                      {selectedRecord.biometryTimeline?.length || 0} registros
                    </span>
                  </div>
                </div>

                <div className="h-[300px] w-full print:h-[260px]">
                  {selectedRecord.biometryTimeline && selectedRecord.biometryTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedRecord.biometryTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                          unit="g" 
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any, name: string) => {
                            if (name === 'weight') return [`${value} g`, 'PESO REAL'];
                            if (name === 'standardWeight') return [`${value} g`, 'CURVA PADRÃO'];
                            return [value, name];
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={36} 
                          iconType="circle"
                          formatter={(val) => <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{val === 'weight' ? 'Peso Real (g)' : 'Curva Padrão (g)'}</span>}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          stroke="#2563eb" 
                          strokeWidth={3.5} 
                          dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }} 
                          activeDot={{ r: 6, strokeWidth: 0 }} 
                          connectNulls 
                        />
                        {selectedRecord.protocolName && (
                          <Line 
                            type="monotone" 
                            dataKey="standardWeight" 
                            stroke="#8b5cf6" 
                            strokeWidth={2} 
                            strokeDasharray="4 4" 
                            dot={false} 
                            connectNulls 
                          />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <Scale className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-[11px] font-bold uppercase tracking-widest">Sem biometrias registradas para o lote</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Inicial: {formatNumber(selectedRecord.initialAvgWeight, 1)}g
                  </span>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                    Final Despesca: {formatNumber(selectedRecord.currentAvgWeight, 1)}g
                  </span>
                </div>
              </div>

              {/* Gráfico 2: Evolução de Mortalidade */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-6 print-card print-no-break">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <FishOff className="w-5 h-5 text-red-500" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">
                      Mortalidade Registrada (un)
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-xl border border-red-100">
                      Perdas: {formatNumber(selectedRecord.mortality)} un
                    </span>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                      Sobrevivência: {formatNumber(selectedRecord.survivalRateReal, 1)}%
                    </span>
                  </div>
                </div>

                <div className="h-[300px] w-full print:h-[260px]">
                  {selectedRecord.mortalityTimeline && selectedRecord.mortalityTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={selectedRecord.mortalityTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                          unit=" un" 
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: any, name: string) => {
                            if (name === 'count') return [`${value} un`, 'MORTALIDADE DO DIA'];
                            if (name === 'cumulative') return [`${value} un`, 'ACUMULADO'];
                            return [value, name];
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          height={36} 
                          formatter={(val) => <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">{val === 'count' ? 'Mortalidade Diária (un)' : 'Acumulado'}</span>}
                        />
                        <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]}>
                          {selectedRecord.mortalityTimeline.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.count > 50 ? '#dc2626' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300">
                      <FishOff className="w-10 h-10 mb-2 opacity-40" />
                      <p className="text-[11px] font-bold uppercase tracking-widest">Nenhuma mortalidade registrada para o lote</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Taxa Acumulada: {selectedRecord.initialQuantity > 0 ? formatNumber((selectedRecord.mortality / selectedRecord.initialQuantity) * 100, 1) : 0}%
                  </span>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                    Despescados: {formatNumber(selectedRecord.harvestedFish)} un
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. QUADRO 3: Quadro de Evolução de Peso do Lote (Histórico de Pesagens) */}
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 print-card print-no-break space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">
                    Quadro de Evolução de Peso do Lote (Histórico de Pesagens)
                  </h4>
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {selectedRecord.biometryTimeline?.length || 0} registros cronológicos
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50/80">
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-700 uppercase tracking-widest">Data</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-700 uppercase tracking-widest">Dia de Cultivo</th>
                      <th className="py-3.5 px-4 text-[10px] font-black text-slate-700 uppercase tracking-widest">Evento / Registro</th>
                      <th className="py-3.5 px-4 text-right text-[10px] font-black text-slate-700 uppercase tracking-widest">Peso Médio Real (g)</th>
                      {selectedRecord.protocolName && (
                        <th className="py-3.5 px-4 text-right text-[10px] font-black text-slate-700 uppercase tracking-widest">Peso Padrão (g)</th>
                      )}
                      <th className="py-3.5 px-4 text-right text-[10px] font-black text-slate-700 uppercase tracking-widest">Ganho Acumulado (g)</th>
                      <th className="py-3.5 px-4 text-right text-[10px] font-black text-slate-700 uppercase tracking-widest">GPD Médio (g/dia)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedRecord.biometryTimeline || []).map((row, idx) => {
                      const initialW = selectedRecord.initialAvgWeight || 0;
                      const weightGain = row.weight !== undefined ? row.weight - initialW : 0;
                      const periodGpd = row.days > 0 && row.weight !== undefined ? (row.weight - initialW) / row.days : 0;
                      const eventLabel = row.days === 0 
                        ? 'Povoamento Inicial' 
                        : row.isHarvestDate 
                          ? 'Despesca Final' 
                          : `Biometria`;

                      return (
                        <tr key={`${row.fullDate}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-black text-slate-900">
                            {safeDateFormat(row.fullDate, 'dd/MM/yyyy')}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold text-slate-600">
                            {row.days === 0 ? 'Dia 0 (Povoamento)' : `Dia ${row.days}`}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase inline-block ${
                              row.days === 0 
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                                : row.isHarvestDate 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}>
                              {eventLabel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs font-black text-blue-700 italic">
                            {row.weight !== undefined ? `${formatNumber(row.weight, 1)} g` : '-'}
                          </td>
                          {selectedRecord.protocolName && (
                            <td className="py-3.5 px-4 text-right text-xs font-black text-purple-700 italic">
                              {row.standardWeight !== undefined ? `${formatNumber(row.standardWeight, 1)} g` : '-'}
                            </td>
                          )}
                          <td className={`py-3.5 px-4 text-right text-xs font-black italic ${weightGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {row.weight !== undefined ? `${weightGain >= 0 ? '+' : ''}${formatNumber(weightGain, 1)} g` : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs font-black text-slate-800 italic">
                            {row.days > 0 && periodGpd > 0 ? `${formatNumber(periodGpd, 2)} g/d` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {(!selectedRecord.biometryTimeline || selectedRecord.biometryTimeline.length === 0) && (
                      <tr>
                        <td colSpan={selectedRecord.protocolName ? 7 : 6} className="py-8 text-center text-slate-400 font-bold uppercase text-xs">
                          Nenhum registro de peso encontrado para este lote.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 4. QUADRO 4: Quadro de Lançamentos (Visual / Somente Leitura) */}
          <div className="space-y-4">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 print-card print-no-break">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h4 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-2 italic">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Quadro de Lançamentos
                </h4>
                
                <div className="flex flex-wrap items-center gap-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase">Filtrar:</span>
                    <select 
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      <option value="">Todas Categorias</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Buscar Lançamento..."
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20 pl-7"
                        value={filterItem}
                        onChange={e => setFilterItem(e.target.value)}
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Total Lançado: {formatCurrency(selectedRecord.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Data</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Categoria</th>
                      <th className="text-left py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Lançamento (Item)</th>
                      <th className="text-right py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredEntries.map((entry, idx) => {
                      const isRevenue = entry.type === 'revenue';
                      return (
                        <tr key={entry.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 text-xs font-bold text-slate-600">{safeDateFormat(entry.date, 'dd/MM/yyyy')}</td>
                          <td className="py-4 text-xs font-black text-slate-600 uppercase italic">{entry.category}</td>
                          <td className="py-4 text-xs font-black text-slate-800 uppercase italic">{entry.description}</td>
                          <td className={`py-4 text-right text-xs font-black ${isRevenue ? 'text-blue-600' : 'text-emerald-600'}`}>
                            {isRevenue ? '+' : ''}{formatCurrency(entry.value)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center">
                          <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Nenhum lançamento encontrado.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] p-16 text-center border border-slate-200 shadow-sm space-y-4">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
            <Archive className="w-10 h-10" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-black text-slate-900 uppercase italic">Histórico de Lotes</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider leading-relaxed">
              Selecione um lote finalizado ou arquivado no menu superior para consultar os indicadores de produção, curvas de evolução de peso e quadro de lançamentos de forma somente visual.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClosedBatchHistory;
