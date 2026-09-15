import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { GlobalErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './utils/supabaseClient';
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

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [resource, config] = args;
  const url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
  
  if (url.startsWith('/api/')) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      args[1] = {
        ...config,
        headers: {
          ...config?.headers,
          'Authorization': `Bearer ${session.access_token}`
        }
      };
    }
  }
  return originalFetch(...args);
};

const OriginalEventSource = window.EventSource;
class CustomEventSource extends OriginalEventSource {
  constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
    let finalUrl = typeof url === 'string' ? url : url.toString();
    if (finalUrl.startsWith('/api/')) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.endsWith('-auth-token')) {
          try {
            const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
            if (tokenData.access_token) {
              finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'token=' + tokenData.access_token;
            }
          } catch (e) {}
          break;
        }
      }
    }
    super(finalUrl, eventSourceInitDict);
  }
}
(window as any).EventSource = CustomEventSource;

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
