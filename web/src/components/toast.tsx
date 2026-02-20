"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useMemo,
  type ReactNode,
} from "react";

// === Toast Types ===

interface Toast {
  id: string;
  message: string;
  /** Auto-dismiss duration in ms. Default: 2500 */
  duration: number;
}

interface ToastContextValue {
  /** Show a toast notification. Returns the toast id. */
  showToast: (message: string, duration?: number) => string;
}

// === Context ===

const ToastContext = createContext<ToastContextValue | null>(null);

// === Provider ===

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, duration = 2500): string => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, message, duration };

      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container -- fixed bottom center */}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto px-4 py-2.5 bg-gray-900 text-white text-sm font-medium
                         rounded-lg shadow-lg toast-fade-in"
              role="status"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

// === Hook ===

/**
 * Access the toast notification system.
 * Must be used within a ToastProvider.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
