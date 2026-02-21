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

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  /** Auto-dismiss duration in ms. Default: 2500 */
  duration: number;
  /** Optional action button (e.g. "Undo") */
  action?: ToastAction;
}

interface ToastContextValue {
  /** Show a toast notification. Returns the toast id. */
  showToast: (message: string, duration?: number, action?: ToastAction) => string;
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
    (message: string, duration = 2500, action?: ToastAction): string => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, message, duration, action };

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
                         rounded-lg shadow-lg toast-fade-in flex items-center gap-3"
              role="status"
            >
              {toast.message}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action!.onClick();
                    removeToast(toast.id);
                  }}
                  className="text-blue-300 hover:text-blue-200 font-semibold text-sm underline underline-offset-2 shrink-0"
                >
                  {toast.action.label}
                </button>
              )}
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
