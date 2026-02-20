'use client';

import { create } from 'zustand';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

/* ============================================
   TOAST NOTIFICATION SYSTEM
   Glass-effect toasts with icons and animations
   ============================================ */

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

const toastConfig: Record<Toast['type'], {
  icon: typeof CheckCircle2;
  containerClass: string;
  iconClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    containerClass: 'toast toast-success',
    iconClass: 'text-white/90',
  },
  error: {
    icon: XCircle,
    containerClass: 'toast toast-error',
    iconClass: 'text-white/90',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'toast toast-warning',
    iconClass: 'text-black/70',
  },
  info: {
    icon: Info,
    containerClass: 'toast toast-info',
    iconClass: 'text-white/90',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type];
        const Icon = config.icon;

        return (
          <div
            key={toast.id}
            className={cn(
              config.containerClass,
              'flex items-start gap-3 min-w-[280px] cursor-pointer group'
            )}
            onClick={() => removeToast(toast.id)}
          >
            <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconClass)} />
            <p className="flex-1 text-sm font-medium leading-snug">
              {toast.message}
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-opacity duration-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
