export default function ErrorBanner({ message }) {
  return (
    <div className="mb-4 text-sm text-red-200 bg-red-500/10 border border-red-500/40 rounded-lg px-4 py-3 animate-[slideDown_0.3s_ease-out]">
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <span>{message}</span>
      </div>
    </div>
  );
}
