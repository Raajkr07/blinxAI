export default function CredentialsInput({
  identifierRef,
  identifier,
  onIdentifierChange,
  email,
  onEmailChange,
  showEmailField,
  mode,
  loading,
  validIdentifier,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="identifier"
          className="block text-sm font-medium text-slate-300 mb-2"
        >
          Phone or Email
        </label>
        <input
          ref={identifierRef}
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => onIdentifierChange(e.target.value)}
          placeholder="Enter phone or email"
          className="w-full rounded-lg border-2 border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition"
        />
      </div>

      {showEmailField && (
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-300 mb-2"
          >
            Email (optional, for OTP delivery)
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border-2 border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !validIdentifier}
        className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            Sending OTP...
          </span>
        ) : (
          `Continue with ${mode === 'login' ? 'Login' : 'Sign up'}`
        )}
      </button>
    </form>
  );
}
