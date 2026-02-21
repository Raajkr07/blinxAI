import { useState, useEffect } from 'react';
import { useSocketStore } from '../stores/socketStore';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export const ConnectionStatus = () => {
  const status = useSocketStore((state) => state.status);
  const [isVisible, setIsVisible] = useState(() => useSocketStore.getState().status !== 'disconnected');

  useEffect(() => {
    let hideTimer;
    const unsubscribe = useSocketStore.subscribe((state) => {
      const currentStatus = state.status;
      if (hideTimer) clearTimeout(hideTimer);

      if (currentStatus === 'disconnected') {
        setIsVisible(false);
      } else {
        setIsVisible(true);
        if (currentStatus === 'connected') {
          hideTimer = setTimeout(() => {
            setIsVisible(false);
          }, 3000);
        }
      }
    });
    return () => {
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          label: 'System Online',
          color: 'bg-emerald-500',
          textColor: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/20',
          icon: (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )
        };
      case 'connecting':
      case 'reconnecting':
        return {
          label: status === 'connecting' ? 'Connecting...' : 'Reconnecting...',
          color: 'bg-blue-500',
          textColor: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          pulse: true,
          icon: <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        };
      case 'error':
        return {
          label: 'Connection Error',
          color: 'bg-rose-500',
          textColor: 'text-rose-500',
          bgColor: 'bg-rose-500/10',
          borderColor: 'border-rose-500/20',
          icon: <div className="w-1.5 h-1.5 rounded-full bg-current" />
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();

  return (
    <AnimatePresence>
      {isVisible && config && (
        <Motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-4 py-2 text-[11px] font-bold tracking-wider uppercase backdrop-blur-xl border shadow-2xl transition-all duration-500 ${config.bgColor} ${config.textColor} ${config.borderColor}`}
        >
          <div className="flex items-center justify-center">
            {config.icon}
          </div>
          <span className="whitespace-nowrap opacity-90">
            {config.label}
          </span>
          {config.pulse && (
            <div className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${config.color} animate-ping opacity-75`} />
          )}
        </Motion.div>
      )}
    </AnimatePresence>
  );
};
