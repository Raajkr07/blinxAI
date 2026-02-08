export default function OtpInput({ otpRef, otp = '', setOtp }) {
  return (
    <div className="flex justify-center gap-2">
      {[...Array(6)].map((_, i) => (
        <input
          key={i}
          ref={i === 0 ? otpRef : null}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={otp[i] || ''}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '');
            let newOtp;
            if (value) {
              newOtp = otp.slice(0, i) + value + otp.slice(i + 1);
            } else {
              newOtp = otp.slice(0, i) + otp.slice(i + 1);
            }
            setOtp(newOtp.slice(0, 6));
            if (value && i < 5) {
              e.target.parentElement?.children[i + 1]?.focus();
            } else if (!value && i > 0) {
              e.target.parentElement?.children[i - 1]?.focus();
            }
          }}
          className="w-12 h-14 rounded-lg border-2 border-slate-800 bg-slate-900 text-center text-xl font-bold text-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition"
        />
      ))}
    </div>
  );
}