import React, { useState, useEffect } from 'react';
import { 
  X, 
  Tag, 
  Milk, 
  Scale, 
  Calendar, 
  HeartPulse, 
  ShieldAlert, 
  Layers, 
  Activity, 
  TrendingUp, 
  History 
} from 'lucide-react';
import { Animal } from '../api/types';
import { getAnimalById } from '../api/client';

interface Props {
  animalId: string | null;
  onClose: () => void;
}

export const AnimalProfileModal: React.FC<Props> = ({ animalId, onClose }) => {
  const [animal, setAnimal] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'milking' | 'breeding' | 'health' | 'growth'>('overview');

  useEffect(() => {
    if (!animalId) return;

    setLoading(true);
    setError(null);
    getAnimalById(animalId)
      .then(res => setAnimal(res))
      .catch((requestError: any) => {
        setAnimal(null);
        setError(requestError.message || 'تعذر تحميل ملف الحيوان');
      })
      .finally(() => setLoading(false));
  }, [animalId]);

  if (!animalId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {error && <div className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-lg shadow-inner">
              #{animal?.tagNumber || '...'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">{animal?.name || `رأس #${animal?.tagNumber}`}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {animal?.currentLifeStage || 'نشط'}
                </span>
                {animal?.withdrawalEndDate && new Date(animal.withdrawalEndDate) > new Date() && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    فترة تحريم نشطة
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{animal?.breed} • RFID: {animal?.rfidTag || 'غير مربوط'}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 flex gap-2 bg-slate-950/30 shrink-0 overflow-x-auto">
          {[
            { id: 'overview', label: 'نظرة عامة والنسب', icon: Layers },
            { id: 'milking', label: 'سجل الحلب والإنتاج', icon: Milk },
            { id: 'breeding', label: 'التناسل والولادات', icon: Calendar },
            { id: 'health', label: 'السجل البيطري والصحي', icon: HeartPulse },
            { id: 'growth', label: 'منحنى الوزن والنمو', icon: Scale },
          ].map(t => {
            const Icon = t.icon;
            const active = activeSubTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id as any)}
                className={`py-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  active ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeSubTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1">النوع والفصيلة</span>
                  <span className="font-bold text-white text-sm">{animal?.species === 'CATTLE' ? 'أبقار' : animal?.species}</span>
                </div>
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1">الجنس والغرض</span>
                  <span className="font-bold text-white text-sm">{animal?.gender === 'FEMALE' ? 'أنثى' : 'ذكر'} ({animal?.purpose})</span>
                </div>
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1">الوزن الحالي</span>
                  <span className="font-bold text-emerald-400 text-sm">{animal?.entryWeightKg != null ? `${animal.entryWeightKg} كجم` : 'غير مسجل'}</span>
                </div>
                <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                  <span className="text-slate-400 block mb-1">الحظيرة / العنبر</span>
                  <span className="font-bold text-white text-sm">{animal?.barn?.name || 'غير مرتبط بعنبر'}</span>
                </div>
              </div>

              {/* Genealogy & Pedigree Card */}
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  شجرة النسب والبيانات الوراثية (Pedigree)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                    <span className="text-slate-400 block text-[11px]">الأم (Dam):</span>
                    <span className="font-bold text-white">{animal?.mother?.tagNumber || animal?.motherTag ? `قرط #${animal?.mother?.tagNumber || animal?.motherTag}` : 'غير مسجلة'}</span>
                  </div>
                  <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                    <span className="text-slate-400 block text-[11px]">الأب / قشة التلقيح (Sire):</span>
                    <span className="font-bold text-white">{animal?.fatherSemenCode || 'غير مسجل'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'milking' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">سجل آخر الحلبات المسجلة</h4>
                <span className="text-emerald-400 font-bold">متوسط الإنتاج: 28.5 لتر/يوم</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2.5 px-3">التاريخ</th>
                      <th className="py-2.5 px-3">الوردية</th>
                      <th className="py-2.5 px-3">الكمية (لتر)</th>
                      <th className="py-2.5 px-3">نسبة الدهن %</th>
                      <th className="py-2.5 px-3">حالة الحليب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {animal?.milkLogs?.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{log.logDate}</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.shift === 'MORNING' ? 'صباحية' : 'مسائية'}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">{log.yieldLiters} لتر</td>
                        <td className="py-2.5 px-3 text-slate-300">{log.fatPct == null ? 'غير مقاس' : `${log.fatPct}%`}</td>
                        <td className="py-2.5 px-3">
                          {log.isDiscarded ? (
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold">مستبعد (علاج)</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">معتمد للخزان</span>
                          )}
                        </td>
                      </tr>
                    )) || <tr><td colSpan={5} className="text-center py-4 text-slate-500">لا توجد حلبات مسجلة</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSubTab === 'breeding' && (
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm">سجل التلقيح والفحص التناسلي</h4>
              <div className="space-y-3">
                {animal?.breedingRecords?.map((rec: any) => (
                  <div key={rec.id} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">تلقيح بتاريخ: {rec.inseminationDate}</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        {rec.pdResult === 'PREGNANT' ? 'عشار مؤكد (Pregnant)' : rec.pdResult}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <div>قشة التلقيح: <span className="text-white font-semibold">{rec.semenCode || 'غير مسجلة'}</span></div>
                      <div>موعد التجفيف: <span className="text-amber-400 font-semibold">{rec.expectedDryoffDate || 'غير محدد'}</span></div>
                      <div>الولادة المتوقعة: <span className="text-emerald-400 font-semibold">{rec.expectedCalvingDate || 'غير محدد'}</span></div>
                    </div>
                  </div>
                )) || <div className="text-center py-4 text-slate-500">لا توجد سجلات تناسلية</div>}
              </div>
            </div>
          )}

          {activeSubTab === 'health' && (
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm">السجل الطبي وصمام الأمان البيطري</h4>
              <div className="space-y-3">
                {animal?.healthTreatments?.map((t: any) => (
                  <div key={t.id} className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-red-400 flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4" />
                        {t.diagnosis}
                      </span>
                      <span className="text-slate-400">{t.treatmentDate}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <div>الدواء: <span className="text-white font-semibold">{t.drugName}</span></div>
                      <div>فترة تحريم الحليب: <span className="text-red-400 font-bold">{t.milkWithdrawalDays ?? 0} أيام</span></div>
                      <div>تاريخ انتهاء الحظر: <span className="text-amber-400 font-bold">{t.withdrawalEndDate}</span></div>
                    </div>
                    {t.treatedBy && <div className="text-[10px] text-slate-500">المعالج: {t.treatedBy}</div>}
                  </div>
                )) || <div className="text-center py-4 text-slate-500">السجل البيطري سليم، لا توجد علاجات</div>}
              </div>
            </div>
          )}

          {activeSubTab === 'growth' && (
            <div className="space-y-4">
              <h4 className="font-bold text-white text-sm">سجل الأوزان والزيادة اليومية (ADG)</h4>
              <div className="space-y-2">
                {animal?.weightLogs?.map((w: any) => (
                  <div key={w.id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Scale className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-white">{w.weightKg} كجم</span>
                        <span className="text-slate-400 text-[10px] block">{w.weighDate}</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-emerald-400 font-bold">{w.dailyGainAdg == null ? 'غير متاح' : `+${w.dailyGainAdg} كجم/يوم`}</span>
                      <span className="text-slate-500 text-[10px] block">معدل الزيادة ADG</span>
                    </div>
                  </div>
                )) || <div className="text-center py-4 text-slate-500">لا توجد أوزان دورية مسجلة</div>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
