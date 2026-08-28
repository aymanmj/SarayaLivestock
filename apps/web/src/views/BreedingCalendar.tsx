import React, { useState, useEffect } from 'react';
import { Calendar, Heart, Baby, Eye, Sparkles, CheckCircle2, Clock, Plus, ArrowLeftRight, RefreshCw } from 'lucide-react';
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

export const BreedingCalendar: React.FC = () => {
  const [isInseminateOpen, setIsInseminateOpen] = useState(false);
  const [selectedTagForAction, setSelectedTagForAction] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pdTasks, setPdTasks] = useState<PDTask[]>([]);
  const [dryTasks, setDryTasks] = useState<DryOffTask[]>([]);
  const [calvingTasks, setCalvingTasks] = useState<CalvingTask[]>([]);

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
    } catch (error: any) {
      setPdTasks([]);
      setDryTasks([]);
      setCalvingTasks([]);
      setFeedback(error.message || 'تعذر تحميل مهام التناسل');
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
      setFeedback(error.message || 'تعذر تسجيل نتيجة فحص الحمل');
      return;
    }

    setPdTasks(prev => prev.filter(t => t.id !== taskId));
    setFeedback(
      result === 'PREGNANT' 
        ? `✓ تم تأكيد عشار البقرة #${tag} وجدولة موعد التجفيف والولادة آلياً.`
        : `✗ تم تسجيل البقرة #${tag} كفارغة وجدولتها لإعادة التلقيح في الدورة القادمة.`
    );
  };

  const handleDryOffConfirm = (taskId: string, tag: string) => {
    setFeedback(`تعذر تسجيل تجفيف البقرة #${tag}: هذه العملية تحتاج مساراً خادمياً معتمداً قبل تفعيلها.`);
  };

  const handleCalvingConfirm = async (taskId: string, tag: string) => {
    const offspringTag = prompt(`أدخل رقم قرط المولود الجديد للبقرة #${tag}:`, `${tag}-C1`);
    if (!offspringTag) return;

    try {
      await recordCalving(taskId, {
        actualCalvingDate: new Date().toISOString(),
        offspringTagNumber: offspringTag,
        offspringGender: 'FEMALE',
        offspringWeightKg: 42,
      });
    } catch (error: any) {
      setFeedback(error.message || 'تعذر تسجيل الولادة');
      return;
    }

    setCalvingTasks(prev => prev.filter(t => t.id !== taskId));
    setFeedback(`🎉 مبارك! تم تسجيل ولادة البقرة #${tag} وإضافة المولود الجديد #${offspringTag} إلى سجل القطيع.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-pink-400" />
            جدول التناسل والخصوبة والولادات الذكي
          </h2>
          <p className="text-xs text-slate-400">حسابات تلقائية لفترات الحمل، مواعيد التجفيف، وكشوفات السونار</p>
        </div>

        <button
          onClick={() => {
            setSelectedTagForAction(undefined);
            setIsInseminateOpen(true);
          }}
          className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-pink-900/30 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          تسجيل تلقيح جديد
        </button>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 3 Breeding Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: PD Ultrasound Checks Due */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-sm">فحص حمل مستحق (PD Check)</h3>
            </div>
            <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {pdTasks.length} رؤوس
            </span>
          </div>

          <p className="text-xs text-slate-400">تجاوزت 35 يوماً من التلقيح وتتطلب كشف السونار لتأكيد العشار.</p>

          <div className="space-y-3">
            {pdTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md font-semibold">
                    {item.daysPassed} يوم منذ التلقيح
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>السائل: <strong className="text-slate-300">{item.semen}</strong></span>
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
                    className="flex-1 py-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-xl text-xs font-bold transition"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-sm">مواعيد التجفيف الآلي (Dry-Off)</h3>
            </div>
            <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {dryTasks.length} رؤوس
            </span>
          </div>

          <p className="text-xs text-slate-400">متبقي 60 يوماً على الولادة؛ يجب إيقاف الحلب لإراحة الضرع وضمان صحة الجنين.</p>

          <div className="space-y-3">
            {dryTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-semibold">
                    متبقي {item.daysToCalving} يوماً للولادة
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>الولادة المتوقعة: <strong className="text-white">{item.expectedCalving}</strong></span>
                  <span>{item.name}</span>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => handleDryOffConfirm(item.id, item.tag)}
                    className="w-full py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
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
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">ولادات وشيكة (Calving Due)</h3>
            </div>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
              {calvingTasks.length} رأس
            </span>
          </div>

          <p className="text-xs text-slate-400">ولادات متوقعة خلال 48-72 ساعة؛ تجهيز بوكس الولادة وسرسوب اللبأ.</p>

          <div className="space-y-3">
            {calvingTasks.map(item => (
              <div key={item.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-white text-base">#{item.tag}</span>
                  <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-semibold">
                    الموعد: {item.expectedDate}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex justify-between">
                  <span>الأب: <strong className="text-white">{item.sire}</strong></span>
                  <span>موسم الولادة: #{item.parity}</span>
                </div>
                <div className="pt-2">
                  <button 
                    onClick={() => handleCalvingConfirm(item.id, item.tag)}
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
    </div>
  );
};
