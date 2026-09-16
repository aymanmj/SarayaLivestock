import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Milk,
  Scale,
  Skull,
  Plus,
  RefreshCw,
  Printer,
  Calendar,
  User,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ArrowDownRight,
  TrendingUp,
  X,
  Search,
  Filter,
} from 'lucide-react';
import {
  getCommercialSales,
  getSalesSummary,
  getAnimalMortalities,
  recordMilkSale,
  recordAnimalSale,
  recordAnimalMortality,
  CommercialSale,
  AnimalMortality,
  SalesSummary,
  getAnimals,
  getAnimalBookValue,
  updateMilkPolicy,
} from '../api/client';
import { Animal } from '../api/types';
import { formatMoney, formatDate, OFFICIAL_CURRENCY } from '../utils/money.util';

export const CommercialSales: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'mortality'>('sales');
  const [sales, setSales] = useState<CommercialSale[]>([]);
  const [mortalities, setMortalities] = useState<AnimalMortality[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [activeAnimals, setActiveAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [milkPolicy, setMilkPolicy] = useState<'DAILY_RESET' | 'CARRY_OVER'>('DAILY_RESET');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MILK' | 'LIVE_ANIMAL'>('ALL');

  // Modal States
  const [isMilkModalOpen, setIsMilkModalOpen] = useState(false);
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [isMortalityModalOpen, setIsMortalityModalOpen] = useState(false);
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<CommercialSale | null>(null);

  // Milk Sale Form State
  const [milkLiters, setMilkLiters] = useState<number>(100);
  const [milkPrice, setMilkPrice] = useState<number>(3.5);
  const [milkPaymentMethod, setMilkPaymentMethod] = useState<'CASH' | 'BANK' | 'ON_ACCOUNT'>('CASH');
  const [milkBuyerName, setMilkBuyerName] = useState('');
  const [milkBuyerPhone, setMilkBuyerPhone] = useState('');
  const [milkNotes, setMilkNotes] = useState('');

  // Animal Sale Form State
  const [saleAnimalId, setSaleAnimalId] = useState('');
  const [salePricingMethod, setSalePricingMethod] = useState<'BY_WEIGHT' | 'PER_HEAD'>('BY_WEIGHT');
  const [saleWeightKg, setSaleWeightKg] = useState<number>(400);
  const [salePricePerKg, setSalePricePerKg] = useState<number>(22);
  const [salePricePerHead, setSalePricePerHead] = useState<number>(8500);
  const [salePaymentMethod, setSalePaymentMethod] = useState<'CASH' | 'BANK' | 'ON_ACCOUNT'>('CASH');
  const [saleBuyerName, setSaleBuyerName] = useState('');
  const [saleBuyerPhone, setSaleBuyerPhone] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleBookValue, setSaleBookValue] = useState<{ animalId: string; value: number } | null>(null);
  const [saleBookValueError, setSaleBookValueError] = useState('');
  const currentSaleBookValue = saleBookValue?.animalId === saleAnimalId ? saleBookValue.value : null;

  useEffect(() => {
    let cancelled = false;
    setSaleBookValue(null);
    setSaleBookValueError('');
    if (saleAnimalId) {
      const todayStr = new Date().toISOString().split('T')[0];
      getAnimalBookValue(saleAnimalId, todayStr).then(result => {
        if (!cancelled) setSaleBookValue({ animalId: saleAnimalId, value: Number(result.bookValue) });
      }).catch((error: unknown) => {
        if (!cancelled) setSaleBookValueError(error instanceof Error ? error.message : 'تعذر تحميل القيمة الدفترية للحيوان');
      });
    }
    return () => { cancelled = true; };
  }, [saleAnimalId]);

  // Mortality Form State
  const [mortAnimalId, setMortAnimalId] = useState('');
  const [mortDeathDate, setMortDeathDate] = useState(new Date().toISOString().split('T')[0]);
  const [mortCause, setMortCause] = useState('انتفاخ الكرش الحاد (Acute Bloat)');
  const [mortSalvageValue, setMortSalvageValue] = useState<number>(0);
  const [mortNotes, setMortNotes] = useState('');
  const [bookValue, setBookValue] = useState<{ animalId: string; date: string; value: number } | null>(null);
  const [bookValueError, setBookValueError] = useState('');
  const currentBookValue = bookValue?.animalId === mortAnimalId && bookValue.date === mortDeathDate ? bookValue.value : null;

  useEffect(() => {
    let cancelled = false;
    setBookValue(null);
    setBookValueError('');
    if (mortAnimalId && mortDeathDate) {
      getAnimalBookValue(mortAnimalId, mortDeathDate).then(result => {
        if (!cancelled) setBookValue({ animalId: mortAnimalId, date: mortDeathDate, value: Number(result.bookValue) });
      }).catch((error: unknown) => {
        if (!cancelled) setBookValueError(error instanceof Error ? error.message : 'تعذر تحميل القيمة الدفترية');
      });
    }
    return () => { cancelled = true; };
  }, [mortAnimalId, mortDeathDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesData, mortData, sumData, animalsData] = await Promise.all([
        getCommercialSales(100),
        getAnimalMortalities(100),
        getSalesSummary(),
        getAnimals({ status: 'ACTIVE' }),
      ]);
      setSales(salesData);
      setMortalities(mortData);
      setSummary(sumData);
      if (sumData?.milkPolicy) setMilkPolicy(sumData.milkPolicy as 'DAILY_RESET' | 'CARRY_OVER');
      setActiveAnimals(animalsData);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل بيانات المبيعات والنفوق');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePolicy = async (newPolicy: 'DAILY_RESET' | 'CARRY_OVER') => {
    try {
      setLoading(true);
      const changed = await updateMilkPolicy({ milkPolicy: newPolicy });
      setMilkPolicy(newPolicy);
      setFeedback(
        `تم تحديث سياسة مخزون الحليب للمزرعة إلى: ${
          newPolicy === 'CARRY_OVER' ? 'ترحيل الرصيد التراكمي (CARRY_OVER)' : 'تصفير المخزون اليومي (DAILY_RESET)'
        } من ${changed.effectiveDate || 'تاريخ السريان السابق'}. لا يُعاد احتساب مخزون الأيام القديمة.`,
      );
      clearFeedback();
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تحديث سياسة المخزون');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const clearFeedback = () => {
    setTimeout(() => setFeedback(null), 5000);
  };

  // Submit Milk Sale
  const handleMilkSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (milkLiters <= 0 || milkPrice <= 0 || !milkBuyerName.trim()) {
      setError('يرجى ملء جميع الحقول الإلزامية لكمية الحليب والسعر والمشتري');
      return;
    }
    setLoading(true);
    try {
      const result = await recordMilkSale({
        liters: milkLiters,
        pricePerLiter: milkPrice,
        paymentMethod: milkPaymentMethod,
        buyerName: milkBuyerName.trim(),
        buyerPhone: milkBuyerPhone.trim() || undefined,
        notes: milkNotes.trim() || undefined,
      });
      setFeedback(`تم إصدار فاتورة بيع الحليب بنجاح رقم (${result.invoiceNumber}) بمبلغ ${formatMoney(result.totalAmount)}`);
      clearFeedback();
      setIsMilkModalOpen(false);
      setMilkBuyerName('');
      setMilkBuyerPhone('');
      setMilkNotes('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل فاتورة بيع الحليب');
    } finally {
      setLoading(false);
    }
  };

  // Submit Animal Sale
  const handleAnimalSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleAnimalId || !saleBuyerName.trim() || currentSaleBookValue === null) {
      setError('يرجى اختيار الحيوان والتأكد من وجود قيمة دفترية معتمدة له في دفتر الأستاذ وإدخال اسم المشتري');
      return;
    }
    setLoading(true);
    try {
      const result = await recordAnimalSale({
        animalId: saleAnimalId,
        pricingMethod: salePricingMethod,
        weightKg: salePricingMethod === 'BY_WEIGHT' ? saleWeightKg : undefined,
        pricePerKg: salePricingMethod === 'BY_WEIGHT' ? salePricePerKg : undefined,
        pricePerHead: salePricingMethod === 'PER_HEAD' ? salePricePerHead : undefined,
        paymentMethod: salePaymentMethod,
        buyerName: saleBuyerName.trim(),
        buyerPhone: saleBuyerPhone.trim() || undefined,
        notes: saleNotes.trim() || undefined,
      });
      setFeedback(`تم بيع الماشية بنجاح وإصدار الفاتورة رقم (${result.invoiceNumber}) بمبلغ ${formatMoney(result.totalAmount)}`);
      clearFeedback();
      setIsAnimalModalOpen(false);
      setSaleBuyerName('');
      setSaleBuyerPhone('');
      setSaleNotes('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل تسجيل بيع الماشية');
    } finally {
      setLoading(false);
    }
  };

  const totalSaleAmount = useMemo(() => {
    if (salePricingMethod === 'BY_WEIGHT') {
      return (saleWeightKg || 0) * (salePricePerKg || 0);
    }
    return salePricePerHead || 0;
  }, [salePricingMethod, saleWeightKg, salePricePerKg, salePricePerHead]);

  const estimatedSaleGainLoss = useMemo(() => {
    if (currentSaleBookValue === null) return null;
    return totalSaleAmount - currentSaleBookValue;
  }, [totalSaleAmount, currentSaleBookValue]);

  // Submit Mortality
  const handleMortalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mortAnimalId || !mortCause.trim() || currentBookValue === null) {
      setError('يرجى اختيار الحيوان وسبب النفوق');
      return;
    }
    setLoading(true);
    try {
      const result = await recordAnimalMortality({
        animalId: mortAnimalId,
        deathDate: mortDeathDate,
        causeOfDeath: mortCause.trim(),
        salvageValue: mortSalvageValue > 0 ? mortSalvageValue : 0,
        notes: mortNotes.trim() || undefined,
      });
      setFeedback(`تم قيد واقعة النفوق واحتساب الخسارة البيولوجية بمبلغ ${formatMoney(result.netLoss)} وقيدها بالدفتر العام`);
      clearFeedback();
      setIsMortalityModalOpen(false);
      setMortNotes('');
      setMortSalvageValue(0);
      loadData();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل واقعة النفوق');
    } finally {
      setLoading(false);
    }
  };

  const estimatedNetLoss = currentBookValue === null ? null : Math.max(0, currentBookValue - (mortSalvageValue || 0));

  // Filtered Sales
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchSearch =
        s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.buyerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = typeFilter === 'ALL' || s.saleType === typeFilter;
      return matchSearch && matchType;
    });
  }, [sales, searchQuery, typeFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                المبيعات التجارية وإدارة الخسائر والنفوق
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إصدار فواتير بيع الحليب الخام، مواشي التسمين واللحوم، واحتساب خسائر النفوق وفق معيار IAS 41
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">سياسة الحليب:</span>
            <select
              value={milkPolicy}
              disabled={loading}
              onChange={e => handleTogglePolicy(e.target.value as 'DAILY_RESET' | 'CARRY_OVER')}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer text-xs"
              title="التغيير يسري من اليوم قبل أول بيع؛ لا يرحّل مخزون الأيام السابقة ولا يسمح ببيع يسبق تاريخ التغيير"
            >
              <option value="DAILY_RESET">تصفير يومي</option>
              <option value="CARRY_OVER">ترحيل الرصيد</option>
            </select>
          </div>
          <span className="text-xs text-slate-500">تغيير السياسة يسري من اليوم قبل أول بيع، دون ترحيل مخزون الأيام القديمة.</span>

          <button
            onClick={() => setIsMilkModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
          >
            <Milk className="w-4 h-4" />
            <span>بيع حليب خام</span>
          </button>

          <button
            onClick={() => setIsAnimalModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
          >
            <Scale className="w-4 h-4" />
            <span>بيع ماشية حية / لحوم</span>
          </button>

          <button
            onClick={() => setIsMortalityModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
          >
            <Skull className="w-4 h-4" />
            <span>تسجيل نفوق / خسارة</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-medium flex items-center gap-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي المبيعات التجارية</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {formatMoney(summary?.totalSalesLyd || 0)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>إجمالي الإيرادات المقيدة بالدفتر العام</span>
          </div>
        </div>

        {/* Milk Sales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">مبيعات الحليب الخام</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              <Milk className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {formatMoney(summary?.milkSalesLyd || 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            إجمالي الكمية: {Number(summary?.totalMilkLiters || 0).toLocaleString()} لتر
          </div>
        </div>

        {/* Livestock Sales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">مبيعات الماشية واللحوم</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatMoney(summary?.animalSalesLyd || 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
            عدد الرؤوس المبيعة: {summary?.totalAnimalsSold || 0} رأس
          </div>
        </div>

        {/* Biological Loss / Mortality */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-bold">خسائر النفوق (IAS 41)</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <Skull className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatMoney(summary?.totalMortalityLossLyd || 0)}
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-1 flex items-center gap-1">
            <ArrowDownRight className="w-3 h-3" />
            <span>{summary?.totalDeceasedAnimals || 0} رأس نافقة مقيدة بالحساب 5105</span>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'sales'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              فواتير وسجل المبيعات ({sales.length})
            </button>
            <button
              onClick={() => setActiveTab('mortality')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'mortality'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              سجل النفوق والخسائر البيولوجية ({mortalities.length})
            </button>
          </div>

          {activeTab === 'sales' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث برقم الفاتورة أو العميل..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-3 pr-9 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">جميع المنتجات</option>
                <option value="MILK">حليب خام فقط</option>
                <option value="LIVE_ANIMAL">ماشية حية فقط</option>
              </select>
            </div>
          )}
        </div>

        {/* Sales Table Tab */}
        {activeTab === 'sales' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 font-bold">رقم الفاتورة</th>
                  <th className="p-3.5 font-bold">التاريخ</th>
                  <th className="p-3.5 font-bold">نوع المنتج</th>
                  <th className="p-3.5 font-bold">المشتري / العميل</th>
                  <th className="p-3.5 font-bold">التفاصيل والكمية</th>
                  <th className="p-3.5 font-bold">طريقة السداد</th>
                  <th className="p-3.5 font-bold">المبلغ الإجمالي</th>
                  <th className="p-3.5 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد فواتير مبيعات مسجلة
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {sale.invoiceNumber}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="p-3.5">
                        {sale.saleType === 'MILK' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <Milk className="w-3 h-3" />
                            حليب خام
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            <Scale className="w-3 h-3" />
                            ماشية حية
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                        <div>{sale.buyerName}</div>
                        {sale.buyerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">{sale.buyerPhone}</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300">
                        {sale.saleType === 'MILK' ? (
                          <span>{Number(sale.liters).toLocaleString()} لتر @ {sale.pricePerLiter} د.ل/لتر</span>
                        ) : (
                          <span>
                            {sale.pricingMethod === 'BY_WEIGHT'
                              ? `وزن قائم: ${sale.weightKg} كجم @ ${sale.pricePerKg} د.ل/كجم`
                              : `تسعير مقطوع بالرأس: ${formatMoney(sale.pricePerHead)}`}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {sale.paymentMethod === 'CASH'
                            ? 'نقداً (1101)'
                            : sale.paymentMethod === 'BANK'
                            ? 'بنك (1102)'
                            : 'آجل / ذمم (1103)'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(sale.totalAmount)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setSelectedSaleForPrint(sale)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-600" />
                          <span>إيصال / فاتورة</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Mortality Table Tab */}
        {activeTab === 'mortality' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-rose-50/50 dark:bg-rose-950/20 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5 font-bold">تاريخ النفوق</th>
                  <th className="p-3.5 font-bold">رقم القرط والحيوان</th>
                  <th className="p-3.5 font-bold">سبب النفوق (التشخيص)</th>
                  <th className="p-3.5 font-bold">القيمة الدفترية (IAS 41)</th>
                  <th className="p-3.5 font-bold">قيمة التخريد / الاسترداد</th>
                  <th className="p-3.5 font-bold text-rose-600">صافي الخسارة المالية</th>
                  <th className="p-3.5 font-bold">المعالجة المحاسبية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {mortalities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      لا توجد حالات نفوق مسجلة
                    </td>
                  </tr>
                ) : (
                  mortalities.map(mort => (
                    <tr key={mort.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-colors">
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-mono">
                        {mort.deathDate}
                      </td>
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                        {(() => {
                          const animal = mort.animal || activeAnimals.find(a => a.id === mort.animalId);
                          return (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Skull className="w-3.5 h-3.5 text-rose-500" />
                                <span>قرط: {animal?.tagNumber || mort.animalId.slice(0, 8)}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {animal?.breed || animal?.species || 'ماشية'}
                              </span>
                            </>
                          );
                        })()}
                      </td>
                      <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                        {mort.causeOfDeath}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                        {formatMoney(mort.bookValue)}
                      </td>
                      <td className="p-3.5 font-mono text-emerald-600 dark:text-emerald-400">
                        {formatMoney(mort.salvageValue)}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatMoney(mort.netLoss)}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          قيد مصروف 5105
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Milk Sale Modal */}
      {isMilkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Milk className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">إصدار فاتورة بيع حليب خام</h3>
              </div>
              <button onClick={() => setIsMilkModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMilkSaleSubmit} className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">الكمية باللتر *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    value={milkLiters}
                    onChange={e => setMilkLiters(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">سعر اللتر ({OFFICIAL_CURRENCY.symbol}) *</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    value={milkPrice}
                    onChange={e => setMilkPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                    required
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <span className="font-bold text-blue-900 dark:text-blue-200">إجمالي قيمة الفاتورة:</span>
                <span className="text-base font-black font-mono text-blue-700 dark:text-blue-300">
                  {formatMoney(milkLiters * milkPrice)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">اسم العميل / المشتري *</label>
                  <input
                    type="text"
                    placeholder="مثال: مصنع الألبان / مركز التوزيع"
                    value={milkBuyerName}
                    onChange={e => setMilkBuyerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    placeholder="091XXXXXXX"
                    value={milkBuyerPhone}
                    onChange={e => setMilkBuyerPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">طريقة السداد والقبض *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMilkPaymentMethod('CASH')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      milkPaymentMethod === 'CASH'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    نقداً (الصندوق 1101)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMilkPaymentMethod('BANK')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      milkPaymentMethod === 'BANK'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    تحويل بنكي (1102)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMilkPaymentMethod('ON_ACCOUNT')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      milkPaymentMethod === 'ON_ACCOUNT'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    آجل (العملاء 1103)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">ملاحظات إضافية</label>
                <input
                  type="text"
                  placeholder="رقم خزان التبريد، سيارة التوريد..."
                  value={milkNotes}
                  onChange={e => setMilkNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              {/* Accounting Preview */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">الأثر المالي المزدوج المعتمد:</span>
                <div>مدين: {milkPaymentMethod === 'CASH' ? '1101 الصندوق' : milkPaymentMethod === 'BANK' ? '1102 البنك' : '1103 مدينو المبيعات'} (+{formatMoney(milkLiters * milkPrice)})</div>
                <div>دائن: 4101 إيرادات مبيعات الحليب الخام (+{formatMoney(milkLiters * milkPrice)})</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMilkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                >
                  إصدار الفاتورة وترحيل القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Animal Sale Modal */}
      {isAnimalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">بيع ماشية حية أو لحوم</h3>
              </div>
              <button onClick={() => setIsAnimalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAnimalSaleSubmit} className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">اختر الحيوان من القطيع النشط *</label>
                <select
                  value={saleAnimalId}
                  onChange={e => setSaleAnimalId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                  required
                >
                  <option value="">-- اختر رأس الماشية المراد بيعه --</option>
                  {activeAnimals.map(a => (
                    <option key={a.id} value={a.id}>
                      قرط: {a.tagNumber} | {a.breed || a.species} | {a.purpose === 'DAIRY' ? 'حليب' : 'تسمين'} ({a.currentLifeStage})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">طريقة التسعير *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSalePricingMethod('BY_WEIGHT')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      salePricingMethod === 'BY_WEIGHT'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    بالوزن القائم (كجم)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalePricingMethod('PER_HEAD')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      salePricingMethod === 'PER_HEAD'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    مقطوع بالرأس
                  </button>
                </div>
              </div>

              {salePricingMethod === 'BY_WEIGHT' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">الوزن القائم (كجم) *</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={saleWeightKg}
                      onChange={e => setSaleWeightKg(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">سعر الكيلو ({OFFICIAL_CURRENCY.symbol}) *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.1"
                      value={salePricePerKg}
                      onChange={e => setSalePricePerKg(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">سعر الرأس الإجمالي ({OFFICIAL_CURRENCY.symbol}) *</label>
                  <input
                    type="number"
                    step="50"
                    min="1"
                    value={salePricePerHead}
                    onChange={e => setSalePricePerHead(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono font-bold"
                    required
                  />
                </div>
              )}

              {/* Live Total Calculation */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-200">إجمالي ثمن البيع:</span>
                <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                  {formatMoney(
                    salePricingMethod === 'BY_WEIGHT' ? saleWeightKg * salePricePerKg : salePricePerHead
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">اسم المشتري *</label>
                  <input
                    type="text"
                    placeholder="اسم التاجر أو القصاب"
                    value={saleBuyerName}
                    onChange={e => setSaleBuyerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="092XXXXXXX"
                    value={saleBuyerPhone}
                    onChange={e => setSaleBuyerPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">طريقة التحصيل *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSalePaymentMethod('CASH')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      salePaymentMethod === 'CASH'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    نقداً (1101)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalePaymentMethod('BANK')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      salePaymentMethod === 'BANK'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    بنك (1102)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSalePaymentMethod('ON_ACCOUNT')}
                    className={`p-2 rounded-xl font-bold border text-center transition-all ${
                      salePaymentMethod === 'ON_ACCOUNT'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    آجل (1103)
                  </button>
                </div>
              </div>

              {/* Biological Asset Valuation & Gain/Loss Breakdown */}
              {saleAnimalId && (
                <div className="space-y-2">
                  {saleBookValueError && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                      <p className="font-bold">{saleBookValueError}</p>
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                        يلزم ربط القيمة الدفترية للحيوان بقيد أصل بيولوجي في دفتر الأستاذ العام قبل إتمام البيع.
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>القيمة الدفترية للأصل البيولوجي (Book Value):</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {currentSaleBookValue === null ? 'غير متاحة (يلزم ربط الأصل)' : formatMoney(currentSaleBookValue)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>إجمالي ثمن البيع المحصل:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatMoney(totalSaleAmount)}
                      </span>
                    </div>
                    {estimatedSaleGainLoss !== null && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span className="font-bold">
                          {estimatedSaleGainLoss >= 0 ? 'الربح الرأسمالي المتوقع (Capital Gain):' : 'الخسارة الرأسمالية المتوقعة (Capital Loss):'}
                        </span>
                        <span className={`font-mono font-black ${estimatedSaleGainLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {formatMoney(Math.abs(estimatedSaleGainLoss))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">الإجراءات الآلية المترتبة:</span>
                <div>• تحديث حالة الحيوان المبيع فورياً إلى <strong className="text-emerald-600">SOLD</strong></div>
                <div>• استبعاد الأصل البيولوجي دفترياً ({currentSaleBookValue === null ? 'غير محدد' : formatMoney(currentSaleBookValue)}) وإثبات تكلفة التخلص</div>
                <div>• إثبات إيراد البيع ({formatMoney(totalSaleAmount)}) في حساب 4102 ومدين الخزينة/البنك</div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAnimalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading || currentSaleBookValue === null}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm disabled:opacity-50"
                >
                  إتمام البيع وترحيل القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mortality / Biological Loss Modal */}
      {isMortalityModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skull className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">تسجيل نفوق واحتساب الخسائر البيولوجية (IAS 41)</h3>
              </div>
              <button onClick={() => setIsMortalityModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMortalitySubmit} className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">اختر الحيوان النافق *</label>
                <select
                  value={mortAnimalId}
                  onChange={e => setMortAnimalId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold"
                  required
                >
                  <option value="">-- اختر الحيوان من القطيع --</option>
                  {activeAnimals.map(a => (
                    <option key={a.id} value={a.id}>
                      قرط: {a.tagNumber} | {a.breed || a.species} | {a.purpose} ({a.currentLifeStage})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">تاريخ النفوق *</label>
                  <input
                    type="date"
                    value={mortDeathDate}
                    onChange={e => setMortDeathDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">سبب النفوق (التشخيص) *</label>
                  <select
                    value={mortCause}
                    onChange={e => setMortCause(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <option value="انتفاخ الكرش الحاد (Acute Bloat)">انتفاخ الكرش الحاد (Acute Bloat)</option>
                    <option value="تسمم معوي وبكتيري (Enterotoxemia)">تسمم معوي وبكتيري (Enterotoxemia)</option>
                    <option value="حمى والتهاب رئوي حاد (Pneumonia)">حمى والتهاب رئوي حاد (Pneumonia)</option>
                    <option value="عسر ولادة ومضاعفات تناسلية (Dystocia)">عسر ولادة ومضاعفات تناسلية (Dystocia)</option>
                    <option value="رضوض وكسور أو حادث ميكانيكي">رضوض وكسور أو حادث ميكانيكي</option>
                    <option value="نفوق مفاجئ / سبب غير معروف">نفوق مفاجئ / سبب غير معروف</option>
                    <option value="استبعاد بيطري إجباري">استبعاد بيطري إجباري</option>
                  </select>
                </div>
              </div>

              {/* Biological Asset Valuation Breakdown */}
              {bookValueError && <p role="alert" className="text-rose-600">{bookValueError} — يرجى مراجعة المحاسب لربط الأصل من دفتر الأستاذ.</p>}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>القيمة الدفترية للأصل البيولوجي (Book Value):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {currentBookValue === null ? 'القيمة غير متاحة' : formatMoney(currentBookValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>قيمة التخريد / الاسترداد (Salvage Value إن وجد):</span>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      max={currentBookValue ?? 0}
                      value={mortSalvageValue}
                      onChange={e => setMortSalvageValue(parseFloat(e.target.value) || 0)}
                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-mono text-left"
                    />
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between items-center text-rose-600 font-bold">
                  <span>صافي الخسارة المحملة على الدفتر العام (Net Loss):</span>
                  <span className="text-base font-mono font-black">
                    {formatMoney(estimatedNetLoss)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">ملاحظات وتقرير الطبيب البيطري</label>
                <input
                  type="text"
                  placeholder="تقرير التشريح أو الفحص الظاهري..."
                  value={mortNotes}
                  onChange={e => setMortNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              {/* Accounting Entry Preview */}
              <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 text-[11px] text-rose-800 dark:text-rose-300 space-y-1">
                <span className="font-bold block">القيد المحاسبي المزدوج المتوازن (IAS 41):</span>
                <div>• مدين: 5105 خسائر نفوق واستبعاد الماشية بمبلغ ({formatMoney(estimatedNetLoss)})</div>
                {mortSalvageValue > 0 && (
                  <div>• مدين: 1101 الصندوق والخزينة بقيمة التخريد ({formatMoney(mortSalvageValue)})</div>
                )}
                <div>• دائن: الأصل البيولوجي بالقيمة الدفترية الكاملة ({currentBookValue === null ? 'غير متاحة' : formatMoney(currentBookValue)})</div>
                <div>• تحديث حالة الحيوان فورياً إلى <strong className="text-rose-600">DECEASED</strong></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMortalityModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading || currentBookValue === null}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm disabled:opacity-50"
                >
                  اعتماد النفوق وإثبات الخسارة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice & Thermal Receipt Printable Modal */}
      {selectedSaleForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">إيصال وفاتورة بيع معتمدة</h3>
              </div>
              <button onClick={() => setSelectedSaleForPrint(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Receipt Body (80mm simulated) */}
            <div className="p-6 bg-slate-50 dark:bg-slate-950 font-mono text-slate-800 dark:text-slate-200 space-y-4 text-xs">
              <div className="text-center space-y-1 border-b border-dashed border-slate-300 dark:border-slate-800 pb-3">
                <div className="font-black text-sm">مزارع السرايا للإنتاج الحيواني والألبان</div>
                <div className="text-[11px] text-slate-500">Saraya Livestock & Dairy Farms</div>
                <div className="text-[10px] text-slate-400">ليبيا - طرابلس / المنطقة الوسطى</div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم الفاتورة:</span>
                  <span className="font-bold">{selectedSaleForPrint.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">التاريخ والوقت:</span>
                  <span>{formatDate(selectedSaleForPrint.saleDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المشتري:</span>
                  <span className="font-bold">{selectedSaleForPrint.buyerName}</span>
                </div>
                {selectedSaleForPrint.buyerPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">الهاتف:</span>
                    <span>{selectedSaleForPrint.buyerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">طريقة السداد:</span>
                  <span>{selectedSaleForPrint.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 dark:border-slate-800 py-3 space-y-2">
                <div className="flex justify-between font-bold">
                  <span>البيان / الصنف</span>
                  <span>القيمة</span>
                </div>
                {selectedSaleForPrint.saleType === 'MILK' ? (
                  <div className="flex justify-between text-[11px]">
                    <span>حليب خام ({Number(selectedSaleForPrint.liters).toLocaleString()} لتر @ {selectedSaleForPrint.pricePerLiter} د.ل)</span>
                    <span className="font-bold">{formatMoney(selectedSaleForPrint.totalAmount)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-[11px]">
                    <span>
                      ماشية حية ({selectedSaleForPrint.pricingMethod === 'BY_WEIGHT' ? `${selectedSaleForPrint.weightKg} كجم` : 'مقطوع بالرأس'})
                    </span>
                    <span className="font-bold">{formatMoney(selectedSaleForPrint.totalAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-sm font-black pt-1">
                <span>الإجمالي الكلي:</span>
                <span className="text-emerald-600">{formatMoney(selectedSaleForPrint.totalAmount)}</span>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-300 dark:border-slate-800">
                شكراً لتعاملكم مع مزارع السرايا • تم الترحيل بالدفتر العام
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setSelectedSaleForPrint(null)}
                className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 text-xs"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال (حراري / عادي)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
