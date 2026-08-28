import React, { useEffect, useState } from 'react';
import { X, Scale, Sparkles, TrendingUp } from 'lucide-react';
import { recordWeight } from '../api/client';

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

  useEffect(() => {
    if (isOpen) {
      setAnimalTag(defaultTagNumber ?? '');
      setWeightKg(defaultWeight ?? '');
      setError(null);
    }
  }, [isOpen, defaultTagNumber, defaultWeight]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalTag.trim()) {
      setError('يرجى تحديد رقم قرط الحيوان');
      return;
    }
    if (!weightKg || weightKg <= 0) {
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تسجيل وزن جديد ومعدل التحويل</h3>
              <p className="text-xs text-slate-400">حساب الزيادة اليومية (ADG) والـ FCR آلياً</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">رقم قرط الحيوان *</label>
            <input
              type="text"
              required
              value={animalTag}
              onChange={e => setAnimalTag(e.target.value)}
              placeholder="مثال: 2001"
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">تاريخ الوزن *</label>
            <input
              type="date"
              required
              value={weighDate}
              onChange={e => setWeighDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>الوزن المقروء (كجم) *</span>
              <span className="text-purple-400 text-[11px] font-bold">من الميزان الإلكتروني</span>
            </label>
            <input
              type="number"
              step="0.1"
              required
              value={weightKg}
              onChange={e => setWeightKg(Number(e.target.value))}
              placeholder="480.5"
              className="w-full bg-slate-950 border border-purple-500/40 focus:border-purple-500 rounded-xl px-3.5 py-3 text-lg font-extrabold text-purple-300 focus:outline-none transition"
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
