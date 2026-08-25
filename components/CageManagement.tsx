
import React, { useState, useMemo } from 'react';
import { Cage, AppState, User, Batch } from '../types';
import { Trash2, Box, Edit, X, Ruler, Users, Tag, Calendar, LayoutDashboard, Info, Layers, Eye, Filter, CheckSquare, Square, Save, LogOut, FileText, Printer, Download } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { formatNumber, formatCurrency } from '../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

const CageManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterBatchId, setFilterBatchId] = useState<string>('all');
  const [selectedCages, setSelectedCages] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkData, setBulkData] = useState({
    settlementDate: '',
    harvestDate: '',
    lineId: '',
    initialFishCount: ''
  });
  const [formData, setFormData] = useState({
    cageId: '',
    lineId: '',
    batchId: '',
    initialFishCount: '',
    settlementDate: new Date().toISOString().split('T')[0],
    harvestDate: ''
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const availableCages = useMemo(() => {
    return (state.cages || []).filter(c => (c.status === 'Disponível' && !c.batchId) || (editingId && c.id === editingId));
  }, [state.cages, editingId]);

  const selectedCageDef = useMemo(() => {
    return (state.cages || []).find(c => c.id === formData.cageId);
  }, [state.cages, formData.cageId]);

  const selectedBatch = (state.batches || []).find(b => b.id === formData.batchId);
  
  // Calculate fish used by other cages in this batch (excluding the current cage being settled or edited)
  const otherCagesInBatch = (state.cages || [])
    .filter(c => c.batchId === formData.batchId && c.id !== (editingId || formData.cageId));
    
  const batchUsedFishByOthers = otherCagesInBatch.reduce((a, b) => a + (b.initialFishCount || 0), 0);
  
  let settledAndHarvestedOther = 0;
  (state.harvestLogs || []).forEach(h => {
    if (h.batchId === formData.batchId && h.cageId !== (editingId || formData.cageId)) {
      settledAndHarvestedOther += (h.initialFishCount || 0);
    }
  });

  let nurseryMortality = 0;
  (state.mortalityLogs || []).forEach(m => {
    if (m.batchId === formData.batchId && !m.cageId) {
      nurseryMortality += m.count;
    }
  });
    
  const maxAvailableForThisCage = selectedBatch 
    ? Math.max(0, selectedBatch.initialQuantity - batchUsedFishByOthers - settledAndHarvestedOther - nurseryMortality)
    : 0;

  const isOverBatchBalance = Number(formData.initialFishCount) > maxAvailableForThisCage;
  
  const isOverCageCapacity = selectedCageDef && Number(formData.initialFishCount) > selectedCageDef.stockingCapacity;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.cageId || !formData.batchId || !formData.initialFishCount || !formData.lineId) return;
    
    const count = Number(formData.initialFishCount);
    let updatedBatches = state.batches;

    if (count > maxAvailableForThisCage) {
      if (confirm(`A quantidade (${count.toLocaleString('pt-BR')}) excede o saldo disponível do lote (${maxAvailableForThisCage.toLocaleString('pt-BR')}). Deseja ajustar o saldo inicial do lote para acomodar esta gaiola?`)) {
        const newTotalForBatch = batchUsedFishByOthers + settledAndHarvestedOther + nurseryMortality + count;
        updatedBatches = (state.batches || []).map(b => b.id === formData.batchId ? { ...b, initialQuantity: newTotalForBatch, updatedAt: Date.now() } : b);
      } else {
        return;
      }
    }

    const updatedCages = (state.cages || []).map(c => {
      if (c.id === formData.cageId) {
        return {
          ...c,
          lineId: formData.lineId,
          batchId: formData.batchId,
          initialFishCount: count,
          settlementDate: formData.settlementDate,
          harvestDate: formData.harvestDate,
          status: 'Ocupada' as const,
          updatedAt: Date.now()
        };
      }
      if (editingId && c.id === editingId && c.id !== formData.cageId) {
        return {
          ...c,
          batchId: undefined,
          initialFishCount: undefined,
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Disponível' as const,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, batches: updatedBatches, cages: updatedCages });
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      cageId: '', lineId: '', batchId: '', initialFishCount: '',
      settlementDate: new Date().toISOString().split('T')[0], harvestDate: ''
    });
  };

  const startEdit = (cage: Cage) => {
    if (!hasPermission) return;
    setEditingId(cage.id);
    setFormData({
      cageId: cage.id,
      lineId: cage.lineId || '',
      batchId: cage.batchId || '',
      initialFishCount: (cage.initialFishCount || '').toString(),
      settlementDate: cage.settlementDate || format(new Date(), 'yyyy-MM-dd'),
      harvestDate: cage.harvestDate || ''
    });
  };

  const deleteCageCompletely = (id: string) => {
    if (!hasPermission) return;
    const cage = (state.cages || []).find(c => c.id === id);
    if (!cage) return;
    if (!confirm(`Deseja EXCLUIR DEFINITIVAMENTE a gaiola "${cage.name}"? Esta ação removerá a gaiola do inventário e de todo o sistema.`)) return;

    onUpdate({
      ...state,
      cages: (state.cages || []).filter(c => c.id !== id),
      deletedIds: Array.from(new Set([...(state.deletedIds || []), id]))
    });
  };

  const releaseCage = (id: string) => {
    if (!hasPermission) return;
    if (!confirm('Deseja desocupar e desvincular esta gaiola do lote? Seu status será alterado para "Limpeza".')) return;
    onUpdate({
      ...state,
      cages: (state.cages || []).map(c => c.id === id ? {
        ...c,
        batchId: undefined,
        initialFishCount: undefined,
        settlementDate: undefined,
        harvestDate: undefined,
        status: 'Limpeza' as const,
        maintenanceStartDate: new Date().toISOString().split('T')[0],
        maintenanceEndDate: undefined,
        updatedAt: Date.now()
      } : c)
    });
  };

  const handleBulkRelease = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!confirm(`Deseja desocupar e desvincular as ${selectedCages.length} gaiolas selecionadas? O status delas será alterado para "Limpeza".`)) return;

    const updatedCages = (state.cages || []).map(c => {
      if (selectedCages.includes(c.id)) {
        return {
          ...c,
          batchId: undefined,
          initialFishCount: undefined,
          settlementDate: undefined,
          harvestDate: undefined,
          status: 'Limpeza' as const,
          maintenanceStartDate: new Date().toISOString().split('T')[0],
          maintenanceEndDate: undefined,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setSelectedCages([]);
  };

  const handleBulkDelete = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!confirm(`Deseja EXCLUIR DEFINITIVAMENTE as ${selectedCages.length} gaiolas selecionadas? Elas serão removidas do sistema.`)) return;

    onUpdate({
      ...state,
      cages: (state.cages || []).filter(c => !selectedCages.includes(c.id)),
      deletedIds: Array.from(new Set([...(state.deletedIds || []), ...selectedCages]))
    });
    setSelectedCages([]);
  };

  const occupiedCages = useMemo(() => {
    return (state.cages || []).filter(c => Boolean(c.batchId) || c.status === 'Ocupada');
  }, [state.cages]);

  const filteredCages = useMemo(() => {
    if (filterBatchId === 'all') return occupiedCages;
    return occupiedCages.filter(c => c.batchId === filterBatchId);
  }, [occupiedCages, filterBatchId]);

  const batchStratification = useMemo(() => {
    if (filterBatchId === 'all') return null;
    const batch = (state.batches || []).find(b => b.id === filterBatchId);
    if (!batch) return null;

    const cagesInBatch = occupiedCages.filter(c => c.batchId === filterBatchId);
    
    // Group by model
    const counts: { [key: string]: number } = {};
    cagesInBatch.forEach(c => {
      counts[c.model] = (counts[c.model] || 0) + 1;
    });
    
    const modelList = Object.entries(counts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count);

    const totalCages = cagesInBatch.length;
    const totalFishInCages = cagesInBatch.reduce((sum, c) => sum + (c.initialFishCount || 0), 0);

    // Calculate batch settlement balance (Saldo Povoamento) exactly like BatchManagement
    const allCagesForBatch = (state.cages || []).filter(c => c.batchId === filterBatchId);
    const activeCagesInBatch = allCagesForBatch.filter(c => c.status === 'Ocupada' || c.batchId === filterBatchId);
    const usedFish = activeCagesInBatch.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
    
    let settledAndHarvested = 0;
    (state.harvestLogs || []).forEach(h => {
      if (h.batchId === filterBatchId) {
        settledAndHarvested += (h.initialFishCount || 0);
      }
    });

    let nurseryMortality = 0;
    (state.mortalityLogs || []).forEach(m => {
      if (m.batchId === filterBatchId && !m.cageId) {
        nurseryMortality += m.count;
      }
    });

    const settlementBalance = batch.isSettlementComplete 
      ? 0 
      : Math.max(0, batch.initialQuantity - usedFish - settledAndHarvested - nurseryMortality);

    return {
      batchName: batch.name,
      totalCages,
      totalFishInCages,
      settlementBalance,
      initialQuantity: batch.initialQuantity,
      models: modelList
    };
  }, [occupiedCages, filterBatchId, state.batches, state.cages, state.harvestLogs, state.mortalityLogs]);

  const toggleSelectCage = (id: string) => {
    setSelectedCages(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCages.length === filteredCages.length) {
      setSelectedCages([]);
    } else {
      setSelectedCages(filteredCages.map(c => c.id));
    }
  };

  const safeDateFormat = (dateStr?: string, pattern: string = 'dd/MM/yyyy') => {
    if (!dateStr) return '---';
    try {
      const raw = dateStr.split('T')[0];
      const parsed = parseISO(raw);
      if (isNaN(parsed.getTime())) return '---';
      return format(parsed, pattern);
    } catch (e) {
      return '---';
    }
  };

  const getBatchSettlementBalance = (batch: Batch) => {
    const allCagesForBatch = (state.cages || []).filter(c => c.batchId === batch.id);
    const activeCagesInBatch = allCagesForBatch.filter(c => c.status === 'Ocupada' || c.batchId === batch.id);
    const usedFish = activeCagesInBatch.reduce((acc, curr) => acc + (curr.initialFishCount || 0), 0);
    
    let settledAndHarvested = 0;
    (state.harvestLogs || []).forEach(h => {
      if (h.batchId === batch.id) {
        settledAndHarvested += (h.initialFishCount || 0);
      }
    });

    const nurseryMortality = (state.mortalityLogs || []).filter(m => m.batchId === batch.id && !m.cageId).reduce((acc, curr) => acc + curr.count, 0);

    return batch.isSettlementComplete 
      ? 0 
      : Math.max(0, batch.initialQuantity - usedFish - settledAndHarvested - nurseryMortality);
  };

  const handleExportPDF = () => {
    const isSingleBatch = filterBatchId !== 'all';
    const targetBatch = isSingleBatch ? (state.batches || []).find(b => b.id === filterBatchId) : null;
    const cagesToExport = filteredCages;

    if (cagesToExport.length === 0 && !targetBatch) {
      alert("Nenhum dado de povoamento encontrado para gerar o PDF.");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const now = new Date();
    const emissionDateStr = format(now, "dd/MM/yyyy 'às' HH:mm");

    // Header Background
    doc.setFillColor(52, 68, 52); // #344434 AquaGestão Dark Green
    doc.rect(0, 0, 210, 26, "F");

    // Accent Line
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 26, 210, 1.5, "F");

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("AQUAGESTÃO • CONTROLE DE POVOAMENTO", 14, 11);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(228, 228, 212); // #e4e4d4
    const subTitle = isSingleBatch && targetBatch
      ? `RELATÓRIO DETALHADO DO LOTE: ${targetBatch.name.toUpperCase()}`
      : "RELATÓRIO GERAL DE POVOAMENTO DE GAIOLAS (TODOS OS LOTES ATIVOS)";
    doc.text(subTitle, 14, 17);

    doc.setFontSize(7.5);
    doc.text(`Emissão: ${emissionDateStr} | Usuário: ${currentUser.name} | CostaFoods Brasil`, 14, 22);

    let startY = 32;

    if (isSingleBatch && targetBatch) {
      const protocol = (state.protocols || []).find(p => p.id === targetBatch.protocolId);
      
      const totalInitial = targetBatch.initialQuantity || 0;
      const totalInCages = cagesToExport.reduce((acc, c) => acc + (c.initialFishCount || 0), 0);
      const nurseryMort = (state.mortalityLogs || []).filter(m => m.batchId === targetBatch.id && !m.cageId).reduce((a, b) => a + b.count, 0);
      
      let cagesMort = 0;
      let livingFishInCages = 0;

      cagesToExport.forEach(c => {
        const cMort = (state.mortalityLogs || []).filter(m => {
          if (m.cageId !== c.id) return false;
          if (m.batchId && m.batchId !== targetBatch.id) return false;
          const cageSettlement = c.settlementDate || targetBatch.settlementDate;
          if (cageSettlement && m.date < cageSettlement) return false;
          if (c.harvestDate && m.date > c.harvestDate) return false;
          return true;
        }).reduce((a, b) => a + b.count, 0);
        cagesMort += cMort;
        livingFishInCages += Math.max(0, (c.initialFishCount || 0) - cMort);
      });

      const totalBatchMort = nurseryMort + cagesMort;
      const totalLivingBatch = Math.max(0, totalInitial - totalBatchMort);
      const survivalRate = totalInitial > 0 ? ((totalLivingBatch / totalInitial) * 100) : 0;
      const settlementBal = getBatchSettlementBalance(targetBatch);

      // Model stratification string
      const modelCounts: { [key: string]: { count: number; fish: number } } = {};
      cagesToExport.forEach(c => {
        const m = c.model || 'Padrão';
        if (!modelCounts[m]) modelCounts[m] = { count: 0, fish: 0 };
        modelCounts[m].count += 1;
        modelCounts[m].fish += (c.initialFishCount || 0);
      });
      const stratText = Object.entries(modelCounts)
        .map(([m, data]) => `Mod. ${m}: ${data.count} gaiola(s) (${formatNumber(data.fish)} un)`)
        .join(' | ');

      const supplierText = targetBatch.supplierName || 'Não informado';
      const nfsText = targetBatch.invoices && targetBatch.invoices.length > 0
        ? targetBatch.invoices.map(i => i.invoiceNumber).filter(Boolean).join(', ')
        : (targetBatch.invoiceValue ? formatCurrency(targetBatch.invoiceValue) : 'Não informada');

      // Batch Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, startY, 182, 38, 2, 2, "FD");

      // Batch Title inside Box
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`LOTE: ${targetBatch.name}`, 18, startY + 6);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Line 1: Dates & Initial Stats
      doc.text(`Data Povoamento: ${safeDateFormat(targetBatch.settlementDate)}`, 18, startY + 12);
      doc.text(`Prev. Despesca: ${safeDateFormat(targetBatch.expectedHarvestDate)}`, 78, startY + 12);
      doc.text(`Peso Médio Inicial: ${targetBatch.initialUnitWeight ? `${formatNumber(targetBatch.initialUnitWeight, 1)} g` : '---'}`, 135, startY + 12);

      // Line 2: Totals & Balance
      doc.text(`Povoamento Total Lote: ${formatNumber(totalInitial)} un`, 18, startY + 17);
      doc.text(`Alocado em Gaiolas: ${formatNumber(totalInCages)} un`, 78, startY + 17);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235); // Blue
      doc.text(`Saldo Povoamento: ${formatNumber(settlementBal)} un`, 135, startY + 17);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Line 3: Living stock & Mortality
      doc.text(`Gaiolas Ativas: ${cagesToExport.length} un`, 18, startY + 22);
      doc.text(`Mortalidade Acum.: ${formatNumber(totalBatchMort)} un (${totalInitial > 0 ? formatNumber((totalBatchMort / totalInitial) * 100, 1) : 0}%)`, 78, startY + 22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`Estoque Vivo Atual: ${formatNumber(totalLivingBatch)} un (${formatNumber(survivalRate, 1)}% Sobrev.)`, 135, startY + 22);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);

      // Line 4: Supplier, Invoices & Protocol
      doc.setFontSize(7.5);
      doc.text(`Fornecedor: ${supplierText} | NF(s): ${nfsText} | Protocolo: ${protocol?.name || 'Padrão'}`, 18, startY + 28);
      
      // Line 5: Stratification
      if (stratText) {
        doc.text(`Estratificação Gaiolas: ${stratText}`, 18, startY + 33);
      }

      startY += 42;
    } else {
      // General Summary Card for All Batches
      const totalActiveCages = cagesToExport.length;
      const totalInitialAll = cagesToExport.reduce((acc, c) => acc + (c.initialFishCount || 0), 0);
      let totalMortAll = 0;
      let totalLivingAll = 0;

      cagesToExport.forEach(c => {
        const cMort = (state.mortalityLogs || []).filter(m => {
          if (m.cageId !== c.id) return false;
          if (c.batchId && m.batchId && m.batchId !== c.batchId) return false;
          if (c.settlementDate && m.date < c.settlementDate) return false;
          if (c.harvestDate && m.date > c.harvestDate) return false;
          return true;
        }).reduce((a, b) => a + b.count, 0);
        totalMortAll += cMort;
        totalLivingAll += Math.max(0, (c.initialFishCount || 0) - cMort);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, startY, 182, 18, 2, 2, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`Total de Gaiolas Ocupadas: ${totalActiveCages} un`, 18, startY + 7);
      doc.text(`Povoamento Inicial Total: ${formatNumber(totalInitialAll)} un`, 80, startY + 7);
      doc.text(`Estoque Vivo em Cultivo: ${formatNumber(totalLivingAll)} un`, 140, startY + 7);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Mortalidade Acumulada em Gaiolas: ${formatNumber(totalMortAll)} un | Sobrevivência Geral: ${totalInitialAll > 0 ? formatNumber((totalLivingAll / totalInitialAll) * 100, 1) : 0}%`, 18, startY + 13);

      startY += 23;
    }

    // Build Table Rows
    const tableHead = isSingleBatch
      ? [["#", "Gaiola", "Setor / Linha", "Modelo", "Data Povoam.", "Dias", "Prev. Despesca", "Qtd Inicial", "Mort. Acum.", "Estoque Vivo", "Sobrev."]]
      : [["#", "Gaiola", "Lote", "Setor / Linha", "Modelo", "Data Povoam.", "Dias", "Qtd Inicial", "Mort. Acum.", "Estoque Vivo", "Sobrev."]];

    let sumInitial = 0;
    let sumMort = 0;
    let sumLiving = 0;

    const tableBody = cagesToExport.map((cage, index) => {
      const batch = (state.batches || []).find(b => b.id === cage.batchId);
      const line = (state.lines || []).find(l => l.id === cage.lineId);
      
      const cMort = (state.mortalityLogs || []).filter(m => {
        if (m.cageId !== cage.id) return false;
        if (cage.batchId && m.batchId && m.batchId !== cage.batchId) return false;
        const cageSettlement = cage.settlementDate || batch?.settlementDate;
        if (cageSettlement && m.date < cageSettlement) return false;
        if (cage.harvestDate && m.date > cage.harvestDate) return false;
        return true;
      }).reduce((a, b) => a + b.count, 0);

      const initCount = cage.initialFishCount || 0;
      const currentCount = Math.max(0, initCount - cMort);
      const survPct = initCount > 0 ? (currentCount / initCount) * 100 : 0;

      sumInitial += initCount;
      sumMort += cMort;
      sumLiving += currentCount;

      let cycleDaysStr = '---';
      const sDate = cage.settlementDate || batch?.settlementDate;
      if (sDate) {
        try {
          const days = differenceInDays(startOfDay(now), startOfDay(parseISO(sDate.split('T')[0])));
          cycleDaysStr = `${Math.max(0, days)}d`;
        } catch(e) {}
      }

      const rawModel = cage.model 
        ? cage.model 
        : cage.dimensions 
          ? `${cage.dimensions.length}x${cage.dimensions.width}x${cage.dimensions.depth}`
          : '---';

      if (isSingleBatch) {
        return [
          (index + 1).toString(),
          cage.name,
          line?.name || '---',
          rawModel,
          safeDateFormat(cage.settlementDate || batch?.settlementDate),
          cycleDaysStr,
          safeDateFormat(cage.harvestDate || batch?.expectedHarvestDate),
          formatNumber(initCount),
          formatNumber(cMort),
          formatNumber(currentCount),
          `${formatNumber(survPct, 1)}%`
        ];
      } else {
        return [
          (index + 1).toString(),
          cage.name,
          batch?.name || '---',
          line?.name || '---',
          rawModel,
          safeDateFormat(cage.settlementDate || batch?.settlementDate),
          cycleDaysStr,
          formatNumber(initCount),
          formatNumber(cMort),
          formatNumber(currentCount),
          `${formatNumber(survPct, 1)}%`
        ];
      }
    });

    const totalSurvAvg = sumInitial > 0 ? (sumLiving / sumInitial) * 100 : 0;

    const tableFoot = isSingleBatch
      ? [[
          "TOTAIS",
          `${cagesToExport.length} gaiolas`,
          "",
          "",
          "",
          "",
          "",
          `${formatNumber(sumInitial)} un`,
          `${formatNumber(sumMort)} un`,
          `${formatNumber(sumLiving)} un`,
          `${formatNumber(totalSurvAvg, 1)}%`
        ]]
      : [[
          "TOTAIS",
          `${cagesToExport.length} gaiolas`,
          "",
          "",
          "",
          "",
          "",
          `${formatNumber(sumInitial)} un`,
          `${formatNumber(sumMort)} un`,
          `${formatNumber(sumLiving)} un`,
          `${formatNumber(totalSurvAvg, 1)}%`
        ]];

    autoTable(doc, {
      startY: startY,
      head: tableHead,
      body: tableBody,
      foot: tableFoot,
      theme: "striped",
      headStyles: {
        fillColor: [52, 68, 52],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: "bold",
        halign: "center",
        valign: "middle"
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        valign: "middle"
      },
      columnStyles: isSingleBatch ? {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 26, fontStyle: "bold" },
        2: { cellWidth: 24 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 17, halign: "right" },
        8: { cellWidth: 15, halign: "right", textColor: [185, 28, 28] },
        9: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [21, 128, 61] },
        10: { cellWidth: 14, halign: "right" }
      } : {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 24, fontStyle: "bold" },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 17, halign: "center" },
        6: { cellWidth: 12, halign: "center" },
        7: { cellWidth: 17, halign: "right" },
        8: { cellWidth: 15, halign: "right", textColor: [185, 28, 28] },
        9: { cellWidth: 17, halign: "right", fontStyle: "bold", textColor: [21, 128, 61] },
        10: { cellWidth: 14, halign: "right" }
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontSize: 7.5,
        fontStyle: "bold",
        valign: "middle"
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    const signY = Math.min(Math.max(finalY + 20, 235), 270);

    // If signY would exceed page, add page
    if (finalY > 235) {
      doc.addPage();
      const newSignY = 60;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.4);
      doc.line(20, newSignY, 90, newSignY);
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.text("Responsável Técnico / Biólogo", 55, newSignY + 5, { align: "center" });

      doc.line(120, newSignY, 190, newSignY);
      doc.text("Gerência de Produção / Piscicultura", 155, newSignY + 5, { align: "center" });
    } else {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.4);
      doc.line(20, signY, 90, signY);
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.text("Responsável Técnico / Biólogo", 55, signY + 5, { align: "center" });

      doc.line(120, signY, 190, signY);
      doc.text("Gerência de Produção / Piscicultura", 155, signY + 5, { align: "center" });
    }

    // Page count footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`AquaGestão Piscicultura • CostaFoods Brasil — Página ${i} de ${pageCount}`, 105, 290, { align: "center" });
    }

    const fileName = isSingleBatch && targetBatch
      ? `relatorio-povoamento-${targetBatch.name.toLowerCase().replace(/\s+/g, '-')}-${format(now, 'yyyyMMdd-HHmm')}.pdf`
      : `relatorio-geral-povoamento-${format(now, 'yyyyMMdd-HHmm')}.pdf`;

    doc.save(fileName);
  };

  const handleBulkUpdate = () => {
    if (!hasPermission || selectedCages.length === 0) return;
    if (!bulkData.settlementDate && !bulkData.harvestDate && !bulkData.lineId && !bulkData.initialFishCount) return;

    if (!confirm(`Deseja aplicar as alterações em ${selectedCages.length} gaiolas?`)) return;

    const updatedCages = (state.cages || []).map(c => {
      if (selectedCages.includes(c.id)) {
        return {
          ...c,
          settlementDate: bulkData.settlementDate || c.settlementDate,
          harvestDate: bulkData.harvestDate || c.harvestDate,
          lineId: bulkData.lineId || c.lineId,
          initialFishCount: bulkData.initialFishCount ? Number(bulkData.initialFishCount) : c.initialFishCount,
          updatedAt: Date.now()
        };
      }
      return c;
    });

    onUpdate({ ...state, cages: updatedCages });
    setShowBulkEdit(false);
    setSelectedCages([]);
    setBulkData({ settlementDate: '', harvestDate: '', lineId: '', initialFishCount: '' });
  };

  return (
    <div className="space-y-8 pb-20">
      {hasPermission ? (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
              {editingId ? 'Editar Povoamento' : 'Novo Povoamento'}
            </div>
            {editingId && (
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>

          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Selecionar Gaiola</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.cageId} onChange={(e) => setFormData({...formData, cageId: e.target.value})}>
                <option value="">Escolha a gaiola...</option>
                {availableCages.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.dimensions ? `(${c.dimensions.length}x${c.dimensions.width}x${c.dimensions.depth}m - Cap: ${c.stockingCapacity.toLocaleString('pt-BR')})` : `(Cap: ${c.stockingCapacity.toLocaleString('pt-BR')})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Linha de Localização</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.lineId} onChange={(e) => setFormData({...formData, lineId: e.target.value})}>
                <option value="">Selecione a linha...</option>
                {(state.lines || []).map(line => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Vincular ao Lote</label>
              <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" value={formData.batchId} onChange={(e) => setFormData({...formData, batchId: e.target.value})}>
                <option value="">Selecione o lote...</option>
                {(state.batches || []).sort((a, b) => a.name.localeCompare(b.name)).map(b => {
                  const otherCages = (state.cages || []).filter(c => c.batchId === b.id && c.id !== (editingId || formData.cageId));
                  const used = otherCages.reduce((x, y) => x + (y.initialFishCount || 0), 0);
                  let harvests = 0;
                  (state.harvestLogs || []).forEach(h => {
                    if (h.batchId === b.id && h.cageId !== (editingId || formData.cageId)) harvests += (h.initialFishCount || 0);
                  });
                  let mort = 0;
                  (state.mortalityLogs || []).forEach(m => {
                    if (m.batchId === b.id && !m.cageId) mort += m.count;
                  });
                  const rem = Math.max(0, b.initialQuantity - used - harvests - mort);
                  return <option key={b.id} value={b.id}>{b.name} (Saldo: {rem.toLocaleString('pt-BR')})</option>;
                })}
              </select>
            </div>

            {selectedCageDef && (
              <div className="col-span-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100 grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Ruler className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Volume / Medidas</div>
                    <div className="text-xs font-bold text-slate-700">
                      {(selectedCageDef.dimensions.length * selectedCageDef.dimensions.width * selectedCageDef.dimensions.depth).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}m³ 
                      <span className="text-[10px] text-slate-400 ml-1">({selectedCageDef.dimensions.length}x{selectedCageDef.dimensions.width}x{selectedCageDef.dimensions.depth}m)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-slate-400 uppercase">Capacidade / Densidade</div>
                    <div className="text-xs font-bold text-slate-700">
                      {selectedCageDef.stockingCapacity.toLocaleString('pt-BR')} un
                      {selectedCageDef.stockingDensity && <span className="text-[10px] text-slate-400 ml-1">({selectedCageDef.stockingDensity.toLocaleString('pt-BR')} p/m³)</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Quantidade de Peixes</label>
              <input type="number" required placeholder="Qtd alojada" className={`w-full px-4 py-3 bg-white border rounded-2xl outline-none font-bold ${isOverCageCapacity || isOverBatchBalance ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200'}`} value={formData.initialFishCount} onChange={(e) => setFormData({...formData, initialFishCount: e.target.value})} />
              {isOverCageCapacity && <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">Atenção: Acima da capacidade!</p>}
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-black text-slate-400 uppercase mb-1">Previsão de Despesca</label>
              <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={formData.harvestDate} onChange={(e) => setFormData({...formData, harvestDate: e.target.value})} />
            </div>

            <button type="submit" disabled={isOverBatchBalance || !formData.cageId || !formData.lineId} className={`col-span-2 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${isOverBatchBalance || !formData.cageId || !formData.lineId ? 'bg-slate-300' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'}`}>
              {editingId ? 'Salvar Alterações' : 'Confirmar Povoamento'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center max-w-2xl mx-auto">
          <Eye className="w-10 h-10 text-slate-300" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Modo Leitura Ativo</h4>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Você não possui permissão para povoar novos peixes ou editar povoamentos.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2 bg-slate-50 text-slate-400 rounded-xl">
            <Filter className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Filtrar por Lote</label>
            <select 
              className="w-full bg-transparent border-none outline-none font-black text-slate-800 text-sm p-0 cursor-pointer"
              value={filterBatchId}
              onChange={(e) => {
                setFilterBatchId(e.target.value);
                setSelectedCages([]);
              }}
            >
              <option value="all">Todos os Lotes Ativos</option>
              {(state.batches || [])
                .filter(b => !b.isClosed)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <button
            onClick={handleExportPDF}
            title="Gerar PDF com as gaiolas e informações do lote filtrado"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 active:scale-95"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{filterBatchId !== 'all' ? 'Gerar PDF do Lote' : 'Gerar PDF Geral'}</span>
          </button>

          {hasPermission && filteredCages.length > 0 && (
            <React.Fragment>
              <button 
                onClick={toggleSelectAll}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {selectedCages.length === filteredCages.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectedCages.length === filteredCages.length ? 'Desmarcar' : 'Marcar Todos'}
              </button>
              {selectedCages.length > 0 && (
                <React.Fragment>
                  <button 
                    onClick={() => setShowBulkEdit(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    <Edit className="w-4 h-4" /> Edição em Massa ({selectedCages.length})
                  </button>
                  <button 
                    onClick={handleBulkRelease}
                    title="Desvincular gaiolas do lote mantendo-as no inventário"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    <LogOut className="w-4 h-4" /> Desvincular ({selectedCages.length})
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    title="Excluir gaiolas definitivamente do sistema"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir ({selectedCages.length})
                  </button>
                </React.Fragment>
              )}
            </React.Fragment>
          )}
        </div>
      </div>

      {showBulkEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Edição em Massa</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Alterando {selectedCages.length} gaiolas selecionadas</p>
              </div>
              <button onClick={() => setShowBulkEdit(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Data de Povoamento</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.settlementDate}
                    onChange={(e) => setBulkData({...bulkData, settlementDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Previsão de Despesca</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.harvestDate}
                    onChange={(e) => setBulkData({...bulkData, harvestDate: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Linha/Setor</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.lineId}
                    onChange={(e) => setBulkData({...bulkData, lineId: e.target.value})}
                  >
                    <option value="">Manter atual...</option>
                    {(state.lines || []).map(line => (
                      <option key={line.id} value={line.id}>{line.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade de Peixes (Saldo Inicial)</label>
                  <input 
                    type="number" 
                    placeholder="Manter atual..."
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                    value={bulkData.initialFishCount}
                    onChange={(e) => setBulkData({...bulkData, initialFishCount: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed">
                  Campos deixados em branco não serão alterados. As mudanças serão aplicadas instantaneamente a todas as gaiolas marcadas.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowBulkEdit(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleBulkUpdate}
                  className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Aplicar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchStratification && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100 shadow-sm flex flex-col md:flex-row justify-between items-stretch gap-6 animate-in fade-in duration-300">
          <div className="flex flex-col justify-center min-w-[280px]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">Resumo do Lote Selecionado</span>
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
                title="Exportar PDF deste lote com gaiolas e detalhes"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF do Lote</span>
              </button>
            </div>
            <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic">
              {batchStratification.batchName}
            </h4>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider block">Saldo Povoamento (Disponível)</span>
                <span className={`text-base font-black ${batchStratification.settlementBalance > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                  {batchStratification.settlementBalance.toLocaleString('pt-BR')} un
                </span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Povoado (Lote)</span>
                <span className="text-base font-black text-slate-700">{batchStratification.initialQuantity.toLocaleString('pt-BR')} un</span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Gaiolas Ativas</span>
                <span className="text-base font-black text-slate-800">{batchStratification.totalCages}</span>
              </div>
              <div className="bg-white/80 px-4 py-2 rounded-xl border border-blue-200/60 shadow-xs">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Peixes em Gaiolas</span>
                <span className="text-base font-black text-indigo-700">{batchStratification.totalFishInCages.toLocaleString('pt-BR')} un</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest block">Modelos de Gaiola no Lote</span>
              <button
                onClick={handleExportPDF}
                className="hidden md:flex px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Exportar Relatório PDF</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {batchStratification.models.map(({ model, count }) => (
                <div key={model} className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-black text-slate-800 uppercase block tracking-wider">Modelo {model}</span>
                    <span className="text-base font-black text-indigo-700">{count} {count === 1 ? 'gaiola' : 'gaiolas'}</span>
                  </div>
                </div>
              ))}
              {batchStratification.models.length === 0 && (
                <div className="col-span-full py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/50 rounded-2xl">
                  Nenhuma gaiola povoada neste lote.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCages.map(cage => {
          const isSelected = selectedCages.includes(cage.id);
          const batch = (state.batches || []).find(b => b.id === cage.batchId);
          const line = (state.lines || []).find(l => l.id === cage.lineId);
          const mortalities = (state.mortalityLogs || []).filter(m => {
            if (m.cageId !== cage.id) return false;
            if (m.batchId && m.batchId !== cage.batchId) return false;
            const cageSettlement = cage.settlementDate || batch?.settlementDate;
            if (cageSettlement && m.date < cageSettlement) return false;
            if (cage.harvestDate && m.date > cage.harvestDate) return false;
            return true;
          }).reduce((a, b) => a + b.count, 0);
          const currentCount = Math.max(0, (cage.initialFishCount || 0) - mortalities);

          const rawModel = cage.model 
            ? cage.model.toUpperCase() 
            : cage.dimensions 
              ? `${cage.dimensions.length}X${cage.dimensions.width}X${cage.dimensions.depth}`.replace('.', ',')
              : '';

          const cageCardTitle = rawModel && !cage.name.toUpperCase().includes(rawModel)
            ? `${cage.name} - ${rawModel}`
            : cage.name;
          
          return (
            <div key={cage.id} className={`bg-white rounded-3xl shadow-sm border transition-all overflow-hidden group ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-200'}`}>
              <div className={`p-4 border-b flex justify-between items-center ${isSelected ? 'bg-blue-50 border-blue-100' : 'bg-blue-50/30 border-slate-100'}`}>
                <div className="flex items-center gap-3">
                  {hasPermission && (
                    <button 
                      onClick={() => toggleSelectCage(cage.id)}
                      className={`p-1 rounded-lg transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-300 hover:text-blue-400'}`}
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="font-black text-slate-800 uppercase tracking-tighter block">{cageCardTitle}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{line?.name || 'Setor não definido'}</span>
                    </div>
                  </div>
                </div>
                {hasPermission && (
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(cage)} title="Editar Povoamento" className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => releaseCage(cage.id)} title="Desvincular do Lote (tornar disponível)" className="p-2 text-slate-300 hover:text-amber-600 transition-colors"><LogOut className="w-4 h-4" /></button>
                    <button onClick={() => deleteCageCompletely(cage.id)} title="Excluir Gaiola Definitivamente" className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote Vinculado</span>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg uppercase">{batch?.name || '---'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-50 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque Vivo</span>
                    <span className={`text-xl font-black leading-none mt-1 ${currentCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{currentCount.toLocaleString('pt-BR')} un</span>
                    {currentCount === 0 && (cage.initialFishCount || 0) > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 uppercase mt-1">Saldo Positivo: {(cage.initialFishCount || 0).toLocaleString('pt-BR')} un</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inicial</span>
                    <span className="text-xs font-bold text-slate-500">{cage.initialFishCount?.toLocaleString('pt-BR')} un</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filteredCages.length === 0 && (
          <div className="col-span-full py-24 text-center">
            <Info className="w-10 h-10 text-slate-200 mx-auto mb-4" />
            <h4 className="text-slate-400 font-black uppercase tracking-widest text-xs">Nenhum povoamento ativo encontrado para este filtro.</h4>
          </div>
        )}
      </div>
    </div>
  );
};

export default CageManagement;
