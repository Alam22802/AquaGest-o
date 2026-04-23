
import React, { useMemo, useState, useEffect } from 'react';
import { AppState } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { formatNumber } from '../utils/formatters';
import { Fish, Utensils, Scale, TrendingUp, FishOff, Calendar, Layers, Download, Info, AlertTriangle, PackageSearch, CloudSun, Droplets, Wind, CloudRain, Thermometer, Umbrella, Cloud, RefreshCw, ChevronDown, ClipboardCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, subDays, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTilapiaPriceMG, MarketPrice } from '../src/services/marketPriceService';

const getInterpolatedStandardCurvePoints = (standardCurves: any[], avgInitial: number) => {
  const curves = (standardCurves || []).filter(sc => sc.curve && sc.curve.some((p: any) => p.weight > 0));
  if (curves.length === 0) {
    const pts = [];
    for (let i = 0; i <= 210; i += 15) pts.push({ day: i, weight: avgInitial + (i * 5.4) });
    return pts;
  }
  
  const allWeeks = Array.from(new Set(curves.flatMap(sc => sc.curve.map((p: any) => p.day)))).sort((a, b) => a - b);
  return allWeeks.map(week => {
    let sumWeight = 0;
    let count = 0;
    curves.forEach(sc => {
      const c = sc.curve.filter((p: any) => p.weight > 0).sort((a: any, b: any) => a.day - b.day);
      const nextIdx = c.findIndex((p: any) => p.day >= week);
      if (nextIdx === 0) {
        sumWeight += c[0].weight;
        count++;
      } else if (nextIdx !== -1) {
        const p1 = c[nextIdx - 1];
        const p2 = c[nextIdx];
        const w = p1.weight + (p2.weight - p1.weight) * (week - p1.day) / (p2.day - p1.day);
        sumWeight += w;
        count++;
      } else {
        const last = c[c.length - 1];
        if (week <= last.day + 2) {
          sumWeight += last.weight;
          count++;
        }
      }
    });
    return { day: week * 7, weight: count > 0 ? sumWeight / count : 0 };
  }).filter(p => p.weight > 0);
};

interface Props {
  state: AppState;
}

const MiniStat = ({ label, value, icon, color, subtext }: any) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 transition-all hover:shadow-md h-full">
    <div className={`p-3 rounded-xl bg-slate-50 shadow-sm ${color} shrink-0`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-slate-800">{value}</div>
      {subtext && <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{subtext}</div>}
    </div>
  </div>
);

const WeatherWidget = () => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch weather for Araguari-MG using Open-Meteo (Free, no key required)
      // Coordinates: -18.6475, -48.1872
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-18.6475&longitude=-48.1872&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto');
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      setWeather(data);
    } catch (err: any) {
      console.error('Error fetching weather:', err);
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getWeatherInfo = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0) return { icon: <CloudSun className="w-6 h-6" />, desc: 'Céu Limpo' };
    if (code <= 3) return { icon: <Cloud className="w-6 h-6" />, desc: 'Parcialmente Nublado' };
    if (code <= 48) return { icon: <Cloud className="w-6 h-6" />, desc: 'Nevoeiro' };
    if (code <= 55) return { icon: <CloudRain className="w-6 h-6" />, desc: 'Garoa' };
    if (code <= 65) return { icon: <CloudRain className="w-6 h-6" />, desc: 'Chuva' };
    if (code <= 82) return { icon: <CloudRain className="w-6 h-6" />, desc: 'Pancadas de Chuva' };
    if (code <= 99) return { icon: <CloudRain className="w-6 h-6" />, desc: 'Tempestade' };
    return { icon: <CloudSun className="w-6 h-6" />, desc: 'N/A' };
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-pulse flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-slate-100 rounded w-1/4" />
            <div className="h-6 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-slate-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-0.5">Erro de Conexão</div>
            <div className="text-xs font-bold text-red-700 uppercase tracking-tight">Não foi possível carregar o clima</div>
          </div>
        </div>
        <button 
          onClick={fetchWeather}
          className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm active:scale-95"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!weather || !weather.current_weather || !weather.daily) return null;

  const current = weather.current_weather;
  const daily = weather.daily;
  const currentInfo = getWeatherInfo(current.weathercode);

  return (
    <div className="bg-[#344434] rounded-2xl p-4 text-[#e4e4d4] shadow-lg shadow-black/10 flex flex-col gap-4 overflow-hidden relative group border border-white/5">
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
            {currentInfo.icon}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e4e4d4]/60">Clima em Tempo Real</span>
              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] font-black uppercase tracking-widest text-[#e4e4d4] border border-white/5">Araguari-MG</span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-black tracking-tighter italic drop-shadow-sm">{Math.round(current.temperature)}°C</h2>
              <span className="text-xs font-bold text-[#e4e4d4]/80 capitalize">{currentInfo.desc}</span>
            </div>
          </div>
        </div>
        
        <div className="hidden sm:block text-right">
          <div className="text-[9px] font-black text-[#e4e4d4]/40 uppercase tracking-widest mb-0.5">Atualizado</div>
          <div className="text-[11px] font-bold text-[#e4e4d4]/70">{format(new Date(), 'HH:mm')}</div>
        </div>
      </div>

      {/* Previsão 5 Dias */}
      <div className="relative z-10 grid grid-cols-5 gap-2">
        {daily.time.slice(1, 6).map((date: string, index: number) => {
          const idx = index + 1;
          const info = getWeatherInfo(daily.weathercode[idx]);
          const rainProb = daily.precipitation_probability_max[idx];
          const rainSum = daily.precipitation_sum[idx];
          
          return (
            <div key={date} className="bg-white/5 backdrop-blur-sm p-2 rounded-xl border border-white/5 flex flex-col items-center text-center transition-all hover:bg-white/10">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#e4e4d4]/50 mb-1">
                {format(parseISO(date), 'eee', { locale: ptBR })}
              </span>
              <div className="mb-1 text-[#e4e4d4]/80 scale-75">
                {info.icon}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-black">{Math.round(daily.temperature_2m_max[idx])}°</span>
                <span className="text-[9px] font-bold text-[#e4e4d4]/40">{Math.round(daily.temperature_2m_min[idx])}°</span>
              </div>
              
              {(rainProb > 20 || rainSum > 0) && (
                <div className="mt-1.5 pt-1.5 border-t border-white/5 w-full flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-0.5 text-[8px] font-black text-blue-300 uppercase">
                    <Umbrella className="w-2 h-2" />
                    {rainProb}%
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decorative background elements */}
      <div className="absolute right-[-15px] top-[-15px] opacity-5 group-hover:scale-110 transition-transform duration-1000">
        <CloudSun className="w-32 h-32" />
      </div>
    </div>
  );
};

const TilapiaPriceWidget = () => {
  const [marketData, setMarketData] = useState<MarketPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTilapiaPriceMG();
      setMarketData(data);
    } catch (err: any) {
      console.error('Error fetching price:', err);
      setError('Falha ao obter preço');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
  }, []);

  if (loading) {
    return (
      <div className="bg-[#344434] p-6 rounded-2xl border border-white/5 shadow-sm animate-pulse flex items-center gap-4">
        <div className="w-12 h-12 bg-white/5 rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-white/5 rounded w-1/4" />
          <div className="h-6 bg-white/5 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#344434] rounded-2xl p-4 text-[#e4e4d4] shadow-lg shadow-black/10 flex flex-col gap-4 overflow-hidden relative group border border-white/5">
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-left">
          <div className="p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e4e4d4]/60">Mercado Triângulo Mineiro</span>
              <span className="px-1.5 py-0.5 bg-white/10 rounded text-[8px] font-black uppercase tracking-widest text-[#e4e4d4] border border-white/5">CEPEA/Peixe BR</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl font-black tracking-tighter italic drop-shadow-sm">R$ {(marketData?.price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              {marketData?.variation !== undefined && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${marketData.variation >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {marketData.variation >= 0 ? '+' : ''}{marketData.variation}%
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[8px] font-black text-[#e4e4d4]/40 uppercase tracking-widest mb-0.5">Sincronizado</div>
            <div className="text-[10px] font-bold text-[#e4e4d4]/70">{marketData ? format(new Date(marketData.lastUpdate), 'dd/MM HH:mm') : '---'}</div>
          </div>
          <button 
            onClick={fetchPrice}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-[#e4e4d4]/60 hover:text-[#e4e4d4] transition-all border border-white/5 active:scale-95"
            title="Atualizar Preço"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* MG variations list */}
      {marketData?.mgRegions && marketData.mgRegions.length > 0 && (
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
          {marketData.mgRegions.map((region, idx) => (
            <div key={idx} className="bg-white/5 backdrop-blur-sm p-2 rounded-xl border border-white/5 flex flex-col items-center text-center transition-all hover:bg-white/10">
              <span className="text-[8px] font-black uppercase tracking-widest text-[#e4e4d4]/50 mb-1">{region.name}</span>
              <div className="text-xs font-black">R$ {(region.price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              {region.variation !== undefined && (
                <span className={`text-[7px] font-black ${region.variation >= 0 ? 'text-emerald-400' : 'text-red-400'} mt-0.5`}>
                  {region.variation >= 0 ? '↑' : '↓'} {Math.abs(region.variation)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-[8px] font-bold text-[#e4e4d4]/30 uppercase tracking-tighter">
        Fonte: {marketData?.source}
      </div>

      {/* Decorative background element */}
      <div className="absolute right-[-15px] top-[-15px] opacity-10 group-hover:scale-110 transition-transform duration-1000">
        <TrendingUp className="w-32 h-32" />
      </div>
    </div>
  );
};

const Dashboard: React.FC<Props> = ({ state }) => {
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [showBatchSelector, setShowBatchSelector] = useState(false);
  const [reportStartDate, setReportStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showSupplierCurve, setShowSupplierCurve] = useState<boolean>(false);
  const [showStandardCurve, setShowStandardCurve] = useState<boolean>(false);
  const [showContinueCurve, setShowContinueCurve] = useState<boolean>(false);

  const lowStockFeeds = useMemo(() => {
    return (state.feedTypes || []).filter(feed => {
      const stockKg = feed.totalStock / 1000;
      const limitKg = (feed.maxCapacity * feed.minStockPercentage) / 100;
      return stockKg <= limitKg;
    });
  }, [state.feedTypes]);

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds(prev => 
      prev.includes(batchId) 
        ? prev.filter(id => id !== batchId) 
        : [...prev, batchId]
    );
  };

  const batchStats = useMemo(() => {
    const cagesByBatch = new Map<string, typeof state.cages>();
    (state.cages || []).forEach(c => {
      if (c.batchId) {
        const list = cagesByBatch.get(c.batchId) || [];
        list.push(c);
        cagesByBatch.set(c.batchId, list);
      }
    });

    const sortedHarvestLogs = [...(state.harvestLogs || [])].sort((a, b) => a.date.localeCompare(b.date));

    const mortalityByBatch = new Map<string, number>();
    (state.mortalityLogs || []).forEach(m => {
      let bId = m.batchId;
      if (!bId && m.cageId) {
        const mDate = m.date;
        // 1. Check harvest logs first (historical data) - find the first harvest after the log date
        const harvest = sortedHarvestLogs.find(h => h.cageId === m.cageId && h.date >= mDate);
        if (harvest) {
          bId = harvest.batchId;
        } else {
          // 2. Check current cage assignment
          const cage = (state.cages || []).find(c => c.id === m.cageId);
          if (cage?.batchId) {
            const batch = (state.batches || []).find(b => b.id === cage.batchId);
            if (batch && mDate >= batch.settlementDate) {
              bId = cage.batchId;
            }
          }
        }
      }
      
      if (bId) {
        mortalityByBatch.set(bId, (mortalityByBatch.get(bId) || 0) + m.count);
      }
    });

    const feedingByBatch = new Map<string, number>();
    const feedBreakdownByBatch = new Map<string, { [name: string]: number }>();
    (state.feedingLogs || []).forEach(f => {
      let bId = f.batchId;
      if (!bId && f.cageId) {
        const fDate = (f.timestamp || '').split('T')[0];
        // 1. Check harvest logs first (historical data)
        const harvest = sortedHarvestLogs.find(h => h.cageId === f.cageId && h.date >= fDate);
        if (harvest) {
          bId = harvest.batchId;
        } else {
          // 2. Check current cage assignment
          const cage = (state.cages || []).find(c => c.id === f.cageId);
          if (cage?.batchId) {
            const batch = (state.batches || []).find(b => b.id === cage.batchId);
            if (batch && fDate >= batch.settlementDate) {
              bId = cage.batchId;
            }
          }
        }
      }
      
      if (bId) {
        feedingByBatch.set(bId, (feedingByBatch.get(bId) || 0) + f.amount);
        
        const breakdown = feedBreakdownByBatch.get(bId) || {};
        const feedType = (state.feedTypes || []).find(ft => ft.id === f.feedTypeId);
        const name = feedType ? feedType.name : 'Ração S/ Ident.';
        breakdown[name] = (breakdown[name] || 0) + f.amount;
        feedBreakdownByBatch.set(bId, breakdown);
      }
    });

    const nurseryMortalityByBatch = new Map<string, number>();
    (state.mortalityLogs || []).forEach(m => {
      if (m.batchId && !m.cageId) {
        nurseryMortalityByBatch.set(m.batchId, (nurseryMortalityByBatch.get(m.batchId) || 0) + m.count);
      }
    });

    const harvestsByBatch = new Map<string, { fishCount: number, weight: number, initialFishCount: number }>();
    (state.harvestLogs || []).forEach(h => {
      const current = harvestsByBatch.get(h.batchId) || { fishCount: 0, weight: 0, initialFishCount: 0 };
      
      // Fallback for old logs missing initialFishCount
      let initial = h.initialFishCount;
      if (!initial) {
        const batch = (state.batches || []).find(b => b.id === h.batchId);
        const cageMortality = (state.mortalityLogs || [])
          .filter(m => {
            if (m.cageId !== h.cageId) return false;
            if (m.batchId) return m.batchId === h.batchId;
            return batch && m.date >= batch.settlementDate && m.date <= h.date;
          })
          .reduce((acc, curr) => acc + curr.count, 0);
        initial = h.fishCount + cageMortality;
      }

      harvestsByBatch.set(h.batchId, {
        fishCount: current.fishCount + h.fishCount,
        weight: current.weight + h.totalWeight,
        initialFishCount: current.initialFishCount + (initial || 0)
      });
    });

    return (state.batches || []).map(batch => {
      const batchCages = cagesByBatch.get(batch.id) || [];
      
      const totalInitial = batch.initialQuantity;
      const harvestData = harvestsByBatch.get(batch.id) || { fishCount: 0, weight: 0, initialFishCount: 0 };
      const totalHarvested = harvestData.fishCount;
      const totalHarvestedWeight = harvestData.weight;
      const totalInitialInHarvested = harvestData.initialFishCount;
      const totalMortality = mortalityByBatch.get(batch.id) || 0;
      const nurseryMortality = nurseryMortalityByBatch.get(batch.id) || 0;

      const usedFish = batchCages.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
      const settlementBalance = batch.isSettlementComplete ? 0 : Math.max(0, totalInitial - usedFish - totalInitialInHarvested - nurseryMortality);

      const currentTotalStock = Math.max(0, totalInitial - totalMortality - totalHarvested);

      // Filter biometries for this batch
      const batchBiometries = (state.biometryLogs || []).filter(b => {
        if (b.batchId) return b.batchId === batch.id;
        // Fallback: check if cage is currently in this batch and date is after settlement
        const cage = (state.cages || []).find(c => c.id === b.cageId);
        if (cage?.batchId === batch.id && b.date >= batch.settlementDate) {
          // Ensure there isn't a harvest for this cage between settlement and biometry
          const harvestBeforeBiometry = sortedHarvestLogs.find(h => h.cageId === b.cageId && h.date >= batch.settlementDate && h.date < b.date);
          if (!harvestBeforeBiometry) return true;
        }
        
        // Fallback for harvested cages
        const harvest = sortedHarvestLogs.find(h => h.cageId === b.cageId && h.date >= b.date);
        return harvest?.batchId === batch.id;
      });

      let currentAvgWeight = batch.initialUnitWeight;
      let samplingInfo = "Peso Inicial";

      if (batchBiometries.length > 0) {
        const lastDate = batchBiometries.reduce((max, log) => log.date > max ? log.date : max, "");
        const lastDayLogs = batchBiometries.filter(log => log.date === lastDate);
        if (lastDayLogs.length > 0) {
          const sumWeights = lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0);
          currentAvgWeight = sumWeights / lastDayLogs.length;
          try {
            samplingInfo = `Média de ${lastDayLogs.length} gaiolas (Dia: ${format(parseISO(lastDate), 'dd/MM')})`;
          } catch {
            samplingInfo = `Média de ${lastDayLogs.length} gaiolas`;
          }
        }
      }

      const totalBiomassKg = (currentTotalStock * currentAvgWeight) / 1000;
      
      const totalFeedAmount = feedingByBatch.get(batch.id) || 0;
      const feedBreakdownObj = feedBreakdownByBatch.get(batch.id) || {};

      const totalFeedKg = totalFeedAmount / 1000;
      const feedBreakdown = Object.entries(feedBreakdownObj).map(([name, amount]) => ({
        name,
        amountKg: amount / 1000
      })).sort((a, b) => a.name.localeCompare(b.name));

      const totalProducedWeightKg = totalBiomassKg + totalHarvestedWeight;
      const fcaValue = totalProducedWeightKg > 0 ? formatNumber(totalFeedKg / totalProducedWeightKg, 2) : '0,00';

      return { 
        id: batch.id, 
        name: batch.name, 
        stock: currentTotalStock, 
        harvested: totalHarvested,
        harvestedWeight: totalHarvestedWeight,
        mortality: totalMortality,
        biomass: totalBiomassKg, 
        feed: totalFeedKg, 
        feedBreakdown,
        fca: fcaValue,
        avgWeight: currentAvgWeight,
        samplingInfo,
        settlementBalance
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [state.batches, state.cages, state.mortalityLogs, state.biometryLogs, state.feedingLogs, state.feedTypes, state.harvestLogs]);

  const filteredBatchStats = useMemo(() => {
    // Show only batches that are fully settled (balance 0)
    return batchStats.filter(b => b.settlementBalance === 0);
  }, [batchStats]);

  const selectedBatchData = useMemo(() => {
    const batchesToProcess = selectedBatchIds.length > 0 
      ? filteredBatchStats.filter(b => selectedBatchIds.includes(b.id))
      : filteredBatchStats;

    const stats = batchesToProcess.reduce((acc, curr) => {
      acc.stock += curr.stock;
      acc.harvested += curr.harvested;
      acc.harvestedWeight += curr.harvestedWeight;
      acc.mortality += curr.mortality;
      acc.biomass += curr.biomass;
      acc.feed += curr.feed;
      
      curr.feedBreakdown.forEach(fb => {
        const existing = acc.feedBreakdown.find(f => f.name === fb.name);
        if (existing) {
          existing.amountKg += fb.amountKg;
        } else {
          acc.feedBreakdown.push({ ...fb });
        }
      });
      
      return acc;
    }, { 
      stock: 0, 
      harvested: 0, 
      harvestedWeight: 0,
      mortality: 0, 
      biomass: 0, 
      feed: 0, 
      feedBreakdown: [] as { name: string, amountKg: number }[] 
    });

    const totalProducedWeightKg = stats.biomass + stats.harvestedWeight;
    const fcaValue = totalProducedWeightKg > 0 ? formatNumber(stats.feed / totalProducedWeightKg, 2) : '0,00';
    const avgWeight = stats.stock > 0 ? (stats.biomass * 1000) / stats.stock : 0;

    return {
      ...stats,
      fca: fcaValue,
      avgWeight,
      samplingInfo: selectedBatchIds.length === 1 
        ? batchStats.find(b => b.id === selectedBatchIds[0])?.samplingInfo || 'Sem dados'
        : `Total de ${batchesToProcess.length} lotes`
    };
  }, [batchStats, filteredBatchStats, selectedBatchIds]);

  const batch = selectedBatchIds.length === 1 
    ? (state.batches || []).find(b => b.id === selectedBatchIds[0])
    : (state.batches || []).find(b => b.id === (state.biometryLogs || []).find(l => l.batchId)?.batchId);
  const protocol = state.protocols.find(p => p.id === batch?.protocolId);

  const biometryEvolutionData = useMemo(() => {
    let logs: any[] = [];
    let initialWeights: number[] = [];
    let settlementDate = '';
    let expectedHarvestDate = '';

    const filteredBatches = (state.batches || []).filter(b => {
      const stats = batchStats.find(s => s.id === b.id);
      const isSettled = stats?.settlementBalance === 0;
      const isSelected = selectedBatchIds.length === 0 || selectedBatchIds.includes(b.id);
      return isSettled && isSelected;
    });
    
    initialWeights = filteredBatches.map(b => b.initialUnitWeight);
    if (filteredBatches.length > 0) {
      settlementDate = filteredBatches[0].settlementDate;
      expectedHarvestDate = filteredBatches[0].expectedHarvestDate || '';
    }
    
    logs = (state.biometryLogs || []).filter(l => {
      const batch = filteredBatches.find(b => b.id === l.batchId);
      if (batch) return true;
      
      if (!l.batchId && l.cageId) {
        const cage = state.cages.find(c => c.id === l.cageId);
        const cageBatch = filteredBatches.find(b => b.id === cage?.batchId);
        if (cageBatch && l.date >= cageBatch.settlementDate) return true;
        
        const harvest = (state.harvestLogs || []).find(h => h.cageId === l.cageId && h.date >= l.date);
        return filteredBatches.some(b => b.id === harvest?.batchId);
      }
      return false;
    });
    
    const uniqueDates = Array.from(new Set(logs.map(l => l.date))).sort();
    
    const actualData = uniqueDates.map(currentDate => {
      const dayLogs = logs.filter(l => l.date === currentDate);
      const avgWeight = dayLogs.reduce((a, b) => a + b.averageWeight, 0) / dayLogs.length;

      let dateLabel = currentDate;
      try {
        dateLabel = format(new Date(currentDate + 'T12:00:00'), 'dd/MM');
      } catch {}

      return {
        date: dateLabel,
        fullDate: currentDate,
        weight: Math.round(avgWeight)
      };
    });
    
    const avgInitial = initialWeights.length > 0 ? initialWeights.reduce((a, b) => a + b, 0) / initialWeights.length : 0;
    const baseData = [{ date: 'Início', weight: Math.round(avgInitial), fullDate: settlementDate }, ...actualData];

    // Prediction Curves
    if ((showSupplierCurve || showStandardCurve || showContinueCurve) && settlementDate) {
      const start = parseISO(settlementDate);
      const targetW = protocol?.targetWeight || 950;
      
      const getPoints = (curve: {day: number, weight: number}[], fallbackRate: number) => {
        if (curve && curve.some(p => p.weight > 0)) {
          return [...curve].filter(p => p.weight > 0).sort((a, b) => a.day - b.day).map(p => ({ day: p.day * 7, weight: p.weight }));
        }
        const pts = [];
        for (let i = 0; i <= 210; i += 15) pts.push({ day: i, weight: avgInitial + (i * fallbackRate) });
        return pts;
      };

      const standardCurvePoints = getInterpolatedStandardCurvePoints(state.standardCurves || [], avgInitial);
      const supplierCurvePoints = getPoints(protocol?.supplierCurve || [], 5.7);

      const getWeightAtDay = (points: {day: number, weight: number}[], targetDay: number) => {
        if (points.length === 0) return null;
        const nextIdx = points.findIndex(p => p.day >= targetDay);
        if (nextIdx === 0) return points[0].weight;
        if (nextIdx === -1) {
          const p1 = points[points.length - 2];
          const p2 = points[points.length - 1];
          const rate = (p2.weight - p1.weight) / Math.max(1, p2.day - p1.day);
          return p2.weight + rate * (targetDay - p2.day);
        }
        const p1 = points[nextIdx - 1];
        const p2 = points[nextIdx];
        return p1.weight + (p2.weight - p1.weight) * (targetDay - p1.day) / Math.max(1, p2.day - p1.day);
      };

      // 2. Calculate Batch Rate based on LAST interval if possible
      let currentBatchRate = 0;
      let lastActualDay = 0;
      let lastWeight = avgInitial;
      const dataForProjection = [...baseData].filter(d => d.weight !== undefined);
      
      if (dataForProjection.length > 0) {
        const lastActual = dataForProjection[dataForProjection.length - 1];
        lastWeight = lastActual.weight;
        lastActualDay = Math.floor((parseISO(lastActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        const lastTwo = dataForProjection.slice(-2);
        if (lastTwo.length === 2) {
          const p1 = lastTwo[0];
          const p2 = lastTwo[1];
          const d1 = Math.floor((parseISO(p1.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const d2 = Math.floor((parseISO(p2.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          currentBatchRate = (p2.weight - p1.weight) / Math.max(1, d2 - d1);
        } else {
          const firstActual = dataForProjection[0];
          const firstActualDay = Math.floor((parseISO(firstActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          currentBatchRate = (lastActual.weight - firstActual.weight) / Math.max(1, lastActualDay - firstActualDay);
        }
      }

      // 3. Determine Total Days
      const end = expectedHarvestDate ? parseISO(expectedHarvestDate) : addDays(start, 168);
      const baseTotalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.max(180, baseTotalDays);
      
      const allDates: string[] = [];
      for (let i = 0; i <= totalDays; i += 7) {
        allDates.push(format(addDays(start, i), 'yyyy-MM-dd'));
      }
      if (expectedHarvestDate && !allDates.includes(expectedHarvestDate)) allDates.push(expectedHarvestDate);
      if (settlementDate && !allDates.includes(settlementDate)) allDates.push(settlementDate);
      uniqueDates.forEach(d => { if (!allDates.includes(d)) allDates.push(d); });
      allDates.sort();

      const stdWeightAtStart = getWeightAtDay(standardCurvePoints, lastActualDay) || 0;
      const supWeightAtStart = getWeightAtDay(supplierCurvePoints, lastActualDay) || 0;

      return allDates.map(d => {
        const day = differenceInDays(parseISO(d), start);
        const actual = actualData.find(ad => ad.fullDate === d);
        
        let supplierWeight = showSupplierCurve ? getWeightAtDay(supplierCurvePoints, day) : undefined;
        let standardWeight = showStandardCurve ? getWeightAtDay(standardCurvePoints, day) : undefined;
        
        if (day > 210) {
          supplierWeight = undefined;
          standardWeight = undefined;
        } else {
          if (supplierWeight !== null && supplierWeight !== undefined && supplierWeight > targetW + 50) supplierWeight = undefined;
          if (standardWeight !== null && standardWeight !== undefined && standardWeight > targetW + 50) standardWeight = undefined;
        }
        
        let continueWeight = undefined;
        if (showContinueCurve && day >= lastActualDay) {
          const gainBatch = currentBatchRate * (day - lastActualDay);
          const gainStd = (getWeightAtDay(standardCurvePoints, day) || 0) - stdWeightAtStart;
          const gainSup = (getWeightAtDay(supplierCurvePoints, day) || 0) - supWeightAtStart;
          
          continueWeight = lastWeight + (gainBatch + gainStd + gainSup) / 3;
          if (continueWeight > targetW + 50) continueWeight = undefined;
        }

        let dateLabel = d;
        try {
          dateLabel = format(new Date(d + 'T12:00:00'), 'dd/MM');
        } catch {}

        let weight = actual?.weight;
        if (d === settlementDate && weight === undefined) weight = Math.round(avgInitial);

        return {
          date: d === settlementDate ? 'Início' : dateLabel,
          fullDate: d,
          isHarvestDate: expectedHarvestDate && d === expectedHarvestDate,
          weight: weight,
          supplierWeight: supplierWeight ? Math.round(supplierWeight) : undefined,
          standardWeight: standardWeight ? Math.round(standardWeight) : undefined,
          continueWeight: continueWeight ? Math.round(continueWeight) : undefined
        };
      });
    }

    return baseData;
  }, [state.biometryLogs, state.batches, state.cages, state.harvestLogs, state.protocols, state.standardCurves, selectedBatchIds, batchStats, showSupplierCurve, showStandardCurve, showContinueCurve]);

  const mortalityEvolutionData = useMemo(() => {
    let logs: any[] = [];

    const filteredBatches = (state.batches || []).filter(b => {
      const stats = batchStats.find(s => s.id === b.id);
      const isSettled = stats?.settlementBalance === 0;
      const isSelected = selectedBatchIds.length === 0 || selectedBatchIds.includes(b.id);
      return isSettled && isSelected;
    });

    logs = (state.mortalityLogs || []).filter(m => {
      const batch = filteredBatches.find(b => b.id === m.batchId);
      if (batch) return true;

      if (!m.batchId && m.cageId) {
        const cage = state.cages.find(c => c.id === m.cageId);
        const cageBatch = filteredBatches.find(b => b.id === cage?.batchId);
        if (cageBatch && m.date >= cageBatch.settlementDate) return true;
        
        const harvest = (state.harvestLogs || []).find(h => h.cageId === m.cageId && h.date >= m.date);
        return filteredBatches.some(b => b.id === harvest?.batchId);
      }
      return false;
    });

    const grouped = logs.reduce((acc: any, log) => {
      if (!acc[log.date]) acc[log.date] = 0;
      acc[log.date] += log.count;
      return acc;
    }, {});
    return Object.keys(grouped).map(date => {
      let dateLabel = date;
      try {
        dateLabel = format(new Date(date + 'T12:00:00'), 'dd/MM');
      } catch {}
      return { 
        date: dateLabel, 
        fullDate: date, 
        count: grouped[date] 
      };
    }).sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [state.mortalityLogs, state.cages, state.batches, state.harvestLogs, selectedBatchIds, batchStats]);

  const biomassEvolutionData = useMemo(() => {
    let relevantBatches: any[] = [];
    let settlementDate = '';
    let expectedHarvestDate = '';

    relevantBatches = (state.batches || []).filter(b => {
      const stats = batchStats.find(s => s.id === b.id);
      const isSettled = stats?.settlementBalance === 0;
      const isSelected = selectedBatchIds.length === 0 || selectedBatchIds.includes(b.id);
      return isSettled && isSelected;
    });

    if (relevantBatches.length > 0) {
      settlementDate = relevantBatches[0].settlementDate;
      expectedHarvestDate = relevantBatches[0].expectedHarvestDate || '';
    }

    if (relevantBatches.length === 0) return [];

    const batchIds = relevantBatches.map(b => b.id);
    const initialPop = relevantBatches.reduce((acc, b) => acc + b.initialQuantity, 0);
    const initialWeight = relevantBatches.length > 0 ? relevantBatches.reduce((acc, b) => acc + b.initialUnitWeight, 0) / relevantBatches.length : 0;

    // Helper to check if a log belongs to the relevant batches
    const isLogRelevant = (log: any) => {
      if (log.batchId && batchIds.includes(log.batchId)) return true;
      if (!log.batchId && log.cageId) {
        const cage = state.cages.find(c => c.id === log.cageId);
        if (cage?.batchId && batchIds.includes(cage.batchId)) {
          const batch = relevantBatches.find(b => b.id === cage.batchId);
          if (batch && log.date >= batch.settlementDate) return true;
        }
        const harvest = (state.harvestLogs || []).find(h => h.cageId === log.cageId && h.date >= log.date);
        if (harvest && batchIds.includes(harvest.batchId)) return true;
      }
      return false;
    };

    const biometries = (state.biometryLogs || []).filter(isLogRelevant);
    const mortalities = (state.mortalityLogs || []).filter(isLogRelevant);
    const harvests = (state.harvestLogs || []).filter(l => batchIds.includes(l.batchId));

    // Use ONLY biometry dates as requested
    const biometryDates = Array.from(new Set(biometries.map(l => l.date))).sort();
    
    const actualData = biometryDates.map(date => {
      // "Estoque Vivo" at this specific date
      const cumMortality = mortalities.filter(m => m.date <= date).reduce((acc, m) => acc + m.count, 0);
      const cumHarvest = harvests.filter(h => h.date <= date).reduce((acc, h) => acc + h.fishCount, 0);
      const currentPop = Math.max(0, initialPop - cumMortality - cumHarvest);
      
      const dayBiometries = biometries.filter(b => b.date === date);
      const avgWeight = dayBiometries.reduce((acc, b) => acc + b.averageWeight, 0) / dayBiometries.length;
      
      // Biomassa = Estoque Vivo * Média de Peso da Biometria
      const biomassKg = (currentPop * avgWeight) / 1000;

      let dateLabel = date;
      try {
        dateLabel = format(new Date(date + 'T12:00:00'), 'dd/MM');
      } catch {}

      return {
        date: dateLabel,
        fullDate: date,
        biomass: Number(biomassKg.toFixed(1)),
        weight: Math.round(avgWeight),
        pop: currentPop
      };
    });

    const baseData = [
      { 
        date: 'Início', 
        fullDate: settlementDate,
        biomass: Number(((initialPop * initialWeight) / 1000).toFixed(1)), 
        weight: Math.round(initialWeight), 
        pop: initialPop 
      }, 
      ...actualData
    ];

    // Prediction Curves
    if ((showSupplierCurve || showStandardCurve || showContinueCurve) && settlementDate) {
      const start = parseISO(settlementDate);
      const targetW = protocol?.targetWeight || 950;
      
      // Calculate projected days to reach target weight to ensure chart extends far enough
      let projectedTotalDays = 168;
      if (actualData.length > 0) {
        const lastActual = actualData[actualData.length - 1];
        const firstActual = actualData[0];
        const lastActualDay = Math.floor((parseISO(lastActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const firstActualDay = Math.floor((parseISO(firstActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const batchRate = (lastActual.weight - firstActual.weight) / Math.max(1, lastActualDay - firstActualDay);
        const daysToTarget = batchRate > 0 ? (targetW - lastActual.weight) / batchRate : 0;
        projectedTotalDays = Math.ceil(lastActualDay + daysToTarget);
      }

      const end = expectedHarvestDate ? parseISO(expectedHarvestDate) : addDays(start, 168);
      const baseTotalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.max(168, baseTotalDays, projectedTotalDays);
      
      // Standard Curve (Interpolated from all registered curves)
      const standardCurvePoints = getInterpolatedStandardCurvePoints(state.standardCurves || [], initialWeight);

      // Supplier Curve (from Protocol)
      let supplierCurvePoints: { day: number, weight: number }[] = [];
      if (protocol?.supplierCurve && protocol.supplierCurve.some(p => p.weight > 0)) {
        const sortedPoints = [...protocol.supplierCurve]
          .filter(p => p.weight > 0)
          .sort((a, b) => a.day - b.day);
        
        supplierCurvePoints = sortedPoints.map(p => ({
          day: p.day * 7, // Convert weeks to days
          weight: p.weight
        }));
      }

      const getWeightAtDay = (points: {day: number, weight: number}[], targetDay: number) => {
        if (points.length === 0) return null;
        const nextIdx = points.findIndex(p => p.day >= targetDay);
        if (nextIdx === 0) return points[0].weight;
        if (nextIdx === -1) {
          const p1 = points[points.length - 2];
          const p2 = points[points.length - 1];
          const rate = (p2.weight - p1.weight) / Math.max(1, p2.day - p1.day);
          return p2.weight + rate * (targetDay - p2.day);
        }
        const p1 = points[nextIdx - 1];
        const p2 = points[nextIdx];
        return p1.weight + (p2.weight - p1.weight) * (targetDay - p1.day) / Math.max(1, p2.day - p1.day);
      };

      const allDates: string[] = [];
      for (let i = 0; i <= totalDays; i += 7) {
        const d = addDays(start, i);
        allDates.push(format(d, 'yyyy-MM-dd'));
      }
      if (expectedHarvestDate && !allDates.includes(expectedHarvestDate)) allDates.push(expectedHarvestDate);
      if (settlementDate && !allDates.includes(settlementDate)) allDates.push(settlementDate);
      biometryDates.forEach(d => { if (!allDates.includes(d)) allDates.push(d); });
      allDates.sort();

      // Calculate Batch Rate based on LAST interval
      let currentBatchRate = 0;
      let lastActualDay = 0;
      let lastWeight = initialWeight;
      if (actualData.length > 0) {
        const lastActual = actualData[actualData.length - 1];
        lastWeight = lastActual.weight;
        lastActualDay = Math.floor((parseISO(lastActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        const lastTwo = actualData.slice(-2);
        if (lastTwo.length === 2) {
          const p1 = lastTwo[0];
          const p2 = lastTwo[1];
          const d1 = Math.floor((parseISO(p1.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const d2 = Math.floor((parseISO(p2.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          currentBatchRate = (p2.weight - p1.weight) / Math.max(1, d2 - d1);
        } else {
          const firstActual = actualData[0];
          const firstActualDay = Math.floor((parseISO(firstActual.fullDate).getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          currentBatchRate = (lastActual.weight - firstActual.weight) / Math.max(1, lastActualDay - firstActualDay);
        }
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const totalMortalitySoFar = mortalities.filter(m => m.date <= todayStr).reduce((acc, m) => acc + m.count, 0);
      const totalHarvestSoFar = harvests.filter(h => h.date <= todayStr).reduce((acc, h) => acc + h.fishCount, 0);
      const currentLiveStock = Math.max(0, initialPop - totalMortalitySoFar - totalHarvestSoFar);

      const stdWeightAtStart = getWeightAtDay(standardCurvePoints, lastActualDay) || 0;
      const supWeightAtStart = getWeightAtDay(supplierCurvePoints, lastActualDay) || 0;

      return allDates.map(d => {
        const day = differenceInDays(parseISO(d), start);
        const actual = actualData.find(ad => ad.fullDate === d);
        
        // Use current live stock for the entire prediction curve as requested
        const estimatedPop = currentLiveStock;

        let supplierBiomass = undefined;
        if (showSupplierCurve) {
          let supplierWeight = getWeightAtDay(supplierCurvePoints, day);
          if (day > 210 || (supplierWeight !== null && supplierWeight !== undefined && supplierWeight > targetW + 50)) {
            supplierWeight = undefined;
          }
          if (supplierWeight !== undefined && supplierWeight !== null) {
            supplierBiomass = (estimatedPop * supplierWeight) / 1000;
          }
        }

        let standardBiomass = undefined;
        if (showStandardCurve) {
          let standardWeight = getWeightAtDay(standardCurvePoints, day);
          if (day > 210 || (standardWeight !== null && standardWeight !== undefined && standardWeight > targetW + 50)) {
            standardWeight = undefined;
          }
          if (standardWeight !== undefined && standardWeight !== null) {
            standardBiomass = (estimatedPop * standardWeight) / 1000;
          }
        }

        let dateLabel = d;
        try {
          dateLabel = format(new Date(d + 'T12:00:00'), 'dd/MM');
        } catch {}

        let biomass = actual?.biomass;
        let weight = actual?.weight;
        let pop = actual?.pop;

        if (d === settlementDate && biomass === undefined) {
          biomass = Number(((initialPop * initialWeight) / 1000).toFixed(1));
          weight = Math.round(initialWeight);
          pop = initialPop;
        }

        let continueBiomass = undefined;
        if (showContinueCurve && day >= lastActualDay) {
          const gainBatch = currentBatchRate * (day - lastActualDay);
          const gainStd = (getWeightAtDay(standardCurvePoints, day) || 0) - stdWeightAtStart;
          const gainSup = (getWeightAtDay(supplierCurvePoints, day) || 0) - supWeightAtStart;
          
          const projectedWeight = lastWeight + (gainBatch + gainStd + gainSup) / 3;
          if (projectedWeight <= targetW + 50) {
            continueBiomass = Number(((estimatedPop * projectedWeight) / 1000).toFixed(1));
          }
        }

        return {
          date: d === settlementDate ? 'Início' : dateLabel,
          fullDate: d,
          biomass: biomass,
          weight: weight,
          pop: pop,
          supplierBiomass: supplierBiomass ? Number(supplierBiomass.toFixed(1)) : undefined,
          standardBiomass: standardBiomass ? Number(standardBiomass.toFixed(1)) : undefined,
          continueBiomass: continueBiomass
        };
      });
    }

    return baseData;
  }, [state.biometryLogs, state.mortalityLogs, state.cages, state.batches, state.harvestLogs, selectedBatchIds, batchStats, showSupplierCurve, showStandardCurve, showContinueCurve]);

  const totalMortalityInChart = useMemo(() => {
    return mortalityEvolutionData.reduce((acc, curr) => acc + curr.count, 0);
  }, [mortalityEvolutionData]);

  // FUNÇÃO DE EXPORTAÇÃO COMPLETA COM FILTRO DE DATA
  const handleDownloadReport = () => {
    // Definir intervalo de filtro
    const start = startOfDay(parseISO(reportStartDate));
    const end = endOfDay(parseISO(reportEndDate));

    // Função auxiliar para filtrar logs por data
    const filterByDate = (dateString: string | undefined) => {
      if (!dateString) return false;
      try {
        const itemDate = parseISO(dateString);
        if (isNaN(itemDate.getTime())) return false;
        return isWithinInterval(itemDate, { start, end });
      } catch {
        return false;
      }
    };

    // 1. Helpers de Mapeamento
    const cageMap = new Map(state.cages.map(c => [c.id, c.name]));
    const feedMap = new Map(state.feedTypes.map(f => [f.id, f.name]));
    const userMap = new Map(state.users.map(u => [u.id, u.name]));
    const lineMap = new Map(state.lines.map(l => [l.id, l.name]));
    const batchMap = new Map(state.batches.map(b => [b.id, b.name]));
    const protocolMap = new Map(state.protocols.map(p => [p.id, p.name]));

    const wb = XLSX.utils.book_new();

    // 2. ABA: RESUMO GERAL
    const summaryHeader = [
      ["RELATÓRIO GERAL DE PRODUÇÃO - AQUAGESTÃO"],
      ["Período Selecionado:", `${format(start, 'dd/MM/yyyy')} até ${format(end, 'dd/MM/yyyy')}`],
      ["Data de Exportação:", format(new Date(), 'dd/MM/yyyy HH:mm')],
      [""],
      ["ESTATÍSTICAS CONSOLIDADAS POR LOTE (DADOS ATUAIS)"]
    ];
    const summaryData = batchStats.map(bs => [
      bs.name,
      `Estoque: ${formatNumber(bs.stock)} un`,
      `Biomassa: ${formatNumber(bs.biomass, 2)} kg`,
      `Consumo Total: ${formatNumber(bs.feed, 2)} kg`,
      `FCA: ${bs.fca}`,
      `Peso Médio: ${formatNumber(bs.avgWeight, 1)} g`
    ]);
    const wsSummary = XLSX.utils.aoa_to_sheet([...summaryHeader, ...summaryData]);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Geral");

    // 3. ABA: LOTES
    const wsBatches = XLSX.utils.json_to_sheet(state.batches.map(b => ({
      "Nome do Lote": b.name,
      "Data Povoamento": b.settlementDate,
      "Qtd Inicial": b.initialQuantity,
      "Peso Inicial (g)": b.initialUnitWeight,
      "Modelo Produção": protocolMap.get(b.protocolId || '') || "Nenhum"
    })));
    XLSX.utils.book_append_sheet(wb, wsBatches, "Lotes");

    // 4. ABA: GAIOLAS (INVENTÁRIO)
    const wsCages = XLSX.utils.json_to_sheet(state.cages.map(c => ({
      "Gaiola": c.name,
      "Linha/Setor": lineMap.get(c.lineId || '') || "N/A",
      "Capacidade": c.stockingCapacity,
      "Status": c.status,
      "Lote Atual": batchMap.get(c.batchId || '') || "Vazia",
      "Peixes Alojados": c.initialFishCount || 0,
      "Povoamento": c.settlementDate || "",
      "Prev. Despesca": c.harvestDate || ""
    })));
    XLSX.utils.book_append_sheet(wb, wsCages, "Inventário Gaiolas");

    // 5. ABA: TRATOS (ALIMENTAÇÃO) - FILTRADO
    const filteredFeedingLogs = (state.feedingLogs || []).filter(f => filterByDate(f.timestamp));
    const wsFeeding = XLSX.utils.json_to_sheet(filteredFeedingLogs.map(f => {
      let bId = f.batchId;
      if (!bId && f.cageId) {
        const fDate = (f.timestamp || '').split('T')[0];
        const harvest = sortedHarvestLogs.find(h => h.cageId === f.cageId && h.date >= fDate);
        if (harvest) {
          bId = harvest.batchId;
        } else {
          const cage = (state.cages || []).find(c => c.id === f.cageId);
          if (cage?.batchId) {
            const batch = (state.batches || []).find(b => b.id === cage.batchId);
            if (batch && fDate >= batch.settlementDate) {
              bId = cage.batchId;
            }
          }
        }
      }

      return {
        "Data/Hora": f.timestamp,
        "Lote": batchMap.get(bId || '') || "N/A",
        "Gaiola": cageMap.get(f.cageId) || f.cageId,
        "Ração": feedMap.get(f.feedTypeId) || f.feedTypeId,
        "Quantidade (g)": f.amount,
        "Lançado por": userMap.get(f.userId) || f.userId
      };
    }));
    XLSX.utils.book_append_sheet(wb, wsFeeding, "Tratos Alimentares");

    // 6. ABA: MORTALIDADE - FILTRADO
    const filteredMortalityLogs = (state.mortalityLogs || []).filter(m => filterByDate(m.date));
    const wsMortality = XLSX.utils.json_to_sheet(filteredMortalityLogs.map(m => ({
      "Data": m.date,
      "Gaiola": cageMap.get(m.cageId) || m.cageId,
      "Quantidade": m.count,
      "Lançado por": userMap.get(m.userId) || m.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsMortality, "Mortalidade");

    // 7. ABA: BIOMETRIA - FILTRADO
    const filteredBiometryLogs = (state.biometryLogs || []).filter(b => filterByDate(b.date));
    const wsBiometry = XLSX.utils.json_to_sheet(filteredBiometryLogs.map(b => ({
      "Data": b.date,
      "Gaiola": cageMap.get(b.cageId) || b.cageId,
      "Peso Médio (g)": b.averageWeight,
      "Lançado por": userMap.get(b.userId) || b.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsBiometry, "Biometria");

    // 8. ABA: ESTOQUE RAÇÃO
    const wsFeedStock = XLSX.utils.json_to_sheet((state.feedTypes || []).map(f => ({
      "Ração": f.name,
      "Estoque Atual (kg)": f.totalStock / 1000,
      "Capacidade Silo (kg)": f.maxCapacity,
      "Alerta Mínimo (%)": f.minStockPercentage
    })));
    XLSX.utils.book_append_sheet(wb, wsFeedStock, "Estoque Ração");

    // 10. ABA: FRIGORÍFICO - FILTRADO
    const filteredSlaughterLogs = (state.slaughterLogs || []).filter(s => filterByDate(s.date));
    const wsSlaughter = XLSX.utils.json_to_sheet(filteredSlaughterLogs.map(s => ({
      "Data": s.date,
      "Lote Abate": s.slaughterBatch,
      "Produtor": s.producer,
      "Peso Filé Congelado (kg)": s.gtaWeight,
      "Recepção (kg)": s.receptionWeight,
      "Embalado (kg)": s.packedQuantity,
      "Rendimento (%)": s.receptionWeight > 0 ? formatNumber((s.packedQuantity / s.receptionWeight) * 100, 1) : 0,
      "Lote Embalagem": s.packagingBatch,
      "Lançado por": userMap.get(s.userId) || s.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsSlaughter, "Frigorífico");

    // 11. ABA: DESPESCAS - FILTRADO
    const filteredHarvestLogs = (state.harvestLogs || []).filter(h => filterByDate(h.date));
    const wsHarvest = XLSX.utils.json_to_sheet(filteredHarvestLogs.map(h => ({
      "Data": h.date,
      "Lote": batchMap.get(h.batchId) || h.batchId,
      "Gaiola": cageMap.get(h.cageId) || h.cageId,
      "Peixes Retirados": h.fishCount,
      "Peso Total (kg)": h.totalWeight,
      "Peso Médio (g)": h.averageWeight || (h.fishCount > 0 ? formatNumber(h.totalWeight * 1000 / h.fishCount, 1) : 0),
      "Lançado por": userMap.get(h.userId) || h.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsHarvest, "Despescas");

    // 12. ABA: FINANCEIRO FRIGORÍFICO - FILTRADO
    const filteredSlaughterExpenses = (state.slaughterExpenses || []).filter(e => filterByDate(e.date));
    const wsSlaughterFinance = XLSX.utils.json_to_sheet(filteredSlaughterExpenses.map(e => ({
      "Data": e.date,
      "Descrição": e.description,
      "Categoria": e.category,
      "Valor (R$)": e.value,
      "Quantidade": e.quantity || 1,
      "Valor Unitário": e.unitValue || e.value,
      "Lançado por": userMap.get(e.userId) || e.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsSlaughterFinance, "Finanças Frigorífico");

    // 13. ABA: RH FRIGORÍFICO
    const employeeMap = new Map((state.slaughterEmployees || []).map(e => [e.id, e.name]));
    const filteredHREntries = (state.slaughterHREntries || []).filter(e => filterByDate(e.date));
    const wsSlaughterHR = XLSX.utils.json_to_sheet(filteredHREntries.map(e => ({
      "Data": e.date,
      "Funcionários": e.employeeIds.map(id => employeeMap.get(id) || id).join(', '),
      "Tipo": e.type,
      "Dias": e.days || 1,
      "Descrição": e.description || "",
      "Lançado por": userMap.get(e.userId) || e.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsSlaughterHR, "RH Frigorífico");

    // 15. ABA: CAPEX - FILTRADO
    const portfolioMap_capex = new Map(state.portfolios.map(p => [p.id, p.name]));
    const projectMap = new Map(state.capexProjects.map(p => [p.id, p.name]));
    const filteredCapexInvoices = (state.capexInvoices || []).filter(i => filterByDate(i.date));
    const wsCapex = XLSX.utils.json_to_sheet(filteredCapexInvoices.map(i => ({
      "Data": i.date,
      "Portfólio": portfolioMap_capex.get(i.portfolioId) || i.portfolioId,
      "Projeto": projectMap.get(i.projectId) || i.projectId,
      "NF": i.invoiceNumber,
      "Fornecedor": i.supplier,
      "Tipo": i.type,
      "Valor (R$)": i.value,
      "Descrição": i.description,
      "Lançado por": userMap.get(i.userId) || i.userId
    })));
    XLSX.utils.book_append_sheet(wb, wsCapex, "CAPEX (Investimentos)");

    // 16. ABA: UTILIDADES E FRIO - FILTRADO
    const filteredColdStorage = (state.coldStorageLogs || []).filter(l => filterByDate(l.date));
    const filteredUtilities = (state.utilityLogs || []).filter(l => filterByDate(l.date));
    
    const utilityData = [
      ...filteredColdStorage.map(l => {
        const chamber = (state.coldChambers || []).find(c => c.id === l.chamberId);
        return {
          "Data": l.date,
          "Hora": l.time,
          "Tipo": "Câmara Fria",
          "Local/Medição": chamber?.name || (l.chamberId?.startsWith('chamber-') ? l.chamberId.replace('chamber-', '').toUpperCase() : '---'),
          "Valor/Temp": !isNaN(Number(l.temperature)) ? `${l.temperature}°C` : l.temperature,
          "Lançado por": userMap.get(l.userId) || l.userId
        };
      }),
      ...filteredUtilities.map(l => ({
        "Data": l.date,
        "Hora": "---",
        "Tipo": l.type === 'water' ? 'Água' : 'Energia',
        "Local/Medição": "Leitura Geral",
        "Valor/Temp": l.reading,
        "Lançado por": userMap.get(l.userId) || l.userId
      }))
    ].sort((a, b) => b.Data.localeCompare(a.Data) || b.Hora.localeCompare(a.Hora));

    const wsUtilities = XLSX.utils.json_to_sheet(utilityData);
    XLSX.utils.book_append_sheet(wb, wsUtilities, "Utilidades e Frio");

    // 18. ABA: AGENDAMENTO DESPESCA
    const filteredSchedules = (state.harvestSchedules || []).filter(s => filterByDate(s.date));
    const wsSchedules = XLSX.utils.json_to_sheet(filteredSchedules.map(s => ({
      "Data": s.date,
      "Lote": batchMap.get(s.batchId) || s.batchId,
      "Gaiolas": s.cageIds.map(id => cageMap.get(id) || id).join(', '),
      "Último Trato": s.lastFeedingDate || "N/A",
      "Observações": s.notes || ""
    })));
    XLSX.utils.book_append_sheet(wb, wsSchedules, "Agendamento Despesca");

    // FINALIZAR DOWNLOAD
    XLSX.writeFile(wb, `Relatorio_AquaGestao_${reportStartDate}_a_${reportEndDate}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Clima e Mercado stacked */}
      <div className="grid grid-cols-1 gap-4">
        <WeatherWidget />
        <TilapiaPriceWidget />
      </div>

      {/* Alerta de Estoque Baixo */}
      {lowStockFeeds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col md:flex-row items-center gap-6 animate-in fade-in slide-in-from-top duration-500 shadow-lg shadow-red-500/5">
          <div className="p-4 bg-red-100 rounded-2xl text-red-600 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-sm font-black text-red-800 uppercase tracking-widest italic">Estoque Crítico de Ração!</h3>
            <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
              {lowStockFeeds.map(feed => (
                <span key={feed.id} className="px-3 py-1 bg-white border border-red-100 rounded-xl text-[11px] font-black text-red-600 uppercase flex items-center gap-2">
                  <PackageSearch className="w-3 h-3" /> {feed.name}: {formatNumber(feed.totalStock/1000, 0)}kg restantes
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block text-[10px] font-black text-red-400 uppercase tracking-widest max-w-[150px] text-right">
            Providencie a compra imediata para evitar falhas no trato.
          </div>
        </div>
      )}

      {/* Seleção de Lote e Relatórios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-sm"><Layers className="w-6 h-6" /></div>
            <div className="relative">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lotes Selecionados</h3>
              <button 
                onClick={() => setShowBatchSelector(!showBatchSelector)}
                className="flex items-center gap-2 text-lg font-black text-slate-800 hover:text-slate-600 transition-colors"
              >
                {selectedBatchIds.length === 0 ? 'Todos os Lotes' : `${selectedBatchIds.length} Selecionados`}
                <ChevronDown className={`w-5 h-5 transition-transform ${showBatchSelector ? 'rotate-180' : ''}`} />
              </button>

              {showBatchSelector && (
                <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 max-h-80 overflow-y-auto">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400">Selecionar Lotes</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedBatchIds(filteredBatchStats.map(b => b.id))} 
                        className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-700"
                      >
                        Selecionar Todos
                      </button>
                      <button 
                        onClick={() => setSelectedBatchIds([])} 
                        className="text-[9px] font-black uppercase text-red-500 hover:text-red-600"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {filteredBatchStats.map(batch => (
                      <label key={batch.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedBatchIds.includes(batch.id)}
                          onChange={() => toggleBatch(batch.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-slate-700 uppercase">{batch.name}</span>
                      </label>
                    ))}
                    {filteredBatchStats.length === 0 && (
                      <div className="text-center py-4 text-[10px] font-bold text-slate-400 uppercase">Nenhum lote encontrado</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col xl:flex-row-reverse items-center gap-4">
          <button onClick={handleDownloadReport} className="w-full xl:w-auto px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:bg-emerald-700 transition-all active:scale-95 whitespace-nowrap">
            <Download className="w-4 h-4" /> RELATÓRIO (EXCEL)
          </button>
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm hidden sm:block"><Calendar className="w-6 h-6" /></div>
            <div className="flex-1 grid grid-cols-2 gap-3 w-full">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Início Relatório</label>
                <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fim Relatório</label>
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas Gerais do Lote */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MiniStat label="Estoque Vivo Atual" value={<span className="text-xl font-black">{selectedBatchData.stock} un</span>} icon={<Fish className="w-5 h-5" />} color="text-blue-600" subtext="Peixes atualmente na água" />
        <MiniStat 
          label="Total Despescado" 
          value={
            <div className="flex flex-col">
              <span className="text-xl font-black text-indigo-600 leading-none">{selectedBatchData.harvested} un</span>
              <span className="text-[10px] font-black text-slate-400 uppercase mt-1">Biomassa: {formatNumber(selectedBatchData.harvestedWeight, 1)}kg</span>
            </div>
          } 
          icon={<Download className="w-5 h-5" />} 
          color="text-indigo-600" 
          subtext="Peixes retirados para abate" 
        />
        <MiniStat label="Mortalidade Total" value={<span className="text-xl font-black">{selectedBatchData.mortality} un</span>} icon={<FishOff className="w-5 h-5" />} color="text-red-600" subtext="Perdas registradas no lote" />
        <MiniStat label="Biomassa Est. Atual" value={<span className="text-xl font-black">{formatNumber(selectedBatchData.biomass, 1)}kg</span>} icon={<Scale className="w-5 h-5" />} color="text-emerald-600" subtext={selectedBatchData.samplingInfo} />
        <MiniStat 
          label="Ração Consumida" 
          value={
            <div className="flex flex-col">
              <div className="text-xl font-black text-slate-800 leading-none mb-2">{formatNumber(selectedBatchData.feed, 1)}kg</div>
              <div className="space-y-1 pt-2 border-t border-slate-100">
                {selectedBatchData.feedBreakdown.length > 0 ? selectedBatchData.feedBreakdown.map((item: any) => (
                  <div key={item.name} className="flex justify-between items-center text-[9px]">
                    <span className="font-bold text-slate-400 uppercase truncate">{item.name}</span>
                    <span className="font-black text-slate-600 ml-1">{formatNumber(item.amountKg, 1)}k</span>
                  </div>
                )) : <span className="text-[9px] font-bold text-slate-300 italic">Sem consumo</span>}
              </div>
            </div>
          } icon={<Utensils className="w-5 h-5" />} color="text-amber-600" />
        <MiniStat label="FCA (Conversão)" value={<span className="text-xl font-black">{selectedBatchData.fca}</span>} icon={<TrendingUp className="w-5 h-5" />} color="text-indigo-600" subtext="Baseado na biomassa atual" />
      </div>

      {/* Gráficos Evolutivos */}
      <div className="flex flex-col gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><TrendingUp className="w-4 h-4" /> Evolução de Peso (Lote)</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showSupplierCurve} onChange={e => setShowSupplierCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-amber-600 transition-colors">Curva Fornecedor</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showStandardCurve} onChange={e => setShowStandardCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-violet-600 transition-colors">Curva Padrão</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showContinueCurve} onChange={e => setShowContinueCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-blue-600 transition-colors">Projeção Lote</span>
              </label>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={biometryEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'weight') return [`${value} g`, 'PESO REAL'];
                    if (name === 'continueWeight') return [`${value} g`, 'PROJEÇÃO LOTE'];
                    if (name === 'supplierWeight') return [`${value} g`, 'CURVA FORNECEDOR'];
                    if (name === 'standardWeight') return [`${value} g`, 'CURVA PADRÃO'];
                    return [value, name];
                  }}
                />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={4} dot={{r: 4, fill: '#3b82f6', strokeWidth: 0}} activeDot={{r: 6, strokeWidth: 0}} connectNulls />
                {showContinueCurve && (
                  <Line 
                    type="monotone" 
                    dataKey="continueWeight" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    strokeDasharray="5 5" 
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (payload.isHarvestDate) {
                        return (
                          <g key={`harvest-dot-${payload.fullDate}`}>
                            <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="white" strokeWidth={2} />
                            <text x={cx} y={cy - 15} textAnchor="middle" fontSize={8} fontWeight={900} fill="#3b82f6" style={{ textTransform: 'uppercase' }}>
                              Despesca Programada
                            </text>
                          </g>
                        );
                      }
                      return null;
                    }} 
                    connectNulls 
                  />
                )}
                {showSupplierCurve && <Line type="monotone" dataKey="supplierWeight" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />}
                {showStandardCurve && <Line type="monotone" dataKey="standardWeight" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><FishOff className="w-4 h-4" /> Mortalidade Registrada</h3>
            </div>
            <div className="mt-1"><span className="text-[11px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">Perdas Totais: {totalMortalityInChart} un</span></div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mortalityEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]}>{mortalityEvolutionData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.count > 50 ? '#b91c1c' : '#ef4444'} />))}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><Scale className="w-4 h-4" /> Evolução da Biomassa Estimada (kg)</h3>
              <div className="text-[10px] font-bold text-slate-400 uppercase">Considera despescas e mortalidade</div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showSupplierCurve} onChange={e => setShowSupplierCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-amber-600 transition-colors">Fornecedor</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showStandardCurve} onChange={e => setShowStandardCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-violet-600 transition-colors">Padrão</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input type="checkbox" checked={showContinueCurve} onChange={e => setShowContinueCurve(e.target.checked)} className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase group-hover:text-emerald-600 transition-colors">Continue</span>
              </label>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={biomassEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => {
                    if (name === 'biomass') return [`${formatNumber(value)} kg`, 'Biomassa Real'];
                    if (name === 'continueBiomass') return [`${formatNumber(value)} kg`, 'Projeção Lote'];
                    if (name === 'supplierBiomass') return [`${formatNumber(value)} kg`, 'Prev. Fornecedor'];
                    if (name === 'standardBiomass') return [`${formatNumber(value)} kg`, 'Prev. Padrão'];
                    return [value, name];
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="biomass" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  dot={{r: 4, fill: '#10b981', strokeWidth: 0}}
                  activeDot={{r: 6, strokeWidth: 0}}
                  connectNulls
                />
                {showContinueCurve && <Line type="monotone" dataKey="continueBiomass" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />}
                {showSupplierCurve && <Line type="monotone" dataKey="supplierBiomass" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />}
                {showStandardCurve && <Line type="monotone" dataKey="standardBiomass" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
