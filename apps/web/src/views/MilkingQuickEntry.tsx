import React, { useState, useEffect, useCallback } from 'react';
import { 
  Milk, 
  ShieldAlert, 
  CheckCircle2, 
  QrCode, 
  Search, 
  AlertCircle, 
  Save, 
  Scale, 
  Printer, 
  ArrowDownRight,
  TrendingUp,
  Clock,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  Layers,
  ThermometerSnowflake,
  Volume2
} from 'lucide-react';
import { MilkingShift } from '../api/types';
import { logMilkingSession } from '../api/client';
import { useAnimalsQuery, useMilkingSummaryQuery } from '../api/queries';
import { Money, formatMoney, formatNumber, formatDate, OFFICIAL_CURRENCY } from '../utils/money.util';

interface CowInfo {
  id?: string;
  tagNumber: string;
  name: string;
  breed: string;
  avgYield: number;
  daysInMilk: number;
  isQuarantined: boolean;
  quarantineEndDate?: string;
  quarantineReason?: string;
  lastMilkingYield?: number;
}

interface RecentMilkLog {
  id: string;
  tagNumber: string;
  cowName: string;
  yieldLiters: number;
  shift: MilkingShift;
  time: string;
  logDate: string;
  isDiscarded: boolean;
  discardReason: string | null | undefined;
  value: number;
}

export const MilkingQuickEntry: React.FC = () => {
  const [tagInput, setTagInput] = useState<string>('');
  const [selectedCow, setSelectedCow] = useState<CowInfo | null>(null);
  const [currentYield, setCurrentYield] = useState<string>('');
  const [fatPct, setFatPct] = useState<string>('');
  const [proteinPct, setProteinPct] = useState<string>('');
  const [shift, setShift] = useState<MilkingShift>('MORNING');
  const [isDiscarded, setIsDiscarded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentMilkLog[]>([]);
  const [lastSavedLog, setLastSavedLog] = useState<RecentMilkLog | null>(null);

  // Bulk Tank Telemetry
  const [bulkTankVolume, setBulkTankVolume] = useState<number>(0);
  const [dailyTotalLiters, setDailyTotalLiters] = useState<number>(0);
  const [dailyUsableLiters, setDailyUsableLiters] = useState<number>(0);
  const [chillerTemp, setChillerTemp] = useState<number | null>(null);
  const targetTankCapacity = 5000;
  const milkSellingPricePerLiter = 3.5; // LYD

  // --- React Query: load animals & milking summary ---
  const todayDate = new Date().toISOString().slice(0, 10);
  const { data: rawAnimals = [] } = useAnimalsQuery();
  const { data: summary } = useMilkingSummaryQuery(todayDate);

  // Map raw animals to CowInfo for dairy/dual purpose only
  const availableCows: CowInfo[] = React.useMemo(() => {
    return rawAnimals
      .filter((a: any) => a.purpose === 'DAIRY' || a.purpose === 'DUAL')
      .map((a: any) => {
        const isQuar = a.withdrawalEndDate ? new Date(a.withdrawalEndDate) > new Date() : false;
        return {
          id: a.id,
          tagNumber: a.tagNumber,
          name: a.name || `بقرة #${a.tagNumber}`,
          breed: a.breed || 'غير محدد',
          avgYield: 0,
          daysInMilk: 0,
          isQuarantined: isQuar,
          quarantineEndDate: a.withdrawalEndDate ? String(a.withdrawalEndDate).slice(0, 10) : undefined,
          quarantineReason: isQuar ? 'علاج مضاد حيوي بيطري (صمام الأمان نشط)' : undefined,
          lastMilkingYield: undefined,
        };
      });
  }, [rawAnimals]);

  // Sync summary data when it arrives
  useEffect(() => {
    if (!summary) return;
    setRecentLogs(summary.logs.map((log: any) => ({
      id: log.id,
      tagNumber: log.animal?.tagNumber || '',
      cowName: log.animal?.name || '',
      yieldLiters: Number(log.yieldLiters),
      shift: log.shift,
      time: new Date(log.logDate).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
      logDate: String(log.logDate),
      isDiscarded: log.isDiscarded,
      discardReason: log.discardReason,
      value: log.isDiscarded ? 0 : Money.mul(log.yieldLiters as any, milkSellingPricePerLiter),
    })));
    setDailyTotalLiters(Number(summary.totalLiters || 0));
    setDailyUsableLiters(Number(summary.usableLiters || 0));
    setBulkTankVolume(Number(summary.usableLiters || 0));
  }, [summary]);

  // Auto-select first cow when cows load
  useEffect(() => {
    if (availableCows.length > 0 && !selectedCow) {
      selectCow(availableCows[0]);
    }
  }, [availableCows]);

  // Fetch chiller telemetry (Electron only)
  useEffect(() => {
    (async () => {
      if ((window as any).electronAPI?.getTankTelemetry) {
        try {
          const telemetry = await (window as any).electronAPI.getTankTelemetry();
          if (telemetry?.temperature !== undefined && telemetry?.connected) {
            setChillerTemp(telemetry.temperature);
          }
        } catch {
          setChillerTemp(null);
        }
      }
    })();
  }, []);

  // Select a cow and update quarantine interlock
  const selectCow = useCallback((cow: CowInfo) => {
    setSelectedCow(cow);
    setTagInput(cow.tagNumber);
    setIsDiscarded(cow.isQuarantined);
    if (cow.lastMilkingYield) {
      setCurrentYield(String(cow.lastMilkingYield));
    }
    setFeedback(null);
  }, []);

  // Search by tag number or RFID
  const handleSearch = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase();
    const found = availableCows.find(
      c => c.tagNumber.toLowerCase() === cleanTag || c.tagNumber.toLowerCase().includes(cleanTag)
    );

    if (found) {
      selectCow(found);
    } else {
      setFeedback('لم يتم العثور على الحيوان في مزرعة المستخدم');
    }
  };

  // Quick Yield Increment Presets
  const handleQuickAdd = (liters: number) => {
    setCurrentYield(String(liters.toFixed(1)));
  };

  // Hardware COM-Port Scale Reading
  const handleReadScale = async (simulate = false) => {
    if ((window as any).electronAPI?.readSerialScale) {
      try {
        const res = await (window as any).electronAPI.readSerialScale({ simulateIfNoDevice: simulate });
        if (res?.success && res?.weightKg) {
          const liters = (res.weightKg / 1.03).toFixed(1);
          setCurrentYield(liters);
          setFeedback(`✅ تمت القراءة من ميزان المحلب: ${liters} لتر ${res.isSimulated ? '(محاكاة تجريبية)' : ''}`);
        } else {
          setFeedback(`⚠️ ${res?.error || 'تعذر استلام قراءة الميزان'}`);
        }
      } catch (err: any) {
        setFeedback(`❌ خطأ: ${err?.message || 'تعذر الاتصال بالميزان'}`);
      }
    } else {
      if (simulate) {
        const fakeLiters = (18 + Math.random() * 8).toFixed(1);
        setCurrentYield(fakeLiters);
        setFeedback(`✅ قراءة محاكاة تجريبية: ${fakeLiters} لتر`);
      } else {
        setFeedback('⚠️ الاتصال بالميزان الإلكتروني متاح عبر تطبيق المحطة المكتبية (Desktop Client)');
      }
    }
  };

  // POS Thermal Receipt Print
  const handlePrintReceipt = async () => {
    if (!selectedCow) {
      setFeedback('يرجى اختيار بقرة أولاً لطباعة الإيصال');
      return;
    }

    const targetLog = lastSavedLog && lastSavedLog.tagNumber === selectedCow.tagNumber
      ? lastSavedLog
      : null;

    if (!targetLog) {
      setFeedback('يرجى حفظ الحلبة أولاً قبل طباعة إذن الاستلام المالي؛ لا يمكن طباعة إيصال لحلبة غير مسجلة');
      return;
    }

    const yieldToPrint = String(targetLog.yieldLiters);
    const isDiscardedToPrint = targetLog.isDiscarded;
    const valueToPrint = isDiscardedToPrint ? 0 : Money.mul(yieldToPrint, milkSellingPricePerLiter);

    const receiptData = {
      cowTag: selectedCow.tagNumber,
      cowName: selectedCow.name,
      yieldLiters: yieldToPrint,
      shift: targetLog.shift,
      date: formatDate(targetLog.logDate),
      isDiscarded: isDiscardedToPrint,
      financialValue: valueToPrint,
    };

    if ((window as any).electronAPI?.printReceipt) {
      try {
        const res = await (window as any).electronAPI.printReceipt(receiptData);
        if (res && res.success === false) {
          throw new Error(res.error || 'فشلت عملية الطباعة الحرارية من الجهاز');
        }
        setFeedback(`تم إصدار وطباعة إيصال استلام الحلبة للبقرة #${selectedCow.tagNumber} بنجاح.`);
      } catch (e: any) {
        console.warn('Print error:', e);
        setFeedback(e.message || 'تعذرت طباعة الإيصال');
      }
    } else {
      // Fallback to standard OS printer via browser print
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl">
            <head>
              <title>إيصال استلام حليب</title>
              <style>
                body { font-family: 'Courier New', Courier, monospace; padding: 20px; text-align: center; }
                .bold { font-weight: bold; font-size: 1.2rem; margin-bottom: 5px; }
                .divider { border-bottom: 1px dashed #000; margin: 15px 0; }
                .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
              </style>
            </head>
            <body>
              <div class="bold">محطة سريا للحلب</div>
              <div>إيصال استلام حليب</div>
              <div class="divider"></div>
              <div class="row"><span>التاريخ:</span> <span>${receiptData.date}</span></div>
              <div class="row"><span>الوردية:</span> <span>${receiptData.shift}</span></div>
              <div class="row"><span>رقم البقرة:</span> <span class="bold">#${receiptData.cowTag}</span></div>
              <div class="divider"></div>
              <div class="row"><span>الكمية:</span> <span class="bold">${receiptData.yieldLiters} لتر</span></div>
              <div class="row"><span>حالة الحليب:</span> <span>${receiptData.isDiscarded ? 'مستبعد' : 'صالح'}</span></div>
              <div class="row"><span>القيمة:</span> <span class="bold">${formatMoney(receiptData.financialValue)}</span></div>
              <div class="divider"></div>
              <div>تم الاستلام بنجاح.</div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
        setFeedback(`تم تجهيز طباعة الإيصال للبقرة #${selectedCow.tagNumber}.`);
      } else {
        setFeedback('يرجى السماح بالنوافذ المنبثقة (Popups) للطباعة');
      }
    }
  };

  // Save Milking Session
  const handleSave = async () => {
    if (!selectedCow) return;
    const yieldNum = Number(currentYield);
    if (!yieldNum || yieldNum <= 0) {
      setFeedback('يرجى تحديد كمية الحليب باللتر بشكل صحيح');
      return;
    }

    setLoading(true);

    try {
      const result = await logMilkingSession({
        animalId: selectedCow.id || selectedCow.tagNumber,
        logDate: new Date().toISOString(),
        shift,
        yieldLiters: yieldNum,
        fatPct: fatPct !== '' ? Number(fatPct) : undefined,
        proteinPct: proteinPct !== '' ? Number(proteinPct) : undefined,
        isDiscarded,
        discardReason: isDiscarded ? selectedCow.quarantineReason || 'عزل بيطري وتحريم دوائي' : undefined,
      });

      const savedLog = result.milkLog;
      const savedYield = Number(savedLog.yieldLiters);

      setDailyTotalLiters(prev => Money.sum(prev, savedYield));
      if (!savedLog.isDiscarded) {
        setDailyUsableLiters(prev => Money.sum(prev, savedYield));
        setBulkTankVolume(prev => prev + savedYield);
      }

      const newLog: RecentMilkLog = {
        id: savedLog.id,
        tagNumber: savedLog.animal.tagNumber,
        cowName: savedLog.animal.name || selectedCow.name,
        yieldLiters: savedYield,
        shift: savedLog.shift,
        time: new Date(savedLog.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
        logDate: String(savedLog.logDate),
        isDiscarded: savedLog.isDiscarded,
        discardReason: savedLog.discardReason,
        value: savedLog.isDiscarded ? 0 : Money.mul(savedYield, milkSellingPricePerLiter),
      };

      setLastSavedLog(newLog);
      setRecentLogs(prev => [newLog, ...prev.slice(0, 7)]);
      
      const estimatedValue = formatMoney(Money.mul(savedYield, milkSellingPricePerLiter));
      const financialNote = savedLog.isDiscarded
        ? '⚠️ تم توجيه الحليب للتغذية/الإتلاف (0 د.ل)' 
        : `💰 القيمة الإنتاجية التقديرية: ${estimatedValue} (تُرحل للإيرادات عند اعتماد مبيعات الحليب)`;

      const serverAlerts = [result.safetyWarning, result.healthAlert].filter(Boolean).join(' ');

      setFeedback(
        `✅ تم تسجيل واعتماد حلبة (${savedYield} لتر) للبقرة #${selectedCow.tagNumber} بنجاح. `
        + `${financialNote}${serverAlerts ? ` ${serverAlerts}` : ''}`,
      );

      // Auto cycle to next cow in parlor queue
      const currentIndex = availableCows.findIndex(c => c.tagNumber === selectedCow.tagNumber);
      const nextIndex = (currentIndex + 1) % availableCows.length;
      if (availableCows[nextIndex]) {
        selectCow(availableCows[nextIndex]);
      }
    } catch (error: any) {
      setFeedback(error.message || `تعذر حفظ الحلبة للبقرة #${selectedCow.tagNumber}`);
    } finally {
      setLoading(false);
    }
  };

  const totalTodayLiters = dailyTotalLiters;
  const usableTodayLiters = dailyUsableLiters;
  const totalFinancialValue = Money.mul(usableTodayLiters, milkSellingPricePerLiter);

  return (
    <div className="space-y-6">
      {/* Header & Shift Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Milk className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            محطة الحلب السريعة وإدارة خزانات الحليب
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            إدخال فوري للورديات، صمام أمان التحريم التلقائي، والربط المحاسبي بالدينار الليبي ({OFFICIAL_CURRENCY.symbol})
          </p>
        </div>

        {/* Shift Selector */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl self-start md:self-auto shadow-lg">
          {(['MORNING', 'NOON', 'EVENING'] as MilkingShift[]).map(s => (
            <button
              key={s}
              onClick={() => setShift(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                shift === s 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{s === 'MORNING' ? 'الوردية الصباحية' : s === 'NOON' ? 'وردية الظهيرة' : 'الوردية المسائية'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Cow Selection Chips (Touch friendly for parlor workers) */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-md space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            طابور الأبقار في محطة الحلب الحالية (انقر للاختيار الفوري):
          </span>
          <span className="text-[11px] text-slate-500">{availableCows.length} أبقار جاهزة</span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {availableCows.map(cow => {
            const isSelected = selectedCow?.tagNumber === cow.tagNumber;
            return (
              <button
                key={cow.tagNumber}
                onClick={() => selectCow(cow)}
                className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold transition shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-900/30'
                    : 'bg-slate-50/70 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:text-white'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] font-black ${
                  isSelected ? 'bg-emerald-700 text-slate-900 dark:text-white' : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400'
                }`}>
                  #{cow.tagNumber.replace('SA-COW-', '')}
                </div>
                <span>{cow.name.split(' ')[0]}</span>
                {cow.isQuarantined && (
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" title="تحريم بيطري نشط" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Entry Terminal vs Bulk Tank Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Touch-friendly Quick Terminal */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          {/* Tag & RFID Search Bar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              رقم القرط أو مسح شريحة الـ RFID التلقائي
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => {
                    setTagInput(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearch(tagInput);
                  }}
                  placeholder="أدخل رقم القرط (مثال: 1042 أو 1015)..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-emerald-500 rounded-2xl pr-12 pl-4 py-3 text-base font-extrabold text-slate-900 dark:text-white focus:outline-none transition shadow-inner"
                />
              </div>

              <button 
                onClick={() => handleSearch(tagInput)}
                className="px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 border border-slate-300 dark:border-slate-700 transition"
              >
                <QrCode className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                بحث وتأكيد
              </button>
            </div>
          </div>

          {/* Selected Cow Details Banner */}
          {selectedCow && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-black text-xl text-emerald-700 dark:text-emerald-400 shadow-inner shrink-0">
                    #{selectedCow.tagNumber.replace('SA-COW-', '')}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">{selectedCow.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedCow.breed} • أيام الحلب (DIM): <strong className="text-slate-900 dark:text-white">{selectedCow.daysInMilk} يوم</strong></p>
                  </div>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-r border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pr-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">المتوسط اليومي المعتاد</span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">{formatNumber(selectedCow.avgYield)} لتر/يوم</span>
                </div>
              </div>

              {/* Safety Lock Active Banner (Critical Mastitis / Antibiotic Interlock) */}
              {selectedCow.isQuarantined && (
                <div className="p-4 bg-red-500/10 border-2 border-red-500/50 rounded-2xl space-y-2 animate-pulse">
                  <div className="flex items-center gap-2.5 text-red-400 font-extrabold text-sm">
                    <ShieldAlert className="w-5 h-5 shrink-0" />
                    <span>تحذير صمام الأمان: فترة تحريم بيطرية نشطة (Withdrawal Safety Lock)!</span>
                  </div>
                  <p className="text-xs text-red-300 pr-7 leading-relaxed">
                    {selectedCow.quarantineReason} • ينتهي الحظر بتاريخ: <strong className="underline">{selectedCow.quarantineEndDate}</strong>
                  </p>
                  <div className="pr-7 pt-1 flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 bg-red-600 text-slate-900 dark:text-white font-bold rounded-lg text-[11px] flex items-center gap-1">
                      🔒 صمام الأمان مفعل: تحويل الحليب للإتلاف / رضاعة العجول
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Milk Yield Input & Touch Keypad */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                كمية الحليب المسجلة لهذه الوردية (باللتر):
              </label>
              <button 
                onClick={handleReadScale}
                className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
              >
                <Scale className="w-3.5 h-3.5" />
                قراءة مباشرة من ميزان المحلب (COM1)
              </button>
            </div>

            <div className="flex gap-3">
              <input
                type="number"
                step="0.1"
                value={currentYield}
                onChange={e => setCurrentYield(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-emerald-500/60 focus:border-emerald-400 rounded-2xl px-5 py-3.5 text-3xl font-black text-emerald-700 dark:text-emerald-400 text-center focus:outline-none transition shadow-inner"
              />
            </div>

            {/* Quick Presets Buttons */}
            <div className="grid grid-cols-6 gap-2 pt-1">
              {[8, 10, 12, 14, 16, 18].map(liters => (
                <button
                  key={liters}
                  type="button"
                  onClick={() => handleQuickAdd(liters)}
                  className={`py-2 rounded-xl text-xs font-black transition border ${
                    Number(currentYield) === liters 
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-md' 
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {liters} لتر
                </button>
              ))}
            </div>
          </div>

          {/* Milk Quality Specs & Valuation */}
          <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-1">نسبة الدهن (اختياري %):</label>
              <input
                type="number"
                step="0.1"
                placeholder="غير مقاس"
                value={fatPct}
                onChange={e => setFatPct(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-1">نسبة البروتين (اختياري %):</label>
              <input
                type="number"
                step="0.1"
                placeholder="غير مقاس"
                value={proteinPct}
                onChange={e => setProteinPct(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-500 dark:text-slate-400 text-[11px] mb-1">القيمة المالية للحلبة:</label>
              <div className="p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-black text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>{isDiscarded ? '0.000 د.ل (معزول)' : formatMoney(Money.mul(currentYield || 0, milkSellingPricePerLiter))}</span>
              </div>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className="p-4 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold leading-relaxed">{feedback}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={loading || !selectedCow}
              className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-900/40 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'جاري الاعتماد...' : 'اعتماد وتسجيل الحلبة في السجل'}
            </button>

            <button
              onClick={handlePrintReceipt}
              className="py-4 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition border border-slate-300 dark:border-slate-700"
            >
              <Printer className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              طباعة إذن الاستلام
            </button>
          </div>
        </div>

        {/* Right 1 Col: Bulk Tank Monitor & Shift Progress */}
        <div className="space-y-6">
          {/* Bulk Tank Telemetry Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Milk className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                خزان التبريد الرئيسي (Bulk Tank #1)
              </h3>
              <div className="flex items-center gap-1.5">
                <ThermometerSnowflake className={`w-3.5 h-3.5 ${chillerTemp !== null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span className={`text-[11px] font-bold ${chillerTemp !== null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                  {chillerTemp !== null ? `${chillerTemp} °C` : '-- °C (غير متصل)'}
                </span>
              </div>
            </div>

            {/* Tank Capacity Gauge */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(bulkTankVolume)} لتر</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">من سعة {formatNumber(targetTankCapacity)} لتر</span>
              </div>
              <div className="h-4 bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 via-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (bulkTankVolume / targetTankCapacity) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>نسبة الامتلاء: {((bulkTankVolume / targetTankCapacity) * 100).toFixed(0)}%</span>
                <span>قيمة المخزون: {formatMoney(Money.mul(bulkTankVolume, milkSellingPricePerLiter))}</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>إنتاج اليوم الإجمالي:</span>
                <strong className="text-slate-900 dark:text-white font-bold">{formatNumber(totalTodayLiters)} لتر</strong>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>الحليب الصالح للتسويق:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatNumber(usableTodayLiters)} لتر</strong>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                <span>إجمالي القيمة التقديرية للإنتاج:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-black">{formatMoney(totalFinancialValue)}</strong>
              </div>
            </div>
          </div>

          {/* Live Recent Milkings Ledger */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center justify-between">
              <span>سجل آخر الحلبات المسجلة اليوم:</span>
              <span className="text-[10px] text-slate-500">{recentLogs.length} عمليات</span>
            </h4>

            <div className="space-y-2 text-xs">
              {recentLogs.map(log => (
                <div 
                  key={log.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    log.isDiscarded 
                      ? 'bg-red-500/10 border-red-500/30 text-red-300' 
                      : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 dark:text-white">#{log.tagNumber.replace('SA-COW-', '')}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">({log.cowName})</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{log.time} • {log.shift === 'MORNING' ? 'صباح' : 'مساء'}</div>
                  </div>

                  <div className="text-left">
                    <span className={`font-black text-sm block ${log.isDiscarded ? 'text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      {log.yieldLiters} لتر
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {log.isDiscarded ? 'معزول' : formatMoney(log.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};






