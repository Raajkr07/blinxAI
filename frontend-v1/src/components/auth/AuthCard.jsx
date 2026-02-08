export default function AuthCard({ children }) {
  return (
    <div className="relative w-full max-w-md group">
      <div className="electric-glow" />
      <div className="electric-card p-6 md:p-8 border border-slate-800/60 backdrop-blur-2xl shadow-2xl">
        {children}
      </div>
    </div>
  );
}
