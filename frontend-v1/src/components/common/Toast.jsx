import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-indigo-500',
  }[type];

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up max-w-md`}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-white/80 hover:text-white transition"
      >
        ×
      </button>
    </div>
  );
}
