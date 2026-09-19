import React, { useState, useEffect } from 'react';
import { FileText, Printer, X, Search, Loader2, DollarSign, User } from 'lucide-react';
import { getPayrollSlips } from '../api/client';
import { formatDate } from '../utils/money.util';
import { PrintPayrollSheet } from './PrintPayrollSheet';

interface PayrollSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: any;
}

export const PayrollSlipsModal: React.FC<PayrollSlipsModalProps> = ({
  isOpen,
  onClose,
  period,
}) => {
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    if (isOpen && period?.id) {
      fetchSlips();
    }
  }, [isOpen, period?.id]);

  const fetchSlips = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPayrollSlips(period.id);
      setSlips(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل قسائم الرواتب');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !period) return null;

  const totalNet = slips.reduce((sum, s) => sum + Number(s.netSalary || 0), 0);
  const totalBase = slips.reduce((sum, s) => sum + Number(s.baseSalary || 0), 0);
  const totalAdvances = slips.reduce((sum, s) => sum + Number(s.advancesSettled || 0), 0);

  const filteredSlips = slips.filter(slip => {
    const fullName = slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : '';
    const code = slip.employee?.employeeCode || '';
    const query = search.toLowerCase();
    return fullName.toLowerCase().includes(query) || code.toLowerCase().includes(query);
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  قسائم رواتب شهر {period.monthName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  الفترة من <span className="font-mono">{formatDate(period.startDate)}</span> إلى{' '}
                  <span className="font-mono">{formatDate(period.endDate)}</span> • إجمالي القسائم:{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{slips.length}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPrintOpen(true)}
                disabled={slips.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة كشف المسير</span>
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 mb-1 font-semibold">إجمالي الرواتب الأساسية</div>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                {totalBase.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">د.ل</span>
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <div className="text-xs text-slate-500 mb-1 font-semibold">إجمالي تسويات السلف</div>
              <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                {totalAdvances.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">د.ل</span>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm">
              <div className="text-xs text-emerald-800 dark:text-emerald-300 mb-1 font-semibold">إجمالي صافي الرواتب المستحقة</div>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs font-normal">د.ل</span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-6 pt-4 pb-2 flex items-center justify-between shrink-0">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث برقم الموظف أو الاسم..."
                className="w-full pr-9 pl-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Slips Table */}
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            {loading ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                جاري تحميل قسائم الرواتب...
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 text-red-600 rounded-xl text-xs font-bold text-center">
                {error}
              </div>
            ) : filteredSlips.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">لا توجد قسائم مطابقة للبحث.</div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5 text-center w-12">#</th>
                      <th className="p-3.5">الرقم الوظيفي</th>
                      <th className="p-3.5">اسم الموظف</th>
                      <th className="p-3.5">المسمى الوظيفي</th>
                      <th className="p-3.5 text-left">الراتب الأساسي</th>
                      <th className="p-3.5 text-left">المكافآت</th>
                      <th className="p-3.5 text-left">الاستقطاعات</th>
                      <th className="p-3.5 text-left">السلف المسواة</th>
                      <th className="p-3.5 text-left">صافي الراتب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSlips.map((slip, idx) => (
                      <tr key={slip.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {slip.employee?.employeeCode || '-'}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          {slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : 'موظف'}
                        </td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">
                          {slip.employee?.jobTitle || '-'}
                        </td>
                        <td className="p-3 font-mono text-left text-slate-800 dark:text-slate-200">
                          {Number(slip.baseSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-mono text-left text-emerald-600 dark:text-emerald-400 font-semibold">
                          {Number(slip.bonuses || 0) > 0 ? Number(slip.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 font-mono text-left text-red-600 dark:text-red-400">
                          {Number(slip.deductions || 0) > 0 ? Number(slip.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 font-mono text-left text-amber-600 dark:text-amber-400">
                          {Number(slip.advancesSettled || 0) > 0 ? Number(slip.advancesSettled).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-3 font-mono font-black text-left text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20">
                          {Number(slip.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} د.ل
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
            <div className="text-xs text-slate-500">
              حالة المسير:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {period.status === 'APPROVED' ? 'معتمد' : period.status === 'PAID' ? 'تم الصرف' : 'مسودة'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      <PrintPayrollSheet
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        period={period}
        slips={slips}
      />
    </>
  );
};
