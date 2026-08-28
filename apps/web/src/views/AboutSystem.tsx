import React, { useState } from 'react';
import { 
  Building2, 
  User, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Sparkles, 
  Award, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  MessageCircle, 
  Layers, 
  Cpu, 
  Database, 
  FileText,
  Lock,
  Wheat,
  Scale
} from 'lucide-react';

export const AboutSystem: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 p-8 md:p-10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-2xl shadow-emerald-900/50 shrink-0">
              <Building2 className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  إصدار المؤسسات v1.0.0 Enterprise
                </span>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  2026 Edition
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-2 tracking-tight">
                سرايا لإدارة الماشية والألبان والإنتاج الحيواني
              </h1>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                المنظومة السحابية والمكتبية المتكاملة لإدارة مزارع الأبقار والأغنام والماعز، محالب الحلب الآلي، دورات التناسل، ومصانع الأعلاف وفق أعلى المعايير الدولية.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Company & Developer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">الشركة المالكة والمطورة:</span>
              <h3 className="text-lg font-bold text-white">السرايا للتقنية (Al-Saraya for Technology)</h3>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            بيت خبرة برمجية متخصص في تطوير أنظمة إدارة المؤسسات الكبرى (ERP)، الحلول الزراعية والحيوانية الذكية، وتطبيقات سطح المكتب والسحابة الآمنة.
          </p>

          <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="flex items-center gap-2 text-slate-300">
                <Globe className="w-4 h-4 text-emerald-400" />
                الموقع الإلكتروني الرسمي:
              </span>
              <a
                href="http://www.alsarayatech.ly"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-mono font-bold flex items-center gap-1 transition"
              >
                www.alsarayatech.ly
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Developer & Contact Card */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-400">المطور والمهندس المسؤول:</span>
              <h3 className="text-lg font-bold text-white">المهندس / أيمن جاب الله</h3>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            لطلب الدعم الفني، تفعيل التراخيص، الاستشارات التقنية والتكامل مع أجهزة المحالب والموازين الإلكترونية.
          </p>

          <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60">
              <span className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-cyan-400" />
                رقم الهاتف / الدعم:
              </span>
              <div className="flex items-center gap-2">
                <span className="text-white font-mono font-bold">0916523434</span>
                <button
                  onClick={() => handleCopy('0916523434', 'phone')}
                  className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                  title="نسخ الرقم"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href="https://wa.me/218916523434"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  واتساب
                </a>
              </div>
            </div>

            {copied && (
              <div className="text-[11px] text-emerald-400 text-center font-bold animate-in fade-in">
                ✓ تم نسخ {copied === 'phone' ? 'رقم الهاتف' : 'النص'} بنجاح إلى الحافظة
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enterprise Pillars & Certifications */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-400" />
          المواصفات والمعايير الهندسية والمالية المعتمدة بالمنظومة
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <Scale className="w-4 h-4" />
              معيار المحاسبة الدولي IAS 41
            </div>
            <p className="text-slate-400 leading-relaxed">
              تقييم الأصول البيولوجية والمواشي والقطيع بالقيمة العادلة، وحساب الإهلاك والتكلفة التاريخية لقطعان الألبان والتسمين.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Wheat className="w-4 h-4" />
              محرك العلائق الأقل تكلفة (TMR)
            </div>
            <p className="text-slate-400 leading-relaxed">
              خوارزميات البرمجة الخطية (Linear Programming) لتحقيق أقصى إنتاجية للحليب ونمو اللحم بأقل تكلفة للكيلوغرام.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              صمام الأمان والتحريم البيطري
            </div>
            <p className="text-slate-400 leading-relaxed">
              قفل أمان ذكي يمنع خلط حليب الأبقار المعالجة بمضادات حيوية في تانك التجميع آلياً لحماية المستهلك والجودة.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold">
              <Lock className="w-4 h-4" />
              أمان وحماية HashiCorp Vault
            </div>
            <p className="text-slate-400 leading-relaxed">
              تشفير متقدم لكافة الاتصالات والأسرار بخوارزميات AES-256-GCM مع تدوير آلي للمفاتيح الأمنية.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Database className="w-4 h-4" />
              مبدأ المصدر الوحيد (SSOT)
            </div>
            <p className="text-slate-400 leading-relaxed">
              قاعدة بيانات PostgreSQL عالية الأداء تضمن دقة مطلقة وسلامة البيانات ومنع أي تضارب بين المحالب والعنابر.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold">
              <Cpu className="w-4 h-4" />
              ربط عتاد المزرعة الذكي
            </div>
            <p className="text-slate-400 leading-relaxed">
              تكامل مباشر مع الموازين الإلكترونية (Serial COM1/USB) وقارئات شرائح الـ RFID وطابعات الباركود الحرارية.
            </p>
          </div>
        </div>
      </div>

      {/* Copyright Notice */}
      <div className="text-center text-xs text-slate-500 py-4 border-t border-slate-800">
        جميع الحقوق محفوظة © 2026 لـ <strong className="text-slate-300">شركة السرايا للتقنية</strong> (Al-Saraya for Technology).
      </div>
    </div>
  );
};
