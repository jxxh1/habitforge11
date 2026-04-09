import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Shield, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'shield' | 'delete';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className={`
                pointer-events-auto flex items-center gap-3 px-4 py-3 bg-[#1A1A1A] border-l-4 shadow-2xl min-w-[200px]
                ${toast.type === 'success' || toast.type === 'shield' ? 'border-gold' : 'border-missed'}
              `}
            >
              {toast.type === 'success' && <Check size={16} className="text-gold" />}
              {toast.type === 'shield' && <Shield size={16} className="text-gold" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-missed" />}
              {toast.type === 'delete' && <X size={16} className="text-missed" />}
              
              <span className="font-mono text-[12px] text-text-main tracking-wider uppercase">
                {toast.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
