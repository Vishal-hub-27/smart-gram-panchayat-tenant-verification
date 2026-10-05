import { useState, useCallback, useRef } from 'react';

/**
 * Lightweight per-page toast notification hook. A page calls showToast()
 * after an action succeeds/fails; <Toast toast={toast} /> renders it.
 * Kept local to each page rather than a global context — simple enough
 * for now, and every page that needs it already has its own async
 * actions to hook into.
 */
export default function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}
