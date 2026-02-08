export default function ProfileSetup({
  username,
  onUsernameChange,
  avatarUrl,
  onAvatarUrlChange,
  bio,
  onBioChange,
  loading,
  onBack,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 mt-4">
      <div className="text-center mb-4">
        <p className="text-sm font-semibold text-slate-300 mb-1">
          Complete your profile
        </p>
        <p className="text-xs text-slate-500">
          Just a few more details to get started
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Username <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder="Choose a unique username"
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition"
          required
        />
        <p className="text-xs text-slate-500">This will be your display name</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">
          Avatar URL (optional)
        </label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => onAvatarUrlChange(e.target.value)}
          placeholder="https://example.com/avatar.jpg"
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300">Bio (optional)</label>
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => onBioChange(e.target.value)}
          placeholder="Tell us about yourself..."
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition resize-none"
        />
        <p className="text-xs text-slate-500 text-right">
          {bio.length}/120 characters
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          disabled={loading}
          onClick={onBack}
          className="hover:text-slate-300 transition disabled:opacity-50"
        >
          ← Back
        </button>
      </div>

      <button
        type="submit"
        disabled={loading || !username.trim()}
        className="w-full rounded-lg bg-linear-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            Creating account...
          </span>
        ) : (
          'Finish Signup'
        )}
      </button>
    </form>
  );
}
