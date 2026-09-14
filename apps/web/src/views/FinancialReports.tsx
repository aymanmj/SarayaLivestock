import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Milk, 
  Scale, 
  AlertOctagon, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  PieChart, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  Calendar,
  Sparkles,
  Wheat,
  Activity
} from 'lucide-react';
import { FinancialOverviewData, CullingCandidate } from '../api/types';
import { getFinancialOverview, getCullingCandidates, getExportData, updateAnimalStatus, type ExportDataType } from '../api/client';
import { formatMoney, formatNumber, formatDate, formatPercent, OFFICIAL_CURRENCY } from '../utils/money.util';

export const FinancialReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dairy' | 'beef' | 'culling' | 'exports'>('dairy');
  const [financialData, setFinancialData] = useState<FinancialOverviewData | null>(null);
  const [cullingList, setCullingList] = useState<CullingCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportFailed, setExportFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cullingTarget, setCullingTarget] = useState<CullingCandidate | null>(null);
  const [cullingLoading, setCullingLoading] = useState(false);
  const [cullingMessage, setCullingMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleConfirmCulling = async () => {
    if (!cullingTarget) return;
    setCullingLoading(true);
    try {
      await updateAnimalStatus(cullingTarget.id, {
        status: 'CULLED',
        notes: `استبعاد اقتصادي موصى به: ${cullingTarget.reasons.join('، ')} (قيمة تقديرية: ${cullingTarget.estimatedSalvageValue} د.ل)`,
      });
      setCullingList(prev => prev.filter(c => c.id !== cullingTarget.id));
      setCullingMessage({
        text: `تم استبعاد الرأس #${cullingTarget.tagNumber} وتحديث الحالة إلى 'مستبعد' (CULLED) بنجاح.`,
      });
      setCullingTarget(null);
      setTimeout(() => setCullingMessage(null), 5000);
    } catch (err: any) {
      setCullingMessage({
        text: `تعذر استبعاد الرأس: ${err.message || 'خطأ في الخادم'}`,
        error: true,
      });
    } finally {
      setCullingLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [fin, cull] = await Promise.all([
        getFinancialOverview(),
        getCullingCandidates(),
      ]);

      setFinancialData(fin);
      setCullingList(cull || []);
    } catch (error: any) {
      setFinancialData(null);
      setCullingList([]);
      setLoadError(error.message || 'تعذر تحميل التقارير المالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Client-Side CSV / Excel Downloader
  const handleExportCSV = async (type: ExportDataType, title: string) => {
    setExportFailed(false);
    setExportMessage(`جاري تجهيز كشف ${title}...`);
    try {
      const data = await getExportData(type);
      
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM for Arabic Excel
      
      if (Array.isArray(data) && data.length > 0) {
        const headers = Object.keys(data[0]).join(',');
        csvContent += headers + "\r\n";
        data.forEach(row => {
          const values = Object.values(row).map(val => {
            if (typeof val === 'object' && val !== null) return JSON.stringify(val);
            return `"${String(val).replace(/"/g, '""')}"`;
          }).join(',');
          csvContent += values + "\r\n";
        });
      } else throw new Error('لا توجد بيانات متاحة للتصدير');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `SarayaLivestock_${type}_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportMessage(`تم تصدير ملف (${title}) بنجاح بصيغة CSV المتوافقة مع Excel!`);
      setTimeout(() => setExportMessage(null), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
      setExportFailed(true);
      setExportMessage(`تعذر تصدير الملف: ${message}`);
      setTimeout(() => setExportMessage(null), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!financialData) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">جاري تحميل البيانات المالية...</div>;
  }

  const { milkEconomics, beefEconomics, farmPnL } = financialData;

  return (
    <div className="space-y-6">
      {loadError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            التقارير المالية والتحليل الاقتصادي (IAS 41 Farm Accounting)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            حساب التكلفة الفعلية للتر الحليب وكيلو اللحم، مراكز التكلفة، وقرارات الاستبعاد الاقتصادي بالدينار الليبي ({OFFICIAL_CURRENCY.symbol})
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => handleExportCSV('animals', 'سجل القطيع والماشية')}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition border border-emerald-500/30"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel (XLSX)
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition border border-slate-300 dark:border-slate-700"
          >
            <Printer className="w-4 h-4" />
            طباعة تقرير التدقيق
          </button>
        </div>
      </div>

      {exportMessage && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 ${
          exportFailed
            ? 'bg-red-500/10 border border-red-500/30 text-red-300'
            : 'bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
        }`}>
          {exportFailed
            ? <AlertTriangle className="w-4 h-4 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{exportMessage}</span>
        </div>
      )}

      {/* Top 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">صافي الأرباح التشغيلية</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatMoney(farmPnL.netProfit)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">هامش ربح {formatPercent(farmPnL.profitMarginPct)}</span>
            <span className="text-[11px] text-slate-500">خلال {financialData.period}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">التكلفة الفعلية للتر الحليب</span>
            <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Milk className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{formatMoney(milkEconomics.actualCostPerLiter, true, 3)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ لتر</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-bold">
            صافي ربح {formatMoney(milkEconomics.profitPerLiter, true, 3)} لكل لتر حليب
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">تكلفة كجم اللحم المضاف</span>
            <div className="p-2 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{formatMoney(beefEconomics.costPerKgGain)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ كجم لحم</span>
          </div>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-2 font-bold">
            سعر السوق: {formatMoney(beefEconomics.marketPricePerKg)} (هامش {formatPercent(beefEconomics.profitMarginPct)})
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">الماشية المرشحة للاستبعاد</span>
            <div className="p-2 bg-red-500/10 text-red-400 rounded-xl">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-400">{formatNumber(cullingList.length)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">رؤوس غير مجدية</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            قيمة الاسترداد التقديرية: {formatMoney(cullingList.reduce((s, c) => s + c.estimatedSalvageValue, 0))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('dairy')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === 'dairy' 
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Milk className="w-4 h-4" />
          اقتصاديات قطاع الألبان وتكلفة اللتر
        </button>

        <button
          onClick={() => setActiveTab('beef')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === 'beef' 
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Scale className="w-4 h-4" />
          اقتصاديات قطاع التسمين وكيلو اللحم
        </button>

        <button
          onClick={() => setActiveTab('culling')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === 'culling' 
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          محرك قرارات استبعاد الماشية ({formatNumber(cullingList.length)})
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition shrink-0 ${
            activeTab === 'exports' 
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          مركز تصدير البيانات والكشوفات
        </button>
      </div>

      {/* Tab 1: Dairy Economics */}
      {activeTab === 'dairy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cost Breakdown Cards */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                تحليل عناصر تكلفة لتر الحليب الفعلي (Cost Waterfall)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                توزيع المصروفات التشغيلية المباشرة وغير المباشرة على إجمالي {formatNumber(milkEconomics.totalMilkLiters)} لتر حليب
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">تكلفة الأعلاف (TMR):</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">{formatMoney(milkEconomics.feedCost)}</span>
                <span className="text-[10px] text-slate-500 block">
                  {formatPercent((milkEconomics.feedCost / milkEconomics.totalCost) * 100, 0)} من إجمالي التكلفة
                </span>
              </div>

              <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">الأدوية والرعاية البيطرية:</span>
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">{formatMoney(milkEconomics.vetCost)}</span>
                <span className="text-[10px] text-slate-500 block">
                  {formatPercent((milkEconomics.vetCost / milkEconomics.totalCost) * 100, 0)} من إجمالي التكلفة
                </span>
              </div>

              <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">العمالة والمصروفات الإدارية:</span>
                <span className="text-xl font-black text-purple-700 dark:text-purple-400">{formatMoney(milkEconomics.laborAndOverhead)}</span>
                <span className="text-[10px] text-slate-500 block">
                  {formatPercent((milkEconomics.laborAndOverhead / milkEconomics.totalCost) * 100, 0)} من إجمالي التكلفة
                </span>
              </div>
            </div>

            {/* Visual Margin Bar */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">سعر بيع اللتر: <strong className="text-slate-900 dark:text-white">{formatMoney(milkEconomics.sellingPricePerLiter, true, 3)}</strong></span>
                <span className="text-slate-500 dark:text-slate-400">التكلفة: <strong className="text-red-400">{formatMoney(milkEconomics.actualCostPerLiter, true, 3)}</strong></span>
                <span className="text-slate-500 dark:text-slate-400">صافي الربح: <strong className="text-emerald-700 dark:text-emerald-400">{formatMoney(milkEconomics.profitPerLiter, true, 3)} ({formatPercent(milkEconomics.marginPct)})</strong></span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-full overflow-hidden flex">
                <div 
                  className="bg-red-500 h-full" 
                  style={{ width: `${(milkEconomics.actualCostPerLiter / milkEconomics.sellingPricePerLiter) * 100}%` }}
                  title="نسبة التكلفة"
                />
                <div 
                  className="bg-emerald-500 h-full" 
                  style={{ width: `${milkEconomics.marginPct}%` }}
                  title="هامش الربح"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>🔴 التكلفة الإجمالية ({formatPercent((milkEconomics.actualCostPerLiter / milkEconomics.sellingPricePerLiter) * 100)})</span>
                <span>🟢 صافي هامش الأرباح ({formatPercent(milkEconomics.marginPct)})</span>
              </div>
            </div>
          </div>

          {/* Right Summary */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">مؤشرات قطاع الألبان</h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">إجمالي الحليب المنتج:</span>
                <strong className="text-slate-900 dark:text-white">{formatNumber(milkEconomics.totalMilkLiters)} لتر</strong>
              </div>
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">إجمالي مبيعات الحليب:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatMoney(milkEconomics.grossRevenue)}</strong>
              </div>
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">إجمالي مصروفات القطاع:</span>
                <strong className="text-red-400 font-bold">{formatMoney(milkEconomics.totalCost)}</strong>
              </div>
              <div className="flex justify-between p-3 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <span className="text-emerald-300 font-bold">صافي أرباح الألبان:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                  {formatMoney(milkEconomics.grossRevenue - milkEconomics.totalCost)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Beef Economics */}
      {activeTab === 'beef' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                اقتصاديات دورات تسمين العجول والزيادة الوزنية (ADG)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                حساب كفاءة التحويل الغذائي، تكلفة كيلو اللحم المنتج، والقيمة السوقية التقديرية بالدينار الليبي
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">إجمالي الزيادة الوزنية للقطيع:</span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(beefEconomics.totalGainKg)} كجم</span>
                <span className="text-[11px] text-slate-500 block">خلال {financialData.period}</span>
              </div>

              <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">تكلفة كجم اللحم المضاف:</span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatMoney(beefEconomics.costPerKgGain)}</span>
                <span className="text-[11px] text-slate-500 block">تشمل الأعلاف والرعاية</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">سعر بيع كجم اللحم الحي القائم:</span>
                <strong className="text-slate-900 dark:text-white">{formatMoney(beefEconomics.marketPricePerKg)} / كجم</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">صافي الربح لكل كيلوجرام مضاف:</span>
                <strong className="text-emerald-700 dark:text-emerald-400">{formatMoney(beefEconomics.marketPricePerKg - beefEconomics.costPerKgGain)} / كجم</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-700 dark:text-slate-300 font-bold">هامش الربحية لقطاع التسمين:</span>
                <strong className="text-purple-700 dark:text-purple-400 font-black text-sm">{formatPercent(beefEconomics.profitMarginPct)}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">ملخص قطاع التسمين</h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">القيمة السوقية المضافة:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-bold">{formatMoney(beefEconomics.grossEstimatedRevenue)}</strong>
              </div>
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">تكلفة علف التسمين:</span>
                <strong className="text-amber-600 dark:text-amber-400 font-bold">{formatMoney(beefEconomics.feedCost)}</strong>
              </div>
              <div className="flex justify-between p-3 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">إجمالي تكلفة التسمين:</span>
                <strong className="text-red-400 font-bold">{formatMoney(beefEconomics.totalCost)}</strong>
              </div>
              <div className="flex justify-between p-3 bg-purple-500/10 rounded-xl border border-purple-300 dark:border-purple-500/30">
                <span className="text-purple-700 dark:text-purple-300 font-bold">صافي أرباح التسمين:</span>
                <strong className="text-purple-700 dark:text-purple-400 font-extrabold text-sm">
                  {formatMoney(beefEconomics.grossEstimatedRevenue - beefEconomics.totalCost)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Culling Candidates */}
      {activeTab === 'culling' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-400" />
                قائمة الماشية الموصى باستبعادها (Culling Decision Support)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                كشف آلي للحيوانات ذات الإنتاج المنخفض، أو تكرار الأمراض، أو العقم لتقليل الهدر المالي
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('culling', 'قائمة استبعاد الماشية')}
              className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-slate-900 dark:text-white rounded-xl text-xs font-bold transition border border-red-500/30 flex items-center gap-1.5 self-start"
            >
              <Download className="w-4 h-4" />
              تصدير قائمة الاستبعاد
            </button>
          </div>

          {cullingMessage && (
            <div className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 ${
              cullingMessage.error 
                ? 'bg-red-500/10 border border-red-500/30 text-red-300' 
                : 'bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            }`}>
              {cullingMessage.error ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
              <span className="font-bold">{cullingMessage.text}</span>
            </div>
          )}

          <div className="space-y-3">
            {cullingList.map(cand => (
              <div
                key={cand.id}
                className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-slate-900 dark:text-white text-sm">{cand.tagNumber}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">({cand.breed})</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      cand.severity === 'HIGH' 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40' 
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                    }`}>
                      {cand.severity === 'HIGH' ? 'استبعاد عالي الأولوية' : 'ملاحظة ومراجعة'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {cand.reasons.map((r, idx) => (
                      <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className="text-red-400">•</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                    💡 التوصية الفنية: {cand.recommendation}
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">قيمة البيع التقديرية:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-black text-base">{formatMoney(cand.estimatedSalvageValue)}</strong>
                  </div>
                  <button
                    onClick={() => setCullingTarget(cand)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-900/30"
                  >
                    إصدار أمر استبعاد
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Culling Confirmation Modal */}
          {cullingTarget && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-3 text-red-500">
                  <div className="p-3 bg-red-500/10 rounded-2xl">
                    <AlertOctagon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">تأكيد أمر استبعاد الماشية</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">تحديث الحالة في سجل القطيع إلى 'مستبعد'</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم القرط:</span>
                    <strong className="text-slate-900 dark:text-white">{cullingTarget.tagNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">السلالة:</span>
                    <span className="text-slate-700 dark:text-slate-300">{cullingTarget.breed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">القيمة الاستردادية التقديرية:</span>
                    <strong className="text-emerald-700 dark:text-emerald-400">{formatMoney(cullingTarget.estimatedSalvageValue)}</strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-red-400">
                    سيتم نقل هذا الحيوان إلى حالة CULLED وإلغاء إدراجه من الحظائر النشطة وجداول الحلب اليومية.
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={cullingLoading}
                    onClick={() => setCullingTarget(null)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={cullingLoading}
                    onClick={handleConfirmCulling}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition shadow-lg shadow-red-900/30 disabled:opacity-50"
                  >
                    {cullingLoading ? 'جاري الاعتماد...' : 'تأكيد الاستبعاد'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Farm Data Export Center */}
      {activeTab === 'exports' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              مركز استخراج وتصدير الكشوفات والتقارير الرسمية
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تصدير بيانات المزرعة بصيغة CSV و Excel المتوافقة مع كافة البرامج المحاسبية وجداول البيانات
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">كشف جرد القطيع الشامل (Herd Directory)</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">أرقام القروء، الشرائح، السلالات، الأعمار، وشجرة النسب</p>
                </div>
              </div>
              <button
                onClick={() => handleExportCSV('animals', 'سجل القطيع والماشية')}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-800 dark:text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                تصدير كشف القطيع (Excel / CSV)
              </button>
            </div>

            <div className="p-5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Milk className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">سجل إنتاج الحلب اليومي والشهري</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ورديات الحلب، الإنتاج باللتر، نسبة الدهن، وحليب العزل</p>
                </div>
              </div>
              <button
                onClick={() => handleExportCSV('milking', 'سجل الحلب الشهري')}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-800 dark:text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                تصدير سجل الحلب (Excel / CSV)
              </button>
            </div>

            <div className="p-5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">كشف التناسل والتلقيح والسونار</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">مواعيد السونار، قشات السائل المنوي، مواعيد التجفيف والولادات</p>
                </div>
              </div>
              <button
                onClick={() => handleExportCSV('breeding', 'سجل التناسل والولادات')}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 text-slate-800 dark:text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                تصدير كشف التناسل (Excel / CSV)
              </button>
            </div>

            <div className="p-5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Wheat className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">مستودع خامات الأعلاف وحركات الصرف</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">أرصدة الخامات، أسعار الشراء، وحركات صرف العليقة للحظائر</p>
                </div>
              </div>
              <button
                onClick={() => handleExportCSV('nutrition', 'مخزون وحركات الأعلاف')}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 text-slate-800 dark:text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                تصدير كشف الأعلاف (Excel / CSV)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
