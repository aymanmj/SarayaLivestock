import React, { useEffect, useState } from 'react';
import { X, Truck, Layers, Building, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { dispenseFeedToBarn, getBarns } from '../api/client';
import { BarnSummary, FeedFormula } from '../api/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  formulas: FeedFormula[];
}

export const DispenseFeedModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, formulas }) => {
  const [barns, setBarns] = useState<BarnSummary[]>([]);
  const [selectedBarnId, setSelectedBarnId] = useState('');
  const [selectedFormulaId, setSelectedFormulaId] = useState(formulas[0]?.id || '');
  const [quantityKg, setQuantityKg] = useState<number>(1200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedFormulaId(formulas[0]?.id || '');
    getBarns()
      .then(result => {
        setBarns(result);
        setSelectedBarnId(result[0]?.id || '');
      })
      .catch((requestError: any) => {
        setBarns([]);
        setSelectedBarnId('');
        setError(requestError.message || 'تعذر تحميل قائمة الحظائر');
      });
  }, [isOpen, formulas]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBarnId || !selectedFormulaId || !quantityKg || quantityKg <= 0) {
      setError('يجب اختيار حظيرة وخلطة معتمدة وإدخال كمية صحيحة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await dispenseFeedToBarn({
        barnId: selectedBarnId,
        formulaId: selectedFormulaId,
        quantityKg: Number(quantityKg),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء صرف العلف للحظيرة');
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
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">صرف وجبة علفية للحظيرة (TMR)</h3>
              <p className="text-xs text-slate-400">خصم آلي من المستودع وترحيل محاسبي لمركز التكلفة</p>
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
            <label className="block font-semibold text-slate-300 mb-1.5">الحظيرة أو العنبر المستلم *</label>
            <select
              value={selectedBarnId}
              onChange={e => setSelectedBarnId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            >
              {barns.map(barn => (
                <option key={barn.id} value={barn.id}>
                  {barn.name} - {barn._count.animals}/{barn.capacity} رأس
                </option>
              ))}
              {barns.length === 0 && <option value="">لا توجد حظائر متاحة</option>}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">الخلطة العلفية المعتمدة (TMR Formula) *</label>
            <select
              value={selectedFormulaId}
              onChange={e => setSelectedFormulaId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            >
              {formulas.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.targetSector})</option>
              ))}
              {formulas.length === 0 && <option value="">لا توجد خلطات معتمدة</option>}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">الكمية المصروفة بالخلاط (كجم) *</label>
            <input
              type="number"
              step="50"
              required
              value={quantityKg}
              onChange={e => setQuantityKg(Number(e.target.value))}
              placeholder="1200"
              className="w-full bg-slate-950 border border-purple-500/40 focus:border-purple-500 rounded-xl px-3.5 py-3 text-lg font-black text-purple-300 focus:outline-none transition"
            />
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1 text-slate-400">
            <div className="flex justify-between">
              <span>حصة الرأس التقريبية:</span>
              <strong className="text-white">{(quantityKg / 80).toFixed(1)} كجم / رأس</strong>
            </div>
            <div className="flex justify-between">
              <span>التكلفة التقديرية للوجبة:</span>
              <strong className="text-emerald-400">{(quantityKg * 0.24).toFixed(2)} $</strong>
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
              disabled={loading || !selectedBarnId || !selectedFormulaId}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الصرف والخصم...' : 'تأكيد الصرف وترحيل القيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
