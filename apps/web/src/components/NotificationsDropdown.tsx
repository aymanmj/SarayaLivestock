import React, { useState } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  HeartPulse, 
  Baby, 
  Milk, 
  Check, 
  ChevronLeft, 
  ExternalLink,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { 
  useQuarantineQuery, 
  useBreedingTasksQuery, 
  useFeedStockQuery, 
  useDashboardQuery 
} from '../api/queries';

interface Props {
  onNavigate: (view: string) => void;
}

export const NotificationsDropdown: React.FC<Props> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  const { data: quarantineList } = useQuarantineQuery();
  const { data: breedingTasks } = useBreedingTasksQuery();
  const { data: feedStock } = useFeedStockQuery();
  const { data: dashboardData } = useDashboardQuery();

  // Aggregate live notifications
  const notifications: Array<{
    id: string;
    type: 'QUARANTINE' | 'BREEDING_PD' | 'DRY_OFF' | 'FEED_LOW' | 'MILK_ANOMALY';
    title: string;
    description: string;
    severity: 'URGENT' | 'WARNING' | 'INFO';
    targetView: string;
    timeAgo: string;
  }> = [];

  // 1. Quarantine alerts
  if (quarantineList && Array.isArray(quarantineList)) {
    quarantineList.forEach(q => {
      const daysLeft = q.withdrawalEndDate
        ? Math.max(0, Math.ceil((new Date(q.withdrawalEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
        : null;
      notifications.push({
        id: `quar-${q.id}`,
        type: 'QUARANTINE',
        title: `🚨 قفل أمان صحي للبقرة #${q.tagNumber}`,
        description: daysLeft == null
          ? 'تحت فترة تحريم بيطرية؛ تاريخ انتهاء التحريم غير محدد. يمنع حلبها في التانك الرئيسي!'
          : `تحت فترة تحريم بيطرية - متبقي ${daysLeft} يوم. يمنع حلبها في التانك الرئيسي!`,
        severity: 'URGENT',
        targetView: 'milking',
        timeAgo: 'نشط الآن',
      });
    });
  }

  // 2. Breeding PD checks due
  if (breedingTasks?.pendingPdChecks && Array.isArray(breedingTasks.pendingPdChecks)) {
    breedingTasks.pendingPdChecks.slice(0, 3).forEach(b => {
      notifications.push({
        id: `pd-${b.id}`,
        type: 'BREEDING_PD',
        title: `🔬 فحص سونار مستحق #${b.animal?.tagNumber || 'غير محدد'}`,
        description: `تجاوزت 35 يوماً من تاريخ التلقيح (${b.semenCode || 'سائل منوي'})، يرجى تأكيد العشار.`,
        severity: 'WARNING',
        targetView: 'breeding',
        timeAgo: 'اليوم',
      });
    });
  }

  // 3. Dry off due
  if (breedingTasks?.pendingDryOffs && Array.isArray(breedingTasks.pendingDryOffs)) {
    breedingTasks.pendingDryOffs.slice(0, 2).forEach(d => {
      notifications.push({
        id: `dry-${d.id}`,
        type: 'DRY_OFF',
        title: `🥛 موعد تجفيف مستحق #${d.animal?.tagNumber || 'غير محدد'}`,
        description: `بقرة حلابة عشار يجب نقلها لحظيرة التجفيف استعداداً لموسم الولادة.`,
        severity: 'INFO',
        targetView: 'breeding',
        timeAgo: 'مستحق هذا الأسبوع',
      });
    });
  }

  // 4. Low feed stock alerts
  if (feedStock && Array.isArray(feedStock)) {
    feedStock
      .filter(f => Number(f.currentStock ?? 0) <= Number(f.minStockAlert ?? 0))
      .slice(0, 2)
      .forEach(f => {
        notifications.push({
          id: `feed-${f.id}`,
          type: 'FEED_LOW',
          title: `🌾 نقص مخزون خامات: ${f.name}`,
          description: `الرصيد المتبقي (${f.currentStock} ${f.unit}) بلغ حد الأمان (${f.minStockAlert} ${f.unit}) أو أقل.`,
          severity: 'WARNING',
          targetView: 'nutrition',
          timeAgo: 'تنبيه مستودع',
        });
      });
  }

  const unreadNotifications = notifications.filter(n => !readIds.includes(n.id));
  const unreadCount = unreadNotifications.length;

  const handleMarkAllAsRead = () => {
    setReadIds(notifications.map(n => n.id));
  };

  const handleNotificationClick = (targetView: string, id: string) => {
    if (!readIds.includes(id)) {
      setReadIds(prev => [...prev, id]);
    }
    setIsOpen(false);
    onNavigate(targetView);
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-white transition relative"
        title="تنبيهات المزرعة الحية"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white font-mono text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-rose-500/50">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute left-0 mt-3 w-80 md:w-96 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">مركز التنبيهات الميدانية الحي</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20">
                  {unreadCount} غير مقروء
                </span>
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 transition"
                >
                  <Check className="w-3 h-3" />
                  قراءة الكل
                </button>
              )}
            </div>

            {/* Notification Items List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 custom-scrollbar bg-white dark:bg-slate-900">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400 space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-emerald-700 dark:text-emerald-400/60" />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">جميع مؤشرات المزرعة مستقرة</p>
                  <p className="text-[10px] text-slate-500">لا توجد أقفال تحريم أو مهام بيطرية متأخرة حالياً</p>
                </div>
              ) : (
                notifications.map(n => {
                  const isRead = readIds.includes(n.id);
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n.targetView, n.id)}
                      className={`p-3 transition cursor-pointer flex items-start gap-3 hover:bg-slate-100 dark:bg-slate-800 ${
                        isRead ? 'opacity-80 bg-white/50 dark:bg-slate-900/50' : 'bg-slate-100/30 dark:bg-slate-800/30'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.severity === 'URGENT' ? (
                          <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                        ) : n.severity === 'WARNING' ? (
                          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Baby className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</span>
                          <span className="text-[9px] text-slate-500 shrink-0 font-mono">{n.timeAgo}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{n.description}</p>
                      </div>

                      <ChevronLeft className="w-4 h-4 text-slate-500 self-center shrink-0" />
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-800/30 text-center">
              <span className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                ⚡ مزامنة حية مع قاعدة بيانات المزرعة (SSOT)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
