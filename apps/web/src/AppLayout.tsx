import React, { useState } from 'react';
import { Outlet, Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Milk, 
  Layers, 
  Calendar, 
  Scale, 
  Wheat, 
  DollarSign, 
  Shield, 
  Building2, 
  Laptop,
  Info,
  KeyRound,
  LogOut,
  PieChart,
  Globe,
  Sun,
  Moon
} from 'lucide-react';

import { useAuth } from './context/AuthContext';
import { LoginView } from './views/LoginView';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { LicenseModal } from './components/LicenseModal';
import { useTheme } from './hooks/useTheme';

export const AppLayout: React.FC = () => {
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const { user, role, isLoggedIn, isLoading, logout } = useAuth();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 flex items-center justify-center text-sm">
        {t('app.loading')}
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginView />;
  }

  const isRtl = i18n.language.startsWith('ar');
  const activeTab = routerState.location.pathname.replace('/', '') || 'animals';

  const toggleLanguage = () => {
    i18n.changeLanguage(isRtl ? 'en' : 'ar');
  };

  const navItems = [
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'VETERINARIAN'].includes(role)
      ? [{ id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'MILKER'].includes(role)
      ? [{ id: 'milking', label: t('nav.milking'), icon: Milk, badge: 'سريع' }]
      : []),
    { id: 'animals', label: t('nav.animals'), icon: Layers, badge: 'SSOT' },
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'VETERINARIAN'].includes(role)
      ? [{ id: 'breeding', label: t('nav.breeding'), icon: Calendar, badge: 'مهام حية' }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'WORKER'].includes(role)
      ? [{ id: 'fattening', label: t('nav.fattening'), icon: Scale }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'WORKER'].includes(role)
      ? [{ id: 'nutrition', label: t('nav.nutrition'), icon: Wheat, badge: 'أقل تكلفة' }]
      : []),
    ...(role === 'SUPER_ADMIN' || role === 'ACCOUNTANT'
      ? [{ id: 'accounting', label: t('nav.accounting'), icon: DollarSign, badge: 'GL & IAS 41' }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'VETERINARIAN'].includes(role)
      ? [{ id: 'financial', label: t('nav.financial'), icon: PieChart, badge: 'تحليلي' }]
      : []),
    ...(role === 'SUPER_ADMIN'
      ? [{ id: 'users', label: t('nav.users'), icon: Shield, badge: 'RBAC' }]
      : []),
    { id: 'about', label: t('nav.about'), icon: Info, badge: 'السرايا' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-72 bg-white dark:bg-slate-900 ${isRtl ? 'border-l' : 'border-r'} border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0`}>
        <div>
          {/* Logo & Farm Branding */}
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-900 dark:text-white shadow-lg shadow-emerald-900/40">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">سرايا للإنتاج الحيواني</h1>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block">Livestock & Dairy ERP</span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  to={`/${item.id === 'animals' ? '' : item.id}` as any}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-emerald-700 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Station & License Section */}
        <div className="p-3 space-y-2 m-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <button
            onClick={() => setIsLicenseModalOpen(true)}
            className="w-full p-2.5 rounded-xl bg-purple-100 dark:bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 text-xs font-bold flex items-center justify-between transition"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-700 dark:text-purple-400" />
              الترخيص والاشتراك
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">
              Enterprise
            </span>
          </button>

          <div className="p-2.5 bg-slate-50/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
              <Laptop className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              محطة المزرعة (Electron)
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        {/* Top App Bar */}
        <header className="relative z-50 h-16 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-6 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-500/20">الفرع الرئيسي</span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">مزرعة سرايا النموذجية (محطة الحلب والتسمين)</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition flex items-center gap-2 text-xs font-bold"
              title="تغيير المظهر"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'النهاري' : 'الليلي'}</span>
            </button>

            <button
              onClick={toggleLanguage}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition flex items-center gap-2 text-xs font-bold"
              title="تغيير لغة النظام"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{isRtl ? 'English' : 'العربية'}</span>
            </button>

            <NotificationsDropdown onNavigate={(tab) => navigate({ to: `/${tab}` })} />

            <button
              onClick={() => setIsLicenseModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-white transition"
              title="معلومات الترخيص والاشتراك"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
              <span>الترخيص</span>
            </button>

            <div 
              onClick={() => navigate({ to: '/users' })}
              className="flex items-center gap-2.5 pr-3 border-r border-slate-200 dark:border-slate-800 cursor-pointer hover:opacity-80 transition"
              title="إدارة الحساب والأدوار"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-400 text-xs shadow-md">
                {user?.fullName?.slice(0, 1) || 'س'}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-white">{user?.fullName?.split(' ')[0] || 'المستخدم'}</div>
                <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">{role}</div>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 rounded-xl bg-rose-100 dark:bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
              title="تسجيل الخروج من المنظومة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="p-6 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>

      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
      />
    </div>
  );
};
