import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { App } from './App';
import './index.css';
import './i18n';
import { SyncQueue } from './offline/sync-queue';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  tracesSampleRate: 1.0,
});

SyncQueue.initListeners();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SentryFallback = () => (
  <div
    dir="rtl"
    className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 space-y-4"
  >
    <h1 className="text-2xl font-extrabold text-red-400">⚠️ حدث خطأ غير متوقع</h1>
    <p className="text-sm text-slate-400 text-center max-w-md">
      واجهت المنظومة مشكلة غير متوقعة. يرجى إعادة تحميل الصفحة أو التواصل مع الدعم الفني.
    </p>
    <button
      onClick={() => window.location.reload()}
      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm transition"
    >
      إعادة تحميل الصفحة
    </button>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);

