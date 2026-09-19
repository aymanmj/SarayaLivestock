import React, { useState, useEffect } from 'react';
import { BadgeDollarSign, FileText, CheckCircle2, AlertCircle, Printer, Eye, Trash2, Check, DollarSign, Wallet, Calendar } from 'lucide-react';
import { getPayrollPeriods, generatePayrollPeriod, approvePayrollPeriod, deletePayrollPeriodDraft, getPayrollSlips } from '../api/client';
import { formatDate } from '../utils/money.util';
import { DateInput } from '../components/DateInput';
import { PayrollSlipsModal } from '../components/PayrollSlipsModal';
import { PrintPayrollSheet } from '../components/PrintPayrollSheet';

export const HrPayrollView: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Generation form
  const [isGenerating, setIsGenerating] = useState(false);
  const [monthName, setMonthName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [slipsModalPeriod, setSlipsModalPeriod] = useState<any | null>(null);
  const [printPeriod, setPrintPeriod] = useState<any | null>(null);
  const [printSlips, setPrintSlips] = useState<any[]>([]);
  const [isPrintLoading, setIsPrintLoading] = useState(false);

  const fetchPeriods = async () => {
    setLoading(true);
    try {
      const data = await getPayrollPeriods();
      setPeriods(Array.isArray(data) ? data : []);
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
      await generatePayrollPeriod({
        monthName,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      setFeedback('تم إنشاء مسودة كشوف الرواتب بنجاح');
      setIsGenerating(false);
      setMonthName('');
      setStartDate('');
      setEndDate('');
      fetchPeriods();
    } catch (error: any) {
      setFeedback(error.message || 'تعذر توليد الرواتب');
    }
  };

  const handleDirectPrint = async (period: any) => {
    setIsPrintLoading(true);
    try {
      const slipsData = await getPayrollSlips(period.id);
      setPrintPeriod(period);
      setPrintSlips(Array.isArray(slipsData) ? slipsData : []);
    } catch (err: any) {
      setFeedback(err.message || 'تعذر تحميل بيانات الطباعة');
    } finally {
      setIsPrintLoading(false);
    }
  };

  // KPIs
  const totalPaid = periods
    .filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.totalNetSalary || 0), 0);

  const totalDraft = periods
    .filter(p => p.status === 'DRAFT')
    .reduce((sum, p) => sum + Number(p.totalNetSalary || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BadgeDollarSign className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            إدارة المرتبات والأجور
          </h2>
          <p className="text-xs text-slate-500">احتساب كشوف الرواتب، معاينة القسائم، والترحيل للدفتر العام</p>
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

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BadgeDollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">إجمالي المسيرات المسجلة</div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{periods.length}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">إجمالي الرواتب المصروفة</div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">د.ل</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold">مسودات قيد المراجعة</div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {totalDraft.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">د.ل</span>
            </div>
          </div>
        </div>
      </div>

      {isGenerating && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xl">
          <h3 className="font-bold mb-4 text-slate-900 dark:text-white">إصدار كشف رواتب للفترة المالية</h3>
          <form onSubmit={handleGenerateSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">اسم الشهر (مثال: مارس 2026)</label>
              <input
                type="text"
                value={monthName}
                onChange={e => setMonthName(e.target.value)}
                placeholder="مثال: مارس 2026"
                required
                className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">من تاريخ</label>
              <DateInput
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">إلى تاريخ</label>
              <DateInput
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGenerating(false)}
                className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold"
              >
                توليد واحتساب الرواتب
              </button>
            </div>
          </form>
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-xs">
              عند التوليد، سيتم إنشاء مسيرة الرواتب كـ <strong>مسودة</strong> للمراجعة. يمكنك معاينة قسائم الموظفين وطباعة كشف المسير والتأكد من صحتها قبل اعتمادها.
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
              <th className="p-4">عدد القسائم</th>
              <th className="p-4 text-left">إجمالي صافي المرتبات</th>
              <th className="p-4">الحالة</th>
              <th className="p-4 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {periods.map(period => (
              <tr key={period.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <td className="p-4 font-bold text-slate-900 dark:text-white">{period.monthName}</td>
                <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{formatDate(period.startDate)}</td>
                <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{formatDate(period.endDate)}</td>
                <td className="p-4 font-mono font-bold">{period._count?.slips || 0}</td>
                <td className="p-4 font-mono font-bold text-left text-emerald-600 dark:text-emerald-400 text-sm">
                  {Number(period.totalNetSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} د.ل
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                    period.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : period.status === 'PAID'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                  }`}>
                    {period.status === 'APPROVED' ? 'معتمد' : period.status === 'PAID' ? 'تم الصرف' : 'مسودة'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {/* View Slips Button */}
                    <button
                      onClick={() => setSlipsModalPeriod(period)}
                      title="عرض قسائم الموظفين"
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1 transition text-[11px]"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                      <span>القسائم</span>
                    </button>

                    {/* Print Sheet Button */}
                    <button
                      onClick={() => handleDirectPrint(period)}
                      disabled={isPrintLoading}
                      title="طباعة كشف المرتبات الرسمي"
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold flex items-center gap-1 transition text-[11px]"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-500" />
                      <span>طباعة</span>
                    </button>

                    {period.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await approvePayrollPeriod(period.id);
                              fetchPeriods();
                              setFeedback('تم اعتماد المسودة بنجاح وتسجيل قيد الاستحقاق بالدفتر العام');
                            } catch (err: any) {
                              setFeedback(err.message);
                            }
                          }}
                          title="اعتماد كشف الرواتب"
                          className="px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 rounded-lg font-bold flex items-center gap-1 transition text-[11px]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>اعتماد</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;
                            try {
                              await deletePayrollPeriodDraft(period.id);
                              fetchPeriods();
                              setFeedback('تم حذف المسودة بنجاح');
                            } catch (err: any) {
                              setFeedback(err.message);
                            }
                          }}
                          title="حذف المسودة"
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:text-red-300 rounded-lg font-bold flex items-center gap-1 transition text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {periods.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">لا يوجد مسيرات رواتب مسجلة حتى الآن.</div>
        )}
      </div>

      {/* Slips Details Modal */}
      {slipsModalPeriod && (
        <PayrollSlipsModal
          isOpen={Boolean(slipsModalPeriod)}
          onClose={() => setSlipsModalPeriod(null)}
          period={slipsModalPeriod}
        />
      )}

      {/* Direct Print Sheet */}
      {printPeriod && (
        <PrintPayrollSheet
          isOpen={Boolean(printPeriod)}
          onClose={() => setPrintPeriod(null)}
          period={printPeriod}
          slips={printSlips}
        />
      )}
    </div>
  );
};
