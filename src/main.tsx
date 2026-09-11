import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { GlobalErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Handle stale deployment chunk 404s automatically
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite chunk preload error detected. Reloading page for new deployment...', event);
  window.location.reload();
});

// Self-healing check: automatically clear legacy bloated drafts that trigger QuotaExceededError
try {
  const legacyDraft = localStorage.getItem('uploadZone_draft');
  if (legacyDraft && legacyDraft.length > 500000) {
    console.warn('Purging legacy oversized draft from localStorage to prevent QuotaExceededError');
    localStorage.removeItem('uploadZone_draft');
  }
} catch {
  try {
    localStorage.removeItem('uploadZone_draft');
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </GlobalErrorBoundary>
  </React.StrictMode>,
);
