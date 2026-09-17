import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, CheckCircle2, UserCheck, Stethoscope, BadgeDollarSign } from 'lucide-react';
import { generatedApiClient, unwrapGenerated } from '../api/client';
import type { components } from '../api/generated/schema';

type Employee = components['schemas']['CreateEmployeeDto'] & { id: string, status: string, createdAt: string }; // Fallback till openapi generation finishes

export const HrEmployeesView: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form states
  const [isAdding, setIsAdding] = useState(false);
  const [empCode, setEmpCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hireDate, setHireDate] = useState('');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const json = unwrapGenerated(await generatedApiClient.GET('/api/v1/hr/employees'), 'تحميل الموظفين');
      setEmployees(Array.isArray(json) ? json : []);
    } catch (error: any) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const added = unwrapGenerated(await generatedApiClient.POST('/api/v1/hr/employees', {
        body: {
          employeeCode: empCode,
          firstName,
          lastName,
          jobTitle,
          baseSalary: Number(baseSalary),
          hireDate: new Date(hireDate).toISOString(),
        }
      }), 'إضافة موظف');
      setEmployees(prev => [added, ...prev]);
      setFeedback('تمت إضافة الموظف بنجاح');
      setIsAdding(false);
      // reset
      setEmpCode(''); setFirstName(''); setLastName(''); setJobTitle(''); setBaseSalary(''); setHireDate('');
    } catch (error: any) {
      setFeedback(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            شؤون الموظفين والعمالة
          </h2>
          <p className="text-xs text-slate-500">إدارة سجلات العاملين والبيطريين والرواتب الأساسية</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition"
        >
          <Plus className="w-4 h-4" />
          تسجيل موظف جديد
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {isAdding && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-xl">
          <h3 className="font-bold mb-4 text-slate-900 dark:text-white">بيانات الموظف الجديد</h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">الرقم الوظيفي / البصمة</label>
              <input type="text" value={empCode} onChange={e => setEmpCode(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">الاسم الأول</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">اسم العائلة</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">المسمى الوظيفي</label>
              <input type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">الراتب الأساسي</label>
              <input type="number" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block mb-1 font-bold text-slate-600 dark:text-slate-400">تاريخ التعيين</label>
              <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} required className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold">إلغاء</button>
              <button type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold">تسجيل وحفظ</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-4">الرقم الوظيفي</th>
              <th className="p-4">الموظف</th>
              <th className="p-4">المسمى</th>
              <th className="p-4">تاريخ التعيين</th>
              <th className="p-4">الراتب الأساسي</th>
              <th className="p-4">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="p-4 font-mono font-bold">{emp.employeeCode}</td>
                <td className="p-4 font-bold text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</td>
                <td className="p-4">{emp.jobTitle}</td>
                <td className="p-4">{new Date(emp.hireDate).toLocaleDateString('ar-EG')}</td>
                <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">{Number(emp.baseSalary).toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${emp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {emp.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">لا يوجد موظفين مسجلين.</div>
        )}
      </div>
    </div>
  );
};
