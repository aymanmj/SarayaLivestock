import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { executeSyncTask } from '../api/client';

// تهيئة متجر IndexedDB للعمليات المعلقة
const syncStore = localforage.createInstance({
  name: 'SarayaLivestock',
  storeName: 'sync_queue'
});

export interface SyncTask {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  timestamp: number;
  idempotencyKey: string;
  retryCount: number;
}

export const SyncQueue = {
  /**
   * إضافة عملية إلى طابور الانتظار (في حالة انقطاع الاتصال)
   */
  async enqueue(url: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: any): Promise<void> {
    const task: SyncTask = {
      id: uuidv4(),
      url,
      method,
      body,
      timestamp: Date.now(),
      idempotencyKey: uuidv4(), // لضمان عدم التكرار على السيرفر
      retryCount: 0
    };
    
    await syncStore.setItem(task.id, task);
    
    // محاولة تشغيل المزامنة في الخلفية إذا كانت مدعومة
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-ignore
        await registration.sync.register('saraya-sync');
      } catch (err) {
        console.error('Background sync failed to register:', err);
      }
    } else {
      // الرجوع للمحاولة الفورية
      setTimeout(() => this.processQueue(), 5000);
    }
  },

  /**
   * معالجة جميع العمليات المعلقة
   */
  async processQueue(): Promise<void> {
    if (!navigator.onLine) return;

    const keys = await syncStore.keys();
    if (keys.length === 0) return;

    console.log(`بدء مزامنة ${keys.length} عملية معلقة...`);

    for (const key of keys) {
      const task = await syncStore.getItem<SyncTask>(key);
      if (!task) continue;

      try {
        const result = await executeSyncTask({
          url: task.url,
          method: task.method,
          body: task.body,
          idempotencyKey: task.idempotencyKey,
        });

        if (result.ok || !result.shouldRetry) {
          // نجحت العملية أو حدث خطأ منطقي/غير قابل للإعادة (4xx ما عدا 408)
          await syncStore.removeItem(key);
        } else {
          // خطأ في السيرفر 5xx، يمكن إعادة المحاولة مع الحفاظ على نفس مفتاح idempotencyKey
          task.retryCount++;
          await syncStore.setItem(key, task);
        }
      } catch (_error) {
        // فشل الاتصال، احتفظ بالعملية للمحاولة القادمة
        task.retryCount++;
        await syncStore.setItem(key, task);
      }
    }
  },

  /**
   * الاستماع لعودة الاتصال ومعالجة الطابور
   */
  initListeners() {
    window.addEventListener('online', () => {
      this.processQueue();
    });
  }
};
