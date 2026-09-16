import React, { useState, useEffect } from 'react';
import { 
  Wheat, 
  Sparkles, 
  Scale, 
  DollarSign, 
  Truck, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowDownRight, 
  RefreshCw, 
  Save, 
  Calculator, 
  Info, 
  Activity,
  Archive
} from 'lucide-react';
import { FeedIngredient, FeedFormula, FeedDistribution, LeastCostResult } from '../api/types';
import { 
  getFeedStock, 
  getFeedFormulas, 
  getFeedDistributions, 
  calculateLeastCostRation, 
  createFeedFormula 
} from '../api/client';
import { AddFeedIngredientModal } from '../components/AddFeedIngredientModal';
import { ReceiveFeedBatchModal } from '../components/ReceiveFeedBatchModal';
import { DispenseFeedModal } from '../components/DispenseFeedModal';
import { Money, formatMoney, formatNumber, formatDate, formatPercent, OFFICIAL_CURRENCY } from '../utils/money.util';

type FeedSector = 'DAIRY' | 'BREEDING' | 'FATTENING' | 'CALVES' | 'ISOLATION';

const PRESET_TARGETS: Array<{
  id: string;
  name: string;
  protein: number;
  energy: number;
  sector: FeedSector;
}> = [
  { id: 'dairy-high', name: 'أبقار حلب عالي (+28 لتر)', protein: 18.0, energy: 2.9, sector: 'DAIRY' },
  { id: 'dairy-mid', name: 'أبقار حلب متوسط (18-25 لتر)', protein: 16.0, energy: 2.7, sector: 'DAIRY' },
  { id: 'dairy-dry', name: 'أبقار جافة وعشار', protein: 13.0, energy: 2.4, sector: 'DAIRY' },
  { id: 'beef-1', name: 'عجول تسمين مرحلة أولى (200-350 كجم)', protein: 16.0, energy: 3.1, sector: 'FATTENING' },
  { id: 'beef-2', name: 'عجول تسمين مرحلة ثانية (350-550 كجم)', protein: 13.5, energy: 3.2, sector: 'FATTENING' },
  { id: 'sheep', name: 'أغنام وخراف تسمين', protein: 14.5, energy: 2.8, sector: 'FATTENING' },
];

export const NutritionRations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'optimizer' | 'warehouse' | 'formulas'>('optimizer');
  const [stock, setStock] = useState<FeedIngredient[]>([]);
  const [formulas, setFormulas] = useState<FeedFormula[]>([]);
  const [distributions, setDistributions] = useState<FeedDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Optimizer State
  const [selectedTarget, setSelectedTarget] = useState(PRESET_TARGETS[0]);
  const [customProtein, setCustomProtein] = useState<number>(18.0);
  const [batchTotalKg, setBatchTotalKg] = useState<number>(3000);
  const [selectedIngredients, setSelectedIngredients] = useState<Record<string, boolean>>({});
  const [optimizationResult, setOptimizationResult] = useState<LeastCostResult | null>(null);
  const [optError, setOptError] = useState<string | null>(null);
  const [formulaSaveSuccess, setFormulaSaveSuccess] = useState(false);

  // Modals State
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState(false);
  const [isReceiveBatchOpen, setIsReceiveBatchOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [selectedIngredientForReceive, setSelectedIngredientForReceive] = useState<FeedIngredient | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sData, fData, dData] = await Promise.all([
        getFeedStock(),
        getFeedFormulas(),
        getFeedDistributions(),
      ]);

      setStock(sData || []);
      setFormulas(fData || []);
      setDistributions(dData || []);

      const initialSelected: Record<string, boolean> = {};
      (sData || []).forEach(item => { initialSelected[item.id] = true; });
      setSelectedIngredients(initialSelected);
    } catch (error: any) {
      setStock([]);
      setFormulas([]);
      setDistributions([]);
      setLoadError(error.message || 'تعذر تحميل بيانات التغذية والمخزون');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Run Least-Cost Optimization
  const handleOptimize = async () => {
    setOptError(null);
    setFormulaSaveSuccess(false);

    const available = stock.filter(i => selectedIngredients[i.id] && Number(i.currentStock) > 0);
    if (available.length < 2) {
      setOptError('يرجى اختيار مادتين علفيتين على الأقل للخلط (مصدر طاقة + مصدر بروتين).');
      return;
    }

    try {
      const missingNutrition = available.filter(i => i.proteinPct == null || i.energyMcal == null);
      if (missingNutrition.length) {
        setOptError(`لا يمكن التحسين قبل استكمال البروتين والطاقة للمواد: ${missingNutrition.map(i => i.name).join('، ')}`);
        return;
      }
      const inputs = available.map(i => ({
        id: i.id,
        name: i.name,
        costPerKg: Number(i.costPerUnit),
        proteinPct: Number(i.proteinPct),
        energyMcal: Number(i.energyMcal),
      }));

      const res = await calculateLeastCostRation(inputs, {
        targetProteinPct: Number(customProtein),
        batchTotalKg: Number(batchTotalKg),
      });

      setOptimizationResult(res);
    } catch (err: any) {
      setOptimizationResult(null);
      setOptError(err.message || 'تعذر حساب التركيبة العلفية');
    }
  };

  const handleSaveAsFormula = async () => {
    if (!optimizationResult) return;

    try {
      await createFeedFormula({
        name: `خلطة ${selectedTarget.name} - ${customProtein}% بروتين`,
        targetSector: selectedTarget.sector,
        description: `تركيبة علفية اقتصادية TMR محسوبة آلياً بتكلفة ${optimizationResult.costPerTon} د.ل/طن`,
        items: optimizationResult.items.map(i => ({
          ingredientId: i.ingredientId,
          percentage: i.percentage,
        })),
      });

      setFormulaSaveSuccess(true);
      loadAllData();
    } catch (error: any) {
      setFormulaSaveSuccess(false);
      setOptError(error.message || 'تعذر حفظ الخلطة العلفية');
    }
  };

  // Warehouse Calculations
  const totalStockKg = Money.sum(...stock.map(item => item.currentStock));
  const totalStockTons = Money.round(Money.div(totalStockKg, 1000), 1);
  const totalInventoryValue = Money.round(Money.sum(...stock.map(item => Money.mul(item.currentStock, item.costPerUnit))), 0);
  const lowStockCount = stock.filter(item => Number(item.currentStock) <= Number(item.minStockAlert)).length;
  const distributedQuantityKg = Money.sum(...distributions.map(item => item.quantityKg));
  const distributedCost = Money.sum(...distributions.map(item => item.totalCost));
  const averageDistributedCostPerTon = distributedQuantityKg > 0
    ? Money.mul(Money.div(distributedCost, distributedQuantityKg), 1000)
    : null;

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wheat className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            إدارة الأعلاف وتركيب العلائق بأقل تكلفة (Nutrition & TMR)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">محرك تركيب العلائق الاقتصادية، إدارة مخازن الخامات، وصرف الوجبات للحظائر</p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setIsDispenseOpen(true)}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-purple-900/30"
          >
            <Truck className="w-4 h-4" />
            صرف وجبة للحظيرة
          </button>
          <button
            onClick={() => setIsAddIngredientOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-amber-900/30"
          >
            <Plus className="w-4 h-4" />
            إضافة مادة علفية
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">إجمالي المخزون بالمستودع</span>
            <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <Archive className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalStockTons}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">طن أعلاف</span>
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-bold">يكفي لاستهلاك 35 يوماً للقطيع</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">القيمة المالية للمخزون</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">{formatMoney(totalInventoryValue)}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">تسعير المتوسط المرجح للتكلفة (Weighted Average Cost)</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">متوسط تكلفة طن العليقة TMR</span>
            <div className="p-2 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{averageDistributedCostPerTon == null ? 'غير متاح' : formatMoney(averageDistributedCostPerTon)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ طن</span>
          </div>
          <p className="text-[11px] text-purple-700 dark:text-purple-400 mt-2 font-bold">محسوب من عمليات الصرف المسجلة فعلياً</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">تنبيهات حد الأمان للمخازن</span>
            <div className={`p-2 rounded-xl ${lowStockCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">نواقص تحت الطلب</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            {lowStockCount > 0 ? 'يرجى إصدار أوامر شراء للخامات' : 'كافة الخامات في الحدود الآمنة'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
        <button
          onClick={() => setActiveTab('optimizer')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'optimizer' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          محرك تركيب العليقة بأقل تكلفة (Least-Cost TMR)
        </button>

        <button
          onClick={() => setActiveTab('warehouse')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'warehouse' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Wheat className="w-4 h-4" />
          مستودع خامات الأعلاف واستلام الشحنات ({stock.length})
        </button>

        <button
          onClick={() => setActiveTab('formulas')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'formulas' 
              ? 'border-amber-500 text-amber-600 dark:text-amber-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          الخلطات المعتمدة وسجل صرف الحظائر ({formulas.length})
        </button>
      </div>

      {/* Tab 1: Least-Cost Optimizer */}
      {activeTab === 'optimizer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Formulator Settings */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                تحديد المعايير والاحتياجات الغذائية للخلطة
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">اختر الفئة الإنتاجية أو أدخل نسبة البروتين المستهدفة وحجم خلطة الـ TMR</p>
            </div>

            {/* Target Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">القطاع والهدف الإنتاجي:</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_TARGETS.map(preset => {
                  const isSelected = selectedTarget.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedTarget(preset);
                        setCustomProtein(preset.protein);
                      }}
                      className={`p-3 rounded-2xl border text-right transition ${
                        isSelected 
                          ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-950/40' 
                          : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{preset.name}</div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                        {preset.protein}% بروتين • {preset.energy} Mcal
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Protein & Batch Total Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  نسبة البروتين الخام المستهدفة (CP %)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={customProtein}
                  onChange={e => setCustomProtein(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-lg font-black text-amber-600 dark:text-amber-400 focus:outline-none transition shadow-inner"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  سعة خلاط الأعلاف / حجم الخلطة (كجم)
                </label>
                <input
                  type="number"
                  step="500"
                  value={batchTotalKg}
                  onChange={e => setBatchTotalKg(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:outline-none transition shadow-inner"
                />
              </div>
            </div>

            {/* Ingredients Availability Checklist */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  الخامات المتاحة للإدخال في معادلة التحسين:
                </label>
                <span className="text-[11px] text-slate-500">تم تحديد الخامات ذات الأرصدة المتوفرة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stock.map(item => {
                  const isChecked = !!selectedIngredients[item.id];
                  const hasStock = Number(item.currentStock) > 0;
                  return (
                    <label
                      key={item.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                        isChecked 
                          ? 'bg-slate-50/80 dark:bg-slate-950/80 border-amber-500/50 text-slate-900 dark:text-white' 
                          : 'bg-slate-50/30 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800/80 text-slate-500'
                      } ${!hasStock ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!hasStock}
                          onChange={e => setSelectedIngredients(prev => ({ ...prev, [item.id]: e.target.checked }))}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                        />
                        <div>
                          <div className="font-bold text-xs">{item.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            بروتين: <strong className="text-amber-600 dark:text-amber-400">{item.proteinPct}%</strong> • رصيد: {Number(item.currentStock).toLocaleString()} كجم
                          </div>
                        </div>
                      </div>

                      <div className="text-left font-bold text-xs text-emerald-700 dark:text-emerald-400">
                        {formatMoney(item.costPerUnit, true, 3)}/كجم
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {optError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{optError}</span>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={handleOptimize}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-amber-900/40"
            >
              <Sparkles className="w-5 h-5" />
              تشغيل خوارزمية التحسين وحساب أرخص خلطة (Least-Cost Optimization)
            </button>
          </div>

          {/* Right 1 Col: Optimization Result Breakdown */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  نتيجة التركيبة المحسوبة TMR
                </h3>
                {optimizationResult && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                    أرخص تكلفة
                  </span>
                )}
              </div>

              {optimizationResult ? (
                <div className="space-y-5">
                  {/* Economics Summary Card */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">تكلفة طن الخلطة:</span>
                      <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatMoney(optimizationResult.costPerTon)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
                      <span>إجمالي خلطة الخلاط ({formatNumber(optimizationResult.batchTotalKg)} كجم):</span>
                      <strong className="text-slate-900 dark:text-white font-bold">{formatMoney(optimizationResult.totalCost)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>البروتين المحقق:</span>
                      <strong className="text-amber-600 dark:text-amber-400 font-bold">{optimizationResult.actualProteinPct}% CP</strong>
                    </div>
                  </div>

                  {/* Batch Weight Breakdown Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">أوزان الإضافة في خلاط الـ TMR:</span>
                    <div className="space-y-2">
                      {optimizationResult.items.map(item => (
                        <div key={item.ingredientId} className="p-3 bg-slate-50/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <strong className="text-slate-900 dark:text-white block">{item.name}</strong>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{item.percentage}% من الخلطة</span>
                          </div>
                          <div className="text-left">
                            <span className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">{formatNumber(item.weightKg)} كجم</span>
                            <span className="text-[10px] text-slate-500 block">({formatMoney(item.cost)})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Save as Formula Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleSaveAsFormula}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 transition"
                    >
                      <Save className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      حفظ الخلطة في سجل التركيبات المعتمدة
                    </button>
                    {formulaSaveSuccess && (
                      <p className="text-emerald-700 dark:text-emerald-400 text-[11px] text-center mt-2 font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تم حفظ الخلطة بنجاح!
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center text-slate-500 text-xs space-y-2">
                  <Calculator className="w-8 h-8 mx-auto text-slate-600" />
                  <p>اضغط على زر (تشغيل خوارزمية التحسين) لعرض تفاصيل وأوزان الخلطة وتكلفتها للطن.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ingredients Warehouse */}
      {activeTab === 'warehouse' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">مستودع خامات ومكونات الأعلاف</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">متابعة أرصدة المخزون، أسعار الشراء، وتوريد الشحنات الجديدة</p>
            </div>
            <button
              onClick={() => setIsAddIngredientOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              إضافة مادة
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                  <th className="pb-3 px-3">اسم المادة العلفية</th>
                  <th className="pb-3 px-3">الرصيد الحالي</th>
                  <th className="pb-3 px-3">سعر الشراء (د.ل/كجم)</th>
                  <th className="pb-3 px-3">القيمة الإجمالية</th>
                  <th className="pb-3 px-3">التحليل الغذائي</th>
                  <th className="pb-3 px-3">حالة الأمان</th>
                  <th className="pb-3 px-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                {stock.map(item => {
                  const isLow = Number(item.currentStock) <= Number(item.minStockAlert);
                  const totalVal = Number(item.currentStock) * Number(item.costPerUnit);
                  return (
                    <tr key={item.id} className="hover:bg-slate-100/40 dark:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white text-sm">{item.name}</td>
                      <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">{formatNumber(item.currentStock)} كجم</td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">{formatMoney(item.costPerUnit, true, 3)}</td>
                      <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">{formatMoney(totalVal)}</td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                        <span>{item.proteinPct}% بروتين • {item.energyMcal} Mcal</span>
                      </td>
                      <td className="py-3 px-3">
                        {isLow ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" />
                            طلب توريد
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 w-fit">
                            متوفر آمن
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-left">
                        <button
                          onClick={() => {
                            setSelectedIngredientForReceive(item);
                            setIsReceiveBatchOpen(true);
                          }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          استلام شحنة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Saved Formulas & Distribution Logs */}
      {activeTab === 'formulas' && (
        <div className="space-y-6">
          {/* Formulas Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formulas.map(formula => (
              <div key={formula.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{formula.name}</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-400">
                    {formula.targetSector === 'DAIRY' ? 'أبقار حلب' : 'تسمين'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">{formula.description || 'تركيبة علفية TMR معتمدة'}</p>

                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">المكونات ونسب الخلط:</span>
                  {formula.items?.map(item => (
                    <div key={item.id} className="flex justify-between p-2 bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-slate-700 dark:text-slate-300">{item.ingredient?.name || 'مادة علفية'}</span>
                      <strong className="text-amber-600 dark:text-amber-400 font-bold">{item.percentage}%</strong>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => setIsDispenseOpen(true)}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 flex items-center justify-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    صرف هذه الخلطة للحظيرة
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Distribution History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">سجل آخر حركات صرف الأعلاف للحظائر</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                    <th className="pb-3 px-3">التاريخ</th>
                    <th className="pb-3 px-3">الحظيرة المستلمة</th>
                    <th className="pb-3 px-3">الخلطة المصروفة</th>
                    <th className="pb-3 px-3">الكمية الإجمالية</th>
                    <th className="pb-3 px-3">التكلفة المحاسبية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
                  {distributions.length > 0 ? (
                    distributions.map(d => (
                      <tr key={d.id} className="hover:bg-slate-100/40 dark:bg-slate-800/40 transition">
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{formatDate(d.dispenseDate)}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{d.barn?.name || 'حظيرة غير متاحة'}</td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{d.formula?.name || 'خلطة غير متاحة'}</td>
                        <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">{formatNumber(d.quantityKg)} كجم</td>
                        <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">{formatMoney(d.totalCost)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-500">لا توجد عمليات صرف أعلاف مسجلة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddFeedIngredientModal
        isOpen={isAddIngredientOpen}
        onClose={() => setIsAddIngredientOpen(false)}
        onSuccess={loadAllData}
      />

      <ReceiveFeedBatchModal
        isOpen={isReceiveBatchOpen}
        onClose={() => setIsReceiveBatchOpen(false)}
        onSuccess={loadAllData}
        ingredient={selectedIngredientForReceive}
      />

      <DispenseFeedModal
        isOpen={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        onSuccess={loadAllData}
        formulas={formulas}
      />
    </div>
  );
};


