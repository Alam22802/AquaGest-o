
import React, { useState, useMemo } from 'react';
import { AppState, FeedType, FeedStockLog, User } from '../types';
import { Plus, Package, TrendingDown, AlertCircle, Calendar, Settings2, Edit, Trash2, X, ArrowUpDown, Clock, User as UserIcon, Filter, CheckSquare, Square, Info, FileText, Copy, RotateCcw, FileDown } from 'lucide-react';
import { subDays, format, parseISO } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../utils/formatters';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

interface PlanningRow {
  id: string;
  tableId: string;
  batchId: string;
  fishCount: string;
  averageWeight: string;
  currentWeek: string;
  calculationDays: string;
}

const FeedManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'recommended' | 'planning'>('stock');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    name: '',
    maxCapacity: '1000',
    minStockPercentage: '20',
    currentStockKg: '0'
  });

  const saveRowsToLocals = (rows: PlanningRow[]) => {
    localStorage.setItem('feed_planning_rows', JSON.stringify(rows));
  };

  const [planningRows, setPlanningRows] = useState<PlanningRow[]>(() => {
    const saved = localStorage.getItem('feed_planning_rows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: generateId(),
        tableId: '',
        batchId: '',
        fishCount: '',
        averageWeight: '',
        currentWeek: '1',
        calculationDays: '7'
      }
    ];
  });

  // Filters and Pagination
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterFeedId, setFilterFeedId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 20;

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const [entryData, setEntryData] = useState({ 
    feedId: '', 
    amount: '', 
    date: new Date().toISOString().split('T')[0] 
  });

  const createEmptyRows = (count: number, startWeek: number) => {
    return Array.from({ length: count }, (_, i) => ({
      week: startWeek + i,
      averageWeight: 0,
      gpd: 0,
      feedPercentagePV: 0,
      feedingsPerDay: 3,
      feedTypeId: ''
    }));
  };

  const [tableFormData, setTableFormData] = useState({
    name: '',
    recriaInicial: createEmptyRows(3, 1),
    recriaFinal: createEmptyRows(4, 4),
    crescimento: createEmptyRows(5, 8),
    terminacao: createEmptyRows(14, 13)
  });

  const [editingTableId, setEditingTableId] = useState<string | null>(null);

  const { userMap, feedMap } = useMemo(() => {
    const users = new Map((state.users || []).map(u => [u.id, u]));
    const feeds = new Map((state.feedTypes || []).map(f => [f.id, f]));
    return { userMap: users, feedMap: feeds };
  }, [state.users, state.feedTypes]);

  const handleSaveFeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name) return;

    const newStockGrams = Number(formData.currentStockKg) * 1000;

    if (editingId) {
      const oldFeed = (state.feedTypes || []).find(f => f.id === editingId);
      const diff = newStockGrams - (oldFeed?.totalStock || 0);

      const updatedFeeds = (state.feedTypes || []).map(f => {
        if (f.id === editingId) {
          return {
            ...f,
            name: formData.name,
            maxCapacity: Number(formData.maxCapacity),
            minStockPercentage: Number(formData.minStockPercentage),
            totalStock: newStockGrams,
            updatedAt: Date.now()
          };
        }
        return f;
      });

      const newLogs = [...(state.feedStockLogs || [])];
      if (diff !== 0) {
        newLogs.unshift({
          id: generateId(),
          feedTypeId: editingId,
          amount: diff,
          type: 'Ajuste',
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          updatedAt: Date.now()
        });
      }

      onUpdate({ ...state, feedTypes: updatedFeeds, feedStockLogs: newLogs });
      setEditingId(null);
    } else {
      const newId = generateId();
      const newFeed: FeedType = {
        id: newId,
        name: formData.name,
        totalStock: newStockGrams,
        maxCapacity: Number(formData.maxCapacity),
        minStockPercentage: Number(formData.minStockPercentage),
        updatedAt: Date.now()
      };

      const newLogs = [...(state.feedStockLogs || [])];
      if (newStockGrams > 0) {
        newLogs.unshift({
          id: generateId(),
          feedTypeId: newId,
          amount: newStockGrams,
          type: 'Entrada',
          timestamp: new Date().toISOString(),
          userId: currentUser.id,
          updatedAt: Date.now()
        });
      }

      onUpdate({
        ...state,
        feedTypes: [...(state.feedTypes || []), newFeed],
        feedStockLogs: newLogs
      });
    }
    setFormData({ name: '', maxCapacity: '1000', minStockPercentage: '20', currentStockKg: '0' });
  };

  const startEdit = (feed: FeedType) => {
    if (!hasPermission) return;
    setEditingId(feed.id);
    setFormData({
      name: feed.name,
      maxCapacity: feed.maxCapacity.toString(),
      minStockPercentage: feed.minStockPercentage.toString(),
      currentStockKg: (feed.totalStock / 1000).toString()
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeFeed = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Tem certeza que deseja excluir este modelo de ração?')) return;
    onUpdate({
      ...state,
      feedTypes: (state.feedTypes || []).filter(f => f.id !== id),
      feedStockLogs: (state.feedStockLogs || []).filter(l => l.feedTypeId !== id),
      deletedIds: [...(state.deletedIds || []), id, ...(state.feedStockLogs || []).filter(l => l.feedTypeId === id).map(l => l.id)]
    });
  };

  const addStockEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!entryData.feedId || !entryData.amount) return;

    const amountGrams = Number(entryData.amount) * 1000;

    const updatedFeeds = (state.feedTypes || []).map(f => {
      if (f.id === entryData.feedId) {
        return { ...f, totalStock: f.totalStock + amountGrams, updatedAt: Date.now() };
      }
      return f;
    });

    const newLog: FeedStockLog = {
      id: generateId(),
      feedTypeId: entryData.feedId,
      amount: amountGrams,
      type: 'Entrada',
      timestamp: `${entryData.date}T${format(new Date(), 'HH:mm:ss')}`,
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    onUpdate({ 
      ...state, 
      feedTypes: updatedFeeds, 
      feedStockLogs: [newLog, ...(state.feedStockLogs || [])] 
    });
    setEntryData({ feedId: '', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  const feedStats = useMemo(() => {
    const last7Days = subDays(new Date(), 7);
    return (state.feedTypes || []).map(feed => {
      const consumptionLast7Days = (state.feedingLogs || [])
        .filter(log => log.feedTypeId === feed.id && new Date(log.timestamp) > last7Days)
        .reduce((acc, log) => acc + log.amount, 0);
      const avgDailyConsumption = consumptionLast7Days / 7;
      const daysLeft = avgDailyConsumption > 0 ? Math.floor(feed.totalStock / avgDailyConsumption) : Infinity;
      return { ...feed, avgDaily: avgDailyConsumption, daysLeft };
    });
  }, [state.feedTypes, state.feedingLogs]);

  // Log filtering and sorting
  const filteredLogs = useMemo(() => {
    let logs = Array.isArray(state.feedStockLogs) ? [...state.feedStockLogs] : [];
    
    if (filterFeedId) {
      logs = logs.filter(l => l.feedTypeId === filterFeedId);
    }
    if (startDate) {
      logs = logs.filter(l => l.timestamp.split('T')[0] >= startDate);
    }
    if (endDate) {
      logs = logs.filter(l => l.timestamp.split('T')[0] <= endDate);
    }

    return logs.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [state.feedStockLogs, filterFeedId, startDate, endDate, sortOrder]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(paginatedLogs.map(l => l.id)));
    }
  };

  const toggleSelectLog = (id: string) => {
    const newSelected = new Set(selectedLogIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLogIds(newSelected);
  };

  const removeSelectedLogs = () => {
    if (!hasPermission || selectedLogIds.size === 0) return;
    if (!confirm(`Deseja excluir ${selectedLogIds.size} lançamentos selecionados? O estoque será ajustado.`)) return;

    const logsToRemove = (state.feedStockLogs || []).filter(l => selectedLogIds.has(l.id));
    
    // Group by feed type to update stock
    const feedUpdates = new Map<string, number>();
    logsToRemove.forEach(log => {
      const current = feedUpdates.get(log.feedTypeId) || 0;
      feedUpdates.set(log.feedTypeId, current + log.amount);
    });

    onUpdate({
      ...state,
      feedStockLogs: (state.feedStockLogs || []).filter(l => !selectedLogIds.has(l.id)),
      feedTypes: (state.feedTypes || []).map(f => {
        const adjustment = feedUpdates.get(f.id);
        if (adjustment) return { ...f, totalStock: f.totalStock - adjustment };
        return f;
      })
    });
    setSelectedLogIds(new Set());
  };

  const handleSaveFeedingTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!tableFormData.name) return;

    const newTable = {
      ...tableFormData,
      id: editingTableId || generateId(),
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    const updatedTables = editingTableId
      ? (state.feedingTables || []).map(t => t.id === editingTableId ? newTable : t)
      : [newTable, ...(state.feedingTables || [])];

    onUpdate({ ...state, feedingTables: updatedTables });
    setEditingTableId(null);
    setTableFormData({
      name: '',
      recriaInicial: createEmptyRows(3, 1),
      recriaFinal: createEmptyRows(4, 4),
      crescimento: createEmptyRows(5, 8),
      terminacao: createEmptyRows(14, 13)
    });
  };

  const removeFeedingTable = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Excluir esta tabela de trato?')) return;
    onUpdate({
      ...state,
      feedingTables: (state.feedingTables || []).filter(t => t.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const startEditTable = (table: any) => {
    if (!hasPermission) return;
    setEditingTableId(table.id);
    setTableFormData({
      name: table.name,
      recriaInicial: table.recriaInicial,
      recriaFinal: table.recriaFinal,
      crescimento: table.crescimento,
      terminacao: table.terminacao
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateRow = (phase: 'recriaInicial' | 'recriaFinal' | 'crescimento' | 'terminacao', index: number, field: string, value: string) => {
    const finalValue = field === 'feedTypeId' ? value : Number(value);
    const newPhases = { ...tableFormData };
    newPhases[phase][index] = { ...newPhases[phase][index], [field]: finalValue };
    setTableFormData(newPhases);
  };

  const findClosestWeek = (weight: number, tableId: string) => {
    const table = (state.feedingTables || []).find(t => t.id === tableId);
    if (!table) return null;

    const allRows = [
      ...table.recriaInicial,
      ...table.recriaFinal,
      ...table.crescimento,
      ...table.terminacao
    ];

    if (allRows.length === 0) return null;

    let closestRow = allRows[0];
    let minDiff = Math.abs(allRows[0].averageWeight - weight);

    allRows.forEach(row => {
      const diff = Math.abs(row.averageWeight - weight);
      if (diff < minDiff) {
        minDiff = diff;
        closestRow = row;
      }
    });

    return closestRow.week;
  };

  const handleAddNewPlanningRow = () => {
    const tId = state.feedingTables?.[0]?.id || '';
    const newRows = [
      ...planningRows,
      {
        id: generateId(),
        tableId: tId,
        batchId: '',
        fishCount: '',
        averageWeight: '',
        currentWeek: '1',
        calculationDays: '7'
      }
    ];
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const handleRemovePlanningRow = (id: string) => {
    if (planningRows.length <= 1) return;
    const newRows = planningRows.filter(r => r.id !== id);
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const handleResetPlanning = () => {
    if (!confirm('Deseja limpar todos os lotes e iniciar uma nova programação?')) return;
    const tId = state.feedingTables?.[0]?.id || '';
    const resetRows = [
      {
        id: generateId(),
        tableId: tId,
        batchId: '',
        fishCount: '',
        averageWeight: '',
        currentWeek: '1',
        calculationDays: '7'
      }
    ];
    setPlanningRows(resetRows);
    saveRowsToLocals(resetRows);
  };

  const handleRowFieldChange = (rowId: string, field: keyof PlanningRow, value: string) => {
    const newRows = planningRows.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const handleRowBatchChange = (rowId: string, batchId: string) => {
    const batch = (state.batches || []).find(b => b.id === batchId);
    if (!batch) {
      const newRows = planningRows.map(row => {
        if (row.id === rowId) {
          return {
            ...row,
            batchId: '',
            fishCount: '',
            averageWeight: '',
            currentWeek: '1'
          };
        }
        return row;
      });
      setPlanningRows(newRows);
      saveRowsToLocals(newRows);
      return;
    }

    const cagesMap = new Map((state.cages || []).map(c => [c.id, c]));
    
    const batchMortality = (state.mortalityLogs || [])
      .filter(m => m.batchId === batchId || (m.cageId && cagesMap.get(m.cageId)?.batchId === batchId))
      .reduce((sum, m) => sum + m.count, 0);

    const batchHarvested = (state.harvestLogs || [])
      .filter(h => h.batchId === batchId)
      .reduce((sum, h) => sum + h.fishCount, 0);

    const liveFish = Math.max(0, batch.initialQuantity - batchMortality - batchHarvested);

    const batchBiometries = (state.biometryLogs || [])
      .filter(b => b.batchId === batchId || (b.cageId && cagesMap.get(b.cageId)?.batchId === batchId));
    const latestBiometry = batchBiometries.length > 0 
      ? [...batchBiometries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
      : null;
    const avgWeight = latestBiometry ? latestBiometry.averageWeight : batch.initialUnitWeight;

    const currentRow = planningRows.find(r => r.id === rowId);
    const tableId = currentRow?.tableId || (state.feedingTables?.[0]?.id || '');
    
    let weekStr = '1';
    if (tableId) {
      const closestWeek = findClosestWeek(avgWeight, tableId);
      if (closestWeek !== null) {
        weekStr = closestWeek.toString();
      }
    }

    const newRows = planningRows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          batchId,
          tableId,
          fishCount: liveFish.toString(),
          averageWeight: avgWeight.toString(),
          currentWeek: weekStr
        };
      }
      return row;
    });
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const handleRowWeightChange = (rowId: string, weightStr: string) => {
    const weight = Number(weightStr);
    const newRows = planningRows.map(row => {
      if (row.id === rowId) {
        let newWeek = row.currentWeek;
        if (weightStr && !isNaN(weight) && row.tableId) {
          const closestWeek = findClosestWeek(weight, row.tableId);
          if (closestWeek !== null) {
            newWeek = closestWeek.toString();
          }
        }
        return {
          ...row,
          averageWeight: weightStr,
          currentWeek: newWeek
        };
      }
      return row;
    });
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const handleRowTableChange = (rowId: string, tableId: string) => {
    const newRows = planningRows.map(row => {
      if (row.id === rowId) {
        let newWeek = row.currentWeek;
        if (row.averageWeight && tableId) {
          const closestWeek = findClosestWeek(Number(row.averageWeight), tableId);
          if (closestWeek !== null) {
            newWeek = closestWeek.toString();
          }
        }
        return {
          ...row,
          tableId,
          currentWeek: newWeek
        };
      }
      return row;
    });
    setPlanningRows(newRows);
    saveRowsToLocals(newRows);
  };

  const getRowCalculations = (row: PlanningRow) => {
    if (!row.tableId || !row.currentWeek || !row.fishCount) {
      return { dailyFeed: 0, totalFeed: 0, feedTypeId: '', feedPercentPV: 0 };
    }

    const table = (state.feedingTables || []).find(t => t.id === row.tableId);
    if (!table) return { dailyFeed: 0, totalFeed: 0, feedTypeId: '', feedPercentPV: 0 };

    const week = Number(row.currentWeek);
    const fishCount = Number(row.fishCount);
    
    const allRows = [
      ...table.recriaInicial,
      ...table.recriaFinal,
      ...table.crescimento,
      ...table.terminacao
    ];
    
    const r = allRows.find(item => item.week === week);
    if (!r) return { dailyFeed: 0, totalFeed: 0, feedTypeId: '', feedPercentPV: 0 };

    const weight = row.averageWeight ? Number(row.averageWeight) : r.averageWeight;
    const feedPercentPV = r.feedPercentagePV;
    
    const dailyFeed = (fishCount * weight / 1000) * (feedPercentPV / 100);
    const days = Number(row.calculationDays) || 1;
    const totalFeed = dailyFeed * days;

    return {
      dailyFeed,
      totalFeed,
      feedTypeId: r.feedTypeId || '',
      feedPercentPV
    };
  };

  const orderAggregation = useMemo(() => {
    const map = new Map<string, { feedName: string; totalKg: number }>();
    let grandTotalKg = 0;

    planningRows.forEach(row => {
      const calcs = getRowCalculations(row);
      if (calcs.totalFeed > 0 && calcs.feedTypeId) {
        const feed = feedMap.get(calcs.feedTypeId);
        const feedName = feed ? feed.name : 'Ração não especificada';
        const current = map.get(calcs.feedTypeId) || { feedName, totalKg: 0 };
        current.totalKg += calcs.totalFeed;
        map.set(calcs.feedTypeId, current);
        grandTotalKg += calcs.totalFeed;
      }
    });

    let grandTotalStockKg = 0;
    let grandTotalOrderKg = 0;

    const items = Array.from(map.entries()).map(([feedId, data]) => {
      const feed = feedMap.get(feedId);
      const stockKg = feed ? (feed.totalStock / 1000) : 0;
      const orderKg = Math.max(0, data.totalKg - stockKg);
      
      grandTotalStockKg += stockKg;
      grandTotalOrderKg += orderKg;

      return {
        feedId,
        feedName: data.feedName,
        totalKg: data.totalKg,                     // Demanda planejada
        stockKg,                                   // Saldo no estoque (Kg)
        orderKg,                                   // Total real a pedir (Kg)
        bags25kg: Math.ceil(orderKg / 25),
        percentage: grandTotalKg > 0 ? (data.totalKg / grandTotalKg) * 100 : 0
      };
    });

    return {
      items,
      grandTotalKg,
      grandTotalStockKg,
      grandTotalOrderKg
    };
  }, [planningRows, feedMap, state.feedingTables]);

  const handleDownloadPDF = () => {
    if (orderAggregation.items.length === 0) return;

    try {
      const doc = new jsPDF();
      
      // Theme colors
      const primaryColor = [22, 101, 52]; // Emerald 800
      const secondaryColor = [30, 41, 59]; // Slate 800
      
      // Header Banner
      doc.setFillColor(22, 101, 52); 
      doc.rect(0, 0, 210, 36, 'F');

      // Title text inside banner
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AQUAGESTÃO PISCICULTURA', 15, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(215, 235, 215);
      doc.text('Programação de Ração e Pedido Consolidado Oficial', 15, 22);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 15, 29);

      // Metadata card
      doc.setFillColor(241, 245, 249); // slate 100 bg
      doc.rect(15, 42, 180, 26, 'F');
      
      // User who did the entries / calculations
      doc.setTextColor(30, 41, 59); // slate 800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('METADADOS DO PEDIDO CONSOLIDADO', 20, 48);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate 600
      doc.text(`Responsável Clínico / Lançamento: ${currentUser?.name || 'Não especificado'} (${currentUser?.email || 'N/A'})`, 20, 54);
      doc.text(`Regra de Dedução: Totalmente calculado abatendo o saldo real do estoque físico de ração`, 20, 59);
      doc.text(`Identificação Única: ${generateId().toUpperCase().slice(0, 8)} - PDF não editável certificado por AquaGestão`, 20, 64);

      // Section 1: Detailed Batches feeding table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(22, 101, 52);
      doc.text('1. PARÂMETROS E PLANEJAMENTO DETALHADO POR LOTE', 15, 76);

      const batchTableHeader = [['Lote / Tanque', 'Tabela Ref.', 'Peixes Vivos', 'P. Médio', 'Semana', 'Dias', 'Ração e % PV', 'Consumo (Kg)']];
      const batchTableRows = planningRows.map((row, index) => {
        const batch = (state.batches || []).find(b => b.id === row.batchId);
        const table = (state.feedingTables || []).find(t => t.id === row.tableId);
        const calcs = getRowCalculations(row);
        const feed = calcs.feedTypeId ? feedMap.get(calcs.feedTypeId) : null;
        const feedStr = feed ? `${feed.name.toUpperCase()} (${formatNumber(calcs.feedPercentPV, 2)}% PV)` : 'N/A';
        
        return [
          batch ? batch.name.toUpperCase() : `Lote Desconhecido ${index + 1}`,
          table ? table.name.toUpperCase() : 'N/A',
          formatNumber(Number(row.fishCount) || 0, 0),
          `${formatNumber(Number(row.averageWeight) || 0, 1)}g`,
          `S${row.currentWeek}`,
          `${row.calculationDays}d`,
          feedStr,
          `${formatNumber(calcs.totalFeed, 1)} kg`
        ];
      });

      autoTable(doc, {
        startY: 80,
        head: batchTableHeader,
        body: batchTableRows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { fontStyle: 'bold' },
          7: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
      });

      // Section 2: Consolidated PDF result
      const nextY1 = ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) 
        ? (doc as any).lastAutoTable.finalY + 10 
        : 140;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(22, 101, 52);
      doc.text('2. PEDIDO CONSOLIDADO PARA FORNECEDOR (DEPOIS DE ABATER ESTOQUE)', 15, nextY1);

      const consolidatedHeaders = [['Modelo de Ração', 'Demanda Total (Kg)', 'Saldo Estoque (Kg)', 'A Pedir Real (Kg)']];
      const consolidatedRows = orderAggregation.items.map(item => [
        item.feedName.toUpperCase(),
        `${formatNumber(item.totalKg, 1)} kg`,
        `${formatNumber(item.stockKg, 1)} kg`,
        `${formatNumber(item.orderKg, 1)} kg`
      ]);

      autoTable(doc, {
        startY: nextY1 + 4,
        head: consolidatedHeaders,
        body: consolidatedRows,
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] }
        },
        foot: [[
          'TOTALIZADORES',
          `${formatNumber(orderAggregation.grandTotalKg, 1)} kg`,
          `${formatNumber(orderAggregation.grandTotalStockKg, 1)} kg`,
          `${formatNumber(orderAggregation.grandTotalOrderKg, 1)} kg`
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8.5 },
        margin: { left: 15, right: 15 }
      });

      let nextY2 = ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) 
        ? (doc as any).lastAutoTable.finalY + 18 
        : 200;

      if (nextY2 > 245) {
        doc.addPage();
        nextY2 = 25;
      }

      // Divider and signature areas
      doc.setLineWidth(0.4);
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.line(15, nextY2, 95, nextY2);
      doc.line(115, nextY2, 195, nextY2);

      // Signatures
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('Responsável pela Programação', 15, nextY2 + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(currentUser?.name || 'Não especificado', 15, nextY2 + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`E-mail: ${currentUser?.email || 'N/A'}`, 15, nextY2 + 12);

      doc.text('Autorização / Compras', 115, nextY2 + 4);
      doc.text('Assinatura / Carimbo', 115, nextY2 + 8);
      doc.text('Data: ____ / ____ / ________', 115, nextY2 + 12);

      // Footer notes at bottom (A4 height is 297)
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate 400
      doc.text('Documento eletrônico autenticado pelo sistema AquaGestão. Impresso sob demanda e protegido.', 15, 288);
      doc.text('Página 1 de 1', 195, 288, { align: 'right' });

      // Save the file
      const dateStr = format(new Date(), 'dd-MM-yyyy_HHmm');
      doc.save(`Pedido_Racao_AquaGestao_${dateStr}.pdf`);
    } catch (error) {
      console.error('Falha ao gerar o PDF:', error);
      alert('Houve um erro ao processar a geração do PDF. Por favor, tente novamente.');
    }
  };

  const handleCopyOrder = () => {
    if (orderAggregation.items.length === 0) return;
    let text = `📋 *RESUMO DO PEDIDO DE RAÇÃO*\n`;
    text += `----------------------------------\n\n`;
    
    orderAggregation.items.forEach(item => {
      text += `🔹 *${item.feedName.toUpperCase()}*\n`;
      text += `   • Demanda Total: ${formatNumber(item.totalKg, 1)} kg\n`;
      text += `   • Saldo em Estoque: ${formatNumber(item.stockKg, 1)} kg\n`;
      text += `   • *A ser pedido: ${formatNumber(item.orderKg, 1)} kg*\n\n`;
    });

    text += `----------------------------------\n`;
    text += `Total Planejado: ${formatNumber(orderAggregation.grandTotalKg, 1)} kg\n`;
    text += `Estoque Abatido: ${formatNumber(orderAggregation.grandTotalStockKg, 1)} kg\n`;
    text += `Total Líquido a Pedir: *${formatNumber(orderAggregation.grandTotalOrderKg, 1)} kg*\n\n`;
    text += `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Pedido copiado para a área de transferência!');
    }).catch(err => {
      console.error('Falha ao copiar:', err);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl w-fit mb-4 gap-1">
        <button
          onClick={() => setActiveSubTab('stock')}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'stock' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Estoque de Ração
        </button>
        <button
          onClick={() => setActiveSubTab('recommended')}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'recommended' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Trato Indicado
        </button>
        <button
          onClick={() => setActiveSubTab('planning')}
          className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'planning' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Programação Ração
        </button>
      </div>

      {activeSubTab === 'stock' ? (
        <React.Fragment>
          {hasPermission ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all ${editingId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-200'}`}>
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
              <div className="flex items-center gap-2">
                 {editingId ? <Edit className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
                 {editingId ? 'Editar Modelo' : 'Novo Modelo de Ração'}
              </div>
              {editingId && (
                <button onClick={() => { setEditingId(null); setFormData({name:'', maxCapacity:'1000', minStockPercentage:'20', currentStockKg: '0'}); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </h3>
            <form onSubmit={handleSaveFeed} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Modelo (Ex: 2a3mm)</label>
                <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Capacidade (Kg)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.maxCapacity} onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Alerta Mínimo (%)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={formData.minStockPercentage} onChange={(e) => setFormData({ ...formData, minStockPercentage: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Saldo Atual (Kg)</label>
                <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-amber-500/20" value={formData.currentStockKg} onChange={(e) => setFormData({ ...formData, currentStockKg: e.target.value })} />
                <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tight leading-relaxed italic opacity-70">O ajuste manual do saldo gerará um registro de "Ajuste" no histórico.</p>
              </div>
              <button type="submit" className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 ${editingId ? 'bg-amber-600 shadow-amber-600/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
                {editingId ? 'Atualizar Modelo' : 'Cadastrar Modelo'}
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tighter italic">
              <Package className="w-5 h-5 text-emerald-500" /> Entrada de Estoque
            </h3>
            <form onSubmit={addStockEntry} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Modelo de Ração</label>
                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" value={entryData.feedId} onChange={(e) => setEntryData({...entryData, feedId: e.target.value})}>
                  <option value="">Selecione...</option>
                  {(state.feedTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Quantidade (Kg)</label>
                  <input type="number" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={entryData.amount} onChange={(e) => setEntryData({...entryData, amount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Data</label>
                  <input type="date" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" value={entryData.date} onChange={(e) => setEntryData({...entryData, date: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-500/20 transition-all active:scale-95">
                Registrar Entrada
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
          <Package className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar modelos ou estoque de ração.</p>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2 font-black text-slate-800 uppercase tracking-tighter italic">
          <Settings2 className="w-5 h-5 text-blue-500" /> Configuração e Status do Estoque
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Modelo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Capacidade</th>
                <th className="px-6 py-4">Alerta</th>
                {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feedStats.map(feed => {
                const stockKg = feed.totalStock / 1000;
                const percentage = feed.maxCapacity > 0 ? (stockKg / feed.maxCapacity) * 100 : 0;
                const isCritical = percentage <= feed.minStockPercentage;
                
                return (
                  <tr key={feed.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{feed.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(100, percentage)}%`}} />
                        </div>
                        <span className={`text-[11px] font-black ${isCritical ? 'text-red-600' : 'text-slate-600'}`}>
                          {formatNumber(stockKg, 1)}kg ({formatNumber(percentage, 0)}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatNumber(feed.maxCapacity)}kg</td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatNumber(feed.minStockPercentage)}%</td>
                    {hasPermission && (
                      <td className="px-6 py-4 text-center">
                         <div className="flex justify-center gap-2">
                            <button onClick={() => startEdit(feed)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeFeed(feed.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {feedStats.length === 0 && (
            <div className="p-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhuma ração cadastrada.</div>
          )}
        </div>
      </div>

      {/* Histórico de Lançamentos */}
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Histórico de Lançamentos (Entradas/Ajustes)</h3>
          <div className="flex items-center gap-2">
            {selectedLogIds.size > 0 && (
              <button 
                onClick={removeSelectedLogs}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                <Trash2 className="w-3 h-3" /> Excluir ({selectedLogIds.size})
              </button>
            )}
            <select 
              className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg outline-none border-none"
              value={filterFeedId}
              onChange={e => {
                setFilterFeedId(e.target.value);
                setCurrentPage(1);
                setSelectedLogIds(new Set());
              }}
            >
              <option value="">Todos os Modelos</option>
              {(state.feedTypes || []).map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
              <input 
                type="date"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
              />
              <span className="text-[9px] font-black text-slate-300">ATÉ</span>
              <input 
                type="date"
                className="text-[11px] font-black uppercase text-slate-500 bg-transparent outline-none border-none"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                  setSelectedLogIds(new Set());
                }}
              />
            </div>
            <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
              <ArrowUpDown className="w-3 h-3" /> {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                {hasPermission && (
                  <th className="px-6 py-4 w-10">
                    <button onClick={toggleSelectAll} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                      {selectedLogIds.size === paginatedLogs.length && paginatedLogs.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                )}
                <th className="px-6 py-4">Tipo / Modelo</th>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Lançado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map(log => {
                const feed = feedMap.get(log.feedTypeId);
                const user = userMap.get(log.userId);
                const isSelected = selectedLogIds.has(log.id);
                const isAdjustment = log.type === 'Ajuste';
                const isNegative = log.amount < 0;

                return (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    {hasPermission && (
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelectLog(log.id)} className="p-1 text-slate-400 hover:text-blue-500 transition-colors">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mb-1 ${isAdjustment ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {log.type}
                      </div>
                      <div className="font-black text-slate-800 uppercase">{feed?.name || '---'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'dd/MM/yyyy')}</div>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3 opacity-30" /> {format(parseISO(log.timestamp), 'HH:mm')}</div>
                    </td>
                    <td className={`px-6 py-4 font-black ${isNegative ? 'text-red-600' : 'text-slate-700'}`}>
                      {isNegative ? '' : '+'}{formatNumber(log.amount / 1000, 1)}kg
                    </td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase">
                      <div className="flex items-center gap-1"><UserIcon className="w-3 h-3 opacity-30" /> @{user?.username || '---'}</div>
                    </td>
                  </tr>
                );
              })}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td colSpan={hasPermission ? 5 : 4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhum lançamento registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-4">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Anterior
            </button>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Página {currentPage} de {totalPages}
            </span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </React.Fragment>
  ) : activeSubTab === 'recommended' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          {hasPermission ? (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3 uppercase tracking-tighter italic">
                <Settings2 className="w-6 h-6 text-blue-500" />
                {editingTableId ? 'Editar Tabela de Trato' : 'Nova Tabela de Trato Indicado'}
              </h3>
              <form onSubmit={handleSaveFeedingTable} className="space-y-10">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Nome da Tabela</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Tilápia Ciclo Verão"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={tableFormData.name}
                      onChange={(e) => setTableFormData({ ...tableFormData, name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Phases */}
                {[
                  { id: 'recriaInicial' as const, label: 'RECRIA INICIAL', rows: 3 },
                  { id: 'recriaFinal' as const, label: 'RECRIA FINAL', rows: 4 },
                  { id: 'crescimento' as const, label: 'CRESCIMENTO', rows: 5 },
                  { id: 'terminacao' as const, label: 'TERMINAÇÃO', rows: 14 }
                ].map(phase => (
                  <div key={phase.id} className="space-y-4">
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest border-l-4 border-blue-600 pl-3">{phase.label}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                            <th className="px-2 py-2 w-24">Semana</th>
                            <th className="px-2 py-2">Ração</th>
                            <th className="px-2 py-2">Peso Médio (g)</th>
                            <th className="px-2 py-2">GPD (g/dia)</th>
                            <th className="px-2 py-2">Trato Diário (% PV)</th>
                            <th className="px-2 py-2">Tratos/Dia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tableFormData[phase.id].map((row: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-2 py-2 w-24">
                                <input
                                  type="number"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.week}
                                  onChange={(e) => updateRow(phase.id, idx, 'week', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-[10px] outline-none"
                                  value={row.feedTypeId || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'feedTypeId', e.target.value)}
                                >
                                  <option value="">Selecione...</option>
                                  {(state.feedTypes || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.averageWeight || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'averageWeight', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.gpd || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'gpd', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none pr-6"
                                    value={row.feedPercentagePV || ''}
                                    onChange={(e) => updateRow(phase.id, idx, 'feedPercentagePV', e.target.value)}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</span>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none"
                                  value={row.feedingsPerDay || ''}
                                  onChange={(e) => updateRow(phase.id, idx, 'feedingsPerDay', e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-4">
                  {editingTableId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTableId(null);
                        setTableFormData({
                          name: '',
                          recriaInicial: createEmptyRows(3, 1),
                          recriaFinal: createEmptyRows(4, 4),
                          crescimento: createEmptyRows(5, 8),
                          terminacao: createEmptyRows(14, 13)
                        });
                      }}
                      className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                  >
                    {editingTableId ? 'Atualizar Tabela' : 'Salvar Tabela'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
              <Info className="w-10 h-10 text-slate-300" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modo Leitura Ativo</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Você não possui permissão para gerenciar tabelas de trato.</p>
            </div>
          )}

          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                Tabelas de Trato Cadastradas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Nome da Tabela</th>
                    <th className="px-6 py-4">Total Semanas</th>
                    <th className="px-6 py-4">Última Atualização</th>
                    {hasPermission && <th className="px-6 py-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(state.feedingTables || []).map(table => {
                    const totalWeeks = table.terminacao.length > 0 ? table.terminacao[table.terminacao.length - 1].week : 0;
                    return (
                      <tr key={table.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800 uppercase">{table.name}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">{totalWeeks} semanas</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400">
                          {table.updatedAt ? format(table.updatedAt, 'dd/MM/yyyy HH:mm') : '---'}
                        </td>
                        {hasPermission && (
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => startEditTable(table)} className="p-2 text-slate-300 hover:text-blue-500 transition-colors">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeFeedingTable(table.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {(state.feedingTables || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">Nenhuma tabela cadastrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeSubTab === 'planning' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-[#344434] p-8 rounded-[2.5rem] shadow-2xl text-[#e4e4d4]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-black flex items-center gap-3 uppercase tracking-tighter italic text-white">
                  <TrendingDown className="w-6 h-6 text-blue-400" />
                  Programação de Ração Semanal
                </h3>
                <p className="text-xs text-[#e4e4d4]/70 mt-1">
                  Configure a alimentação para múltiplos lotes simultaneamente e consolide o pedido semanal para o fornecedor.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddNewPlanningRow}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Adicionar Lote
                </button>
                <button
                  type="button"
                  onClick={handleResetPlanning}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-white/10 transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" /> Limpar
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black text-[#e4e4d4]/60 uppercase tracking-widest">
                    <th className="py-3 px-2">Lote</th>
                    <th className="py-3 px-2">Tabela Referência</th>
                    <th className="py-3 px-2 w-28 text-center">Peixes Vivos</th>
                    <th className="py-3 px-2 w-28 text-center">Peso Médio (g)</th>
                    <th className="py-3 px-2 w-32 text-center">Semana Indicada</th>
                    <th className="py-3 px-2 w-20 text-center">Dias</th>
                    <th className="py-3 px-2 text-right">Consumo Período</th>
                    <th className="py-3 px-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {planningRows.map((row) => {
                    const calcs = getRowCalculations(row);
                    const table = (state.feedingTables || []).find(t => t.id === row.tableId);
                    const allTableWeeks = table ? [
                      ...table.recriaInicial,
                      ...table.recriaFinal,
                      ...table.crescimento,
                      ...table.terminacao
                    ].map(r => r.week) : [];

                    return (
                      <tr key={row.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-2">
                          <select
                            className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white focus:ring-1 focus:ring-blue-500"
                            value={row.batchId}
                            onChange={(e) => handleRowBatchChange(row.id, e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {[...(state.batches || [])]
                              .filter(b => !b.isClosed)
                              .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }))
                              .map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <select
                            className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white focus:ring-1 focus:ring-blue-500"
                            value={row.tableId}
                            onChange={(e) => handleRowTableChange(row.id, e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {(state.feedingTables || []).map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white text-center"
                            value={row.fishCount}
                            onChange={(e) => handleRowFieldChange(row.id, 'fishCount', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            step="0.1"
                            className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white text-center"
                            value={row.averageWeight}
                            onChange={(e) => handleRowWeightChange(row.id, e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-2">
                          {allTableWeeks.length > 0 ? (
                            <select
                              className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white text-center"
                              value={row.currentWeek}
                              onChange={(e) => handleRowFieldChange(row.id, 'currentWeek', e.target.value)}
                            >
                              {allTableWeeks.map(wk => (
                                <option key={wk} value={wk}>Semana {wk}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-xs font-bold text-slate-400 py-2 text-center bg-black/10 rounded-xl border border-white/5">
                              {row.currentWeek || '---'}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            min="1"
                            className="w-full px-2 py-2 bg-black/35 border border-white/10 rounded-xl font-bold text-xs outline-none text-white text-center"
                            value={row.calculationDays}
                            onChange={(e) => handleRowFieldChange(row.id, 'calculationDays', e.target.value)}
                          />
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-extrabold text-white text-sm">
                            {formatNumber(calcs.totalFeed, 1)} kg
                          </div>
                          <div className="text-[9px] text-[#e4e4d4]/50 font-bold uppercase">
                            {calcs.feedPercentPV > 0 ? `${formatNumber(calcs.feedPercentPV, 2)}% PV` : '---'}
                            {calcs.feedTypeId && (() => {
                              const fType = feedMap.get(calcs.feedTypeId);
                              return fType ? ` • ${fType.name}` : '';
                            })()}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {planningRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePlanningRow(row.id)}
                              className="p-1.5 text-[#e4e4d4]/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack View */}
            <div className="lg:hidden space-y-4">
              {planningRows.map((row, index) => {
                const calcs = getRowCalculations(row);
                const table = (state.feedingTables || []).find(t => t.id === row.tableId);
                const allTableWeeks = table ? [
                  ...table.recriaInicial,
                  ...table.recriaFinal,
                  ...table.crescimento,
                  ...table.terminacao
                ].map(r => r.week) : [];

                return (
                  <div key={row.id} className="bg-black/20 p-5 rounded-2xl border border-white/10 space-y-3 relative">
                    {planningRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePlanningRow(row.id)}
                        className="absolute right-3 top-3 p-1 text-[#e4e4d4]/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                      LOTE #{index + 1}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Lote</label>
                        <select
                          className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl font-bold text-xs outline-none text-white"
                          value={row.batchId}
                          onChange={(e) => handleRowBatchChange(row.id, e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {[...(state.batches || [])]
                            .filter(b => !b.isClosed)
                            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }))
                            .map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Tabela de Referência</label>
                        <select
                          className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl font-bold text-xs outline-none text-white"
                          value={row.tableId}
                          onChange={(e) => handleRowTableChange(row.id, e.target.value)}
                        >
                          <option value="">Selecione...</option>
                          {(state.feedingTables || []).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Peixes Vivos</label>
                        <input
                          type="number"
                          className="w-full px-2 py-2 bg-black/20 border border-white/10 rounded-xl font-bold text-xs text-center outline-none text-white"
                          value={row.fishCount}
                          onChange={(e) => handleRowFieldChange(row.id, 'fishCount', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Peso Médio (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-2 py-2 bg-black/20 border border-white/10 rounded-xl font-bold text-xs text-center outline-none text-white"
                          value={row.averageWeight}
                          onChange={(e) => handleRowWeightChange(row.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Semana</label>
                        {allTableWeeks.length > 0 ? (
                          <select
                            className="w-full px-2 py-2 bg-black/20 border border-white/10 rounded-xl font-bold text-xs text-center outline-none text-white"
                            value={row.currentWeek}
                            onChange={(e) => handleRowFieldChange(row.id, 'currentWeek', e.target.value)}
                          >
                            {allTableWeeks.map(wk => (
                              <option key={wk} value={wk}>Semana {wk}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="text-xs font-bold text-slate-400 py-2 text-center bg-black/10 rounded-xl border border-white/5">
                            {row.currentWeek || '---'}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center pt-2 border-t border-white/5">
                      <div>
                        <label className="block text-[9px] font-bold text-[#e4e4d4]/50 uppercase tracking-wider mb-1">Dias p/ Cálculo</label>
                        <input
                          type="number"
                          min="1"
                          className="w-20 px-2 py-1.5 bg-black/20 border border-white/10 rounded-xl font-bold text-xs text-center outline-none text-white"
                          value={row.calculationDays}
                          onChange={(e) => handleRowFieldChange(row.id, 'calculationDays', e.target.value)}
                        />
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-blue-400">
                          {formatNumber(calcs.totalFeed, 1)} kg
                        </div>
                        <div className="text-[9px] text-[#e4e4d4]/50 font-bold uppercase mt-0.5">
                          {calcs.feedPercentPV > 0 ? `${formatNumber(calcs.feedPercentPV, 2)}% PV` : ''}
                          {calcs.feedTypeId && (() => {
                            const fType = feedMap.get(calcs.feedTypeId);
                            return fType ? `, ${fType.name}` : '';
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aggregated Feed Order Summary */}
          {orderAggregation.items.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 font-sans">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter italic">
                      Resumo da Programação (Pedido Consolidado)
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tight">
                      Calculado abatendo o saldo atual do estoque físico de ração
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleDownloadPDF}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition-all active:scale-95"
                  >
                    <FileDown className="w-4 h-4" /> PDF do Pedido
                  </button>
                  <button
                    onClick={handleCopyOrder}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all active:scale-95"
                  >
                    <Copy className="w-4 h-4" /> Copiar (WhatsApp)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-sans">
                <div className="lg:col-span-7 space-y-4">
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3.5">Modelo de Ração</th>
                          <th className="px-3 py-3.5 text-right font-black">Demanda (Kg)</th>
                          <th className="px-3 py-3.5 text-right font-black">Estoque (Kg)</th>
                          <th className="px-3 py-3.5 text-right font-black text-blue-600">A Pedir (Kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderAggregation.items.map(item => (
                          <tr key={item.feedId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4 font-black text-slate-800 uppercase">{item.feedName}</td>
                            <td className="px-3 py-4 text-right font-bold text-slate-500">{formatNumber(item.totalKg, 1)} kg</td>
                            <td className="px-3 py-4 text-right font-bold text-slate-400">{formatNumber(item.stockKg, 1)} kg</td>
                            <td className="px-3 py-4 text-right font-black text-blue-600 text-sm">
                              {formatNumber(item.orderKg, 1)} kg
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-black text-slate-800 border-t border-slate-100">
                          <td className="px-5 py-4 uppercase">Total Geral</td>
                          <td className="px-3 py-4 text-right text-slate-600">{formatNumber(orderAggregation.grandTotalKg, 1)} kg</td>
                          <td className="px-3 py-4 text-right text-slate-500">{formatNumber(orderAggregation.grandTotalStockKg, 1)} kg</td>
                          <td className="px-3 py-4 text-right text-blue-600 text-sm">{formatNumber(orderAggregation.grandTotalOrderKg, 1)} kg</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Copiable Text Preview Box */}
                <div className="lg:col-span-5 flex flex-col h-full">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Visualização do Texto</label>
                  <div className="flex-1 min-h-[220px] bg-slate-50 border border-slate-100 rounded-2xl p-4 font-mono text-[11px] text-slate-700 overflow-y-auto leading-relaxed border-dashed whitespace-pre-wrap">
                    {(() => {
                      let text = `📋 *RESUMO DO PEDIDO DE RAÇÃO*\n`;
                      text += `----------------------------------\n\n`;
                      orderAggregation.items.forEach(item => {
                        text += `🔹 *${item.feedName.toUpperCase()}*\n`;
                        text += `   • Demanda Total: ${formatNumber(item.totalKg, 1)} kg\n`;
                        text += `   • Saldo em Estoque: ${formatNumber(item.stockKg, 1)} kg\n`;
                        text += `   • *A ser pedido: ${formatNumber(item.orderKg, 1)} kg*\n\n`;
                      });
                      text += `----------------------------------\n`;
                      text += `Total Planejado: ${formatNumber(orderAggregation.grandTotalKg, 1)} kg\n`;
                      text += `Estoque Abatido: ${formatNumber(orderAggregation.grandTotalStockKg, 1)} kg\n`;
                      text += `Total Líquido a Pedir: *${formatNumber(orderAggregation.grandTotalOrderKg, 1)} kg*\n\n`;
                      text += `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
                      return text;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedManagement;
