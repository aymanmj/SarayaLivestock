import React, { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { 
  Milk, 
  AlertTriangle, 
  TrendingUp, 
  HeartPulse, 
  Calendar, 
  ShieldAlert, 
  Scale, 
  Activity, 
  RefreshCw, 
  Plus, 
  ArrowUpRight 
} from 'lucide-react';
import { getDashboardData } from '../api/client';
import { DashboardData } from '../api/types';
import { AddAnimalModal } from '../components/AddAnimalModal';
import { AddTreatmentModal } from '../components/AddTreatmentModal';
import { AddWeightModal } from '../components/AddWeightModal';
import { formatMoney, formatNumber, OFFICIAL_CURRENCY } from '../utils/money.util';

export const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddAnimalOpen, setIsAddAnimalOpen] = useState(false);
  const [isTreatmentOpen, setIsTreatmentOpen] = useState(false);
  const [isWeightOpen, setIsWeightOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getDashboardData();
      setData(res);
    } catch (error: any) {
      setData(null);
      setLoadError(error.message || 'تعذر تحميل مؤشرات لوحة القيادة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kpis = data?.kpis || {
    totalAnimals: 0,
    lactatingCows: 0,
    fatteningAnimals: 0,
    quarantineCount: 0,
    milk: { total: 0, usable: 0, wasted: 0, cowsMilked: 0, avgPerCow: '0' },
  };

  const alerts = data?.alerts || {
    quarantineActive: 0,
    pendingPdChecks: 0,
    pendingDryOffs: 0,
    upcomingCalvings: 0,
  };

  return (
    <div className="space-y-6">
      {loadError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            لوحة القيادة التنفيذية ومؤشرات المزرعة
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">متابعة فورية للإنتاجية، صحة القطيع، ودورات الحلب والتسمين</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-700 dark:text-emerald-400' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => setIsAddAnimalOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            تسجيل رأس جديد
          </button>
        </div>
      </div>

      {/* Top Banner Alert (Health Withdrawal Safety Lock) */}
      {alerts.quarantineActive > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-red-300 font-bold text-sm">
                صمام الأمان الصحي نشط: توجد ({alerts.quarantineActive}) أبقار تحت فترة تحريم الحليب
              </h4>
              <p className="text-red-400/80 text-xs">
                يمنع خلط حليب الأبقار المعالجة في الخزان العام لحماية الشحنة من التلف أو الرفض.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setIsTreatmentOpen(true)}
              className="px-3.5 py-2 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:bg-slate-800 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition"
            >
              + إضافة علاج
            </button>
            <button 
              onClick={() => navigate({ to: '/milking' })}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-slate-900 dark:text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-900/30"
            >
              محطة الحلب وقائمة الحظر
            </button>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Herd */}
        <div 
          onClick={() => navigate({ to: '/animals' })}
          className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-500/50 rounded-2xl p-5 shadow-lg cursor-pointer transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">إجمالي القطيع بالمزرعة</span>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{kpis.totalAnimals}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">رأس</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
            <span className="bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">{kpis.lactatingCows} حلابة</span>
            <span className="bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">{kpis.fatteningAnimals} تسمين</span>
            <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
              {kpis.totalAnimals - (kpis.lactatingCows + kpis.fatteningAnimals)} عشار/جاف
            </span>
          </div>
        </div>

        {/* Card 2: Today's Milk */}
        <div 
          onClick={() => navigate({ to: '/milking' })}
          className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-blue-500/50 rounded-2xl p-5 shadow-lg cursor-pointer transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">إنتاج الحليب اليومي</span>
            <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-500/20 transition">
              <Milk className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{kpis.milk.total.toLocaleString()}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">لتر</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">المتوسط: <strong className="text-blue-600 dark:text-blue-400">{kpis.milk.avgPerCow} لتر/بقرة</strong></span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5">
              +4.2% مقارنة بأمس
            </span>
          </div>
        </div>

        {/* Card 3: Fattening ADG */}
        <div 
          onClick={() => navigate({ to: '/fattening' })}
          className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 hover:border-purple-500/50 rounded-2xl p-5 shadow-lg cursor-pointer transition group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">معدل الزيادة اليومية (ADG)</span>
            <div className="p-2 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-xl group-hover:bg-purple-500/20 transition">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">1.48</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">كجم / يوم</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">معامل التحويل FCR: <strong className="text-purple-700 dark:text-purple-400">5.8</strong></span>
            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 rounded font-bold">ممتاز</span>
          </div>
        </div>

        {/* Card 4: Estimated Feed Cost */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">تكلفة لتر الحليب التقديرية</span>
            <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatMoney(2.05, true, 3)}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ لتر</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">سعر البيع: {formatMoney(3.5, true, 2)}</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">هامش 41.4%</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Biological Calendar & Quick Field Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Biological Tasks Due */}
        <div className="lg:col-span-2 bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              المهام البيولوجية والتناسلية المستحقة اليوم
            </h3>
            <button 
              onClick={() => navigate({ to: '/breeding' })}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
            >
              عرض جدول التناسل بالكامل
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Task 1: PD Check */}
            <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">فحص حمل بالسونار (PD Check) مستحق لـ {alerts.pendingPdChecks} أبقار</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">تجاوزت 35 يوماً من تاريخ التلقيح (#1014، #1028، #1055...)</p>
                </div>
              </div>
              <button 
                onClick={() => navigate({ to: '/breeding' })}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg transition"
              >
                مستحق اليوم
              </button>
            </div>

            {/* Task 2: Dry-off */}
            <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">موعد تجفيف آلي (Dry-Off) لـ {alerts.pendingDryOffs} أبقار</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">متبقي 60 يوماً على الولادة المتوقعة (#1007، #1089)</p>
                </div>
              </div>
              <button 
                onClick={() => navigate({ to: '/breeding' })}
                className="px-3 py-1.5 bg-amber-100 dark:bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg transition"
              >
                نقل للحظيرة الجافة
              </button>
            </div>

            {/* Task 3: Calving */}
            <div className="p-4 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">ولادات متوقعة خلال 48 ساعة ({alerts.upcomingCalvings} بقرة)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">البقرة #1033 في حظيرة الولادة المجهزة</p>
                </div>
              </div>
              <button 
                onClick={() => navigate({ to: '/breeding' })}
                className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-lg transition"
              >
                جاهزة للولادة
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Quick Actions Panel */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">إجراءات الميدان السريعة</h3>
            <div className="space-y-3">
              <button 
                onClick={() => navigate({ to: '/milking' })}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-900/30"
              >
                <Milk className="w-4 h-4" />
                بدء وردية الحلب السريعة
              </button>

              <button 
                onClick={() => setIsWeightOpen(true)}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-300 dark:border-slate-700"
              >
                <Scale className="w-4 h-4 text-purple-700 dark:text-purple-400" />
                تسجيل وزن دفعة تسمين
              </button>

              <button 
                onClick={() => setIsAddAnimalOpen(true)}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-300 dark:border-slate-700"
              >
                <Plus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                تسجيل حيوان أو مولود جديد
              </button>

              <button 
                onClick={() => setIsTreatmentOpen(true)}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-300 dark:border-slate-700"
              >
                <HeartPulse className="w-4 h-4 text-red-400" />
                تسجيل علاج بيطري وصمام تحريم
              </button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>حالة السيرفر: <strong className="text-emerald-700 dark:text-emerald-400">متصل (LAN)</strong></span>
            <span>النسخ الاحتياطي: <strong className="text-slate-500 dark:text-slate-400">تلقائي</strong></span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddAnimalModal
        isOpen={isAddAnimalOpen}
        onClose={() => setIsAddAnimalOpen(false)}
        onSuccess={loadData}
      />

      <AddTreatmentModal
        isOpen={isTreatmentOpen}
        onClose={() => setIsTreatmentOpen(false)}
        onSuccess={loadData}
      />

      <AddWeightModal
        isOpen={isWeightOpen}
        onClose={() => setIsWeightOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
