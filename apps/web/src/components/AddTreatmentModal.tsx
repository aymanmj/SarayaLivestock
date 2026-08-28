import React, { useState } from 'react';
import { X, HeartPulse, ShieldAlert, Calendar, UserCheck } from 'lucide-react';
import { recordTreatment } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTagNumber?: string;
}

export const AddTreatmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, defaultTagNumber }) => {
  const [animalTag, setAnimalTag] = useState(defaultTagNumber || '');
  const [diagnosis, setDiagnosis] = useState('التهاب ضرع خفيف (Mastitis Grade 1)');
  const [drugName, setDrugName] = useState('سيفالوسبورين موضعي داخل الحلمة');
  const [dosage, setDosage] = useState('أنبوبة واحدة مرتين يومياً لمدة يومين');
  const [withdrawalDays, setWithdrawalDays] = useState<number>(5);
  const [treatedBy, setTreatedBy] = useState('د. محمود - الطبيب البيطري');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalTag.trim()) {
      setError('يرجى تحديد رقم قرط الحيوان المعالج');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordTreatment({
        animalId: animalTag.trim(),
        diagnosis,
        drugName,
        dosage,
        withdrawalDays: Number(withdrawalDays),
        treatedBy,
        notes,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل العلاج البيطري');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تسجيل تشخيص وعلاج بيطري</h3>
              <p className="text-xs text-slate-400">تفعيل صمام الأمان وتتبع فترة تحريم اللحوم والألبان</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Tag Number */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">رقم قرط الحيوان المصاب *</label>
            <input
              type="text"
              required
              value={animalTag}
              onChange={e => setAnimalTag(e.target.value)}
              placeholder="مثال: 1042"
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">التشخيص الطبي والحالة *</label>
            <input
              type="text"
              required
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="مثال: التهاب ضرع، عرج، حمى"
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          {/* Drug Name & Dosage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">اسم الدواء / المضاد *</label>
              <input
                type="text"
                required
                value={drugName}
                onChange={e => setDrugName(e.target.value)}
                placeholder="أوكسي تتراسيكلين، بنسلين"
                className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">فترة التحريم (أيام) *</label>
              <input
                type="number"
                min="0"
                required
                value={withdrawalDays}
                onChange={e => setWithdrawalDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-red-500/50 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-red-400 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Notice Alert */}
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300 leading-relaxed">
              سيتم قفل حليب هذا الرأس آلياً في محطة الحلب ومنع دخوله للخزان العام لمدة ({withdrawalDays}) أيام لحماية شحنة الحليب من متبقيات الأدوية.
            </p>
          </div>

          {/* Treated By */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">الطبيب البيطري المعالج</label>
            <input
              type="text"
              value={treatedBy}
              onChange={e => setTreatedBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'تثبيت العلاج وتفعيل صمام الأمان'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
