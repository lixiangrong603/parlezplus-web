import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';

type ModalType = 'info' | 'danger';
type ModalMode = 'alert' | 'confirm';

interface ModalOptions {
  title?: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
}

interface ModalState {
  isOpen: boolean;
  mode: ModalMode;
  title: string;
  message: string;
  type: ModalType;
  confirmText: string;
  cancelText: string;
}

interface ModalContextType {
  alert: (options: ModalOptions) => Promise<void>;
  confirm: (options: ModalOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | null>(null);

const DEFAULTS = {
  title: '提示',
  type: 'info' as const,
  confirmText: '确定',
  cancelText: '取消'
};

const UnifiedModal: React.FC<{
  state: ModalState;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ state, onClose, onConfirm }) => {
  if (!state.isOpen) return null;

  const icon = state.type === 'danger'
    ? <Trash2 size={32} />
    : <AlertCircle size={32} />;

  const iconWrapClass = state.type === 'danger'
    ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
    : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600';

  const confirmClass = state.type === 'danger'
    ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none'
    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${iconWrapClass}`}>
            {icon}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{state.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">{state.message}</p>
        </div>

        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          {state.mode === 'confirm' ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              {state.cancelText}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              {state.confirmText}
            </button>
          )}

          {state.mode === 'confirm' && (
            <button
              onClick={onConfirm}
              className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${confirmClass}`}
            >
              {state.confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    mode: 'alert',
    title: DEFAULTS.title,
    message: '',
    type: DEFAULTS.type,
    confirmText: DEFAULTS.confirmText,
    cancelText: DEFAULTS.cancelText
  });

  const resolverRef = useRef<null | ((value: boolean) => void)>(null);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const confirmAction = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const alertFn = useCallback((options: ModalOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => {
        resolve();
      };
      setState({
        isOpen: true,
        mode: 'alert',
        title: options.title || DEFAULTS.title,
        message: options.message,
        type: options.type || DEFAULTS.type,
        confirmText: options.confirmText || DEFAULTS.confirmText,
        cancelText: options.cancelText || DEFAULTS.cancelText
      });
    });
  }, []);

  const confirmFn = useCallback((options: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (v: boolean) => resolve(v);
      setState({
        isOpen: true,
        mode: 'confirm',
        title: options.title || '确认',
        message: options.message,
        type: options.type || 'danger',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || DEFAULTS.cancelText
      });
    });
  }, []);

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<{ title?: string; message: string; type?: ModalType }>;
      const detail = custom.detail;
      if (!detail || !detail.message) return;
      alertFn({
        title: detail.title || DEFAULTS.title,
        message: detail.message,
        type: detail.type || 'info'
      });
    };

    window.addEventListener('parlezplus:alert', handler as EventListener);
    return () => window.removeEventListener('parlezplus:alert', handler as EventListener);
  }, [alertFn]);

  const value = useMemo<ModalContextType>(() => ({ alert: alertFn, confirm: confirmFn }), [alertFn, confirmFn]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      <UnifiedModal state={state} onClose={close} onConfirm={confirmAction} />
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
};
