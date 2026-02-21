import { useState, useEffect } from 'react';
import { useSocketStore } from '../stores/socketStore';
import { useTabsStore } from '../stores/tabsStore';
import { motion as Motion, AnimatePresence } from 'framer-motion';

export const ConnectionStatus = () => {
  // Current state from stores
  const status = useSocketStore((state) => state.status);

  // UI visibility state - Only visible if disconnected or if on the empty landing page
  const [isVisible, setIsVisible] = useState(() => {
    const currentStatus = useSocketStore.getState().status;
    const currentHasTabs = useTabsStore.getState().tabs.length > 0;
    return (currentStatus !== 'connected' && currentStatus !== 'disconnected') || (currentStatus === 'connected' && !currentHasTabs);
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Subscription based state management
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updateVisibility = () => {
      const currentStatus = useSocketStore.getState().status;
      const currentHasTabs = useTabsStore.getState().tabs.length > 0;
      const isActuallyOnline = navigator.onLine;

      if (!isActuallyOnline) {
        setIsVisible(true);
        return;
      }

      if (currentStatus === 'connected') {
        // Disappear completely when a chat is opened, stay visible only on landing page
        setIsVisible(!currentHasTabs);
      } else if (currentStatus === 'disconnected') {
        // If intentionally disconnected (logout), hide
        setIsVisible(false);
      } else {
        // Surface for connecting, reconnecting, or error states regardless of tabs
        setIsVisible(true);
      }
    };

    const unSubSocket = useSocketStore.subscribe(updateVisibility);
    const unSubTabs = useTabsStore.subscribe(updateVisibility);

    // Initial check
    updateVisibility();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unSubSocket();
      unSubTabs();
    };
  }, []);

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        label: 'No Internet Connection',
        color: 'bg-rose-500',
        textColor: 'text-rose-500',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
        icon: (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        )
      };
    }

    switch (status) {
      case 'connected':
        return {
          label: 'Blinx AI is Ready',
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
          label: status === 'connecting' ? 'Securing Connection...' : 'Restoring Session...',
          color: 'bg-blue-500',
          textColor: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          pulse: true,
          icon: <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        };
      case 'error':
        return {
          label: 'Sync Interrupted',
          color: 'bg-amber-500',
          textColor: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/20',
          icon: <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
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
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-2xl px-4 py-2 text-[11px] font-bold tracking-wider uppercase backdrop-blur-xl border shadow-2xl ${config.bgColor} ${config.textColor} ${config.borderColor}`}
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
