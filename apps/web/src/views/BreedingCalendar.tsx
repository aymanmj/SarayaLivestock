import React, { useState, useEffect } from 'react';
import { Calendar, Heart, Baby, Eye, Sparkles, CheckCircle2, Clock, Plus, ArrowLeftRight, RefreshCw, X } from 'lucide-react';
import { recordPdResult, recordCalving, getBreedingTasks } from '../api/client';
import { AddInseminationModal } from '../components/AddInseminationModal';

interface PDTask {
  id: string;
  tag: string;
  name: string;
  insemDate: string;
  daysPassed: number;
  semen: string;
}

interface DryOffTask {
  id: string;
  tag: string;
  name: string;
  expectedCalving: string;
  daysToCalving: number;
  barn: string;
}

interface CalvingTask {
  id: string;
  tag: string;
  name: string;
  expectedDate: string;
  sire: string;
  parity: number;
}

interface CalvingModalState {
  isOpen: boolean;
  taskId: string;
  tag: string;
  actualDate: string;
  tagNumber: string;
  gender: 'FEMALE' | 'MALE';
  weightKg: number;
  difficulty: 'EASY' | 'ASSISTED' | 'SURGICAL' | 'ABORTION';
  isTwin: boolean;
  twinTagNumber: string;
  twinGender: 'FEMALE' | 'MALE';
  twinWeightKg: number;
  notes: string;
  submitting: boolean;
}

export const BreedingCalendar: React.FC = () => {
  const [isInseminateOpen, setIsInseminateOpen] = useState(false);
  const [selectedTagForAction, setSelectedTagForAction] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pdTasks, setPdTasks] = useState<PDTask[]>([]);
  const [dryTasks, setDryTasks] = useState<DryOffTask[]>([]);
  const [calvingTasks, setCalvingTasks] = useState<CalvingTask[]>([]);
  const [calvingModal, setCalvingModal] = useState<CalvingModalState | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await getBreedingTasks();
      if (res) {
        if (res.pendingPdChecks && Array.isArray(res.pendingPdChecks)) {
          setPdTasks(res.pendingPdChecks.map(r => {
            const insem = new Date(r.inseminationDate);
            const daysPassed = Math.round((new Date().getTime() - insem.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: r.id,
              tag: r.animal?.tagNumber || 'غير محدد',
              name: r.animal?.name || 'بقرة حلابة',
              insemDate: r.inseminationDate ? String(r.inseminationDate).slice(0, 10) : '',
              daysPassed: daysPassed > 0 ? daysPassed : 35,
              semen: r.semenCode || 'غير مسجل',
            };
          }));
        }
        if (res.pendingDryOffs && Array.isArray(res.pendingDryOffs)) {
          setDryTasks(res.pendingDryOffs.map(r => ({
            id: r.id,
            tag: r.animal?.tagNumber || 'غير محدد',
            name: r.animal?.name || 'بقرة عشار',
            expectedCalving: r.expectedCalvingDate ? String(r.expectedCalvingDate).slice(0, 10) : '',
            daysToCalving: 60,
            barn: 'عنبر حلب A1',
          })));
        }
        if (res.upcomingCalvings && Array.isArray(res.upcomingCalvings)) {
          setCalvingTasks(res.upcomingCalvings.map(r => ({
            id: r.id,
            tag: r.animal?.tagNumber || 'غير محدد',
            name: r.animal?.name || 'بقرة قريبة الولادة',
            expectedDate: r.expectedCalvingDate ? String(r.expectedCalvingDate).slice(0, 10) : '',
            sire: r.semenCode || 'غير مسجل',
            parity: 2,
          })));
        }
      }
    } catch (e: any) {
      setFeedback(e.message || 'تعذر تحميل مهام التناسل من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handlePdConfirm = async (taskId: string, tag: string, result: 'PREGNANT' | 'OPEN') => {
    try {
      await recordPdResult(taskId, result);
    } catch (error: any) {
      setFeedback(error.message || 'تعذر حفظ نتيجة فحص الحمل');
      return;
    }

    setPdTasks(prev => prev.filter(t => t.id !== taskId));
    setFeedback(
      result === 'PREGNANT'
        ? `✓ تم تأكيد عشار البقرة #${tag} وجدولة موعد التجفيف والولادة آلياً.`
        : `✗ تم تسجيل البقرة #${tag} كفارغة وجدولتها لإعادة التلقيح في الدورة القادمة.`,
    );
  };

  const handleDryOffConfirm = (taskId: string, tag: string) => {
    setFeedback(`تعذر تسجيل تجفيف البقرة #${tag}: هذه العملية تحتاج مساراً خادمياً معتمداً قبل تفعيلها.`);
  };

  const openCalvingModal = (taskId: string, tag: string) => {
    setCalvingModal({
      isOpen: true,
      taskId,
      tag,
      actualDate: new Date().toISOString().split('T')[0],
      tagNumber: `${tag}-C1`,
      gender: 'FEMALE',
      weightKg: 40,
      difficulty: 'EASY',
      isTwin: false,
      twinTagNumber: `${tag}-C2`,
      twinGender: 'MALE',
      twinWeightKg: 38,
      notes: '',
      submitting: false,
    });
  };

  const handleCalvingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calvingModal) return;
    setCalvingModal(prev => prev ? { ...prev, submitting: true } : null);

    try {
      await recordCalving(calvingModal.taskId, {
        actualCalvingDate: new Date(calvingModal.actualDate).toISOString(),
        offspringTagNumber: calvingModal.tagNumber.trim(),
        offspringGender: calvingModal.gender,
        offspringWeightKg: Number(calvingModal.weightKg),
        calvingDifficulty: calvingModal.difficulty,
        notes: calvingModal.notes.trim() || undefined,
        twins: calvingModal.isTwin ? [{
          tagNumber: calvingModal.twinTagNumber.trim(),
          gender: calvingModal.twinGender,
          weightKg: Number(calvingModal.twinWeightKg),
        }] : undefined,
      });

      setCalvingTasks(prev => prev.filter(t => t.id !== calvingModal.taskId));
      const successMsg = calvingModal.isTwin
        ? `🎉 مبارك! تم تسجيل ولادة توأم للبقرة #${calvingModal.tag} وإضافة المواليد (#${calvingModal.tagNumber} و #${calvingModal.twinTagNumber}) إلى سجل القطيع.`
        : `🎉 مبارك! تم تسجيل ولادة البقرة #${calvingModal.tag} وإضافة المولود الجديد #${calvingModal.tagNumber} إلى سجل القطيع.`;
      setFeedback(successMsg);
      setCalvingModal(null);
    } catch (error: any) {
      setFeedback(error.message || 'تعذر تسجيل الولادة');
      setCalvingModal(prev => prev ? { ...prev, submitting: false } : null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-pink-400" />
            جدول التناسل والخصوبة والولادات الذكي
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">حسابات تلقائية لفترات الحمل، مواعيد التجفيف، وكشوفات السونار</p>
        </div>

        <button
          onClick={() => {
            setSelectedTagForAction(undefined);
            setIsInseminateOpen(true);
          }}
          className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-slate-900 dark:text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-pink-900/30 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          تسجيل تلقيح جديد
        </button>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 3 Breeding Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: PD Ultrasound Checks Due */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">فحص حمل مستحق (PD Check)</h3>
            </div>
            <span className="bg-blue-100 dark:bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {pdTasks.length} رؤوس
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">تجاوزت 35 يوماً من التلقيح وتتطلب كشف السونار لتأكيد العشار.</p>

          <div className="space-y-3">
            {pdTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-blue-100 dark:bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-semibold">
                    {item.daysPassed} يوم منذ التلقيح
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>السائل: <strong className="text-slate-700 dark:text-slate-300">{item.semen}</strong></span>
                  <span>{item.name}</span>
                </div>
                <div className="pt-2 flex gap-2">
                  <button 
                    onClick={() => handlePdConfirm(item.id, item.tag, 'PREGNANT')}
                    className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-bold transition"
                  >
                    ✓ تأكيد عشار
                  </button>
                  <button 
                    onClick={() => handlePdConfirm(item.id, item.tag, 'OPEN')}
                    className="flex-1 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-slate-900 dark:text-white rounded-xl text-xs font-bold transition"
                  >
                    ✗ فارغة (إعادة تلقيح)
                  </button>
                </div>
              </div>
            ))}

            {pdTasks.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                تم استكمال جميع فحوصات السونار المستحقة لهذا اليوم 👍
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Dry-Off Due */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">مواعيد التجفيف الآلي (Dry-Off)</h3>
            </div>
            <span className="bg-amber-100 dark:bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {dryTasks.length} رؤوس
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">متبقي 60 يوماً على الولادة؛ يجب إيقاف الحلب لإراحة الضرع وضمان صحة الجنين.</p>

          <div className="space-y-3">
            {dryTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-amber-100 dark:bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold">
                    متبقي {item.daysToCalving} يوماً للولادة
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>الولادة المتوقعة: <strong className="text-slate-900 dark:text-white">{item.expectedCalving}</strong></span>
                  <span>{item.name}</span>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => handleDryOffConfirm(item.id, item.tag)}
                    className="w-full py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-slate-900 dark:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    تأكيد التجفيف ونقل للحظيرة B1
                  </button>
                </div>
              </div>
            ))}

            {dryTasks.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                لا توجد حالات تجفيف مستحقة حالياً 👍
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Upcoming Calvings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">ولادات وشيكة (Calving Due)</h3>
            </div>
            <span className="bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {calvingTasks.length} رأس
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">ولادات متوقعة خلال 48-72 ساعة؛ تجهيز بوكس الولادة وسرسوب اللبأ.</p>

          <div className="space-y-3">
            {calvingTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-slate-900 dark:text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-semibold">
                    الموعد: {item.expectedDate}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                  <span>الأب: <strong className="text-slate-900 dark:text-white">{item.sire}</strong></span>
                  <span>موسم الولادة: #{item.parity}</span>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => openCalvingModal(item.id, item.tag)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5"
                  >
                    <Baby className="w-4 h-4" />
                    تسجيل الولادة والمولود الجديد
                  </button>
                </div>
              </div>
            ))}

            {calvingTasks.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                تم تسجيل جميع الولادات بنجاح 🎉
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Insemination Modal */}
      <AddInseminationModal
        isOpen={isInseminateOpen}
        onClose={() => setIsInseminateOpen(false)}
        onSuccess={() => {
          setFeedback('✓ تم حفظ عملية التلقيح بنجاح وجدولتها في قائمة فحص السونار بعد 35 يوماً.');
        }}
        defaultTagNumber={selectedTagForAction}
      />

      {/* Calving Registration Modal */}
      {calvingModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-pink-100 dark:bg-pink-500/10 rounded-xl text-pink-600 dark:text-pink-400">
                  <Baby className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">تسجيل ولادة رسمية للبقرة #{calvingModal.tag}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">إدخال بيانات المولود وتحديث مرحلة الأم إلى حلابة (Lactating)</p>
                </div>
              </div>
              <button
                onClick={() => setCalvingModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCalvingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">تاريخ الولادة الفعلي</label>
                  <input
                    type="date"
                    required
                    value={calvingModal.actualDate}
                    onChange={e => setCalvingModal(prev => prev ? { ...prev, actualDate: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">درجة صعوبة الولادة</label>
                  <select
                    value={calvingModal.difficulty}
                    onChange={e => setCalvingModal(prev => prev ? { ...prev, difficulty: e.target.value as any } : null)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="EASY">طبيعية سهلة (Easy)</option>
                    <option value="ASSISTED">بمساعدة عادية (Assisted)</option>
                    <option value="SURGICAL">تدخل جراحي/قيصرية (Surgical)</option>
                    <option value="ABORTION">إجهاض (Abortion)</option>
                  </select>
                </div>
              </div>

              {/* Primary Offspring */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">بيانات المولود الأول</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">رقم القرط *</label>
                    <input
                      type="text"
                      required
                      value={calvingModal.tagNumber}
                      onChange={e => setCalvingModal(prev => prev ? { ...prev, tagNumber: e.target.value } : null)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">الجنس *</label>
                    <select
                      value={calvingModal.gender}
                      onChange={e => setCalvingModal(prev => prev ? { ...prev, gender: e.target.value as any } : null)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    >
                      <option value="FEMALE">أنثى (عجلة)</option>
                      <option value="MALE">ذكر (عجل)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">الوزن (كجم)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="150"
                      value={calvingModal.weightKg}
                      onChange={e => setCalvingModal(prev => prev ? { ...prev, weightKg: Number(e.target.value) } : null)}
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Twin Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="twinCheck"
                  checked={calvingModal.isTwin}
                  onChange={e => setCalvingModal(prev => prev ? { ...prev, isTwin: e.target.checked } : null)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="twinCheck" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  ولادة توأم (تسجيل مولود ثانٍ)
                </label>
              </div>

              {/* Second Offspring (Twins) */}
              {calvingModal.isTwin && (
                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">بيانات المولود الثاني (التوأم)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">رقم القرط *</label>
                      <input
                        type="text"
                        required={calvingModal.isTwin}
                        value={calvingModal.twinTagNumber}
                        onChange={e => setCalvingModal(prev => prev ? { ...prev, twinTagNumber: e.target.value } : null)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">الجنس *</label>
                      <select
                        value={calvingModal.twinGender}
                        onChange={e => setCalvingModal(prev => prev ? { ...prev, twinGender: e.target.value as any } : null)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      >
                        <option value="FEMALE">أنثى (عجلة)</option>
                        <option value="MALE">ذكر (عجل)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">الوزن (كجم)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="150"
                        value={calvingModal.twinWeightKg}
                        onChange={e => setCalvingModal(prev => prev ? { ...prev, twinWeightKg: Number(e.target.value) } : null)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">ملاحظات الطبيب البيطري / القائم بالتوليد (اختياري)</label>
                <textarea
                  rows={2}
                  value={calvingModal.notes}
                  onChange={e => setCalvingModal(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  placeholder="ملاحظات سرسوب اللبأ، صحة المولود والأم..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalvingModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={calvingModal.submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-900/30 flex items-center gap-1.5"
                >
                  {calvingModal.submitting ? 'جاري التسجيل...' : 'اعتماد الولادة والمولود'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
