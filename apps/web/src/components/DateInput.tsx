import React from 'react';
import { Calendar } from 'lucide-react';

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  hasIcon?: boolean;
}

/**
 * حقل إدخال تاريخ معتمد ومحصن ضد خلل الاتجاه في المتصفحات
 * يمنع ظهور الحروف المعكوسة (فنس / رهش / موى) ويضمن الأرقام اللاتينية القياسية
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className = '',
  hasIcon = true,
  required,
  disabled,
  placeholder,
  ...rest
}) => {
  return (
    <div className="relative w-full">
      <input
        type="date"
        dir="ltr"
        lang="en-CA"
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        placeholder={placeholder || 'YYYY-MM-DD'}
        className={`w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-right ${
          hasIcon ? 'pl-9' : ''
        } ${className}`}
        {...rest}
      />
      {hasIcon && (
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500">
          <Calendar className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
