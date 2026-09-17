import React, { useState, useEffect } from 'react';
import { BadgeDollarSign, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { generatedApiClient, unwrapGenerated } from '../api/client';

export const HrPayrollView: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [monthName, setMonthName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const json = unwrapGenerated(await generatedApiClient.GET('/api/v1/hr/payroll/periods'), 'تحميل الفترات');
      setPeriods(Array.isArray(json) ? json : []);
    } catch (error: any) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await generatedApiClient.POST('/api/v1/hr/payroll/generate', {
        body: { monthName, startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString() }
      });
      setFeedback('تم إنشاء كشوف الرواتب وترحيلها بنجاح');
      setIsGenerating(false);
      fetchPeriods();
    } catch (error: any) {
      setFeedback(error.message || 'تعذر توليد الرواتب');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            إدارة المرتبات والأجور
          </h2>
          <p className="text-xs text-slate-500">استخراج كشوف الرواتب وترحيل القيود المحاسبية للدفتر العام</p>
        </div>
        <button
          onClick={() => setIsGenerating(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition"
        >
          <FileText className="w-4 h-4" />
          توليد مسير رواتب جديد
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {isGenerating && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xl">
          <h3 className="font-bold mb-4 text-slate-900 dark:text-white">إصدار كشف رواتب للفترة المالية الحالية</h3>
          <form onSubmit={handleGenerateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">اسم الشهر (مثال: مارس 2026)</label>
              <input type="text" value={monthName} onChange={e => setMonthName(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">من تاريخ</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">إلى تاريخ</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsGenerating(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold">إلغاء</button>
              <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">توليد واحتساب الرواتب</button>
            </div>
          </form>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-xs">
              عند التوليد، سيتم إنشاء مسيرة الرواتب كـ <strong>مسودة</strong> للمراجعة. لن يتم إنشاء أي قيود محاسبية أو اعتماد الخصومات إلا بعد مراجعة المسودة واعتمادها نهائياً.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">الشهر</th>
              <th className="p-4">من تاريخ</th>
              <th className="p-4">إلى تاريخ</th>
              <th className="p-4">عدد القسائم (Slips)</th>
              <th className="p-4">الحالة</th>
              <th className="p-4">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {periods.map(period => (
              <tr key={period.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-4 font-bold text-slate-900 dark:text-white">{period.monthName}</td>
                <td className="p-4">{new Date(period.startDate).toLocaleDateString('ar-EG')}</td>
                <td className="p-4">{new Date(period.endDate).toLocaleDateString('ar-EG')}</td>
                <td className="p-4 font-mono font-bold">{period._count?.slips || 0}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${period.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : period.status === 'PAID' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                    {period.status === 'APPROVED' ? 'معتمد (قيد مسجل)' : period.status === 'PAID' ? 'تم الصرف' : 'مسودة'}
                  </span>
                </td>
                <td className="p-4 flex gap-2">
                  {period.status === 'DRAFT' && (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            await generatedApiClient.POST('/api/v1/hr/payroll/{id}/approve', { params: { path: { id: period.id } } });
                            fetchPeriods();
                            setFeedback('تم اعتماد المسودة وإنشاء القيد المحاسبي بنجاح');
                          } catch(err: any) { setFeedback(err.message); }
                        }}
                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded hover:bg-emerald-200 font-bold"
                      >
                        اعتماد
                      </button>
                      <button 
                        onClick={async () => {
                          if(!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;
                          try {
                            await generatedApiClient.DELETE('/api/v1/hr/payroll/{id}', { params: { path: { id: period.id } } });
                            fetchPeriods();
                            setFeedback('تم حذف المسودة بنجاح');
                          } catch(err: any) { setFeedback(err.message); }
                        }}
                        className="px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 rounded hover:bg-red-200 font-bold"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {periods.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">لا يوجد مسيرات رواتب مسجلة حتى الآن.</div>
        )}
      </div>
    </div>
  );
};
