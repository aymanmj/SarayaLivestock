import React, { useEffect, useState } from 'react';
import { X, ArrowDownRight } from 'lucide-react';
import { updateIngredientStock } from '../api/client';
import { FeedIngredient } from '../api/types';
import { formatMoney } from '../utils/money.util';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ingredient: FeedIngredient | null;
}

export const ReceiveFeedBatchModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, ingredient }) => {
  const [addedKg, setAddedKg] = useState<number | ''>('');
  const [costPerUnit, setCostPerUnit] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ingredient) {
      setAddedKg('');
      setCostPerUnit(Number(ingredient.costPerUnit));
      setError(null);
    }
  }, [isOpen, ingredient]);

  if (!isOpen || !ingredient) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addedKg || addedKg <= 0) {
      setError('يرجى إدخال وزن الشحنة الواردة بشكل صحيح');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateIngredientStock(ingredient.id, {
        addedKg: Number(addedKg),
        costPerUnit: Number(costPerUnit),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تسجيل استلام الشحنة');
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
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">استلام وتوريد شحنة أعلاف</h3>
              <p className="text-xs text-slate-400">{ingredient.name}</p>
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

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex justify-between">
            <span className="text-slate-400">الرصيد المتوفر حالياً:</span>
            <strong className="text-white font-bold">{Number(ingredient.currentStock).toLocaleString()} كجم</strong>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">الكمية المستلمة (كجم) *</label>
            <input
              type="number"
              step="100"
              required
              value={addedKg}
              onChange={e => setAddedKg(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-3 text-lg font-extrabold text-emerald-400 focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">سعر الشراء الجديد (د.ل/كجم)</label>
              <input
                type="number"
                step="0.001"
                required
                value={costPerUnit}
                onChange={e => setCostPerUnit(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">إجمالي فاتورة الشحنة</label>
              <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm font-bold text-emerald-400 flex items-center justify-between">
                <span>{formatMoney(Number(addedKg || 0) * Number(costPerUnit || 0))}</span>
              </div>
            </div>
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
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الاستلام...' : 'تأكيد الاستلام وتغذية الرصيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
