import React, { useEffect, useState } from 'react';
import { X, Scale, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { recordWeight } from '../api/client';
import { useElectronicScale } from '../hooks/useElectronicScale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTagNumber?: string;
  defaultWeight?: number;
}

export const AddWeightModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultTagNumber, 
  defaultWeight 
}) => {
  const [animalTag, setAnimalTag] = useState(defaultTagNumber || '');
  const [weighDate, setWeighDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightKg, setWeightKg] = useState<number | ''>(defaultWeight ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { readScale, reading, scaleError, lastResult, clearStatus } = useElectronicScale();

  useEffect(() => {
    if (isOpen) {
      setAnimalTag(defaultTagNumber ?? '');
      setWeightKg(defaultWeight ?? '');
      setError(null);
      clearStatus();
    }
  }, [isOpen, defaultTagNumber, defaultWeight, clearStatus]);

  if (!isOpen) return null;

  const handleFetchFromScale = async (simulate = false) => {
    const val = await readScale(simulate);
    if (val != null) {
      setWeightKg(val);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalTag.trim()) {
      setError('يرجى تحديد رقم قرط الحيوان');
      return;
    }
    if (!weightKg || Number(weightKg) <= 0) {
      setError('يرجى إدخال وزن صحيح');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordWeight({
        animalId: animalTag.trim(),
        weighDate: new Date(weighDate).toISOString(),
        weightKg: Number(weightKg),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الوزن');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-700 dark:text-purple-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تسجيل وزن جديد ومعدل التحويل</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">حساب الزيادة اليومية (ADG) والـ FCR آلياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رقم قرط الحيوان *</label>
            <input
              type="text"
              required
              value={animalTag}
              onChange={e => setAnimalTag(e.target.value)}
              placeholder="مثال: 2001"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">تاريخ الوزن *</label>
            <input
              type="date"
              dir="ltr"
              lang="en-CA"
              required
              value={weighDate}
              onChange={e => setWeighDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition text-right font-mono"
            />
          </div>

          {/* Weight Section with Scale Integration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300">الوزن المقروء (كجم) *</label>
              <button
                type="button"
                onClick={() => handleFetchFromScale(false)}
                disabled={reading}
                className="px-3 py-1 bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {reading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الاتصال بالميزان...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    <span>قراءة من الميزان اللحظي</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                required
                value={weightKg}
                onChange={e => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="480.5"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-purple-500/40 focus:border-purple-500 rounded-xl px-3.5 py-3 text-lg font-extrabold text-purple-700 dark:text-purple-300 focus:outline-none transition"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                كجم
              </span>
            </div>

            {/* Scale Feedback Notification */}
            {lastResult && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>تم استلام الوزن ({lastResult.weightKg} كجم) {lastResult.isSimulated ? '(محاكاة تجريبية)' : 'من الميزان'}</span>
                </div>
              </div>
            )}

            {scaleError && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[11px] space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{scaleError}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-amber-500/10 text-[10px]">
                  <span className="text-slate-400">يمكنك كتابة الوزن يدوياً أعلاه، أو:</span>
                  <button
                    type="button"
                    onClick={() => handleFetchFromScale(true)}
                    className="text-purple-400 hover:text-purple-300 font-bold underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    تجربة قراءة محاكاة (Demo)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ الوزن وحساب الـ ADG'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
