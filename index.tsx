import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/ErrorBoundary';
import { ShareView } from './components/ShareView';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Public read-only share link: `?share=<code>` renders the viewer, bypassing auth.
const shareCode = new URLSearchParams(window.location.search).get('share');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      {shareCode ? <ShareView code={shareCode} /> : <App />}
    </AppErrorBoundary>
  </React.StrictMode>
);
