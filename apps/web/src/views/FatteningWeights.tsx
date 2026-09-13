import React, { useState, useEffect } from 'react';
import { Scale, Plus } from 'lucide-react';
import { AddWeightModal } from '../components/AddWeightModal';
import { getFatteningPerformance } from '../api/client';
import { formatNumber } from '../utils/money.util';
import type { FatteningPerformance } from '../api/types';

interface FatteningAnimal {
  id: string;
  tagNumber: string;
  breed: string;
  barn: string;
  entryWeight: number | null;
  currentWeight: number | null;
  adgKg: number | null;
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_CHECK' | 'NO_DATA';
}

export const FatteningWeights: React.FC = () => {
  const [data, setData] = useState<FatteningAnimal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddWeightOpen, setIsAddWeightOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [selectedWeight, setSelectedWeight] = useState<number | undefined>(undefined);
  const [scaleFeedback, setScaleFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getFatteningPerformance();
      if (Array.isArray(res)) {
        setData(res.map((item: FatteningPerformance) => {
          const adg = item.adgKgPerDay == null ? null : Number(item.adgKgPerDay);
          let status: FatteningAnimal['status'] = 'NO_DATA';
          if (adg != null) {
            status = adg >= 1.4 ? 'EXCELLENT' : adg < 0.9 ? 'NEEDS_CHECK' : 'GOOD';
          }

          return {
            id: item.id,
            tagNumber: item.tagNumber,
            breed: item.breed || 'غير محدد',
            barn: item.barn || 'غير مرتبط بعنبر',
            entryWeight: item.entryWeightKg == null ? null : Number(item.entryWeightKg),
            currentWeight: item.currentWeightKg == null ? null : Number(item.currentWeightKg),
            adgKg: adg,
            status,
          };
        }));
      }
    } catch (error: any) {
      setData([]);
      setLoadError(error.message || 'تعذر تحميل بيانات التسمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReadElectronicScale = async (animalTag?: string) => {
    if ((window as any).electronAPI?.readSerialScale) {
      try {
        const res = await (window as any).electronAPI.readSerialScale();
        if (res?.weightKg) {
          setSelectedTag(animalTag);
          setSelectedWeight(Number(res.weightKg));
          setIsAddWeightOpen(true);
        }
      } catch (err) {
        console.error('Scale error:', err);
      }
    } else {
      setSelectedTag(animalTag);
      setSelectedWeight(undefined);
      setIsAddWeightOpen(true);
    }
  };

  const animalsWithAdg = data.filter(animal => animal.adgKg != null);
  const averageAdg = animalsWithAdg.length
    ? animalsWithAdg.reduce((sum, animal) => sum + (animal.adgKg ?? 0), 0) / animalsWithAdg.length
    : null;
  const readyForSale = data.filter(animal => (animal.currentWeight ?? 0) >= 480).length;

  return (
    <div className="space-y-6">
      {loadError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-purple-700 dark:text-purple-400" />
            متابعة أوزان التسمين ومعدل التحويل الغذائي (ADG & FCR)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">حساب فوري لمعدل النمو اليومي ومؤشرات كفاءة استهلاك العلف وجاهزية البيع</p>
        </div>

        <button 
          onClick={() => handleReadElectronicScale()}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition self-start md:self-auto shadow-lg shadow-purple-900/30"
        >
          <Plus className="w-4 h-4" />
          تسجيل وزن جديد (أو قراءة من الميزان)
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">متوسط الزيادة اليومية للقطيع (ADG)</span>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1 flex items-baseline gap-2">
            <span>{averageAdg == null ? 'غير متاح' : `${formatNumber(averageAdg, 2)} كجم / يوم`}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">محسوب من الحيوانات التي لديها وزنان مؤرخان على الأقل</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">متوسط معامل التحويل الغذائي (FCR)</span>
          <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 mt-1">
            غير متاح
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">يتطلب ربط استهلاك العلف بالحيوان أو مجموعة التسمين</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">جاهزية البيع والذبح (وزن &gt; 480 كجم)</span>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
            {formatNumber(readyForSale)} <span className="text-xs text-slate-500 dark:text-slate-400">رأس جاهزة</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">يعتمد على أحدث وزن مسجل لكل حيوان</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">سجل أوزان دفعات وعجول التسمين</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                <th className="pb-3 px-3">رقم القرط</th>
                <th className="pb-3 px-3">السلالة والعنبر</th>
                <th className="pb-3 px-3">وزن الدخول</th>
                <th className="pb-3 px-3">الوزن الحالي</th>
                <th className="pb-3 px-3">الزيادة اليومية (ADG)</th>
                <th className="pb-3 px-3">معامل التحويل (FCR)</th>
                <th className="pb-3 px-3">التقييم</th>
                <th className="pb-3 px-3 text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
              {data.map(row => (
                <tr key={row.id} className="hover:bg-slate-100/40 dark:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-mono font-extrabold text-slate-900 dark:text-white text-sm">#{row.tagNumber}</td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800 dark:text-slate-200 block">{row.breed}</span>
                    <span className="text-[10px] text-slate-500">{row.barn}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{row.entryWeight == null ? 'غير مسجل' : `${row.entryWeight} كجم`}</td>
                  <td className="py-3 px-3 font-bold text-purple-700 dark:text-purple-400">{row.currentWeight == null ? 'غير مسجل' : `${row.currentWeight} كجم`}</td>
                  <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">{row.adgKg == null ? 'غير متاح' : `+${formatNumber(row.adgKg, 2)} كجم/يوم`}</td>
                  <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">غير متاح</td>
                  <td className="py-3 px-3">
                    {row.status === 'EXCELLENT' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                        نمو مثالي
                      </span>
                    )}
                    {row.status === 'GOOD' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
                        جيد جداً
                      </span>
                    )}
                    {row.status === 'NEEDS_CHECK' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400">
                        بطيء النمو (فحص بيطري)
                      </span>
                    )}
                    {row.status === 'NO_DATA' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 border border-slate-500/30 text-slate-500 dark:text-slate-400">
                        بيانات غير كافية
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-left">
                    <button
                      onClick={() => handleReadElectronicScale(row.tagNumber)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-[11px] transition border border-slate-300 dark:border-slate-700"
                    >
                      وزن جديد
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Weight Modal */}
      <AddWeightModal
        isOpen={isAddWeightOpen}
        onClose={() => setIsAddWeightOpen(false)}
        onSuccess={loadData}
        defaultTagNumber={selectedTag}
        defaultWeight={selectedWeight}
      />
    </div>
  );
};
