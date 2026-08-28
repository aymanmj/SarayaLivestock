import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  MessageCircle, 
  RotateCw, 
  CheckCircle2,
  Sparkles,
  Building2
} from 'lucide-react';
import { generatedApiClient, unwrapGenerated } from '../api/client';
import type { components } from '../api/generated/schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [licenseInfo, setLicenseInfo] = useState<components['schemas']['LicenseStatusResponseDto'] | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHwid, setCopiedHwid] = useState(false);

  const fetchLicense = async () => {
    setLoading(true);
    try {
      const data = unwrapGenerated(await generatedApiClient.GET('/api/v1/license/info'), 'تحميل حالة الترخيص');
      setLicenseInfo(data);
    } catch {
      setLicenseInfo(null);
      setError('تعذر تحميل حالة الترخيص من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLicense();
    }
  }, [isOpen]);

  const handleCopyHwid = () => {
    if (licenseInfo?.hardwareId) {
      navigator.clipboard.writeText(licenseInfo.hardwareId);
      setCopiedHwid(true);
      setTimeout(() => setCopiedHwid(false), 2000);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setActivating(true);
    setError(null);
    setFeedback(null);

    try {
      const data = unwrapGenerated(await generatedApiClient.POST('/api/v1/license/activate', {
        body: { licenseKey: licenseKeyInput.trim() },
      }), 'تفعيل الترخيص');

      setLicenseInfo(data);
      setFeedback(`✓ تم تفعيل الترخيص${data.details?.plan ? ` (${data.details.plan})` : ''} بنجاح!`);
      setLicenseKeyInput('');
    } catch (error: any) {
      setError(error.message || 'تعذر الاتصال بخادم التراخيص');
    } finally {
      setActivating(false);
    }
  };

  if (!isOpen) return null;

  const hwid = licenseInfo?.hardwareId || 'غير متاح';
  const whatsappMessage = encodeURIComponent(
    `السلام عليكم ورحمة الله وبركاته،\nأود تفعيل ترخيص منظومة سرايا لإدارة الماشية والألبان لجهاز بالبصمة العتادية:\n${hwid}\n\nشركة السرايا للتقنية.`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                نظام إدارة التراخيص والاشتراكات (License & Subscriptions)
              </h3>
              <p className="text-xs text-slate-400">تفعيل اشتراك المحطة، فحص بصمة العتاد HWID، وتحديث الصلاحيات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="m-5 mb-0 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="m-5 mb-0 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Subscription Status Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-tr from-slate-800/80 to-slate-850 border border-slate-700/80 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-400 font-semibold block">حالة الاشتراك الحالية:</span>
                <div className="flex items-center gap-2 mt-1">
                  <h4 className="text-lg font-extrabold text-white">
                    {licenseInfo?.details?.companyName || 'بيانات العميل غير متاحة'}
                  </h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    licenseInfo?.details?.plan === 'ENTERPRISE' || licenseInfo?.details?.plan === 'LIFETIME'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {licenseInfo?.details?.plan || 'غير متاح'}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 block">الأيام المتبقية:</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  {licenseInfo?.details?.isPerpetual ? 'غير محدود (دائم)' : `${licenseInfo?.details?.daysRemaining ?? 14} يوم`}
                </span>
              </div>
            </div>

            {/* Hardware ID Section */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  بصمة عتاد هذا الجهاز (Hardware ID):
                </div>
                <div className="font-mono text-xs font-bold text-slate-100 tracking-wider">
                  {hwid}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyHwid}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
                >
                  {copiedHwid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHwid ? 'تم النسخ' : 'نسخ البصمة'}</span>
                </button>

                <a
                  href={`https://wa.me/218916523434?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>طلب كود الترخيص</span>
                </a>
              </div>
            </div>
          </div>

          {/* Activation Form */}
          <form onSubmit={handleActivate} className="space-y-3">
            <label className="block text-xs font-bold text-slate-300">
              إدخال مفتاح التفعيل الجديد (License Key):
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={licenseKeyInput}
                onChange={e => setLicenseKeyInput(e.target.value)}
                placeholder="SARAYA-LIC.eyJsaWNlbnNlSWQiOi..."
                className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-white text-xs font-mono focus:border-emerald-500 focus:outline-none custom-scrollbar"
                required
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={activating || !licenseKeyInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{activating ? 'جاري التحقق والتفعيل...' : 'تفعيل مفتاح الترخيص'}</span>
              </button>

            </div>
          </form>

          {/* Support Info Footer */}
          <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span>الجهة المصدرة: <strong>السرايا للتقنية</strong></span>
            </div>
            <span>هاتف الدعم: <strong className="text-emerald-400 font-mono">0916523434</strong></span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
