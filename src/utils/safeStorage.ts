/**
 * Safe LocalStorage Wrapper
 * 
 * Prevents QuotaExceededError and SecurityError exceptions from ever crashing React.
 * Enforces a strict size threshold to prevent large datasets (like crawls) from entering localStorage.
 */

const MAX_ITEM_BYTES = 250 * 1024; // 250 KB max per item in localStorage

export const safeStorage = {
  getItem<T = any>(key: string, defaultValue: T | null = null): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  },

  setItem(key: string, value: any): boolean {
    try {
      const serialized = JSON.stringify(value);
      
      // Prevent storing large payloads that belong in IndexedDB
      if (serialized.length > MAX_ITEM_BYTES) {
        console.warn(
          `[safeStorage] Rejected setItem for key "${key}": Size (${Math.round(serialized.length / 1024)} KB) exceeds the 250 KB limit. Use IndexedDB for large datasets.`
        );
        return false;
      }

      localStorage.setItem(key, serialized);
      return true;
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError') {
        console.error(`[safeStorage] QuotaExceededError on key "${key}". Evicting item to recover space.`);
        try {
          localStorage.removeItem(key);
        } catch {}
      }
      return false;
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },

  clear(): void {
    try {
      localStorage.clear();
    } catch {}
  }
};
