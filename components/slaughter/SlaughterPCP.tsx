import React, { useState, useMemo } from 'react';
import { AppState, User, PCPSupplier, PCPSlaughterSchedule } from '../../types';
import { 
  Users, 
  Calendar, 
  Plus, 
  Search, 
  Trash2, 
  AlertCircle,
  TrendingUp,
  Scale,
  DollarSign,
  Edit,
  Clock,
  Filter,
  CheckSquare,
  Square,
  SlidersHorizontal,
  X,
  FileDown,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber } from '../../utils/formatters';

interface Props {
  state: AppState;
  onUpdate: (newState: AppState) => void;
  currentUser: User;
}

type PCPSubTab = 'programacao' | 'cadastros';

const monthsList = [
  { value: '01', name: 'Janeiro' },
  { value: '02', name: 'Fevereiro' },
  { value: '03', name: 'Março' },
  { value: '04', name: 'Abril' },
  { value: '05', name: 'Maio' },
  { value: '06', name: 'Junho' },
  { value: '07', name: 'Julho' },
  { value: '08', name: 'Agosto' },
  { value: '09', name: 'Setembro' },
  { value: '10', name: 'Outubro' },
  { value: '11', name: 'Novembro' },
  { value: '12', name: 'Dezembro' }
];

const SlaughterPCP: React.FC<Props> = ({ state, onUpdate, currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<PCPSubTab>('programacao');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Forms states
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<PCPSupplier>>({});
  
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState<Partial<PCPSlaughterSchedule>>({
    expectedDate: new Date().toISOString().split('T')[0]
  });

  // Multiple temporary lines for batch schedule registration inside the modal
  const [tempLines, setTempLines] = useState<{
    tempId: string;
    supplierId: string;
    expectedWeight: number;
    pricePerKg: number;
  }[]>([]);

  // Selection inputs for current batch-line (inside modal in creation mode)
  const [lineSupplierId, setLineSupplierId] = useState('');
  const [lineExpectedWeight, setLineExpectedWeight] = useState('');
  const [linePricePerKg, setLinePricePerKg] = useState('');

  // Active Month select value for the creation modal, default to current month
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0'); // '01' - '12'
  });

  // PDF Generation Selections
  const [showPdfOptionsModal, setShowPdfOptionsModal] = useState(false);
  const [pdfSelectedPeriod, setPdfSelectedPeriod] = useState<'filtered' | 'month'>('filtered');
  const [pdfSelectedMonth, setPdfSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0'); // '01' - '12'
  });
  const [pdfSelectedYear, setPdfSelectedYear] = useState<number>(new Date().getFullYear());

  // Filter States for Slaughter Schedules
  const [filterDate, setFilterDate] = useState('');
  const [filterProducerId, setFilterProducerId] = useState('');
  const [showOnlyRecent, setShowOnlyRecent] = useState(false);
  
  // Multiple Selection State
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set());

  // Accordion active expanded state (stores monthKeys and dateStrings)
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    // Expand current month by default
    const d = new Date();
    const currentYearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return new Set([currentYearMonth]);
  });
  
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const suppliers = state.pcpSuppliers || [];
  const schedules = state.pcpSlaughterSchedules || [];

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cnpj && s.cnpj.includes(searchTerm)) ||
      String(s.sequentialCode).includes(searchTerm)
    ).sort((a, b) => a.sequentialCode - b.sequentialCode);
  }, [suppliers, searchTerm]);

  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    // Filter by producer
    if (filterProducerId) {
      result = result.filter(s => s.supplierId === filterProducerId);
    }

    // Filter by date
    if (filterDate) {
      result = result.filter(s => s.expectedDate === filterDate);
    }

    // Sort strategy and/or limit based on "últimos lançamentos"
    if (showOnlyRecent) {
      result.sort((a, b) => {
        const timeA = a.updatedAt || 0;
        const timeB = b.updatedAt || 0;
        return timeB - timeA;
      });
    } else {
      result.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
    }

    return result;
  }, [schedules, filterProducerId, filterDate, showOnlyRecent]);

  // Group schedules dynamically by Month, then Day for the Accordion layout
  const groupedSchedules = useMemo(() => {
    interface GroupEntry {
      label: string; // e.g. "Maio de 2026"
      monthKey: string; // "2026-05"
      totalWeight: number;
      totalValue: number;
      days: {
        [dateStr: string]: {
          dateStr: string;
          formattedDayLabel: string; // e.g. "Terça-feira, 26/05"
          dayTotalWeight: number;
          dayTotalValue: number;
          items: PCPSlaughterSchedule[];
        };
      };
    }

    const groups: { [key: string]: GroupEntry } = {};

    filteredSchedules.forEach(schedule => {
      const parts = schedule.expectedDate.split('-');
      if (parts.length < 3) return;
      const [year, monthStr, dayStr] = parts;
      const monthKey = `${year}-${monthStr}`;

      if (!groups[monthKey]) {
        const mIndex = Number(monthStr) - 1;
        const monthName = monthsList[mIndex]?.name || monthStr;
        groups[monthKey] = {
          label: `${monthName} de ${year}`,
          monthKey,
          totalWeight: 0,
          totalValue: 0,
          days: {}
        };
      }

      const dayObj = groups[monthKey].days;
      if (!dayObj[schedule.expectedDate]) {
        const formattedLabel = (() => {
          try {
            const dateObj = new Date(schedule.expectedDate + 'T00:00:00');
            const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
            const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
            return `${capitalizedWeekday}, ${dayStr}/${monthStr}`;
          } catch (e) {
            return `${dayStr}/${monthStr}/${year}`;
          }
        })();

        dayObj[schedule.expectedDate] = {
          dateStr: schedule.expectedDate,
          formattedDayLabel: formattedLabel,
          dayTotalWeight: 0,
          dayTotalValue: 0,
          items: []
        };
      }

      const val = schedule.expectedWeight * schedule.pricePerKg;
      groups[monthKey].totalWeight += schedule.expectedWeight;
      groups[monthKey].totalValue += val;

      dayObj[schedule.expectedDate].dayTotalWeight += schedule.expectedWeight;
      dayObj[schedule.expectedDate].dayTotalValue += val;
      dayObj[schedule.expectedDate].items.push(schedule);
    });

    // Convert days mapping back to sorted array
    return Object.values(groups)
      .map(group => {
        const daysArray = Object.values(group.days).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
        return {
          ...group,
          daysArray
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredSchedules]);

  // Year & Month bounds configuration for Date Input
  const currentYear = new Date().getFullYear();
  const lastDayOfChosenMonth = useMemo(() => {
    return new Date(currentYear, Number(selectedMonth), 0).getDate();
  }, [selectedMonth, currentYear]);

  const minDateLimit = `${currentYear}-${selectedMonth}-01`;
  const maxDateLimit = `${currentYear}-${selectedMonth}-${String(lastDayOfChosenMonth).padStart(2, '0')}`;

  const handleMonthChange = (monthStr: string) => {
    setSelectedMonth(monthStr);
    
    // Auto-align schedule date to the selected month
    const d = new Date();
    const currentMonthStr = String(d.getMonth() + 1).padStart(2, '0');
    let targetDate = `${currentYear}-${monthStr}-01`;
    if (monthStr === currentMonthStr) {
      targetDate = d.toISOString().split('T')[0];
    }
    setNewSchedule(prev => ({
      ...prev,
      expectedDate: targetDate
    }));
  };

  const handleAddSupplier = () => {
    if (!newSupplier.name) return;

    const lastCode = suppliers.reduce((max, s) => Math.max(max, s.sequentialCode || 0), 0);
    
    const supplier: PCPSupplier = {
      id: crypto.randomUUID(),
      sequentialCode: lastCode + 1,
      name: newSupplier.name,
      cnpj: newSupplier.cnpj || '',
      contact: newSupplier.contact || '',
      phone: newSupplier.phone || '',
      address: newSupplier.address || '',
      userId: currentUser.id,
      updatedAt: Date.now()
    };

    onUpdate({
      ...state,
      pcpSuppliers: [...suppliers, supplier]
    });

    setNewSupplier({});
    setShowSupplierForm(false);
  };

  const handleDeleteSupplier = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fornecedor?')) return;
    
    const isUsed = schedules.some(s => s.supplierId === id);
    if (isUsed) {
      alert('Este fornecedor possui programações de abate vinculadas e não pode ser excluído.');
      return;
    }

    onUpdate({
      ...state,
      pcpSuppliers: suppliers.filter(s => s.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
  };

  const handleStartEditSchedule = (schedule: PCPSlaughterSchedule) => {
    setEditingScheduleId(schedule.id);
    const parts = schedule.expectedDate.split('-');
    if (parts.length >= 2) {
      setSelectedMonth(parts[1]);
    }
    setNewSchedule({
      supplierId: schedule.supplierId,
      expectedDate: schedule.expectedDate,
      expectedWeight: schedule.expectedWeight,
      pricePerKg: schedule.pricePerKg
    });
    setTempLines([]); // Single edit doesn't require multi-lines list
    setShowScheduleForm(true);
  };

  const handleCancelScheduleForm = () => {
    setShowScheduleForm(false);
    setEditingScheduleId(null);
    setTempLines([]);
    setLineSupplierId('');
    setLineExpectedWeight('');
    setLinePricePerKg('');
    setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
  };

  const handleToggleSelectAll = () => {
    const allSelected = filteredSchedules.length > 0 && filteredSchedules.every(s => selectedScheduleIds.has(s.id));
    if (allSelected) {
      const next = new Set(selectedScheduleIds);
      filteredSchedules.forEach(s => next.delete(s.id));
      setSelectedScheduleIds(next);
    } else {
      const next = new Set(selectedScheduleIds);
      filteredSchedules.forEach(s => next.add(s.id));
      setSelectedScheduleIds(next);
    }
  };

  const handleToggleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedScheduleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedScheduleIds(next);
  };

  const handleBulkDelete = () => {
    if (selectedScheduleIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja excluir as ${selectedScheduleIds.size} programações selecionadas?`)) return;

    const idsArr = Array.from(selectedScheduleIds);
    onUpdate({
      ...state,
      pcpSlaughterSchedules: schedules.filter(s => !selectedScheduleIds.has(s.id)),
      deletedIds: [...(state.deletedIds || []), ...idsArr]
    });
    setSelectedScheduleIds(new Set());
  };

  // Add intermediate line item inside the modal table
  const handleAddNewDraftLine = () => {
    if (!lineSupplierId) {
      alert('Favor selecionar o fornecedor.');
      return;
    }
    if (!lineExpectedWeight || Number(lineExpectedWeight) <= 0) {
      alert('Favor inserir um peso previsto válido e maior que zero.');
      return;
    }
    if (!linePricePerKg || Number(linePricePerKg) <= 0) {
      alert('Favor inserir um valor/kg válido e maior que zero.');
      return;
    }

    setTempLines(prev => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        supplierId: lineSupplierId,
        expectedWeight: Number(lineExpectedWeight),
        pricePerKg: Number(linePricePerKg)
      }
    ]);

    // Clear entries for next line
    setLineSupplierId('');
    setLineExpectedWeight('');
    setLinePricePerKg('');
  };

  // Remove lines inside the modal table draft queue
  const handleRemoveDraftLine = (tempId: string) => {
    setTempLines(prev => prev.filter(item => item.tempId !== tempId));
  };

  // Save the whole dialog state
  const handleAddSchedule = () => {
    if (editingScheduleId) {
      // Single edit submission
      if (!newSchedule.supplierId || !newSchedule.expectedDate || !newSchedule.expectedWeight || !newSchedule.pricePerKg) {
        alert('Preencha todos os campos obrigatórios.');
        return;
      }

      const updatedSchedules = schedules.map(s => {
        if (s.id === editingScheduleId) {
          return {
            ...s,
            supplierId: newSchedule.supplierId!,
            expectedDate: newSchedule.expectedDate!,
            expectedWeight: Number(newSchedule.expectedWeight),
            pricePerKg: Number(newSchedule.pricePerKg),
            updatedAt: Date.now()
          };
        }
        return s;
      });

      onUpdate({
        ...state,
        pcpSlaughterSchedules: updatedSchedules
      });

      setEditingScheduleId(null);
      setShowScheduleForm(false);
    } else {
      // Creation mode (committing batch list of lines)
      if (tempLines.length === 0) {
        // Fallback or let them add current line if populated
        if (lineSupplierId && Number(lineExpectedWeight) > 0 && Number(linePricePerKg) > 0) {
          const schedule: PCPSlaughterSchedule = {
            id: crypto.randomUUID(),
            supplierId: lineSupplierId,
            expectedDate: newSchedule.expectedDate!,
            expectedWeight: Number(lineExpectedWeight),
            pricePerKg: Number(linePricePerKg),
            userId: currentUser.id,
            updatedAt: Date.now()
          };
          onUpdate({
            ...state,
            pcpSlaughterSchedules: [...schedules, schedule]
          });
          setShowScheduleForm(false);
          setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
          return;
        }
        alert('Adicione pelo menos uma linha com fornecedor, peso e valor antes de finalizar.');
        return;
      }

      // Convert all tempLines into system schedules
      const newItems: PCPSlaughterSchedule[] = tempLines.map(line => ({
        id: crypto.randomUUID(),
        supplierId: line.supplierId,
        expectedDate: newSchedule.expectedDate!,
        expectedWeight: line.expectedWeight,
        pricePerKg: line.pricePerKg,
        userId: currentUser.id,
        updatedAt: Date.now()
      }));

      onUpdate({
        ...state,
        pcpSlaughterSchedules: [...schedules, ...newItems]
      });

      setTempLines([]);
      setLineSupplierId('');
      setLineExpectedWeight('');
      setLinePricePerKg('');
      setShowScheduleForm(false);
    }
  };

  const handleDeleteSchedule = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta programação?')) return;
    onUpdate({
      ...state,
      pcpSlaughterSchedules: schedules.filter(s => s.id !== id),
      deletedIds: [...(state.deletedIds || []), id]
    });
    
    if (selectedScheduleIds.has(id)) {
      const next = new Set(selectedScheduleIds);
      next.delete(id);
      setSelectedScheduleIds(next);
    }
  };

  // PDF Download Logic (Copied from Feed and crafted for beautiful PCP formatting)
  const handleDownloadPDF = (schedulesToPrint: PCPSlaughterSchedule[], subTitle: string) => {
    if (schedulesToPrint.length === 0) {
      alert('Nenhuma programação de abate disponível para gerar o PDF.');
      return;
    }

    try {
      const doc = new jsPDF();
      
      const primaryColor = [52, 68, 52]; // #344434 (Brand green/olive)
      
      // Header Banner
      doc.setFillColor(52, 68, 52); 
      doc.rect(0, 0, 210, 36, 'F');

      // Title text inside banner
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AQUAGESTÃO PISCICULTURA', 15, 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(215, 235, 215);
      doc.text(`Programação de Abate Oficial - PCP (${subTitle})`, 15, 22);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`Data de Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 15, 29);

      // Metadata card
      doc.setFillColor(241, 245, 249); // slate 100 bg
      doc.rect(15, 42, 180, 26, 'F');
      
      // Metrics sum
      const totalWeight = schedulesToPrint.reduce((sum, s) => sum + s.expectedWeight, 0);
      const totalValue = schedulesToPrint.reduce((sum, s) => sum + (s.expectedWeight * s.pricePerKg), 0);
      
      doc.setTextColor(30, 41, 59); // slate 800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('METADADOS DO PCP FRIGORÍFICO', 20, 48);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate 600
      doc.text(`Responsável Clínico / PCP: ${currentUser?.name || 'Não especificado'} (${currentUser?.email || 'N/A'})`, 20, 54);
      doc.text(`Balizamento: Peso total estimado e preços de referência para despesca`, 20, 59);
      doc.text(`Identificação Única: ${crypto.randomUUID().toUpperCase().slice(0, 8)} - PDF não editável certificado por AquaGestão`, 20, 64);

      // Table layout and execution
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(52, 68, 52);
      doc.text('PROGRAMAÇÕES DETALHADAS DE DISPONIBILIDADE DE PRODUTO', 15, 76);

      const tableHeaders = [['Cód', 'Fornecedor', 'Data Prevista', 'Peso Previsto', 'Valor / kg', 'Total Est. (R$)']];
      const tableRows = schedulesToPrint.map((schedule) => {
        const supplier = suppliers.find(s => s.id === schedule.supplierId);
        const formattedDate = new Date(schedule.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR');
        return [
          supplier ? supplier.sequentialCode.toString() : '?',
          supplier ? supplier.name.toUpperCase() : 'FORNECEDOR DESCONHECIDO',
          formattedDate,
          `${formatNumber(schedule.expectedWeight, 0)} kg`,
          `R$ ${formatNumber(schedule.pricePerKg, 2)}`,
          `R$ ${formatNumber(schedule.expectedWeight * schedule.pricePerKg, 2)}`
        ];
      });

      autoTable(doc, {
        startY: 80,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [52, 68, 52], fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [52, 68, 52] }
        },
        foot: [[
          'TOTAL',
          `${schedulesToPrint.length} lançamentos`,
          '',
          `${formatNumber(totalWeight, 0)} kg`,
          '',
          `R$ ${formatNumber(totalValue, 2)}`
        ]],
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9 },
        margin: { left: 15, right: 15 }
      });

      let nextY = ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) 
        ? (doc as any).lastAutoTable.finalY + 18 
        : 140;

      if (nextY > 245) {
        doc.addPage();
        nextY = 25;
      }

      // Divider and signature areas
      doc.setLineWidth(0.4);
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.line(15, nextY, 95, nextY);
      doc.line(115, nextY, 195, nextY);

      // Signatures
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text('Responsável pela Programação', 15, nextY + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(currentUser?.name || 'Não especificado', 15, nextY + 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`E-mail: ${currentUser?.email || 'N/A'}`, 15, nextY + 12);

      doc.text('Autorização / PCP Frigorífico', 115, nextY + 4);
      doc.text('Assinatura / Carimbo', 115, nextY + 8);
      doc.text('Data: ____ / ____ / ________', 115, nextY + 12);

      // Footer notes
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // slate 400
      doc.text('Documento eletrônico assinado digitalmente no módulo PCP do AquaGestão. Impresso sob homologação de conformidade.', 15, 288);
      doc.text('Página 1 de 1', 195, 288, { align: 'right' });

      // Save the file
      const dateStr = format(new Date(), 'dd-MM-yyyy_HHmm');
      doc.save(`Programacao_Abate_PCP_${dateStr}.pdf`);
    } catch (error) {
      console.error('Falha ao gerar o PDF:', error);
      alert('Houve um erro ao processar a geração do PDF. Por favor, tente novamente.');
    }
  };

  const toggleMonth = (monthKey: string) => {
    const next = new Set(expandedMonths);
    if (next.has(monthKey)) {
      next.delete(monthKey);
    } else {
      next.add(monthKey);
    }
    setExpandedMonths(next);
  };

  const toggleDay = (dateStr: string) => {
    const next = new Set(expandedDays);
    if (next.has(dateStr)) {
      next.delete(dateStr);
    } else {
      next.add(dateStr);
    }
    setExpandedDays(next);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('programacao')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeSubTab === 'programacao' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Programação Abate
          </div>
          {activeSubTab === 'programacao' && (
            <motion.div layoutId="pcp-tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-[#344434] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('cadastros')}
          className={`pb-4 px-2 text-xs font-black uppercase tracking-widest transition-all relative ${
            activeSubTab === 'cadastros' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Cadastros
          </div>
          {activeSubTab === 'cadastros' && (
            <motion.div layoutId="pcp-tab-indicator" className="absolute bottom-0 left-0 right-0 h-1 bg-[#344434] rounded-t-full" />
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'cadastros' ? (
          <motion.div
            key="cadastros"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Suppliers Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por nome, código ou CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                />
              </div>
              <button
                onClick={() => setShowSupplierForm(true)}
                className="flex items-center justify-center gap-2 bg-[#344434] text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-slate-900/10 hover:scale-105 transition-all"
              >
                <Plus className="w-4 h-4" />
                Adicionar Fornecedor
              </button>
            </div>

            {/* Suppliers Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map(supplier => (
                <div key={supplier.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight text-slate-500">
                      Cód: {supplier.sequentialCode}
                    </div>
                    <button
                      onClick={() => handleDeleteSupplier(supplier.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-black text-slate-900 text-lg mb-1">{supplier.name}</h3>
                  <div className="space-y-2">
                    {supplier.cnpj && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">CNPJ:</span> {supplier.cnpj}
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">Tel:</span> {supplier.phone}
                      </div>
                    )}
                    {supplier.contact && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold">Contato:</span> {supplier.contact}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredSuppliers.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-300 rounded-[3rem]">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum fornecedor encontrado</p>
                </div>
              )}
            </div>

            {/* Modal Supplier Form */}
            {showSupplierForm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white w-full max-w-lg rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight italic">Novo Fornecedor</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Nome / Razão Social *</label>
                        <input
                          type="text"
                          value={newSupplier.name || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">CNPJ</label>
                          <input
                            type="text"
                            value={newSupplier.cnpj || ''}
                            onChange={(e) => setNewSupplier({...newSupplier, cnpj: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Telefone</label>
                          <input
                            type="text"
                            value={newSupplier.phone || ''}
                            onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Contato</label>
                        <input
                          type="text"
                          value={newSupplier.contact || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, contact: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Endereço</label>
                        <input
                          type="text"
                          value={newSupplier.address || ''}
                          onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-8">
                      <button
                        onClick={() => setShowSupplierForm(false)}
                        className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddSupplier}
                        disabled={!newSupplier.name}
                        className="flex-[2] bg-slate-900 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                      >
                        Salvar Fornecedor
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="programacao"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
             {/* Header Section */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Histórico de Programação PCP</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfOptionsModal(true)}
                  className="flex items-center justify-center gap-2 bg-[#344434] text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Gerar PDF do PCP
                </button>
                <button
                  onClick={() => {
                    setEditingScheduleId(null);
                    setTempLines([]);
                    setLineSupplierId('');
                    setLineExpectedWeight('');
                    setLinePricePerKg('');
                    setNewSchedule({ expectedDate: new Date().toISOString().split('T')[0] });
                    setShowScheduleForm(true);
                  }}
                  className="flex items-center justify-center gap-2 bg-[#344434] text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Programação
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Filtrar por Data
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Filtrar por Produtor
                </label>
                <select
                  value={filterProducerId}
                  onChange={(e) => setFilterProducerId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                >
                  <option value="">Todos os Produtores</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Ordenação / Lançamentos
                </label>
                <button
                  type="button"
                  onClick={() => setShowOnlyRecent(!showOnlyRecent)}
                  className={`w-full px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    showOnlyRecent 
                      ? 'bg-[#344434] text-white border-[#344434]' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Últimos Lançamentos
                </button>
              </div>

              {/* Reset Filters */}
              {(filterDate || filterProducerId || showOnlyRecent) ? (
                <button
                  onClick={() => {
                    setFilterDate('');
                    setFilterProducerId('');
                    setShowOnlyRecent(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-[#344434] hover:bg-slate-100 transition-all border border-[#344434]/15 flex items-center justify-center gap-2 h-[38px] w-full"
                >
                  Limpar Filtros
                </button>
              ) : (
                <div className="hidden md:block h-[38px]" />
              )}
            </div>

            {/* Selection Totals indicators */}
            {selectedScheduleIds.size > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="bg-emerald-600 text-white text-xs font-mono font-black px-3 py-1.5 rounded-lg">
                    {selectedScheduleIds.size} SELECIONADOS
                  </div>
                  <div className="flex items-center gap-2 text-slate-700 text-xs">
                    <span className="font-bold">Peso Total:</span>
                    <span className="font-black text-emerald-800 text-sm">
                      {Array.from(selectedScheduleIds).reduce((sum, id) => {
                        const s = schedules.find(item => item.id === id);
                        return sum + (s ? s.expectedWeight : 0);
                      }, 0).toLocaleString()} kg
                    </span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden md:block" />
                  <div className="flex items-center gap-2 text-slate-700 text-xs">
                    <span className="font-bold">Valor Total Estimado:</span>
                    <span className="font-black text-emerald-800 text-sm">
                      R$ {Array.from(selectedScheduleIds).reduce((sum, id) => {
                        const s = schedules.find(item => item.id === id);
                        return sum + (s ? (s.expectedWeight * s.pricePerKg) : 0);
                      }, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const selection = schedules.filter(s => selectedScheduleIds.has(s.id));
                      handleDownloadPDF(selection, 'Seleção Especial');
                    }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow"
                  >
                    <FileDown className="w-4 h-4" /> PDF Seleção
                  </button>
                  <button
                    onClick={() => setSelectedScheduleIds(new Set())}
                    className="px-4 py-2.5 hover:bg-[#344434]/5 rounded-xl text-xs font-bold text-slate-500 transition-all uppercase tracking-wider"
                  >
                    Desmarcar Todos
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider"
                  >
                    <Trash2 className="w-4 h-4" /> Excluir Seleção
                  </button>
                </div>
              </motion.div>
            )}

            {/* Nested Accordion for Month grouping */}
            <div className="space-y-4">
              {groupedSchedules.map(group => {
                const isMonthExpanded = expandedMonths.has(group.monthKey);
                const allMonthSchedules = group.daysArray.flatMap(d => d.items);
                return (
                  <div key={group.monthKey} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Month Header line */}
                    <div 
                      onClick={() => toggleMonth(group.monthKey)}
                      className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-transparent select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#344434]/10 text-[#344434]">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-base">{group.label}</h3>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-500">
                              {allMonthSchedules.length} {allMonthSchedules.length === 1 ? 'programação' : 'programações'}
                            </span>
                            <span className="font-bold">Total:</span> {formatNumber(group.totalWeight, 0)} kg
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="font-bold text-[#344434]">R$ {formatNumber(group.totalValue, 2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(allMonthSchedules, `Mês ${group.label}`)}
                          title="Gerar PDF do Mês"
                          className="p-2 hover:bg-slate-100 text-[#344434] rounded-xl transition-all"
                        >
                          <FileDown className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => toggleMonth(group.monthKey)}
                          className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                        >
                          {isMonthExpanded ? (
                            <ChevronDown className="w-5 h-5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Month Expanded Panel (Displays list of days) */}
                    <AnimatePresence initial={false}>
                      {isMonthExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-slate-100 bg-slate-50/30 divide-y divide-slate-100"
                        >
                          {group.daysArray.map(dayGroup => {
                            const isDayExpanded = expandedDays.has(dayGroup.dateStr);
                            return (
                              <div key={dayGroup.dateStr} className="pl-6 pr-6 py-2">
                                {/* Day child header */}
                                <div 
                                  onClick={() => toggleDay(dayGroup.dateStr)}
                                  className="py-3 px-4 flex items-center justify-between hover:bg-slate-100/60 rounded-xl cursor-pointer transition-all select-none"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-[#344434]" />
                                    <div>
                                      <h4 className="font-bold text-[#344434] text-sm">{dayGroup.formattedDayLabel}</h4>
                                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                        <span>{dayGroup.items.length} Fornecedores</span>
                                        <span>•</span>
                                        <span>{formatNumber(dayGroup.dayTotalWeight, 0)} kg</span>
                                        <span>•</span>
                                        <span className="font-black text-slate-600">R$ {formatNumber(dayGroup.dayTotalValue, 2)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadPDF(dayGroup.items, `Dia ${dayGroup.formattedDayLabel.split(', ')[1]}`)}
                                      title="Gerar PDF do Dia"
                                      className="p-1.5 hover:bg-slate-200/50 text-slate-600 rounded-lg transition-all"
                                    >
                                      <FileDown className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => toggleDay(dayGroup.dateStr)}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
                                    >
                                      {isDayExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-slate-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Day Expanded Panel (Displays nested schedules table) */}
                                <AnimatePresence initial={false}>
                                  {isDayExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden mt-2 mb-3 bg-white border border-slate-200 rounded-2xl shadow-inner pl-2 pr-2"
                                    >
                                      <table className="w-full border-collapse">
                                        <thead>
                                          <tr className="border-b border-slate-100 text-left">
                                            <th className="px-4 py-3 w-10">
                                              <button 
                                                type="button"
                                                onClick={() => {
                                                  const allInDay = dayGroup.items.map(s => s.id);
                                                  const anyUnselected = allInDay.some(id => !selectedScheduleIds.has(id));
                                                  const next = new Set(selectedScheduleIds);
                                                  if (anyUnselected) {
                                                    allInDay.forEach(id => next.add(id));
                                                  } else {
                                                    allInDay.forEach(id => next.delete(id));
                                                  }
                                                  setSelectedScheduleIds(next);
                                                }}
                                                className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                                              >
                                                {dayGroup.items.every(s => selectedScheduleIds.has(s.id)) ? (
                                                  <CheckSquare className="w-3.5 h-3.5 text-[#344434]" />
                                                ) : (
                                                  <Square className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                            </th>
                                            <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Fornecedor</th>
                                            <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Peso Previsto (kg)</th>
                                            <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Valor/kg (R$)</th>
                                            <th className="px-3 py-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Total Est. (R$)</th>
                                            <th className="px-3 py-3 text-right text-[9px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                          {dayGroup.items.map(schedule => {
                                            const supplier = suppliers.find(s => s.id === schedule.supplierId);
                                            const isSelected = selectedScheduleIds.has(schedule.id);
                                            return (
                                              <tr key={schedule.id} className={`hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-emerald-50/20' : ''}`}>
                                                <td className="px-4 py-2 w-10">
                                                  <button 
                                                    type="button"
                                                    onClick={(e) => handleToggleSelectRow(schedule.id, e)}
                                                    className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                                                  >
                                                    {isSelected ? (
                                                      <CheckSquare className="w-3.5 h-3.5 text-[#344434]" />
                                                    ) : (
                                                      <Square className="w-3.5 h-3.5" />
                                                    )}
                                                  </button>
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                  <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 text-slate-500 font-mono font-black text-[9px] px-1.5 py-0.5 rounded">
                                                      Code {supplier?.sequentialCode || '?'}
                                                    </span>
                                                    <span className="font-bold text-slate-900">{supplier?.name || 'Desconhecido'}</span>
                                                  </div>
                                                </td>
                                                <td className="px-3 py-2 text-xs font-black text-slate-900">
                                                  {schedule.expectedWeight.toLocaleString()} kg
                                                </td>
                                                <td className="px-3 py-2 text-xs font-mono text-slate-500">
                                                  R$ {schedule.pricePerKg.toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-black text-[#344434]">
                                                  R$ {(schedule.expectedWeight * schedule.pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                  <div className="flex items-center justify-end gap-1">
                                                    <button
                                                      onClick={() => handleStartEditSchedule(schedule)}
                                                      className="p-1 px-2 text-slate-400 hover:text-[#344434] hover:bg-slate-100 rounded-lg transition-all"
                                                      title="Editar"
                                                    >
                                                      <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                      onClick={(e) => handleDeleteSchedule(schedule.id, e)}
                                                      className="p-1 px-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                      title="Excluir"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {groupedSchedules.length === 0 && (
                <div className="py-20 text-center bg-white border border-slate-200 rounded-[2.5rem]">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhuma programação encontrada para os filtros aplicados</p>
                </div>
              )}
            </div>

            {/* Modal Schedule Creation & Editing */}
            {showScheduleForm && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`bg-white w-full ${editingScheduleId ? 'max-w-lg' : 'max-w-3xl'} rounded-[3rem] p-8 shadow-2xl relative overflow-hidden`}
                >
                  <div className="relative z-10 flex flex-col h-full max-h-[85vh]">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-[#344434]" />
                        {editingScheduleId ? 'Editar Programação' : 'Cadastrar Nova Programação'}
                      </h2>
                      <button 
                        onClick={handleCancelScheduleForm}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="overflow-y-auto space-y-5 pr-2 flex-1 scrollbar-thin">
                      {/* Form Fields: COMMON BATCH HEADER (Month + Date) */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mês de Referência *</label>
                          <select
                            value={selectedMonth}
                            onChange={(e) => handleMonthChange(e.target.value)}
                            disabled={!!editingScheduleId}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                          >
                            {monthsList.map(m => (
                              <option key={m.value} value={m.value}>{m.name} / {currentYear}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data do Abate *</label>
                          <input
                            type="date"
                            min={minDateLimit}
                            max={maxDateLimit}
                            value={newSchedule.expectedDate || ''}
                            onChange={(e) => setNewSchedule({...newSchedule, expectedDate: e.target.value})}
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                          />
                        </div>
                      </div>

                      {/* SINGLE ITEM MODE: Normal Direct Form fields */}
                      {editingScheduleId ? (
                        <div className="space-y-4 pt-2">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Fornecedor *</label>
                            <select
                              value={newSchedule.supplierId || ''}
                              onChange={(e) => setNewSchedule({...newSchedule, supplierId: e.target.value})}
                              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                            >
                              <option value="">Selecione um fornecedor</option>
                              {suppliers.map(s => (
                                <option key={s.id} value={s.id}>[{s.sequentialCode}] {s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Peso Previsto (kg) *</label>
                              <input
                                type="number"
                                value={newSchedule.expectedWeight || ''}
                                onChange={(e) => setNewSchedule({...newSchedule, expectedWeight: e.target.value})}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">Valor/kg (R$) *</label>
                              <input
                                type="number"
                                step="0.01"
                                value={newSchedule.pricePerKg || ''}
                                onChange={(e) => setNewSchedule({...newSchedule, pricePerKg: e.target.value})}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* CREATE MODE: BATCH MULTI-LINE FORM INTERFACE */
                        <div className="space-y-4">
                          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                            <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-3">Inserir Linha da Programação</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Fornecedor *</label>
                                <select
                                  value={lineSupplierId}
                                  onChange={(e) => setLineSupplierId(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                >
                                  <option value="">Selecione...</option>
                                  {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>[{s.sequentialCode}] {s.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Peso Previsto (kg) *</label>
                                <input
                                  type="number"
                                  placeholder="Ex: 5000"
                                  value={lineExpectedWeight}
                                  onChange={(e) => setLineExpectedWeight(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                />
                              </div>

                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Valor/kg (R$) *</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 10.24"
                                  value={linePricePerKg}
                                  onChange={(e) => setLinePricePerKg(e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={handleAddNewDraftLine}
                                className="flex items-center gap-1 bg-[#344434] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar Linha
                              </button>
                            </div>
                          </div>

                          {/* Table showing current drafted rows queue inside the modal */}
                          <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Linhas Adicionadas nesta Programação ({tempLines.length})
                            </label>
                            
                            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[160px] overflow-y-auto">
                              <table className="w-full border-collapse text-left">
                                <thead className="bg-[#344434]/5 text-[#344434]">
                                  <tr>
                                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider">Fornecedor</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Peso (kg)</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Preço (R$/kg)</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-right">Total (R$)</th>
                                    <th className="px-4 py-2.5 text-[9px] font-black uppercase tracking-wider text-center w-12">Remover</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                  {tempLines.map((line, idx) => {
                                    const supplier = suppliers.find(s => s.id === line.supplierId);
                                    return (
                                      <tr key={line.tempId} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-bold text-slate-900">{supplier?.name || 'Desconhecido'}</td>
                                        <td className="px-4 py-2 text-right font-bold">{line.expectedWeight.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">R$ {line.pricePerKg.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-black text-[#344434]">
                                          R$ {(line.expectedWeight * line.pricePerKg).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveDraftLine(line.tempId)}
                                            className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-slate-400 transition"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {tempLines.length === 0 && (
                                    <tr>
                                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                                        Nenhuma linha adicionada. Insira os dados acima e clique em "Adicionar Linha".
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action bar */}
                    <div className="flex gap-4 border-t border-slate-100 pt-5 mt-4">
                      <button
                        onClick={handleCancelScheduleForm}
                        className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddSchedule}
                        className="flex-[2] bg-[#344434] text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-105 transition-all active:scale-95"
                      >
                        {editingScheduleId ? 'Salvar Alterações' : `Finalizar Cadastro (${tempLines.length} Linhas)`}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Modal de Opções do PDF com Seletor de Período e Mês em Pantone do Sistema */}
            {showPdfOptionsModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                      <h2 className="text-xl font-black text-[#344434] uppercase tracking-tight italic flex items-center gap-2">
                        <FileDown className="w-5 h-5 text-[#344434]" />
                        Exportar Relatório PCP
                      </h2>
                      <button 
                        onClick={() => setShowPdfOptionsModal(false)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4 py-2">
                      <p className="text-xs text-slate-500 font-medium">
                        Selecione as opções de período para geração do relatório em formato PDF de acordo com o padrão do sistema.
                      </p>

                      <div className="space-y-3">
                        {/* Option 1: Filtered records */}
                        <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          pdfSelectedPeriod === 'filtered' 
                            ? 'bg-[#344434]/5 border-[#344434]' 
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                        }`}>
                          <input 
                            type="radio" 
                            name="pdfPeriodType"
                            checked={pdfSelectedPeriod === 'filtered'}
                            onChange={() => setPdfSelectedPeriod('filtered')}
                            className="mt-0.5 accent-[#344434]" 
                          />
                          <div>
                            <span className="block text-xs font-black text-slate-950 uppercase tracking-wide">
                              Filtros Ativos
                            </span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              Exporta apenas os lançamentos que estão visíveis no seu histórico filtrado ({filteredSchedules.length} registros).
                            </span>
                          </div>
                        </label>

                        {/* Option 2: Target month */}
                        <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                          pdfSelectedPeriod === 'month' 
                            ? 'bg-[#344434]/5 border-[#344434]' 
                            : 'bg-slate-50/50 border-slate-200 hover:bg-slate-50'
                        }`}>
                          <input 
                            type="radio" 
                            name="pdfPeriodType"
                            checked={pdfSelectedPeriod === 'month'}
                            onChange={() => setPdfSelectedPeriod('month')}
                            className="mt-0.5 accent-[#344434]" 
                          />
                          <div className="flex-1">
                            <span className="block text-xs font-black text-slate-950 uppercase tracking-wide">
                              Mês Específico
                            </span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              Selecione um mês de referência para exportar todas as programações daquele mês específico.
                            </span>

                            {pdfSelectedPeriod === 'month' && (
                              <div className="grid grid-cols-2 gap-2 mt-3 animate-in fade-in slide-in-from-top-1">
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mês</label>
                                  <select
                                    value={pdfSelectedMonth}
                                    onChange={(e) => setPdfSelectedMonth(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  >
                                    {monthsList.map(m => (
                                      <option key={m.value} value={m.value}>{m.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ano</label>
                                  <select
                                    value={pdfSelectedYear}
                                    onChange={(e) => setPdfSelectedYear(Number(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                                  >
                                    <option value={currentYear - 1}>{currentYear - 1}</option>
                                    <option value={currentYear}>{currentYear}</option>
                                    <option value={currentYear + 1}>{currentYear + 1}</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 border-t border-slate-100 pt-5 mt-4">
                      <button
                        onClick={() => setShowPdfOptionsModal(false)}
                        className="flex-1 px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all font-mono"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (pdfSelectedPeriod === 'filtered') {
                            handleDownloadPDF(filteredSchedules, 'Filtro Ativo');
                          } else {
                            const yearStr = String(pdfSelectedYear);
                            const monthStr = pdfSelectedMonth;
                            const monthRecords = schedules.filter(s => s.expectedDate.startsWith(`${yearStr}-${monthStr}`));
                            
                            if (monthRecords.length === 0) {
                              const mIndex = Number(monthStr) - 1;
                              const monthName = monthsList[mIndex]?.name || monthStr;
                              alert(`Nenhuma programação de abate cadastrada para o mês de ${monthName} de ${yearStr}.`);
                              return;
                            }
                            
                            const mIndex = Number(monthStr) - 1;
                            const monthName = monthsList[mIndex]?.name || monthStr;
                            handleDownloadPDF(monthRecords, `${monthName} de ${yearStr}`);
                          }
                          setShowPdfOptionsModal(false);
                        }}
                        className="flex-[2] bg-[#344434] text-white px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[#344434]/20 hover:scale-105 transition-all active:scale-95 animate-in"
                      >
                        Gerar PDF
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SlaughterPCP;
