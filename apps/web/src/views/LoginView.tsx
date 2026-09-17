import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  ArrowLeft, 
  AlertCircle,
  KeyRound,
  Globe,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const { theme, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    i18n.changeLanguage(isRtl ? 'en' : 'ar');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      if (!res.success) {
        setError(res.error || t('auth.loginFailed', 'تعذر تسجيل الدخول، يرجى التأكد من البيانات'));
      }
    } catch {
      setError(t('auth.serverError', 'حدث خطأ أثناء محاولة الاتصال بالخادم'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 relative overflow-hidden" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background Decorative Gradients */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Language & Theme Switcher */}
      <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-20 flex items-center gap-2`}>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition flex items-center justify-center backdrop-blur-md"
          title="تغيير المظهر"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleLanguage}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition flex items-center gap-2 text-xs font-bold backdrop-blur-md"
        >
          <Globe className="w-4 h-4" />
          <span>{isRtl ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 z-10 space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-slate-900 dark:text-white mx-auto shadow-xl shadow-emerald-900/40">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">السرايا للإنتاج الحيواني</h1>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Saraya Livestock & Dairy ERP</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">سجل الدخول للوصول إلى محطات القطيع والمحالب والتقارير</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستخدم</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3 pr-10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition"
                required
              />
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">كلمة المرور</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl p-3 pr-10 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition"
                required
              />
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-slate-900 dark:text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'جاري التحقق...' : 'تسجيل الدخول إلى المنظومة'}</span>
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center text-[10px] text-slate-500">
          تطوير: <span className="text-slate-700 dark:text-slate-300 font-semibold">شركة السرايا للتقنية</span> | م. أيمن جاب الله
        </div>
      </div>
    </div>
  );
};
