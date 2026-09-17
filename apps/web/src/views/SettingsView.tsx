import React, { useState } from 'react';
import { Building2, Save, MapPin, Phone, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { updateFarm } from '../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const farmSettingsSchema = z.object({
  name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل').trim(),
  location: z.string().trim().optional(),
  managerName: z.string().trim().optional(),
  phone: z.string().trim().optional(),
});

type FarmSettingsData = z.infer<typeof farmSettingsSchema>;

export const SettingsView: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FarmSettingsData>({
    resolver: zodResolver(farmSettingsSchema),
    defaultValues: {
      name: user?.farm?.name || '',
      location: user?.farm?.location || '',
      managerName: '',
      phone: '',
    }
  });

  const mutation = useMutation({
    mutationFn: (data: FarmSettingsData) => {
      if (!user?.farmId) throw new Error('لا توجد مزرعة مرتبطة بحسابك');
      return updateFarm(user.farmId, data);
    },
    onSuccess: () => {
      setSuccessMsg('تم حفظ الإعدادات بنجاح. يرجى إعادة تحميل الصفحة لتحديث الاسم في الشريط العلوي.');
      queryClient.invalidateQueries();
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
          إدارة تفضيلات المزرعة، الاسم، ومعلومات التواصل. التعديلات هنا تنعكس فوراً على كافة فروع النظام.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-sm font-bold">
          {successMsg}
        </div>
      )}

      {mutation.isError && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 rounded-2xl text-sm font-bold">
          حدث خطأ أثناء حفظ الإعدادات
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
          بيانات المزرعة الأساسية
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" /> اسم المنشأة أو المزرعة
              </label>
              <input
                type="text"
                {...register('name')}
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
