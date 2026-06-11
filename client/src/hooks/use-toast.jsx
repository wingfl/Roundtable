import { createContext, useContext, useState, useCallback, useRef } from "react";
import { cn } from "../lib/utils";

const ToastContext = createContext(null);

let toastId = 0;
const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const toast = useCallback(({ title, description, variant = "default", duration = 5000 }) => {
    const id = String(++toastId);
    const newToast = { id, title, description, variant };

    setToasts((prev) => {
      const next = [...prev, newToast];
      if (next.length > TOAST_LIMIT) next.shift();
      return next;
    });

    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    timersRef.current.set(id, timer);

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={cn(
              "rounded-lg border p-4 shadow-lg cursor-pointer animate-in slide-in-from-right-full duration-300",
              t.variant === "destructive" && "border-destructive/50 bg-destructive/10 text-destructive",
              t.variant === "success" && "border-success/50 bg-success/10 text-success",
              t.variant === "default" && "border-border bg-card text-card-foreground"
            )}
          >
            {t.title && <div className="font-semibold text-sm">{t.title}</div>}
            {t.description && <div className="text-sm text-muted-foreground mt-1">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
