import React, { useState } from 'react';
import { X, Wheat, Plus, DollarSign, Activity, AlertTriangle } from 'lucide-react';
import { createFeedIngredient } from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddFeedIngredientModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('KG');
  const [currentStock, setCurrentStock] = useState<number>(5000);
  const [minStockAlert, setMinStockAlert] = useState<number>(1000);
  const [costPerUnit, setCostPerUnit] = useState<number>(0.35);
  const [proteinPct, setProteinPct] = useState<number>(14.0);
  const [energyMcal, setEnergyMcal] = useState<number>(2.8);
  const [dryMatterPct, setDryMatterPct] = useState<number>(88.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم المادة العلفية');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createFeedIngredient({
        name: name.trim(),
        unit,
        currentStock: Number(currentStock),
        minStockAlert: Number(minStockAlert),
        costPerUnit: Number(costPerUnit),
        proteinPct: Number(proteinPct),
        energyMcal: Number(energyMcal),
        dryMatterPct: Number(dryMatterPct),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة المادة العلفية');
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
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">إضافة مادة علفية جديدة للمستودع</h3>
              <p className="text-xs text-slate-400">تسجيل أسعار الشراء والتحليل الغذائي ونقاط إعادة الطلب</p>
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
            <label className="block font-semibold text-slate-300 mb-1.5">اسم المادة العلفية *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: دريس حجازي نخب أول، نخالة قمح، كسب صويا"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">سعر الكيلوجرام (د.ل) *</label>
              <input
                type="number"
                step="0.001"
                required
                value={costPerUnit}
                onChange={e => setCostPerUnit(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm font-bold text-emerald-400 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">الرصيد الافتتاحي (كجم) *</label>
              <input
                type="number"
                step="100"
                required
                value={currentStock}
                onChange={e => setCurrentStock(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
              />
            </div>
          </div>

          {/* Nutritional Profile */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
            <span className="font-bold text-white block text-xs">التحليل الغذائي المعملي (Nutritional Specs):</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">البروتين الخام %</label>
                <input
                  type="number"
                  step="0.1"
                  value={proteinPct}
                  onChange={e => setProteinPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">الطاقة (Mcal/kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={energyMcal}
                  onChange={e => setEnergyMcal(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">المادة الجافة DM%</label>
                <input
                  type="number"
                  step="0.5"
                  value={dryMatterPct}
                  onChange={e => setDryMatterPct(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">حد الأمان وإعادة الطلب (كجم)</label>
            <input
              type="number"
              step="500"
              value={minStockAlert}
              onChange={e => setMinStockAlert(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition"
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
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'إضافة المادة للمستودع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
