/**
 * مكتبة معالجة الحسابات المالية وتنسيق الأرقام والعملات (Saraya Livestock Money & Number Utility)
 * 
 * القواعد الأساسية:
 * 1. العملة الرسمية المعتمدة للمنظومة: الدينار الليبي (د.ل - LYD).
 * 2. اعتماد الأرقام العربية القياسية (0, 1, 2, 3...) حصراً في كامل النظام ومنع الأرقام الهندية (١, ٢, ٣...).
 * 3. دقة الحسابات المالية لـ 3 خانات عشرية (درهم) لتوافق المحاسبة المصرفية والزراعية.
 */

export const OFFICIAL_CURRENCY = {
  code: 'LYD',
  symbol: 'د.ل',
  nameAr: 'دينار ليبي',
  nameEn: 'Libyan Dinar',
  decimals: 3,
  subUnit: 'درهم',
};

/**
 * تنسيق المبالغ المالية بالدينار الليبي مع الأرقام العربية القياسية (0-9)
 */
export function formatMoney(
  amount: number | string | null | undefined,
  includeSymbol: boolean = true,
  decimals: number = 2
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0)) || 0;
  
  // استخدام التنسيق اللاتيني القياسي لضمان عدم ظهور الأرقام الهندية
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return includeSymbol ? `${formatted} ${OFFICIAL_CURRENCY.symbol}` : formatted;
}

/**
 * تنسيق الأرقام والكميات القياسية مع الفواصل (مثل: 1,450 كجم أو 250 رأس)
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value || 0)) || 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * تنسيق التواريخ بالأرقام العربية القياسية (YYYY-MM-DD)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * تنسيق النسبة المئوية (%)
 */
export function formatPercent(value: number | string | null | undefined, decimals: number = 1): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value || 0)) || 0;
  return `${num.toFixed(decimals)}%`;
}

/**
 * تحويل نص رقمي أو مدخل إلى رقم عائم آمن
 */
export function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const clean = String(value).replace(/[^0-9.-]+/g, '');
  return parseFloat(clean) || 0;
}
