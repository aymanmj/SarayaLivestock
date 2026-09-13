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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

