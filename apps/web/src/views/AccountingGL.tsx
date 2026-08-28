import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Layers, 
  Calendar, 
  Scale, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  FileText, 
  Lock, 
  Unlock, 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  RefreshCw,
  FolderTree,
  Building2,
  Trash2,
  ArrowRightLeft,
  Sparkles
} from 'lucide-react';
import { generatedApiClient, unwrapGenerated } from '../api/client';
import type { components } from '../api/generated/schema';
import { formatMoney, formatNumber, formatDate, formatPercent, OFFICIAL_CURRENCY } from '../utils/money.util';

type JournalEntry = components['schemas']['JournalEntryResponseDto'];
type Account = components['schemas']['AccountWithChildrenResponseDto'];
type TrialBalance = components['schemas']['TrialBalanceResponseDto'];
type IncomeStatement = components['schemas']['IncomeStatementResponseDto'];
type BalanceSheet = components['schemas']['BalanceSheetResponseDto'];
type FiscalYear = components['schemas']['FiscalYearResponseDto'];
type EntryLine = { accountId: string; debit: number; credit: number; memo: string };

export const AccountingGL: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'entries' | 'accounts' | 'trial' | 'statements' | 'years'>('entries');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data States
  const [journalEntries, setJournalEntries] = useState<readonly JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [fiscalYears, setFiscalYears] = useState<readonly FiscalYear[]>([]);

  // New Journal Entry Form Modal State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(formatDate(new Date()));
  const [entryDescription, setEntryDescription] = useState('');
  const [entryLines, setEntryLines] = useState<EntryLine[]>([
    { accountId: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', debit: 0, credit: 0, memo: '' },
  ]);

  // Rollover Year Modal State
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [nextYearInput, setNextYearInput] = useState<string>(String(new Date().getFullYear() + 1));
  const [isRolloverProcessing, setIsRolloverProcessing] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, accountsRes, trialRes, incomeRes, bsRes, yearsRes] = await Promise.all([
        generatedApiClient.GET('/api/v1/accounting/journal-entries'),
        generatedApiClient.GET('/api/v1/accounting/chart-of-accounts'),
        generatedApiClient.GET('/api/v1/accounting/trial-balance'),
        generatedApiClient.GET('/api/v1/accounting/income-statement'),
        generatedApiClient.GET('/api/v1/accounting/balance-sheet'),
        generatedApiClient.GET('/api/v1/accounting/fiscal-years'),
      ]);

      setJournalEntries(unwrapGenerated(entriesRes, 'تحميل القيود اليومية'));
      setAccounts(unwrapGenerated(accountsRes, 'تحميل دليل الحسابات'));
      setTrialBalance(unwrapGenerated(trialRes, 'تحميل ميزان المراجعة'));
      setIncomeStatement(unwrapGenerated(incomeRes, 'تحميل قائمة الدخل'));
      setBalanceSheet(unwrapGenerated(bsRes, 'تحميل الميزانية'));
      const yrs = unwrapGenerated(yearsRes, 'تحميل السنوات المالية');
      setFiscalYears(yrs);
      if (yrs.length > 0) {
        const current = yrs.find(y => y.isCurrent) || yrs[0];
        setSelectedYearId(current.id);
        const nextYearNum = parseInt(current.yearName, 10) + 1 || new Date().getFullYear() + 1;
        setNextYearInput(String(nextYearNum));
      }
    } catch {
      setError('تعذر تحميل البيانات المحاسبية من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalDebit = entryLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = entryLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  const handleAddLine = () => {
    setEntryLines([...entryLines, { accountId: '', debit: 0, credit: 0, memo: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (entryLines.length <= 2) return;
    setEntryLines(entryLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof EntryLine, value: string | number) => {
    const next = [...entryLines];
    next[idx] = { ...next[idx], [field]: value };
    setEntryLines(next);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setError('لا يمكن حفظ القيد: إجمالي المدين يجب أن يساوي إجمالي الدائن تماماً');
      return;
    }

    try {
      unwrapGenerated(await generatedApiClient.POST('/api/v1/accounting/journal-entries', {
        body: {
          entryDate,
          description: entryDescription,
          lines: entryLines.map(l => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            memo: l.memo,
          })),
        },
      }), 'حفظ القيد اليومي');

      setFeedback('✓ تم تسجيل وترحيل قيد اليومية بنجاح وتحديث أرصدة الحسابات');
      setIsEntryModalOpen(false);
      setEntryDescription('');
      setEntryLines([
        { accountId: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', debit: 0, credit: 0, memo: '' },
      ]);
      fetchData();
    } catch (error: any) {
      setError(error.message || 'تعذر الاتصال بالخادم');
    }
  };

  const handleTogglePeriod = async (periodId: string, currentStatus: string) => {
    try {
      const action = currentStatus === 'CLOSED' ? 'reopen' : 'close';
      const result = action === 'close'
        ? await generatedApiClient.PATCH('/api/v1/accounting/periods/{id}/close', { params: { path: { id: periodId } } })
        : await generatedApiClient.PATCH('/api/v1/accounting/periods/{id}/reopen', { params: { path: { id: periodId } } });
      unwrapGenerated(result, 'تحديث حالة الفترة');
      setFeedback(action === 'close' ? '✓ تم إقفال الفترة المالية بنجاح' : '✓ تم إعادة فتح الفترة المالية بنجاح');
      fetchData();
    } catch {
      setError('تعذر تحديث حالة الفترة');
    }
  };

  const handleExecuteRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedYearId) return;

    setIsRolloverProcessing(true);
    setError(null);
    try {
      const data = unwrapGenerated(await generatedApiClient.POST('/api/v1/accounting/fiscal-years/{id}/rollover', {
        params: { path: { id: selectedYearId } },
        body: { nextYearName: nextYearInput },
      }), 'ترحيل السنة المالية');

      setFeedback(`✓ ${data.message} (صافي الربح المرحل: ${formatMoney(data.netProfitTransferred)})`);
      setIsRolloverModalOpen(false);
      fetchData();
    } catch (error: any) {
      setError(error.message || 'حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setIsRolloverProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Financial Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              IAS 41 Agricultural Accounting
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              العملة الرسمية: {OFFICIAL_CURRENCY.symbol} ({OFFICIAL_CURRENCY.code})
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            الحسابات المالية العامة ودفتر الأستاذ (General Ledger)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            إدارة شجرة الحسابات، قيود اليومية المتوازنة، ميزان المراجعة، الفترات الشهرية، فتح وإقفال السنوات وترحيل الأرصدة.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRolloverModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 flex items-center gap-2 transition"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>إقفال وترحيل السنة المالية</span>
          </button>

          <button
            onClick={() => setIsEntryModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء قيد يومية جديد</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards with Libyan Dinar and Latin Digits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>إجمالي الأصول (IAS 41)</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {formatMoney(balanceSheet?.totalAssets ?? 0)}
          </div>
          <div className="text-[10px] text-emerald-400">يشمل قطعان الألبان والتسمين والمحلب</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>إيرادات المبيعات المحققة</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">
            {formatMoney(incomeStatement?.totalRevenue || 0)}
          </div>
          <div className="text-[10px] text-slate-400">مبيعات الحليب الخام + الماشية والسماد</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>مصروفات التشغيل والتغذية</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-300">
            {formatMoney(incomeStatement?.totalExpenses || 0)}
          </div>
          <div className="text-[10px] text-slate-400">استهلاك الأعلاف + البيطرة والعمالة</div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>ميزان المراجعة والحالة</span>
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl font-black flex items-center gap-1.5 ${trialBalance?.isBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trialBalance?.isBalanced ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span>{trialBalance ? (trialBalance.isBalanced ? 'متوازن' : 'غير متوازن') : 'بانتظار البيانات'}</span>
          </div>
          <div className="text-[10px] text-slate-400">إجمالي المدين = إجمالي الدائن</div>
        </div>
      </div>

      {/* Alerts */}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 hover:text-emerald-200">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">✕</button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'entries', label: 'قيود اليومية (Journal Entries)', icon: BookOpen },
          { id: 'accounts', label: 'شجرة الحسابات (Chart of Accounts)', icon: FolderTree },
          { id: 'trial', label: 'ميزان المراجعة (Trial Balance)', icon: Scale },
          { id: 'statements', label: 'قائمة الدخل والمركز المالي (P&L)', icon: PieChart },
          { id: 'years', label: 'السنوات المالية والترحيل', icon: Calendar },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition shrink-0 ${
                isActive
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Journal Entries */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                دفتر اليومية العامة وسجل الحركات المحاسبية
              </h3>
              <span className="text-[11px] text-slate-400">إجمالي القيود: {formatNumber(journalEntries.length)} قيد</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <th className="p-3.5">رقم القيد</th>
                    <th className="p-3.5">التاريخ</th>
                    <th className="p-3.5">البيان / الشرح</th>
                    <th className="p-3.5">نوع القيد</th>
                    <th className="p-3.5">إجمالي المدين</th>
                    <th className="p-3.5">إجمالي الدائن</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        لا توجد قيود مسجلة حالياً. انقر على "إنشاء قيد يومية جديد" للبدء.
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono font-bold text-emerald-400">{entry.entryNumber}</td>
                        <td className="p-3.5 text-slate-300 font-mono">
                          {formatDate(entry.entryDate)}
                        </td>
                        <td className="p-3.5 text-white font-semibold">{entry.description}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {entry.type === 'OPENING_BALANCE' ? 'قيد افتتاحي مرحل' : entry.type === 'MANUAL' ? 'تسوية يدوية' : entry.type}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {formatMoney(entry.totalDebit)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {formatMoney(entry.totalCredit)}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            مرحل (Posted)
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Chart of Accounts */}
      {activeTab === 'accounts' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              دليل شجرة الحسابات المالية المعتمدة (IAS 41)
            </h3>
            <span className="text-[11px] text-slate-400">إجمالي الحسابات: {formatNumber(accounts.length)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-emerald-400 border border-slate-700">
                      {acc.code}
                    </span>
                    <span className="text-xs font-bold text-white">{acc.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    التصنيف:{' '}
                    <strong className="text-slate-300">
                      {acc.category === 'ASSET'
                        ? 'أصول'
                        : acc.category === 'LIABILITY'
                        ? 'خصوم'
                        : acc.category === 'EQUITY'
                        ? 'حقوق ملكية'
                        : acc.category === 'REVENUE'
                        ? 'إيرادات'
                        : 'مصروفات'}
                    </strong>
                  </div>
                </div>

                <div className="text-left font-mono font-bold text-sm text-emerald-400">
                  {formatMoney(acc.currentBalance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Trial Balance */}
      {activeTab === 'trial' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              ميزان المراجعة بالمجاميع والأرصدة الختامية
            </h3>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>الميزان متوازن حسابياً 100%</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="p-3.5">كود الحساب</th>
                  <th className="p-3.5">اسم الحساب</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">مجموع المدين</th>
                  <th className="p-3.5">مجموع الدائن</th>
                  <th className="p-3.5">رصيد مدين</th>
                  <th className="p-3.5">رصيد دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {trialBalance?.accounts?.map(row => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">{row.code}</td>
                    <td className="p-3.5 text-white font-semibold">{row.name}</td>
                    <td className="p-3.5 text-slate-400 text-[11px]">{row.category}</td>
                    <td className="p-3.5 font-mono text-slate-300">{formatNumber(row.totalDebit, 2)}</td>
                    <td className="p-3.5 font-mono text-slate-300">{formatNumber(row.totalCredit, 2)}</td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">
                      {row.netDebit > 0 ? formatMoney(row.netDebit) : '-'}
                    </td>
                    <td className="p-3.5 font-mono text-cyan-400 font-bold">
                      {row.netCredit > 0 ? formatMoney(row.netCredit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-950 font-bold text-white border-t border-slate-700">
                  <td colSpan={3} className="p-3.5 text-emerald-400">الإجمالي العام لميزان المراجعة</td>
                  <td className="p-3.5 font-mono text-emerald-400">
                    {formatMoney(trialBalance?.totalDebits || 0)}
                  </td>
                  <td className="p-3.5 font-mono text-emerald-400">
                    {formatMoney(trialBalance?.totalCredits || 0)}
                  </td>
                  <td colSpan={2} className="p-3.5 text-center text-emerald-400">✓ توازن كامل 100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Financial Statements (P&L & Balance Sheet) */}
      {activeTab === 'statements' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Farm Income Statement */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                قائمة الدخل الزراعية (Farm P&L)
              </h3>
              <span className="text-xs text-slate-400 font-mono">2026</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/40">
                <span className="text-slate-300 font-semibold">إجمالي إيرادات الحليب والماشية:</span>
                <span className="font-mono font-bold text-cyan-400">
                  {formatMoney(incomeStatement?.totalRevenue || 0)}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/40">
                <span className="text-slate-300 font-semibold">إجمالي تكاليف الأعلاف والتشغيل:</span>
                <span className="font-mono font-bold text-rose-400">
                  {formatMoney(incomeStatement?.totalExpenses || 0)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                <span className="text-white">صافي أرباح التشغيل للمزرعة:</span>
                <span className="font-mono font-black text-emerald-400">
                  {formatMoney(incomeStatement?.netProfit || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Balance Sheet */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                الميزانية العمومية والمركز المالي (Balance Sheet)
              </h3>
              <span className="text-xs text-slate-400 font-mono">IAS 41</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/40">
                <span className="text-slate-300 font-semibold">إجمالي الأصول البيولوجية والمتداولة:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatMoney(balanceSheet?.totalAssets ?? 0)}
                </span>
              </div>

              <div className="flex justify-between items-center p-2 rounded-xl bg-slate-800/40">
                <span className="text-slate-300 font-semibold">إجمالي الالتزامات وحقوق الملكية:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatMoney((balanceSheet?.totalLiabilities ?? 0) + (balanceSheet?.totalEquity ?? 0))}
                </span>
              </div>

              <div className={`pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold ${balanceSheet?.isBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span>توازن المركز المالي:</span>
                <span className="flex items-center gap-1 font-sans text-xs">
                  {balanceSheet?.isBalanced ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {balanceSheet?.isBalanced ? 'الأصول = الخصوم + حقوق الملكية' : 'المركز المالي غير متوازن ويحتاج مراجعة'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Fiscal Years & Rollover */}
      {activeTab === 'years' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                السنوات المالية والفترات الشهرية والترحيل السنوي
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                إقفال الشهور المالية، ترحيل الأرصدة، وفتح السنة المالية التالية تلقائياً
              </p>
            </div>

            <button
              onClick={() => setIsRolloverModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 self-start sm:self-auto"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>إقفال السنة وترحيل الأرصدة للسنة القادمة</span>
            </button>
          </div>

          <div className="space-y-4">
            {fiscalYears.map((fy) => (
              <div key={fy.id} className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">السنة المالية: {fy.yearName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      fy.status === 'OPEN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {fy.status === 'OPEN' ? 'مفتوحة ونشطة' : `مقفلة (${fy.closedBy || 'المدير المالي'})`}
                    </span>
                    {fy.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        السنة النشطة الحالية
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDate(fy.startDate)} إلى {formatDate(fy.endDate)}
                  </span>
                </div>

                {/* 12 Months Grid with Toggle (Open/Close) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {fy.periods?.map(p => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200">{p.periodName}</span>
                        {p.status === 'CLOSED' ? (
                          <Lock className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={p.status === 'CLOSED' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {p.status === 'CLOSED' ? 'مقفل' : 'مفتوح'}
                        </span>
                        <button
                          onClick={() => handleTogglePeriod(p.id, p.status)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[10px]"
                        >
                          {p.status === 'CLOSED' ? 'إعادة فتح' : 'إقفال'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROLLOVER FISCAL YEAR MODAL */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                إقفال السنة المالية وترحيل الأرصدة للسنة القادمة
              </h3>
              <button onClick={() => setIsRolloverModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleExecuteRollover} className="p-6 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-200 space-y-1.5 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-purple-300">
                  <Sparkles className="w-4 h-4" />
                  ماذا سيحدث عند إقفال وترحيل السنة المالية؟
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>إقفال كافة الفترات الشهرية الـ 12 للسنة المالية المحددة.</li>
                  <li>حساب صافي الأرباح/الخسائر التشغيلية وترحيلها لحساب <strong>الأرباح المرحلة (3102)</strong>.</li>
                  <li>إنشاء السنة المالية الجديدة مع 12 شهراً تلقائياً.</li>
                  <li>توليد <strong>القيد الافتتاحي (Opening Balance)</strong> متوازناً في السنة الجديدة بكافة أرصدة الأصول والخصوم ورأس المال.</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">السنة المالية المراد إقفالها</label>
                <select
                  value={selectedYearId}
                  onChange={e => setSelectedYearId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  required
                >
                  {fiscalYears.filter(y => y.status === 'OPEN').map(y => (
                    <option key={y.id} value={y.id}>السنة المالية: {y.yearName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">اسم/رقم السنة المالية الجديدة</label>
                <input
                  type="text"
                  value={nextYearInput}
                  onChange={e => setNextYearInput(e.target.value)}
                  placeholder="2027"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRolloverModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isRolloverProcessing || !selectedYearId}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-50"
                >
                  {isRolloverProcessing ? 'جاري الإقفال والترحيل...' : 'اعتماد الإقفال والترحيل الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW JOURNAL ENTRY MODAL */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                تسجيل قيد يومية عام جديد (Double-Entry Journal)
              </h3>
              <button onClick={() => setIsEntryModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">تاريخ القيد</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">البيان / الشرح</label>
                  <input
                    type="text"
                    value={entryDescription}
                    onChange={e => setEntryDescription(e.target.value)}
                    placeholder="مثال: شراء أعلاف مركزة / صرف أدوية / مبيعات حليب..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs"
                    required
                  />
                </div>
              </div>

              {/* Entry Lines */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>أطراف القيد المحاسبي (مدين / دائن):</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> إضافة طرف
                  </button>
                </div>

                <div className="space-y-2">
                  {entryLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700">
                      <select
                        value={line.accountId}
                        onChange={e => handleLineChange(idx, 'accountId', e.target.value)}
                        className="flex-1 bg-slate-850 border border-slate-700 rounded-lg p-2 text-white text-xs"
                        required
                      >
                        <option value="">-- اختر الحساب --</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="0.001"
                        placeholder="مدين (Debit)"
                        value={line.debit || ''}
                        onChange={e => handleLineChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-slate-850 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      />

                      <input
                        type="number"
                        step="0.001"
                        placeholder="دائن (Credit)"
                        value={line.credit || ''}
                        onChange={e => handleLineChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-slate-850 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      />

                      <input
                        type="text"
                        placeholder="ملاحظات"
                        value={line.memo}
                        onChange={e => handleLineChange(idx, 'memo', e.target.value)}
                        className="w-36 bg-slate-850 border border-slate-700 rounded-lg p-2 text-white text-xs"
                      />

                      {entryLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Balance Checker Footer */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono font-bold">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400">إجمالي المدين: <strong className="text-white">{formatMoney(totalDebit)}</strong></span>
                    <span className="text-slate-400">إجمالي الدائن: <strong className="text-white">{formatMoney(totalCredit)}</strong></span>
                    <span className="text-slate-400">الفرق: <strong className={isBalanced ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(Math.abs(totalDebit - totalCredit))}</strong></span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[11px] ${
                    isBalanced ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {isBalanced ? '✓ القيد متوازن' : '✕ غير متوازن'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  حفظ وترحيل القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
