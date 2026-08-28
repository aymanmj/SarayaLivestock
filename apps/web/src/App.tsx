import React, { useState } from 'react';
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
  UserCheck,
  Info,
  KeyRound,
  LogOut,
  Sparkles,
  PieChart
} from 'lucide-react';

import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/LoginView';
import { ExecutiveDashboard } from './views/ExecutiveDashboard';
import { MilkingQuickEntry } from './views/MilkingQuickEntry';
import { AnimalsDirectory } from './views/AnimalsDirectory';
import { BreedingCalendar } from './views/BreedingCalendar';
import { FatteningWeights } from './views/FatteningWeights';
import { NutritionRations } from './views/NutritionRations';
import { FinancialReports } from './views/FinancialReports';
import { AccountingGL } from './views/AccountingGL';
import { UsersManagement } from './views/UsersManagement';
import { AboutSystem } from './views/AboutSystem';
import { NotificationsDropdown } from './components/NotificationsDropdown';
import { LicenseModal } from './components/LicenseModal';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('animals');
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState<boolean>(false);
  const { user, role, isLoggedIn, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-sm">
        جاري التحقق من الجلسة الآمنة...
      </div>
    );
  }

  // If user is logged out, display enterprise Login screen
  if (!isLoggedIn) {
    return <LoginView />;
  }

  const navItems = [
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'VETERINARIAN'].includes(role)
      ? [{ id: 'dashboard', label: 'لوحة القيادة التنفيذية', icon: LayoutDashboard }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'MILKER'].includes(role)
      ? [{ id: 'milking', label: 'محطة الحلب السريعة', icon: Milk, badge: 'سريع' }]
      : []),
    { id: 'animals', label: 'سجل القطيع والماشية', icon: Layers, badge: 'SSOT' },
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'VETERINARIAN'].includes(role)
      ? [{ id: 'breeding', label: 'التناسل والولادات', icon: Calendar, badge: 'مهام حية' }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'WORKER'].includes(role)
      ? [{ id: 'fattening', label: 'أوزان التسمين والـ ADG', icon: Scale }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'WORKER'].includes(role)
      ? [{ id: 'nutrition', label: 'الأعلاف والعلائق (TMR)', icon: Wheat, badge: 'أقل تكلفة' }]
      : []),
    ...(role === 'SUPER_ADMIN' || role === 'ACCOUNTANT'
      ? [{ id: 'accounting', label: 'الحسابات والدفتر العام', icon: DollarSign, badge: 'GL & IAS 41' }]
      : []),
    ...(role === 'SUPER_ADMIN' || ['FARM_MANAGER', 'ACCOUNTANT', 'VETERINARIAN'].includes(role)
      ? [{ id: 'financial', label: 'التقارير والتحليل المالي', icon: PieChart, badge: 'تحليلي' }]
      : []),
    ...(role === 'SUPER_ADMIN'
      ? [{ id: 'users', label: 'المستخدمون والأمان', icon: Shield, badge: 'RBAC' }]
      : []),
    { id: 'about', label: 'حول المنظومة والمطور', icon: Info, badge: 'السرايا' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-slate-900 border-l border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Farm Branding */}
          <div className="p-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-white tracking-tight">سرايا للإنتاج الحيواني</h1>
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Livestock & Dairy ERP</span>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Station & License Section */}
        <div className="p-3 space-y-2 m-2 border-t border-slate-800/80">
          {/* License Trigger Button */}
          <button
            onClick={() => setIsLicenseModalOpen(true)}
            className="w-full p-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center justify-between transition"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              الترخيص والاشتراك
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
              Enterprise
            </span>
          </button>

          {/* Desktop Station Indicator */}
          <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              محطة المزرعة (Electron)
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top App Bar */}
        <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">الفرع الرئيسي</span>
              <h2 className="text-xs sm:text-sm font-bold text-white">مزرعة سرايا النموذجية (محطة الحلب والتسمين)</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Notifications Dropdown */}
            <NotificationsDropdown onNavigate={setActiveTab} />

            {/* License Quick Button */}
            <button
              onClick={() => setIsLicenseModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-bold text-slate-300 hover:text-white transition"
              title="معلومات الترخيص والاشتراك"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              <span>الترخيص</span>
            </button>

            {/* Active User Badge */}
            <div 
              onClick={() => setActiveTab('users')}
              className="flex items-center gap-2.5 pr-3 border-r border-slate-800 cursor-pointer hover:opacity-80 transition"
              title="إدارة الحساب والأدوار"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-600 flex items-center justify-center font-bold text-emerald-400 text-xs shadow-md">
                {user?.fullName?.slice(0, 1) || 'س'}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-white">{user?.fullName?.split(' ')[0] || 'المستخدم'}</div>
                <div className="text-[9px] text-emerald-400 font-mono font-bold">{role}</div>
              </div>
            </div>

            {/* Real Logout Button */}
            <button
              onClick={logout}
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
              title="تسجيل الخروج من المنظومة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="p-6 md:p-8 flex-1">
          {activeTab === 'dashboard' && <ExecutiveDashboard onNavigate={setActiveTab} />}
          {activeTab === 'milking' && <MilkingQuickEntry />}
          {activeTab === 'animals' && <AnimalsDirectory />}
          {activeTab === 'breeding' && <BreedingCalendar />}
          {activeTab === 'fattening' && <FatteningWeights />}
          {activeTab === 'nutrition' && <NutritionRations />}
          {activeTab === 'accounting' && <AccountingGL />}
          {activeTab === 'financial' && <FinancialReports />}
          {activeTab === 'users' && <UsersManagement />}
          {activeTab === 'about' && <AboutSystem />}
        </div>
      </main>

      {/* Global License Modal */}
      <LicenseModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};
