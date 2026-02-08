export default function ModeToggle({ mode, onToggle }) {
  const isLogin = mode === 'login';

  return (
    <div
      role="tablist"
      aria-label="Authentication mode"
      className="relative flex mb-6 text-xs rounded-full bg-slate-900/80 border border-slate-800 p-1 backdrop-blur"
    >
      {/* Sliding active indicator */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 w-1/2 rounded-full bg-emerald-500 shadow-md transition-transform duration-300 ease-out"
        style={{
          transform: isLogin ? 'translateX(0%)' : 'translateX(100%)',
        }}
      />

      {/* Login */}
      <button
        type="button"
        role="tab"
        aria-selected={isLogin}
        onClick={onToggle}
        className="relative z-10 flex-1 py-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/6"
      >
        <span
          className={isLogin ? 'text-slate-950' : 'text-slate-400 hover:text-slate-300'}
        >
          Login
        </span>
      </button>

      {/* Signup */}
      <button
        type="button"
        role="tab"
        aria-selected={!isLogin}
        onClick={onToggle}
        className="relative z-10 flex-1 py-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/6"
      >
        <span
          className={!isLogin ? 'text-slate-950' : 'text-slate-400 hover:text-slate-300'}
        >
          Sign up
        </span>
      </button>
    </div>
  );
}