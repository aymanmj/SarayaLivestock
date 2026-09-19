import React, { useState } from 'react';
import { X, Calendar, Activity, Sparkles, User } from 'lucide-react';
import { InseminationType } from '../api/types';
import { recordInsemination } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultTagNumber?: string;
}

export const AddInseminationModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, defaultTagNumber }) => {
  const [animalTag, setAnimalTag] = useState(defaultTagNumber || '');
  const [inseminationDate, setInseminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [inseminationType, setInseminationType] = useState<InseminationType>('ARTIFICIAL');
  const [semenStrawCode, setSemenStrawCode] = useState('');
  const [sireName, setSireName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animalTag.trim()) {
      setError('يرجى إدخال رقم قرط الأنثى الملقحة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await recordInsemination({
        animalId: animalTag.trim(),
        inseminationDate: new Date(inseminationDate).toISOString(),
        inseminationType,
        semenStrawCode: semenStrawCode.trim(),
        sireName: sireName.trim(),
        technicianName: technicianName.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ سجل التلقيح');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تسجيل عملية تلقيح جديدة</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">حساب موعد السونار (35 يوماً) والتجفيف والولادة تلقائياً</p>
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
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رقم قرط البقرة / النعجة *</label>
            <input
              type="text"
              required
              value={animalTag}
              onChange={e => setAnimalTag(e.target.value)}
              placeholder="مثال: 1015"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">تاريخ التلقيح *</label>
              <input
                type="date"
                dir="ltr"
                lang="en-CA"
                required
                value={inseminationDate}
                onChange={e => setInseminationDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition text-right font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">نوع التلقيح</label>
              <select
                value={inseminationType}
                onChange={e => setInseminationType(e.target.value as InseminationType)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="ARTIFICIAL">اصطناعي (قشات سائل منوي)</option>
                <option value="NATURAL">طبيعي (فحل المزرعة)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رمز قشة السائل المنوي (Straw Code)</label>
            <input
              type="text"
              value={semenStrawCode}
              onChange={e => setSemenStrawCode(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">الفني / الطبيب القائم بالتلقيح</label>
            <input
              type="text"
              value={technicianName}
              onChange={e => setTechnicianName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
            />
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
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ عملية التلقيح والجدولة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
