import { useState, useCallback } from 'react';

export interface ScaleReadResult {
  weightKg: number;
  scaleModel?: string;
  isSimulated?: boolean;
}

export function useElectronicScale() {
  const [reading, setReading] = useState(false);
  const [scaleError, setScaleError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScaleReadResult | null>(null);

  const readScale = useCallback(async (simulateIfNoDevice = false): Promise<number | null> => {
    setReading(true);
    setScaleError(null);

    try {
      const electron = (window as any).electronAPI;
      if (!electron?.readSerialScale) {
        // إذا كان يعمل على متصفح عادي بدون تطبيق سطح المكتب
        if (simulateIfNoDevice) {
          const fakeWeight = Math.round((400 + Math.random() * 90) * 10) / 10;
          const res = { weightKg: fakeWeight, scaleModel: 'محاكاة ميزان (متصفح الويب)', isSimulated: true };
          setLastResult(res);
          return fakeWeight;
        }
        setScaleError('الاتصال المباشر بالميزان الإلكتروني يتطلب تشغيل تطبيق المحطة المكتبية (Desktop Client) أو توصيل كابل RS232/USB.');
        return null;
      }

      const res = await electron.readSerialScale({ simulateIfNoDevice });

      if (res?.success && typeof res.weightKg === 'number' && res.weightKg > 0) {
        setLastResult({
          weightKg: res.weightKg,
          scaleModel: res.scaleModel || 'ميزان إلكتروني ذكي',
          isSimulated: res.isSimulated || false,
        });
        return res.weightKg;
      } else {
        const errorMsg = res?.error || 'تعذر استلام قراءة الوزن من الميزان. يرجى التأكد من تشغيل الميزان وثبات الوزن.';
        setScaleError(errorMsg);
        return null;
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'خطأ أثناء الاتصال بالميزان الإلكتروني';
      setScaleError(errorMsg);
      return null;
    } finally {
      setReading(false);
    }
  }, []);

  const clearStatus = useCallback(() => {
    setScaleError(null);
    setLastResult(null);
  }, []);

  return {
    readScale,
    reading,
    scaleError,
    lastResult,
    clearStatus,
  };
}
