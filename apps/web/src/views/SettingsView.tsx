import React, { useState, useEffect } from 'react';
import { Building2, Save, MapPin, Phone, User as UserIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getCurrentFarm, updateFarm } from '../api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const farmSettingsSchema = z.object({
  name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل').trim(),
  location: z.string().trim().optional(),
  managerName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

type FarmSettingsData = z.infer<typeof farmSettingsSchema>;

export const SettingsView: React.FC = () => {
  const { user, updateUserFarm } = useAuth();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FarmSettingsData>({
    resolver: zodResolver(farmSettingsSchema),
    defaultValues: {
      name: user?.farm?.name || '',
      location: user?.farm?.location || '',
      managerName: user?.farm?.managerName || '',
      phone: user?.farm?.phone || '',
    }
  });

  const { data: farmData, isLoading: isFarmLoading } = useQuery({
    queryKey: ['current-farm'],
    queryFn: getCurrentFarm,
    initialData: user?.farm as any,
  });

  useEffect(() => {
    if (farmData) {
      reset({
        name: farmData.name || '',
        location: farmData.location || '',
        managerName: farmData.managerName || '',
        phone: farmData.phone || '',
      });
    }
  }, [farmData, reset]);

  const mutation = useMutation({
    mutationFn: (data: FarmSettingsData) => {
      return updateFarm(user?.farmId || 'current', data);
    },
    onSuccess: (updated) => {
      setSuccessMsg('تم حفظ وتحديث إعدادات المزرعة بنجاح.');
      if (updated) {
        updateUserFarm(updated);
      }
      queryClient.invalidateQueries({ queryKey: ['current-farm'] });
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  });

  const onSubmit = (data: FarmSettingsData) => {
    mutation.mutate(data);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Building2 className="w-8 h-8 text-emerald-600" />
          إعدادات النظام والمنشأة
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          إدارة تفضيلات المزرعة، الاسم، ومعلومات التواصل. التعديلات هنا تنعكس فوراً على كافة فروع النظام والشريط العلوي.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-sm font-bold">
          {successMsg}
        </div>
      )}

      {mutation.isError && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold">
          {mutation.error instanceof Error ? mutation.error.message : 'حدث خطأ أثناء حفظ الإعدادات'}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            بيانات المزرعة الأساسية
          </h2>
          {isFarmLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              جاري جلب البيانات...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" /> اسم المنشأة أو المزرعة
              </label>
              <input
                type="text"
                {...register('name')}
                placeholder="مثال: مزرعة السرايا للإنتاج الحيواني"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" /> الموقع الجغرافي / العنوان
              </label>
              <input
                type="text"
                {...register('location')}
                placeholder="مثال: طرابلس - قصر بن غشير"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="w-4 h-4 text-emerald-600" /> اسم المدير العام
              </label>
              <input
                type="text"
                {...register('managerName')}
                placeholder="مثال: م. أيمن"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" /> رقم هاتف المزرعة
              </label>
              <input
                type="text"
                {...register('phone')}
                placeholder="مثال: 0912345678"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none transition"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {mutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
