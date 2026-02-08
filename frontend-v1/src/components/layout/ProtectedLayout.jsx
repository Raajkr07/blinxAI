import { useUIStore } from '../../store/uiStore';

export default function ProtectedLayout({ user, onLogout, children }) {
  const { openModal } = useUIStore();

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      <header className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-indigo-500/10 glass z-50">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            B
          </div>
          <h1 className="m-0 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">
            Blink Chat
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => openModal('editProfile')}
            className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors group cursor-pointer"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="size-8 rounded-full object-cover ring-2 ring-indigo-500/20"
              />
            ) : (
              <div className="size-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </div>
            )}
            {user?.username && (
              <span className="hidden sm:inline text-sm font-medium text-slate-200 group-hover:text-white transition">
                {user.username}
              </span>
            )}
          </button>
          <div className="h-6 w-px bg-white/10 mx-2"></div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <span>Logout</span>
          </button>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden relative z-0">{children}</main>
    </div>
  );
}
