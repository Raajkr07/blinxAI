import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  requestOtp,
  verifyOtpOnly,
  completeSignupWithRefreshToken,
  completeLoginWithRefreshToken,
} from '../../api/authApi';
import AuthBackground from './AuthBackground';
import AuthCard from './AuthCard';
import AuthHeader from './AuthHeader';
import ModeToggle from './ModeToggle';
import ErrorBanner from './ErrorBanner';
import CredentialsInput from './CredentialsInput';
import OtpInput from './OtpInput';
import OtpStep from './OtpStep';
import ProfileSetup from './ProfileSetup';

// Regex for contact and email validation
const PHONE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm() {
  const { loginWithToken, loginWithTokens } = useAuthStore();

  // login || signup
  const [mode, setMode] = useState('login');
  // credentials || otp || profile (signup only)
  const [step, setStep] = useState('credentials');

  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState(''); // optional email for OTP delivery
  const [useEmailAsIdentifier, setUseEmailAsIdentifier] = useState(false);

  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Signup-only profile fields
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const identifierRef = useRef(null);
  const otpRef = useRef(null);
  const otpComplete = otp.length === 6;

  useEffect(() => {
    if (step === 'credentials') identifierRef.current?.focus();
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  const validPhone = PHONE_REGEX.test(identifier);
  const validEmail = EMAIL_REGEX.test(identifier);
  const validIdentifier = validPhone || validEmail;

  // credentials (login or signup) => sends OTP
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validIdentifier) {
      setError('Enter a valid phone number (10 digits) or email address');
      return;
    }

    setLoading(true);
    try {
      // Use identifier as phone or email, and optionally provide email for OTP delivery
      const emailForOtp =
        useEmailAsIdentifier && validEmail ? identifier : email || undefined;
      await requestOtp(identifier, emailForOtp);
      setStep('otp');
      setOtp('');
      setResendTimer(60);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const emailForOtp =
        useEmailAsIdentifier && validEmail ? identifier : email || undefined;
      await requestOtp(identifier, emailForOtp);
      setResendTimer(60);
    } catch (err) {
      setError(err.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpComplete) return;

    setError('');
    setLoading(true);
    try {
      // Verify OTP first (consumes OTP)
      await verifyOtpOnly(identifier, otp);

      if (mode === 'signup') {
        // For signup, proceed to profile creation
        setStep('profile');
      } else {
        // For login, try to complete login immediately
        const emailForLogin = validEmail ? identifier : email || undefined;

        try {
          const tokens = await completeLoginWithRefreshToken(
            identifier,
            emailForLogin,
            null
          );
          await loginWithTokens(tokens.accessToken, tokens.refreshToken);
        } catch (loginErr) {
          // Check if the error is due to incomplete profile
          const errorMessage = loginErr.message || '';
          if (errorMessage.toLowerCase().includes('profile incomplete') ||
            errorMessage.toLowerCase().includes('complete signup')) {
            // User exists but hasn't completed profile - switch to signup mode
            console.log('Profile incomplete, switching to signup mode');
            setMode('signup');
            setStep('profile');
          } else {
            // Other login errors
            throw loginErr;
          }
        }
      }
    } catch (err) {
      console.error('Login verification failed:', err);
      setError(err.message || 'Invalid OTP. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: profile (signup only)
  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    try {
      const phoneForSignup = validPhone ? identifier : undefined;
      const emailForSignup = validEmail ? identifier : email || undefined;

      const payload = {
        username: username.trim(),
        avatarUrl: avatarUrl.trim() || null,
        bio: bio.trim() || null,
        email: emailForSignup,
        phone: phoneForSignup,
      };

      const tokens = await completeSignupWithRefreshToken(identifier, payload);
      await loginWithTokens(tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      console.error('Signup completion failed:', err);
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setStep('credentials');
    setIdentifier('');
    setEmail('');
    setUseEmailAsIdentifier(false);
    setOtp('');
    setUsername('');
    setAvatarUrl('');
    setBio('');
    setError('');
    setResendTimer(0);
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    resetAll();
  };

  const displayIdentifier = () => {
    if (validEmail) return identifier;
    if (validPhone) return `+91 ${identifier}`;
    return identifier;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050b14] p-4 relative overflow-hidden">
      <AuthBackground />

      <AuthCard>
        <AuthHeader
          title="Blink Chat"
          subtitle={mode === 'login' ? 'Welcome back!' : 'Create your account'}
        />

        <ModeToggle mode={mode} onToggle={toggleMode} />

        {error && <ErrorBanner message={error} />}

        {step === 'credentials' && (
          <CredentialsInput
            identifierRef={identifierRef}
            identifier={identifier}
            onIdentifierChange={(value) => {
              setIdentifier(value);
              if (EMAIL_REGEX.test(value)) {
                setUseEmailAsIdentifier(true);
              } else {
                setUseEmailAsIdentifier(false);
              }
            }}
            email={email}
            onEmailChange={setEmail}
            showEmailField={!useEmailAsIdentifier && validPhone}
            mode={mode}
            loading={loading}
            validIdentifier={validIdentifier}
            onSubmit={handleCredentialsSubmit}
          />
        )}

        {step === 'otp' && (
          <OtpStep
            otpRef={otpRef}
            otp={otp}
            setOtp={setOtp}
            loading={loading}
            resendTimer={resendTimer}
            otpComplete={otpComplete}
            displayIdentifier={displayIdentifier()}
            onBack={() => setStep('credentials')}
            onResend={handleResendOtp}
            onSubmit={handleVerifyOtp}
          />
        )}

        {step === 'profile' && mode === 'signup' && (
          <ProfileSetup
            username={username}
            onUsernameChange={setUsername}
            avatarUrl={avatarUrl}
            onAvatarUrlChange={setAvatarUrl}
            bio={bio}
            onBioChange={(value) => setBio(value.slice(0, 120))}
            loading={loading}
            onBack={() => setStep('otp')}
            onSubmit={handleCompleteSignup}
          />
        )}
      </AuthCard>
    </div>
  );
}
