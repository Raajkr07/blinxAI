export default function AuthHeader({ title, subtitle }) {
  return (
    <div className="mb-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-emerald-500 to-teal-600 text-3xl mb-3 shadow-lg">
        🔒
      </div>
      <h1 className="text-2xl font-bold text-slate-50 mb-1">{title}</h1>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}
