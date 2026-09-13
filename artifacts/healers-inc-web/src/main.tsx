import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import faviconUrl from '@workspace/healers-inc/favicon.svg';

import './index.css';

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  ?? document.head.appendChild(document.createElement('link'));
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = faviconUrl;

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
