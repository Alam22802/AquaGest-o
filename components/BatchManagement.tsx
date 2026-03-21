import React, { useState, useMemo } from "react";
import { Batch, AppState, User } from "../types";
import {
  Plus,
  Trash2,
  Tag,
  Calendar,
  Scale,
  Hash,
  Edit,
  X,
  BookOpen,
  Eye,
  TrendingUp,
  Fish,
  AlertCircle,
  ShoppingCart,
  CheckCircle2,
  Package,
  Utensils,
  Info,
  CheckSquare,
  Box,
  FileText,
} from "lucide-react";
import { format, differenceInDays, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatNumber } from "../utils/formatters";
import HarvestManagement from "./HarvestManagement";
import BatchClosing from "./BatchClosing";

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

const BatchManagement: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<
    "inventory" | "harvest" | "closing"
  >("inventory");
  const [selectedPlanningBatchId, setSelectedPlanningBatchId] = useState("");
  const [selectedPlanningCageIds, setSelectedPlanningCageIds] = useState<
    string[]
  >([]);
  const [lastFeeding, setLastFeeding] = useState("");
  const [lastFeedingHour, setLastFeedingHour] = useState("16:00");
  const [plannedHarvestDate, setPlannedHarvestDate] = useState("");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterType, setFilterType] = useState<"settlement" | "harvest">(
    "settlement",
  );
  const [formData, setFormData] = useState({
    name: "",
    settlementDate: new Date().toISOString().split("T")[0],
    initialQuantity: "",
    initialUnitWeight: "",
    protocolId: "",
    expectedHarvestDate: "",
  });

  const hasPermission = currentUser.isMaster || currentUser.canEdit;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission) return;
    if (!formData.name || !formData.initialQuantity) return;

    if (editingId) {
      const updatedBatches = (state.batches || []).map((b) =>
        b.id === editingId
          ? {
              ...b,
              name: formData.name,
              settlementDate: formData.settlementDate,
              initialQuantity: Number(formData.initialQuantity),
              initialUnitWeight: Number(formData.initialUnitWeight),
              protocolId: formData.protocolId,
              expectedHarvestDate: formData.expectedHarvestDate || undefined,
              updatedAt: Date.now(),
            }
          : b,
      );
      onUpdate({ ...state, batches: updatedBatches });
      setEditingId(null);
    } else {
      const newBatch: Batch = {
        id: generateId(),
        name: formData.name,
        settlementDate: formData.settlementDate,
        initialQuantity: Number(formData.initialQuantity),
        initialUnitWeight: Number(formData.initialUnitWeight),
        protocolId: formData.protocolId,
        expectedHarvestDate: formData.expectedHarvestDate || undefined,
        updatedAt: Date.now(),
      };
      onUpdate({ ...state, batches: [...(state.batches || []), newBatch] });
    }

    setFormData({
      name: "",
      settlementDate: new Date().toISOString().split("T")[0],
      initialQuantity: "",
      initialUnitWeight: "",
      protocolId: "",
      expectedHarvestDate: "",
    });
  };

  const startEdit = (batch: Batch) => {
    if (!hasPermission) return;
    setEditingId(batch.id);
    setFormData({
      name: batch.name,
      settlementDate: batch.settlementDate,
      initialQuantity: batch.initialQuantity.toString(),
      initialUnitWeight: batch.initialUnitWeight.toString(),
      protocolId: batch.protocolId || "",
      expectedHarvestDate: batch.expectedHarvestDate || "",
    });
  };

  const removeBatch = (id: string) => {
    if (!hasPermission) return;
    if (
      !confirm(
        "Excluir este lote? Isso removerá o vínculo com todas as gaiolas.",
      )
    )
      return;
    onUpdate({
      ...state,
      batches: (state.batches || []).filter((b) => b.id !== id),
    });
  };

  const toggleSettlementComplete = (batchId: string) => {
    if (!hasPermission) return;
    const updatedBatches = (state.batches || []).map((b) =>
      b.id === batchId
        ? {
            ...b,
            isSettlementComplete: !b.isSettlementComplete,
            updatedAt: Date.now(),
          }
        : b,
    );
    onUpdate({ ...state, batches: updatedBatches });
  };

  const handleSaveSchedule = () => {
    if (!hasPermission) return;
    if (
      !selectedPlanningBatchId ||
      selectedPlanningCageIds.length === 0 ||
      !plannedHarvestDate
    ) {
      alert("Por favor, selecione o lote, as gaiolas e a data da despesca.");
      return;
    }

    const newSchedule = {
      id: editingScheduleId || generateId(),
      batchId: selectedPlanningBatchId,
      cageIds: selectedPlanningCageIds,
      date: plannedHarvestDate,
      lastFeedingDate: lastFeeding,
      userId: currentUser.id,
      updatedAt: Date.now(),
    };

    const existingSchedules = state.harvestSchedules || [];
    let updatedSchedules;
    if (editingScheduleId) {
      updatedSchedules = existingSchedules.map((s) =>
        s.id === editingScheduleId ? newSchedule : s,
      );
    } else {
      updatedSchedules = [newSchedule, ...existingSchedules];
    }

    onUpdate({
      ...state,
      harvestSchedules: updatedSchedules,
    });

    setSelectedPlanningCageIds([]);
    setPlannedHarvestDate("");
    setLastFeeding("");
    setEditingScheduleId(null);
    setSelectedPlanningBatchId("");
  };

  const removeSchedule = (id: string) => {
    if (!hasPermission) return;
    if (!confirm("Excluir esta programação?")) return;
    onUpdate({
      ...state,
      harvestSchedules: (state.harvestSchedules || []).filter(
        (s) => s.id !== id,
      ),
    });
  };

  const startEditSchedule = (schedule: any) => {
    if (!hasPermission) return;
    setEditingScheduleId(schedule.id);
    setSelectedPlanningBatchId(schedule.batchId);
    setSelectedPlanningCageIds(schedule.cageIds);
    setPlannedHarvestDate(schedule.date);
    setLastFeeding(schedule.lastFeedingDate || "");
    if (schedule.lastFeedingDate) {
      const time = schedule.lastFeedingDate.split("T")[1];
      setLastFeedingHour(time);
    }
  };

  const batchStats = useMemo(() => {
    const cagesByBatch = new Map<string, typeof state.cages>();
    (state.cages || []).forEach((c) => {
      if (c.batchId) {
        const list = cagesByBatch.get(c.batchId) || [];
        list.push(c);
        cagesByBatch.set(c.batchId, list);
      }
    });

    const mortalityByBatch = new Map<string, number>();
    const activeCageMortalityByBatch = new Map<string, number>();
    const nurseryMortalityByBatch = new Map<string, number>();
    (state.mortalityLogs || []).forEach((m) => {
      let bId = m.batchId;
      const cage = m.cageId
        ? (state.cages || []).find((c) => c.id === m.cageId)
        : null;

      // Safe fallback: if batchId is missing, check historical and current assignments
      if (!bId && m.cageId) {
        // 1. Check harvest logs first (historical data)
        const harvest = (state.harvestLogs || []).find(
          (h) => h.cageId === m.cageId && h.date >= (m.date || ""),
        );
        if (harvest) {
          bId = harvest.batchId;
        } else if (cage?.batchId) {
          // 2. Check current cage assignment
          const batch = (state.batches || []).find((b) => b.id === cage.batchId);
          if (batch && m.date >= batch.settlementDate) {
            bId = cage.batchId;
          }
        }
      }

      if (bId) {
        mortalityByBatch.set(bId, (mortalityByBatch.get(bId) || 0) + m.count);
        // Mortalidade em gaiola ATIVA (que ainda pertence ao lote)
        if (cage && cage.batchId === bId) {
          activeCageMortalityByBatch.set(
            bId,
            (activeCageMortalityByBatch.get(bId) || 0) + m.count,
          );
        }
        // Mortalidade no berçário (sem gaiola)
        if (!m.cageId) {
          nurseryMortalityByBatch.set(
            bId,
            (nurseryMortalityByBatch.get(bId) || 0) + m.count,
          );
        }
      }
    });

    const biometryByBatch = new Map<string, typeof state.biometryLogs>();
    (state.biometryLogs || []).forEach((b) => {
      let bId = b.batchId;
      if (!bId && b.cageId) {
        // 1. Check harvest logs first
        const harvest = (state.harvestLogs || []).find(
          (h) => h.cageId === b.cageId && h.date >= (b.date || ""),
        );
        if (harvest) {
          bId = harvest.batchId;
        } else {
          // 2. Check current cage
          const cage = (state.cages || []).find((c) => c.id === b.cageId);
          if (cage?.batchId) {
            const batch = (state.batches || []).find((bt) => bt.id === cage.batchId);
            if (batch && b.date >= batch.settlementDate) {
              bId = cage.batchId;
            }
          }
        }
      }

      if (bId) {
        const list = biometryByBatch.get(bId) || [];
        list.push(b);
        biometryByBatch.set(bId, list);
      }
    });

    const feedingByBatch = new Map<string, number>();
    (state.feedingLogs || []).forEach((f) => {
      let bId = f.batchId;
      if (!bId && f.cageId) {
        const fDate = (f.timestamp || "").split("T")[0];
        // 1. Check harvest logs first
        const harvest = (state.harvestLogs || []).find(
          (h) => h.cageId === f.cageId && h.date >= fDate,
        );
        if (harvest) {
          bId = harvest.batchId;
        } else {
          // 2. Check current cage
          const cage = (state.cages || []).find((c) => c.id === f.cageId);
          if (cage?.batchId) {
            const batch = (state.batches || []).find(
              (b) => b.id === cage.batchId,
            );
            if (batch && fDate >= batch.settlementDate) {
              bId = cage.batchId;
            }
          }
        }
      }

      if (bId) {
        feedingByBatch.set(bId, (feedingByBatch.get(bId) || 0) + f.amount);
      }
    });

    const harvestsByBatch = new Map<
      string,
      { fishCount: number; initialFishCount: number; weight: number }
    >();
    (state.harvestLogs || []).forEach((h) => {
      const current = harvestsByBatch.get(h.batchId) || {
        fishCount: 0,
        initialFishCount: 0,
        weight: 0,
      };

      // Se não temos o initialFishCount no log (logs antigos), tentamos reconstruir com a mortalidade daquela gaiola
      let initial = h.initialFishCount;
      if (!initial) {
        const batch = (state.batches || []).find((b) => b.id === h.batchId);
        const cageMortality = (state.mortalityLogs || [])
          .filter((m) => {
            if (m.cageId !== h.cageId) return false;
            if (m.batchId) return m.batchId === h.batchId;
            return batch && m.date >= batch.settlementDate && m.date <= h.date;
          })
          .reduce((acc, curr) => acc + curr.count, 0);
        initial = h.fishCount + cageMortality;
      }

      harvestsByBatch.set(h.batchId, {
        fishCount: current.fishCount + h.fishCount,
        initialFishCount: current.initialFishCount + initial,
        weight: current.weight + h.totalWeight,
      });
    });

    return (state.batches || []).map((batch) => {
      const batchCages = cagesByBatch.get(batch.id) || [];
      const cageIds = batchCages.map((c) => c.id);

      const usedFish = batchCages.reduce(
        (acc, curr) => acc + (curr.initialFishCount || 0),
        0,
      );
      const harvestData = harvestsByBatch.get(batch.id) || {
        fishCount: 0,
        initialFishCount: 0,
        weight: 0,
      };
      const harvestedFish = harvestData.fishCount;
      const harvestedWeight = harvestData.weight;
      const settledAndHarvested = harvestData.initialFishCount;

      const totalMortality = mortalityByBatch.get(batch.id) || 0;
      const nurseryMortality = nurseryMortalityByBatch.get(batch.id) || 0;

      // Saldo Povoamento: O que ainda não saiu do berçário
      const balance = batch.isSettlementComplete
        ? 0
        : Math.max(
            0,
            batch.initialQuantity -
              usedFish -
              settledAndHarvested -
              nurseryMortality,
          );

      const mortality = totalMortality;
      const liveFish = Math.max(
        0,
        batch.initialQuantity - mortality - harvestedFish,
      );
      // Rendimento baseado na sobrevivência (Povoado - Morto) / Povoado
      const yieldPercentage =
        batch.initialQuantity > 0
          ? ((batch.initialQuantity - mortality) / batch.initialQuantity) * 100
          : 0;

      const expectedAtHarvest = batch.initialQuantity - mortality;

      // Calculate Expected Weight for finalized batches to match BatchClosing logic
      let expectedWeight = 0;
      const batchHarvests = (state.harvestLogs || []).filter(
        (h) => h.batchId === batch.id,
      );
      if (batchHarvests.length > 0) {
        const firstHarvestDate = batchHarvests.reduce(
          (min, h) => (h.date < min ? h.date : min),
          batchHarvests[0].date,
        );
        const mortalityBeforeHarvest = (state.mortalityLogs || [])
          .filter((m) => {
            let bId = m.batchId;
            if (!bId && m.cageId) {
              const cage = (state.cages || []).find((c) => c.id === m.cageId);
              if (cage?.batchId === batch.id) bId = batch.id;
            }
            return bId === batch.id && m.date < firstHarvestDate;
          })
          .reduce((acc, curr) => acc + curr.count, 0);

        const expectedFishAtHarvest =
          batch.initialQuantity - mortalityBeforeHarvest;

        const biometriesForPrediction = (state.biometryLogs || []).filter(
          (b) => {
            let bId = b.batchId;
            if (!bId && b.cageId) {
              const cage = (state.cages || []).find((c) => c.id === b.cageId);
              if (cage?.batchId === batch.id) bId = batch.id;
            }
            return bId === batch.id && b.date <= firstHarvestDate;
          },
        );

        let avgWeightForPrediction = batch.initialUnitWeight;
        if (biometriesForPrediction.length > 0) {
          const harvestDayLogs = biometriesForPrediction.filter(
            (log) => log.date === firstHarvestDate,
          );
          if (harvestDayLogs.length > 0) {
            avgWeightForPrediction =
              harvestDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) /
              harvestDayLogs.length;
          } else {
            const lastDate = biometriesForPrediction.reduce(
              (max, log) => (log.date > max ? log.date : max),
              "",
            );
            const lastDayLogs = biometriesForPrediction.filter(
              (log) => log.date === lastDate,
            );
            if (lastDayLogs.length > 0) {
              avgWeightForPrediction =
                lastDayLogs.reduce((acc, log) => acc + log.averageWeight, 0) /
                lastDayLogs.length;
            }
          }
        }
        expectedWeight =
          (expectedFishAtHarvest * avgWeightForPrediction) / 1000;
      }

      const accuracy =
        expectedWeight > 0 ? (harvestedWeight / expectedWeight) * 100 : 0;
      const isFinalized = harvestedFish > 0 && batchCages.length === 0;

      const batchBiometries = biometryByBatch.get(batch.id) || [];

      let currentAvgWeight = batch.initialUnitWeight;
      if (batchBiometries.length > 0) {
        const lastDate = batchBiometries.reduce(
          (max, log) => (log.date > max ? log.date : max),
          "",
        );
        const lastDayLogs = batchBiometries.filter(
          (log) => log.date === lastDate,
        );
        if (lastDayLogs.length > 0) {
          const sumWeights = lastDayLogs.reduce(
            (acc, log) => acc + log.averageWeight,
            0,
          );
          currentAvgWeight = sumWeights / lastDayLogs.length;
        }
      }

      const totalBiomassKg = (liveFish * currentAvgWeight) / 1000;
      const totalProducedCount = Math.max(0, batch.initialQuantity - mortality);
      const totalProducedBiomassKg = totalBiomassKg + harvestedWeight;

      const totalFeed = feedingByBatch.get(batch.id) || 0;

      // FCA: Total Feed / Total Produced Weight (Harvested + Current)
      const fca =
        totalProducedBiomassKg > 0
          ? totalFeed / 1000 / totalProducedBiomassKg
          : 0;

      const protocol = (state.protocols || []).find(
        (p) => p.id === batch.protocolId,
      );

      let settlementAlert = null;
      if (batch.settlementDate) {
        const today = startOfDay(new Date());
        const settlement = startOfDay(parseISO(batch.settlementDate));
        const daysDiff = differenceInDays(settlement, today);

        if (daysDiff >= 0 && daysDiff <= 5) {
          settlementAlert = (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center gap-3 animate-pulse">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                Povoamento em {daysDiff === 0 ? "HOJE" : `${daysDiff} dias`}
              </span>
            </div>
          );
        }
      }

      return {
        ...batch,
        batchCages,
        usedFish,
        harvestedFish,
        balance,
        mortality,
        liveFish,
        yieldPercentage,
        currentAvgWeight,
        totalBiomassKg,
        totalProducedBiomassKg,
        totalProducedCount,
        totalFeed,
        fca,
        protocol,
        settlementAlert,
        accuracy,
        isFinalized,
      };
    });
  }, [
    state.batches,
    state.cages,
    state.mortalityLogs,
    state.biometryLogs,
    state.protocols,
    state.harvestLogs,
  ]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    (state.batches || []).forEach((b) => {
      if (b.settlementDate) {
        try {
          months.add(format(parseISO(b.settlementDate), "yyyy-MM"));
        } catch (e) {}
      }
      if (b.expectedHarvestDate) {
        try {
          months.add(format(parseISO(b.expectedHarvestDate), "yyyy-MM"));
        } catch (e) {}
      }
    });
    return Array.from(months).sort().reverse();
  }, [state.batches]);

  const filteredBatchStats = useMemo(() => {
    const activeBatches = batchStats.filter(b => !b.isClosed);
    if (!filterMonth) return activeBatches;

    return activeBatches.filter((batch) => {
      const dateStr =
        filterType === "settlement"
          ? batch.settlementDate
          : batch.expectedHarvestDate;
      if (!dateStr) return false;

      try {
        const date = parseISO(dateStr);
        const monthStr = format(date, "yyyy-MM");
        return monthStr === filterMonth;
      } catch (e) {
        return false;
      }
    });
  }, [batchStats, filterMonth, filterType]);

  const planningCages = useMemo(() => {
    if (!selectedPlanningBatchId) return [];

    const batch = batchStats.find((b) => b.id === selectedPlanningBatchId);
    if (!batch) return [];

    // Get all cage IDs already scheduled, excluding the one being edited
    const scheduledCageIds = (state.harvestSchedules || [])
      .filter((s) => s.id !== editingScheduleId)
      .flatMap((s) => s.cageIds);

    return batch.batchCages
      .filter((cage) => !scheduledCageIds.includes(cage.id))
      .map((cage) => {
        const mortality = (state.mortalityLogs || [])
          .filter((m) => {
            if (m.cageId !== cage.id) return false;
            if (m.batchId) return m.batchId === batch.id;
            // Fallback for old logs
            return m.date >= batch.settlementDate;
          })
          .reduce((acc, curr) => acc + curr.count, 0);

        const currentCount = (cage.initialFishCount || 0) - mortality;
        const biomass = (currentCount * batch.currentAvgWeight) / 1000;

        return {
          ...cage,
          mortality,
          currentCount,
          biomass,
        };
      })
      .sort((a, b) => b.mortality - a.mortality);
  }, [
    selectedPlanningBatchId,
    batchStats,
    state.mortalityLogs,
    state.harvestSchedules,
    editingScheduleId,
  ]);

  const selectedPlanningCagesData = useMemo(() => {
    return planningCages.filter((c) => selectedPlanningCageIds.includes(c.id));
  }, [planningCages, selectedPlanningCageIds]);

  const stratification = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPlanningCagesData.forEach((cage) => {
      const model = cage.model || "Gaiola";
      const d = cage.dimensions || { width: 0, length: 0, depth: 0 };
      const dim =
        model === "Circular"
          ? `Circular (${d.depth || 0}m prof.)`
          : `${model} (${d.width || 0}x${d.length || 0}x${d.depth || 0})`;
      counts[dim] = (counts[dim] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([dim, count]) => `${dim} ${formatNumber(count)}uni`)
      .join(", ");
  }, [selectedPlanningCagesData]);

  const fastingHours = useMemo(() => {
    if (!plannedHarvestDate || !lastFeeding) return 0;
    const harvestDate = parseISO(plannedHarvestDate);
    harvestDate.setHours(3, 0, 0, 0); // Despesca às 03:00 AM
    const feedingDate = parseISO(lastFeeding);
    return Math.floor(
      (harvestDate.getTime() - feedingDate.getTime()) / (1000 * 60 * 60),
    );
  }, [plannedHarvestDate, lastFeeding]);

  const totalPlanningBiomass = useMemo(() => {
    return selectedPlanningCagesData.reduce(
      (acc, curr) => acc + curr.biomass,
      0,
    );
  }, [selectedPlanningCagesData]);

  return (
    <div className="space-y-8 pb-20">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit mx-auto md:mx-0">
        <button
          onClick={() => setActiveSubTab("inventory")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === "inventory" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
        >
          <Tag className="w-4 h-4" />
          Estoque de Lotes
        </button>
        <button
          onClick={() => setActiveSubTab("harvest")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === "harvest" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
        >
          <ShoppingCart className="w-4 h-4" />
          Despesca
        </button>
        <button
          onClick={() => setActiveSubTab("closing")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeSubTab === "closing" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
        >
          <FileText className="w-4 h-4" />
          Fechamento
        </button>
      </div>

      {activeSubTab === "harvest" ? (
        <HarvestManagement
          state={state}
          onUpdate={onUpdate}
          currentUser={currentUser}
        />
      ) : activeSubTab === "closing" ? (
        <BatchClosing
          state={state}
          onUpdate={onUpdate}
          currentUser={currentUser}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 lg:sticky lg:top-8">
            {hasPermission ? (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center justify-between uppercase tracking-tighter italic">
                  <div className="flex items-center gap-2">
                    {editingId ? (
                      <Edit className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Plus className="w-5 h-5 text-blue-500" />
                    )}
                    {editingId ? "Editar Lote" : "Cadastrar Lote"}
                  </div>
                  {editingId && (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setFormData({
                          name: "",
                          settlementDate: new Date()
                            .toISOString()
                            .split("T")[0],
                          initialQuantity: "",
                          initialUnitWeight: "",
                          protocolId: "",
                          expectedHarvestDate: "",
                        });
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                      Identificação do Lote
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Lote 2024-A"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                      Modelo de Produção
                    </label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={formData.protocolId}
                      onChange={(e) =>
                        setFormData({ ...formData, protocolId: e.target.value })
                      }
                    >
                      <option value="">Nenhum modelo</option>
                      {(state.protocols || []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                        Povoamento
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                        value={formData.settlementDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            settlementDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="0"
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                        value={formData.initialQuantity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initialQuantity: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                        Peso Médio (g)
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="0"
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                        value={formData.initialUnitWeight}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initialUnitWeight: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                        Prev. Despesca
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                        value={formData.expectedHarvestDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expectedHarvestDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-white shadow-xl transition-all active:scale-95 mt-2 ${editingId ? "bg-amber-600 shadow-amber-600/20" : "bg-blue-600 shadow-blue-600/20"}`}
                  >
                    {editingId ? "Salvar Lote" : "Povoar Lote"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-100 p-8 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center gap-4 text-center">
                <Eye className="w-10 h-10 text-slate-300" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Modo Leitura
                </h4>
                <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
                  Sem permissão para editar.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
            {/* Indicação de Gaiola Box */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 rounded-2xl">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">
                      Indicação de Gaiolas para Despesca
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Planejamento e Programação por Gaiola
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Filtrar por Data:
                  </label>
                  <input
                    type="date"
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-xs"
                    value={selectedScheduleDate}
                    onChange={(e) => setSelectedScheduleDate(e.target.value)}
                  />
                  {selectedScheduleDate && (
                    <button
                      onClick={() => setSelectedScheduleDate("")}
                      className="p-2 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                      Selecionar Lote
                    </label>
                    <select
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500/10 text-sm"
                      value={selectedPlanningBatchId}
                      onChange={(e) => {
                        setSelectedPlanningBatchId(e.target.value);
                        setSelectedPlanningCageIds([]);
                      }}
                    >
                      <option value="">Escolher Lote para Planejar</option>
                      {batchStats
                        .filter((b) => !b.isFinalized)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({formatNumber(b.batchCages.length)}{" "}
                            gaiolas)
                          </option>
                        ))}
                    </select>
                  </div>

                  {selectedPlanningBatchId && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Gaiolas Disponíveis
                        </label>
                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">
                          {formatNumber(planningCages.length)} Total
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                        {planningCages.map((cage) => (
                          <button
                            key={cage.id}
                            onClick={() => {
                              if (selectedPlanningCageIds.includes(cage.id)) {
                                setSelectedPlanningCageIds(
                                  selectedPlanningCageIds.filter(
                                    (id) => id !== cage.id,
                                  ),
                                );
                              } else {
                                setSelectedPlanningCageIds([
                                  ...selectedPlanningCageIds,
                                  cage.id,
                                ]);
                              }
                            }}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                              selectedPlanningCageIds.includes(cage.id)
                                ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10"
                                : "bg-white border-slate-100 hover:border-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-xl ${selectedPlanningCageIds.includes(cage.id) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
                              >
                                {selectedPlanningCageIds.includes(cage.id) ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Box className="w-4 h-4" />
                                )}
                              </div>
                              <div className="text-left">
                                <span className="text-sm font-black text-slate-800 uppercase italic">
                                  {cage.name}
                                </span>
                                <div className="flex flex-col mt-0.5">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                                    {formatNumber(cage.currentCount)} peixes
                                  </span>
                                  <span className="text-[9px] font-black text-red-500 uppercase">
                                    Mortalidade: {formatNumber(cage.mortality)}
                                  </span>
                                  <span className="text-[9px] font-black text-blue-600 uppercase">
                                    {formatNumber(cage.biomass, 1)}kg
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {selectedPlanningCageIds.length > 0 ? (
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-6 animate-in fade-in slide-in-from-right-4">
                      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">
                          Nova Programação
                        </h4>
                        <div className="flex gap-2">
                          {editingScheduleId && (
                            <button
                              onClick={() => {
                                setEditingScheduleId(null);
                                setSelectedPlanningCageIds([]);
                                setPlannedHarvestDate("");
                                setLastFeeding("");
                              }}
                              className="p-2 text-slate-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase">
                            {formatNumber(selectedPlanningCageIds.length)}{" "}
                            Gaiolas
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Biomassa Total
                          </span>
                          <span className="text-xl font-black text-blue-600 italic">
                            {formatNumber(totalPlanningBiomass, 1)}kg
                          </span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Estratificação
                          </span>
                          <span className="text-[10px] font-black text-slate-700 uppercase leading-tight block">
                            {stratification || "---"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Data da Despesca
                          </span>
                          <input
                            type="date"
                            className="w-full mt-1 bg-transparent border-none p-0 font-black text-emerald-600 outline-none text-xs"
                            value={plannedHarvestDate}
                            onChange={(e) => {
                              const date = e.target.value;
                              setPlannedHarvestDate(date);
                              if (date) {
                                const [h, m] = lastFeedingHour
                                  .split(":")
                                  .map(Number);
                                const harvestDateObj = parseISO(date);
                                const lastFeedingDate = new Date(
                                  harvestDateObj.getTime() -
                                    2 * 24 * 60 * 60 * 1000,
                                );
                                lastFeedingDate.setHours(h, m, 0, 0);
                                setLastFeeding(
                                  format(lastFeedingDate, "yyyy-MM-dd'T'HH:mm"),
                                );
                              } else {
                                setLastFeeding("");
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                              Último Trato (Jejum Est. {fastingHours}h)
                            </span>
                            {plannedHarvestDate && (
                              <span className="text-[10px] font-black text-blue-600 uppercase">
                                Sugestão:{" "}
                                {format(
                                  new Date(
                                    parseISO(plannedHarvestDate).getTime() -
                                      2 * 24 * 60 * 60 * 1000,
                                  ),
                                  "dd/MM/yyyy",
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {["07:00", "11:00", "13:00", "16:00"].map((h) => (
                              <button
                                key={h}
                                onClick={() => {
                                  setLastFeedingHour(h);
                                  if (plannedHarvestDate) {
                                    const [hour, min] = h
                                      .split(":")
                                      .map(Number);
                                    const harvestDateObj =
                                      parseISO(plannedHarvestDate);
                                    const lastFeedingDate = new Date(
                                      harvestDateObj.getTime() -
                                        2 * 24 * 60 * 60 * 1000,
                                    );
                                    lastFeedingDate.setHours(hour, min, 0, 0);
                                    setLastFeeding(
                                      format(
                                        lastFeedingDate,
                                        "yyyy-MM-dd'T'HH:mm",
                                      ),
                                    );
                                  }
                                }}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black transition-all ${lastFeedingHour === h ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Utensils className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-black text-slate-700">
                            {lastFeeding
                              ? format(
                                  parseISO(lastFeeding),
                                  "dd/MM/yyyy 'às' HH:mm",
                                )
                              : "---"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                          Gaiolas Selecionadas
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlanningCagesData.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-1 bg-slate-100 text-[10px] font-black text-slate-600 rounded-lg uppercase border border-slate-200"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleSaveSchedule}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {editingScheduleId
                          ? "Atualizar Programação"
                          : "Salvar Programação"}
                      </button>

                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[9px] font-bold text-amber-700 uppercase leading-relaxed">
                          Esta ferramenta é apenas para planejamento. Nenhuma
                          alteração será feita nos registros de despesca ou
                          status das gaiolas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic ml-1">
                        Programações Salvas
                      </h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                        {(state.harvestSchedules || [])
                          .filter(
                            (s) =>
                              !selectedScheduleDate ||
                              s.date === selectedScheduleDate,
                          )
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((schedule) => {
                            const batch = state.batches.find(
                              (b) => b.id === schedule.batchId,
                            );
                            return (
                              <div
                                key={schedule.id}
                                className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-black text-slate-800">
                                      {format(
                                        parseISO(schedule.date),
                                        "dd/MM/yyyy",
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() =>
                                        startEditSchedule(schedule)
                                      }
                                      className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        removeSchedule(schedule.id)
                                      }
                                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Lote
                                    </span>
                                    <span className="text-xs font-bold text-slate-700">
                                      {batch?.name || "Lote removido"}
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      Gaiolas
                                    </span>
                                    <span className="text-xs font-bold text-blue-600">
                                      {schedule.cageIds.length} unidades
                                    </span>
                                  </div>
                                </div>

                                {schedule.lastFeedingDate && (
                                  <div className="mb-2 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100 flex items-center gap-2">
                                    <Utensils className="w-3 h-3 text-amber-600" />
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">
                                        Último Trato
                                      </span>
                                      <span className="text-[9px] font-bold text-amber-700 uppercase">
                                        {format(
                                          parseISO(schedule.lastFeedingDate),
                                          "dd/MM/yyyy 'às' HH:mm",
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {(() => {
                                  const scheduleCages = schedule.cageIds
                                    .map((cid) =>
                                      state.cages.find((c) => c.id === cid),
                                    )
                                    .filter(Boolean);
                                  const counts: Record<string, number> = {};
                                  scheduleCages.forEach((cage) => {
                                    if (!cage) return;
                                    const model = cage.model || "Gaiola";
                                    const d = cage.dimensions || {
                                      width: 0,
                                      length: 0,
                                      depth: 0,
                                    };
                                    const dim =
                                      model === "Circular"
                                        ? `Circular (${d.depth || 0}m prof.)`
                                        : `${model} (${d.width || 0}x${d.length || 0}x${d.depth || 0})`;
                                    counts[dim] = (counts[dim] || 0) + 1;
                                  });
                                  const strat = Object.entries(counts)
                                    .map(
                                      ([dim, count]) =>
                                        `${dim} ${formatNumber(count)}uni`,
                                    )
                                    .join(", ");
                                  return strat ? (
                                    <div className="mt-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                                        Estratificação
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-600 uppercase">
                                        {strat}
                                      </span>
                                    </div>
                                  ) : null;
                                })()}

                                <div className="mt-3 flex flex-wrap gap-1">
                                  {schedule.cageIds.map((cid) => {
                                    const c = state.cages.find(
                                      (cage) => cage.id === cid,
                                    );
                                    return (
                                      <span
                                        key={cid}
                                        className="px-1.5 py-0.5 bg-slate-50 text-[8px] font-black text-slate-500 rounded uppercase border border-slate-100"
                                      >
                                        {c?.name || "---"}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        {(!state.harvestSchedules ||
                          state.harvestSchedules.length === 0) && (
                          <div className="py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                            <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Nenhuma programação salva.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">
                      Filtros de Lotes
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Organize por período e tipo de data
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/10 shadow-sm min-w-[140px]"
                  >
                    <option value="">Todos os Meses</option>
                    {availableMonths.map((m) => {
                      const [year, month] = m.split("-");
                      const date = new Date(
                        parseInt(year),
                        parseInt(month) - 1,
                      );
                      return (
                        <option key={m} value={m}>
                          {format(date, "MMMM yyyy", { locale: ptBR })}
                        </option>
                      );
                    })}
                  </select>

                  {filterMonth && (
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        onClick={() => setFilterType("settlement")}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === "settlement" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Povoamento
                      </button>
                      <button
                        onClick={() => setFilterType("harvest")}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === "harvest" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Despesca
                      </button>
                    </div>
                  )}

                  {filterMonth && (
                    <button
                      onClick={() => {
                        setFilterMonth("");
                        setFilterType("settlement");
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      title="Limpar Filtros"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredBatchStats.map((batch) => {
                  return (
                    <div
                      key={batch.id}
                      className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:border-blue-200 transition-all"
                    >
                      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Tag className="w-5 h-5 text-blue-500" />
                          <span className="font-black text-slate-800 uppercase tracking-tighter">
                            {batch.name}
                          </span>
                        </div>
                        {hasPermission && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(batch)}
                              className="text-slate-300 hover:text-blue-500 p-2 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeBatch(batch.id)}
                              className="text-slate-300 hover:text-red-500 p-2 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-6 space-y-4">
                        {batch.settlementAlert}
                        <div className="flex items-center justify-between">
                          {batch.protocol ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100">
                              <BookOpen className="w-3 h-3 text-indigo-600" />
                              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                {batch.protocol.name}
                              </span>
                            </div>
                          ) : (
                            <div></div>
                          )}

                          {batch.isFinalized ? (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-900 rounded-xl border border-indigo-800 text-white">
                              <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                Taxa de Sobrevivência do Lote:{" "}
                                {formatNumber(batch.accuracy, 1)}%
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100">
                              <TrendingUp className="w-3 h-3 text-emerald-600" />
                              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                                Taxa de Sobrevivência do Lote:{" "}
                                {formatNumber(batch.yieldPercentage, 1)}%
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Calendar className="w-3 h-3 opacity-30" />{" "}
                              Povoamento
                            </span>
                            <span className="text-xs font-black text-slate-700">
                              {batch.settlementDate
                                ? format(
                                    new Date(
                                      batch.settlementDate + "T12:00:00",
                                    ),
                                    "dd/MM/yyyy",
                                  )
                                : "---"}
                            </span>
                          </div>

                          {batch.expectedHarvestDate && (
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Calendar className="w-3 h-3 opacity-30 text-blue-400" />{" "}
                                Prev. Despesca
                              </span>
                              <span className="text-xs font-black text-blue-600">
                                {format(
                                  new Date(
                                    batch.expectedHarvestDate + "T12:00:00",
                                  ),
                                  "dd/MM/yyyy",
                                )}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Barra de Progresso da Assertividade */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full transition-all duration-500 ${(batch.isFinalized ? batch.accuracy : batch.yieldPercentage) > 90 ? "bg-emerald-500" : (batch.isFinalized ? batch.accuracy : batch.yieldPercentage) > 70 ? "bg-blue-500" : "bg-amber-500"}`}
                            style={{
                              width: `${batch.isFinalized ? batch.accuracy : batch.yieldPercentage}%`,
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Scale className="w-2.5 h-2.5" /> Peso Médio
                            </span>
                            <span className="text-lg font-black text-blue-600 leading-none mt-1">
                              {formatNumber(batch.currentAvgWeight, 1)}g
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <TrendingUp className="w-2.5 h-2.5" /> Biomassa
                              Total
                            </span>
                            <span className="text-lg font-black text-emerald-600 leading-none mt-1">
                              {formatNumber(batch.totalProducedBiomassKg, 1)}kg
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Package className="w-2.5 h-2.5" /> Ração Total
                            </span>
                            <span className="text-lg font-black text-amber-600 leading-none mt-1">
                              {formatNumber(batch.totalFeed / 1000, 1)}kg
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <TrendingUp className="w-2.5 h-2.5" /> FCA
                            </span>
                            <span className="text-lg font-black text-indigo-600 leading-none mt-1">
                              {formatNumber(batch.fca, 2)}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Fish className="w-2.5 h-2.5" /> Peixes Produzidos
                            </span>
                            <span className="text-lg font-black text-slate-700 leading-none mt-1">
                              {formatNumber(batch.totalProducedCount)} un
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Saldo Povoam.
                              </span>
                              {hasPermission && (
                                <button
                                  onClick={() =>
                                    toggleSettlementComplete(batch.id)
                                  }
                                  title={
                                    batch.isSettlementComplete
                                      ? "Reativar Saldo"
                                      : "Zerar Saldo Manualmente"
                                  }
                                  className={`p-1 rounded-md transition-all ${batch.isSettlementComplete ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500"}`}
                                >
                                  <CheckSquare className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <span
                              className={`text-lg font-black mt-1 leading-none ${batch.balance > 0 ? "text-blue-600" : "text-slate-400"}`}
                            >
                              {formatNumber(batch.balance)} un
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Total Despescado
                            </span>
                            <span className="text-sm font-black text-blue-600">
                              {formatNumber(batch.harvestedFish)} un
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Mortalidade
                            </span>
                            <span className="text-sm font-black text-red-500">
                              {formatNumber(batch.mortality)} un
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Total Povoado
                            </span>
                            <span className="text-sm font-black text-slate-700">
                              {formatNumber(batch.initialQuantity)} un
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManagement;
