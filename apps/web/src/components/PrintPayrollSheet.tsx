import React, { useRef } from 'react';
import { Printer, X, Building2, Calendar, FileText } from 'lucide-react';
import { formatDate, tafqeetLibyanDinars } from '../utils/money.util';
import { useAuth } from '../context/AuthContext';

interface PrintPayrollSheetProps {
  isOpen: boolean;
  onClose: () => void;
  period: any;
  slips: any[];
}

export const PrintPayrollSheet: React.FC<PrintPayrollSheetProps> = ({
  isOpen,
  onClose,
  period,
  slips,
}) => {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !period) return null;

  const farmName = user?.farm?.name || 'مزرعة السرايا للإنتاج الحيواني';
  const farmLocation = user?.farm?.location || 'الفرع الرئيسي';
  const farmPhone = user?.farm?.phone || '';

  // Calculate accurate sums
  const totalBase = slips.reduce((sum, s) => sum + Number(s.baseSalary || 0), 0);
  const totalBonuses = slips.reduce((sum, s) => sum + Number(s.bonuses || 0), 0);
  const totalDeductions = slips.reduce((sum, s) => sum + Number(s.deductions || 0), 0);
  const totalAdvances = slips.reduce((sum, s) => sum + Number(s.advancesSettled || 0), 0);
  const totalNet = slips.reduce((sum, s) => sum + Number(s.netSalary || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  const statusLabel =
    period.status === 'PAID'
      ? 'تم الصرف'
      : period.status === 'APPROVED'
      ? 'معتمد (قيد مسجل)'
      : 'مسودة قيد المراجعة';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-5xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Screen Controls Header (hidden on print) */}
        <div className="print:hidden p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">معاينة كشف المرتبات للطباعة (A4)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printRef} className="p-8 sm:p-12 space-y-6 print:p-0 print:space-y-4 text-slate-900 bg-white" dir="rtl">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 text-slate-900">
                  <Building2 className="w-6 h-6 text-emerald-700" />
                  <h1 className="text-xl font-black">{farmName}</h1>
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium space-x-2 space-x-reverse">
                  <span>الموقع: {farmLocation}</span>
                  {farmPhone && <span>| هاتف: <span className="font-mono">{farmPhone}</span></span>}
                </div>
              </div>

              <div className="text-left">
                <div className="inline-block px-3 py-1 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 bg-slate-50">
                  الحالة: {statusLabel}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  تاريخ الاستخراج: <span className="font-mono">{formatDate(new Date())}</span>
                </div>
              </div>
            </div>

            <div className="text-center mt-4">
              <h2 className="text-lg font-black tracking-wide text-slate-900">
                كشف مسير رواتب وأجور العاملين
              </h2>
              <p className="text-xs text-slate-600 mt-1 font-semibold">
                عن شهر: <span className="font-bold text-slate-900">{period.monthName}</span> (للفترة من{' '}
                <span className="font-mono font-bold">{formatDate(period.startDate)}</span> إلى{' '}
                <span className="font-mono font-bold">{formatDate(period.endDate)}</span>)
              </p>
            </div>
          </div>

          {/* Employees Slips Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                  <th className="p-2.5 border border-slate-300 text-center w-8">#</th>
                  <th className="p-2.5 border border-slate-300 text-center w-20">الرقم</th>
                  <th className="p-2.5 border border-slate-300">اسم الموظف / العامل</th>
                  <th className="p-2.5 border border-slate-300">المسمى الوظيفي</th>
                  <th className="p-2.5 border border-slate-300 text-left">الأساسي</th>
                  <th className="p-2.5 border border-slate-300 text-left">المكافآت</th>
                  <th className="p-2.5 border border-slate-300 text-left">الاستقطاع</th>
                  <th className="p-2.5 border border-slate-300 text-left">خصم السلف</th>
                  <th className="p-2.5 border border-slate-300 text-left bg-emerald-50">الصافي المستحق</th>
                  <th className="p-2.5 border border-slate-300 text-center w-28">التوقيع / البصمة</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip, idx) => (
                  <tr key={slip.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                    <td className="p-2 border border-slate-300 text-center font-mono font-bold text-slate-700">
                      {slip.employee?.employeeCode || '-'}
                    </td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">
                      {slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : 'موظف'}
                    </td>
                    <td className="p-2 border border-slate-300 text-slate-600">
                      {slip.employee?.jobTitle || '-'}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-left">
                      {Number(slip.baseSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-left text-emerald-700">
                      {Number(slip.bonuses || 0) > 0
                        ? Number(slip.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-left text-red-600">
                      {Number(slip.deductions || 0) > 0
                        ? Number(slip.deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono text-left text-amber-700">
                      {Number(slip.advancesSettled || 0) > 0
                        ? Number(slip.advancesSettled).toLocaleString(undefined, { minimumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-bold text-left text-slate-900 bg-emerald-50/50">
                      {Number(slip.netSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 border border-slate-300 text-center"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                  <td colSpan={4} className="p-2.5 border border-slate-300 text-center">
                    الإجمالي العام ({slips.length} قسيمة)
                  </td>
                  <td className="p-2.5 border border-slate-300 font-mono text-left">
                    {totalBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border border-slate-300 font-mono text-left text-emerald-800">
                    {totalBonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border border-slate-300 font-mono text-left text-red-700">
                    {totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border border-slate-300 font-mono text-left text-amber-800">
                    {totalAdvances.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 border border-slate-300 font-mono font-black text-left text-slate-950 bg-emerald-100">
                    {totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })} د.ل
                  </td>
                  <td className="p-2.5 border border-slate-300"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Tafqeet Section */}
          <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs flex items-center justify-between">
            <div className="font-semibold text-slate-800">
              إجمالي المبلغ المستحق للصرف كتابةً:
              <span className="font-bold text-slate-950 mr-2">{tafqeetLibyanDinars(totalNet)}</span>
            </div>
            <div className="font-mono font-bold text-slate-900">
              {totalNet.toLocaleString(undefined, { minimumFractionDigits: 3 })} LYD
            </div>
          </div>

          {/* Approvals and Signatures Section */}
          <div className="pt-8 grid grid-cols-3 gap-8 text-center text-xs">
            <div className="space-y-12">
              <div className="font-bold text-slate-800">إعداد / مسؤول الموارد البشرية</div>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              <div className="text-[11px] text-slate-500">التوقيع والتاريخ</div>
            </div>

            <div className="space-y-12">
              <div className="font-bold text-slate-800">مراجعة / الإدارة المالية</div>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              <div className="text-[11px] text-slate-500">التوقيع والتاريخ</div>
            </div>

            <div className="space-y-12">
              <div className="font-bold text-slate-800">اعتماد / المدير العام</div>
              <div className="border-b border-dashed border-slate-400 w-36 mx-auto"></div>
              <div className="text-[11px] text-slate-500">التوقيع والختم الرسمي</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
