import OtpInput from './OtpInput';

export default function OtpStep({
  otpRef,
  otp,
  setOtp,
  loading,
  resendTimer,
  otpComplete,
  displayIdentifier,
  onBack,
  onResend,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-3 text-center">
        <p className="text-sm text-slate-300">Enter the 6-digit code sent to</p>
        <p className="text-sm font-semibold text-emerald-400">
          {displayIdentifier}
        </p>

        <OtpInput otpRef={otpRef} otp={otp} setOtp={setOtp} />
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
        <button
          type="button"
          disabled={loading || resendTimer > 0}
          onClick={onResend}
          className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-500 transition disabled:cursor-not-allowed"
        >
          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading || !otpComplete}
        className="w-full rounded-lg bg-linear-to-r from-emerald-500 to-teal-600 py-3 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            Verifying...
          </span>
        ) : (
          'Verify & Continue'
        )}
      </button>
    </form>
  );
}
