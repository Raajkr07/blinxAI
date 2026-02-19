import { useSocketStore } from '../stores/socketStore';

export const ConnectionStatus = () => {
  const connected = useSocketStore((state) => state.connected);

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md border transition-all duration-300 shadow-sm select-none pointer-events-auto
      ${connected
        ? 'bg-[var(--color-background)]/80 text-[var(--color-foreground)] border-[var(--color-border)] opacity-0 hover:opacity-100'
        : 'bg-red-500/10 text-red-500 border-red-500/20 opacity-100'
      }`}>
      <div className={`h-2 w-2 rounded-full transition-colors duration-300
        ${connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}
      />
      <span className="opacity-90 whitespace-nowrap">
        {connected ? 'System Online' : 'Reconnecting...'}
      </span>
    </div>
  );
};
