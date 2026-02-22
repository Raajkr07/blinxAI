import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authService, userService } from '../services';
import { useAuthStore } from '../stores';
import { Button, Input, GoogleButton } from '../components/ui';

export function Signup({ onSwitchToLogin, initialIdentifier }) {
    const [step, setStep] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const hasDirectAuth = params.get('otp') || params.get('v');
        return (hasDirectAuth && initialIdentifier) ? 'profile' : 'phone';
    });
    const [identifier, setIdentifier] = useState(() => {
        if (initialIdentifier) return initialIdentifier;
        const params = new URLSearchParams(window.location.search);
        const token = params.get('v');
        if (token) {
            try { return atob(token).split(':')[1] || ''; } catch { return ''; }
        }
        return '';
    });
    const [otp, setOtp] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('v');
        if (token) {
            try { return atob(token).split(':')[0] || ''; } catch { return ''; }
        }
        return params.get('otp') || '';
    });
    const [profile, setProfile] = useState({ username: '', bio: '' });
    const { setUser, setTokens } = useAuthStore();
    const navigate = useNavigate();

    const requestOtpMutation = useMutation({
        mutationFn: () => {
            const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
            return authService.requestOtp(normalized);
        },
        onSuccess: () => {
            toast.success('OTP sent');
            setStep('otp');
        },
        onError: () => toast.error('Failed to send OTP')
    });

    const verifyOtpMutation = useMutation({
        mutationFn: () => {
            const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
            return authService.verifyOtp(normalized, otp.trim());
        },
        onSuccess: (data) => {
            if (data.valid) {
                toast.success('OTP verified');
                setStep('profile');
            } else {
                toast.error('Invalid OTP');
            }
        }
    });

    const signupMutation = useMutation({
        mutationFn: (payload) => authService.signup(payload),
        onSuccess: async (data) => {
            if (data.accessToken) {
                setTokens(data.accessToken, data.refreshToken);
                const userData = await userService.getMe();
                setUser(userData);
                toast.success('Account created');
                navigate('/chat', { replace: true });
            }
        },
        onError: () => toast.error('Signup failed')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (step === 'phone') {
            if (!identifier.trim()) return toast.error('Enter contact details');
            requestOtpMutation.mutate();
        } else if (step === 'otp') {
            if (!otp.trim()) return toast.error('Enter OTP');
            verifyOtpMutation.mutate();
        } else {
            if (!profile.username.trim()) return toast.error('Enter username');
            const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
            const isEmail = normalized.includes('@');
            signupMutation.mutate({
                identifier: normalized,
                username: profile.username.trim(),
                bio: profile.bio?.trim() || undefined,
                [isEmail ? 'email' : 'phone']: normalized
            });
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 space-y-6"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Create Account</h2>
                <p className="text-gray-400">Join Blinx Assistant</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {step === 'phone' && (
                    <div className="space-y-4">
                        <Input
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="Email or Phone Number"
                        />
                        <Button type="submit" className="w-full" loading={requestOtpMutation.isPending}>
                            Continue
                        </Button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="space-y-4">
                        <div className="text-center space-y-1">
                            <label className="block text-sm font-medium">Verification Code</label>
                            <p className="text-xs text-gray-400">Sent to <span className="text-white">{identifier}</span></p>
                        </div>
                        <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            placeholder="000000"
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStep('phone')}>Back</Button>
                            <Button type="submit" className="flex-1" loading={verifyOtpMutation.isPending}>Verify</Button>
                        </div>
                    </div>
                )}

                {step === 'profile' && (
                    <div className="space-y-4">
                        <Input
                            value={profile.username}
                            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                            placeholder="Name"
                        />
                        <Input
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            placeholder="Bio (Optional)"
                        />
                        <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setStep('otp')}>Back</Button>
                            <Button type="submit" className="flex-1" loading={signupMutation.isPending}>Create Account</Button>
                        </div>
                    </div>
                )}
            </form>

            {step === 'phone' && (
                <>
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#1a1a1a] px-2 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <GoogleButton>Sign up with Google</GoogleButton>
                </>
            )}

            <div className="text-center pt-4 border-t border-white/5 space-y-3">
                <p className="text-sm text-gray-400">
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin} className="text-white font-medium hover:underline">
                        Sign in
                    </button>
                </p>
                <p className="text-[10px] text-gray-500 leading-relaxed px-4">
                    By joining, you agree to Blinx AI's{' '}
                    <a href="/terms" className="text-gray-400 hover:text-white underline">Terms of Service</a> and{' '}
                    <a href="/privacy-policy" className="text-gray-400 hover:text-white underline">Privacy Policy</a>.
                </p>
            </div>
        </Motion.div>
    );
}
