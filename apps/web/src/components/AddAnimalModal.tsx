import React, { useState, useEffect } from 'react';
import { X, Plus, Layers, Tag, Scale, Calendar, Building, Sparkles, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Species, Gender, Purpose, LifeStage } from '../api/types';
import { getBreedsForSpecies } from '../utils/breeds.data';
import { useCreateAnimalMutation } from '../api/queries';
import { useElectronicScale } from '../hooks/useElectronicScale';

const animalSchema = z.object({
  tagNumber: z.string().min(1, 'يرجى إدخال رقم القرط أو الوسم').trim(),
  rfidTag: z.string().trim().optional(),
  name: z.string().trim().optional(),
  species: z.enum(['CATTLE', 'SHEEP', 'GOAT'] as const),
  breed: z.string().min(1, 'يرجى اختيار أو إدخال السلالة').trim(),
  customBreed: z.string().trim().optional(),
  gender: z.enum(['FEMALE', 'MALE'] as const),
  purpose: z.enum(['DAIRY', 'BEEF', 'DUAL'] as const),
  currentLifeStage: z.enum(['CALF', 'WEANED', 'HEIFER', 'PREGNANT_HEIFER', 'LACTATING', 'DRY', 'FATTENING', 'SIRE'] as const),
  birthDate: z.string().optional(),
  entryWeightKg: z.number({ message: 'الوزن يجب أن يكون رقماً' }).positive('يجب أن يكون الوزن أكبر من الصفر').optional().or(z.nan().transform(() => undefined)),
  motherId: z.string().trim().optional(),
  fatherSemenCode: z.string().trim().optional(),
}).refine((data) => {
  if (data.breed === '__CUSTOM__' && (!data.customBreed || data.customBreed.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: "يرجى إدخال اسم السلالة المخصصة",
  path: ["customBreed"]
});

type AnimalFormData = z.infer<typeof animalSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddAnimalModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createAnimalMutation = useCreateAnimalMutation();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AnimalFormData>({
    resolver: zodResolver(animalSchema),
    defaultValues: {
      species: 'CATTLE',
      gender: 'FEMALE',
      purpose: 'DAIRY',
      currentLifeStage: 'HEIFER',
      breed: '',
      entryWeightKg: 550,
      tagNumber: '',
      rfidTag: '',
      name: '',
      customBreed: '',
      birthDate: '',
      motherId: '',
      fatherSemenCode: ''
    }
  });

  const selectedSpecies = watch('species');
  const selectedBreed = watch('breed');
  
  // When species changes, update the breed list default
  useEffect(() => {
    const firstBreed = getBreedsForSpecies(selectedSpecies)[0]?.name || '';
    setValue('breed', firstBreed);
  }, [selectedSpecies, setValue]);

  const { readScale, reading: scaleReading, scaleError, lastResult: scaleResult, clearStatus } = useElectronicScale();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset();
      setSubmitError(null);
      clearStatus();
    }
  }, [isOpen, reset, clearStatus]);

  const handleReadScale = async (simulate = false) => {
    const val = await readScale(simulate);
    if (val != null) {
      setValue('entryWeightKg', val, { shouldValidate: true, shouldDirty: true });
    }
  };

  if (!isOpen) return null;

  const onSubmit = async (data: AnimalFormData) => {
    setSubmitError(null);
    try {
      await createAnimalMutation.mutateAsync({
        tagNumber: data.tagNumber,
        rfidTag: data.rfidTag || undefined,
        name: data.name || undefined,
        species: data.species,
        breed: data.breed === '__CUSTOM__' && data.customBreed ? data.customBreed : data.breed,
        gender: data.gender,
        purpose: data.purpose,
        currentLifeStage: data.currentLifeStage,
        birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
        entryWeightKg: data.entryWeightKg || undefined,
        motherId: data.motherId || undefined,
        fatherSemenCode: data.fatherSemenCode || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'حدث خطأ أثناء حفظ سجل الحيوان');
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
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {submitError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
              {submitError}
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
                {...register('tagNumber')}
                placeholder="مثال: 1042"
                className={`w-full bg-slate-50 dark:bg-slate-950 border ${errors.tagNumber ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition`}
              />
              {errors.tagNumber && <p className="text-red-500 text-[10px] mt-1">{errors.tagNumber.message}</p>}
            </div>

            {/* RFID Tag */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                شريحة الـ RFID / الوسم الإلكتروني
              </label>
              <input
                type="text"
                {...register('rfidTag')}
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
                {...register('name')}
                placeholder="مثال: جميلة"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Species */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">النوع / الفصيلة</label>
              <select
                {...register('species')}
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
                {...register('breed')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                {getBreedsForSpecies(selectedSpecies).map(b => (
                  <option key={b.id} value={b.name}>
                    {b.name} — [{b.origin} | {b.primaryPurpose}]
                  </option>
                ))}
                <option value="__CUSTOM__">✨ سلالة أخرى (كتابة يدوية مخصصة)...</option>
              </select>

              {selectedBreed === '__CUSTOM__' && (
                <div>
                  <input
                    type="text"
                    {...register('customBreed')}
                    placeholder="أدخل اسم السلالة يدوياً..."
                    className={`mt-2 w-full bg-slate-50 dark:bg-slate-950 border ${errors.customBreed ? 'border-red-500' : 'border-emerald-500/60'} rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none transition`}
                  />
                  {errors.customBreed && <p className="text-red-500 text-[10px] mt-1">{errors.customBreed.message}</p>}
                </div>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">الجنس</label>
              <select
                {...register('gender')}
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
                {...register('purpose')}
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
                {...register('currentLifeStage')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              >
                <option value="CALF">عجل رضيع / حديث الولادة (Calf)</option>
                <option value="WEANED">مفطوم (Weaned)</option>
                <option value="HEIFER">عجلة بكارة / شبوبة (Heifer)</option>
                <option value="PREGNANT_HEIFER">عجلة عشار (Pregnant Heifer)</option>
                <option value="LACTATING">حلابة نشطة (Lactating)</option>
                <option value="DRY">جافة (Dry)</option>
                <option value="FATTENING">تسمين (Fattening)</option>
                <option value="SIRE">فحل تلقيح (Sire / Bull)</option>
              </select>
            </div>

            {/* Weight with Scale Integration */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  الوزن الابتدائي (كجم)
                </label>
                <button
                  type="button"
                  onClick={() => handleReadScale(false)}
                  disabled={scaleReading}
                  className="px-2.5 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition disabled:opacity-50"
                  title="التقاط الوزن لحظياً من الميزان الإلكتروني"
                >
                  {scaleReading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>جاري القراءة...</span>
                    </>
                  ) : (
                    <>
                      <Scale className="w-3 h-3" />
                      <span>قراءة من الميزان</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="number"
                step="0.5"
                {...register('entryWeightKg', { valueAsNumber: true })}
                placeholder="550"
                className={`w-full bg-slate-50 dark:bg-slate-950 border ${errors.entryWeightKg ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'} focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition`}
              />
              {scaleResult && (
                <p className="text-emerald-500 text-[10px] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>تم استلام الوزن: {scaleResult.weightKg} كجم {scaleResult.isSimulated ? '(محاكاة تجريبية)' : 'من الميزان'}</span>
                </p>
              )}
              {scaleError && (
                <div className="text-amber-400 text-[10px] mt-1 space-y-0.5">
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{scaleError}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleReadScale(true)}
                    className="text-purple-400 hover:text-purple-300 underline font-bold"
                  >
                    تجربة قراءة محاكاة (Demo)
                  </button>
                </div>
              )}
              {errors.entryWeightKg && <p className="text-red-500 text-[10px] mt-1">{errors.entryWeightKg.message}</p>}
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                تاريخ الميلاد
              </label>
              <input
                type="date"
                {...register('birthDate')}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Mother Tag */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رقم قرط الأم (Mother Tag)</label>
              <input
                type="text"
                {...register('motherId')}
                placeholder="0890"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            {/* Father Semen Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">رمز السائل المنوي / الأب</label>
              <input
                type="text"
                {...register('fatherSemenCode')}
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
              disabled={isSubmitting || createAnimalMutation.isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || createAnimalMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتسجيل الحيوان'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
