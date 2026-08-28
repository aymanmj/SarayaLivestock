import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Key, 
  RotateCw, 
  Lock, 
  Server, 
  CheckCircle2, 
  AlertTriangle,
  History,
  Terminal
} from 'lucide-react';
import { generatedApiClient, unwrapGenerated } from '../api/client';
import type { components } from '../api/generated/schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const VaultSecurityModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [vaultStatus, setVaultStatus] = useState<components['schemas']['VaultStatusResponseDto'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [rotatingKey, setRotatingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const json = unwrapGenerated(
        await generatedApiClient.GET('/api/v1/security/vault-status'),
        'تحميل حالة خزينة الأسرار',
      );
      setVaultStatus(json);
    } catch {
      setVaultStatus(null);
      setFeedback({ message: 'تعذر تحميل حالة خزينة الأسرار من الخادم', kind: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleRotate = async (keyName: 'JWT_SECRET') => {
    setRotatingKey(keyName);
    try {
      const json = unwrapGenerated(await generatedApiClient.POST('/api/v1/security/rotate-secret', {
        body: { keyName },
      }), 'تدوير المفتاح');
      setFeedback({ message: `✓ تم تدوير المفتاح (${keyName}) بنجاح إلى الإصدار رقم #${json.version}`, kind: 'success' });
      await fetchStatus();
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : `تعذر تدوير المفتاح (${keyName}). لم يتم إجراء تغيير.`,
        kind: 'error',
      });
    } finally {
      setRotatingKey(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                نظام إدارة وتدوير الأسرار (HashiCorp Vault & Master Security)
              </h3>
              <p className="text-xs text-slate-400">حماية مفاتيح التشفير AES-256-GCM وتدوير رموز JWT والاتصالات البنكية</p>
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
          <div className={`m-4 mb-0 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            feedback.kind === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}>
            {feedback.kind === 'success'
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Status Banner */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-700/80 flex items-center justify-center text-slate-300">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">مزود تخزين الأسرار الحالي:</span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {vaultStatus?.isVaultOnline ? 'خادم HashiCorp Vault' : 'متغيرات بيئة الخادم (وضع صيانة)'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {vaultStatus?.vaultAddr || 'http://127.0.0.1:8200'}
                </span>
              </div>
            </div>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Active Keys & Rotation */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-purple-400" />
              مفاتيح التشفير والأسرار النشطة (Active Encrypted Secrets)
            </h4>

            <div className="space-y-2">
              {vaultStatus?.secrets?.map(s => (
                <div 
                  key={s.keyName} 
                  className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/80 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs font-mono font-bold text-white">{s.keyName}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        v{s.version}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      آخر تدوير: {new Date(s.lastRotated).toLocaleString('ar-SA')} ({s.source})
                    </p>
                    {!s.rotationAvailable && (
                      <p className="text-[10px] text-amber-400">{s.rotationUnavailableReason}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleRotate('JWT_SECRET')}
                    disabled={rotatingKey === s.keyName || !s.rotationAvailable || s.keyName !== 'JWT_SECRET'}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 border border-purple-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${rotatingKey === s.keyName ? 'animate-spin' : ''}`} />
                    تدوير فوري
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Logs */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />
              سجل تدقيق الوصول الأمني (Security Access Audit)
            </h4>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-1.5 max-h-32 overflow-y-auto">
              {vaultStatus?.recentAuditLogs?.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-400 border-b border-slate-900 pb-1">
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString('ar-SA')}</span>
                  <span className="text-emerald-400 font-semibold">{log.action}</span>
                  <span className="text-slate-300">{log.key}</span>
                  <span className="text-purple-400 font-bold">{log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
