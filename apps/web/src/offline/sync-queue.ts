import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

// تهيئة متجر IndexedDB للعمليات المعلقة
const syncStore = localforage.createInstance({
  name: 'SarayaLivestock',
  storeName: 'sync_queue'
});

export interface SyncTask {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  timestamp: number;
  idempotencyKey: string;
  retryCount: number;
}

export const SyncQueue = {
  /**
   * إضافة عملية إلى طابور الانتظار (في حالة انقطاع الاتصال)
   */
  async enqueue(url: string, method: 'POST' | 'PUT' | 'DELETE', body: any): Promise<void> {
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
        const response = await fetch(task.url, {
          method: task.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': task.idempotencyKey,
            // سيتم سحب التوكن من interceptor أو هنا
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          },
          body: JSON.stringify(task.body)
        });

        if (response.ok || response.status >= 400 && response.status < 500) {
          // نجحت العملية أو حدث خطأ منطقي (لا يستحق إعادة المحاولة)
          await syncStore.removeItem(key);
        } else {
          // خطأ في السيرفر 5xx، يمكن إعادة المحاولة
          task.retryCount++;
          await syncStore.setItem(key, task);
        }
      } catch (error) {
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
