import React, { useState } from 'react';
import { X, Plus, Layers, Tag, Scale, Calendar, Building, Sparkles } from 'lucide-react';
import { Species, Gender, Purpose, LifeStage } from '../api/types';
import { createAnimal } from '../api/client';
import { getBreedsForSpecies } from '../utils/breeds.data';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddAnimalModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [tagNumber, setTagNumber] = useState('');
  const [rfidTag, setRfidTag] = useState('');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('CATTLE');
  const [breed, setBreed] = useState('هولشتاين فريزيان (Holstein Friesian)');
  const [isCustomBreed, setIsCustomBreed] = useState(false);
  const [gender, setGender] = useState<Gender>('FEMALE');
  const [purpose, setPurpose] = useState<Purpose>('DAIRY');
  const [currentLifeStage, setCurrentLifeStage] = useState<LifeStage>('LACTATING');
  const [birthDate, setBirthDate] = useState('');
  const [entryWeightKg, setEntryWeightKg] = useState<number>(550);
  const [motherId, setMotherId] = useState('');
  const [fatherSemenCode, setFatherSemenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagNumber.trim()) {
      setError('يرجى إدخال رقم القرط أو الوسم');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAnimal({
        tagNumber: tagNumber.trim(),
        rfidTag: rfidTag.trim() || undefined,
        name: name.trim() || undefined,
        species,
        breed: breed.trim(),
        gender,
        purpose,
        currentLifeStage,
        birthDate: birthDate ? new Date(birthDate).toISOString() : undefined,
        entryWeightKg: Number(entryWeightKg) || undefined,
        motherId: motherId.trim() || undefined,
        fatherSemenCode: fatherSemenCode.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ سجل الحيوان');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">تسجيل رأس أو مولود جديد في القطيع</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">إدخال البيانات البيولوجية ورقم التعريف وشجرة النسب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tag Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                رقم القرط / الوسم البصري *
              </label>
              <input
                type="text"
                required
                value={tagNumber}
                onChange={e => setTagNumber(e.target.value)}
                placeholder="مثال: 1042"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* RFID Tag */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                شريحة الـ RFID / الوسم الإلكتروني
              </label>
              <input
                type="text"
                value={rfidTag}
                onChange={e => setRfidTag(e.target.value)}
                placeholder="982000345678912"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Name / Nickname */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم / تسمية الرأس (اختياري)
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: جميلة"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Species */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">النوع / الفصيلة</label>
              <select
                value={species}
                onChange={e => {
                  const val = e.target.value as Species;
                  setSpecies(val);
                  const firstBreed = getBreedsForSpecies(val)[0]?.name || '';
                  setBreed(firstBreed);
                  setIsCustomBreed(false);
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="CATTLE">أبقار (Cattle)</option>
                <option value="SHEEP">أغنام / خراف (Sheep)</option>
                <option value="GOAT">ماعز (Goat)</option>
              </select>
            </div>

            {/* Breed */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>السلالة</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">سلالات معتمدة</span>
              </label>
              <select
                value={isCustomBreed ? '__CUSTOM__' : breed}
                onChange={e => {
                  if (e.target.value === '__CUSTOM__') {
                    setIsCustomBreed(true);
                    setBreed('');
                  } else {
                    setIsCustomBreed(false);
                    setBreed(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                {getBreedsForSpecies(species).map(b => (
                  <option key={b.id} value={b.name}>
                    {b.name} — [{b.origin} | {b.primaryPurpose}]
                  </option>
                ))}
                <option value="__CUSTOM__">✨ سلالة أخرى (كتابة يدوية مخصصة)...</option>
              </select>

              {isCustomBreed && (
                <input
                  type="text"
                  value={breed}
                  onChange={e => setBreed(e.target.value)}
                  placeholder="أدخل اسم السلالة يدوياً..."
                  required
                  className="mt-2 w-full bg-slate-50 dark:bg-slate-950 border border-emerald-500/60 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition"
                />
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">الجنس</label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value as Gender)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="FEMALE">أنثى</option>
                <option value="MALE">ذكر</option>
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">الغرض الإنتاجي</label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value as Purpose)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="DAIRY">إنتاج حليب (Dairy)</option>
                <option value="BEEF">تسمين ولحوم (Beef)</option>
                <option value="DUAL">ثنائي الغرض (Dual Purpose)</option>
              </select>
            </div>

            {/* Life Stage */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">المرحلة الإنتاجية الحالية</label>
              <select
                value={currentLifeStage}
                onChange={e => setCurrentLifeStage(e.target.value as LifeStage)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="LACTATING">حلابة نشطة (Lactating)</option>
                <option value="DRY">جافة / عشار (Dry)</option>
                <option value="HEIFER">عجلة بكارة / شبوبة (Heifer)</option>
                <option value="CALF">عجل رضيع / مفطوم (Calf)</option>
                <option value="FATTENING_1">تسمين مرحلة 1 (Fattening 1)</option>
                <option value="FATTENING_2">تسمين مرحلة 2 (Fattening 2)</option>
                <option value="BULL">فحل تلقيح (Breeding Bull)</option>
              </select>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                الوزن الابتدائي (كجم)
              </label>
              <input
                type="number"
                step="0.5"
                value={entryWeightKg}
                onChange={e => setEntryWeightKg(Number(e.target.value))}
                placeholder="550"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                تاريخ الميلاد
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Mother Tag */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رقم قرط الأم (Mother Tag)</label>
              <input
                type="text"
                value={motherId}
                onChange={e => setMotherId(e.target.value)}
                placeholder="0890"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Father Semen Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رمز السائل المنوي / الأب</label>
              <input
                type="text"
                value={fatherSemenCode}
                onChange={e => setFatherSemenCode(e.target.value)}
                placeholder="USA-HO-9942 (Sire Straw)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>
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
              {loading ? 'جاري الحفظ...' : 'حفظ وتسجيل الحيوان'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
