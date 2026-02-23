import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion as Motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { authService, userService } from '../services';
import { useAuthStore } from '../stores/authStore';
import { reportSuccess } from '../lib/reportError';
import { Button, Input, GoogleButton } from '../components/ui';

export function Login({ onSwitchToSignup, initialIdentifier }) {
    const [step, setStep] = useState('phone');
    const [identifier, setIdentifier] = useState(initialIdentifier || '');
    const [otp, setOtp] = useState('');
    const { setUser, setTokens } = useAuthStore();
    const navigate = useNavigate();

    const requestOtpMutation = useMutation({
        mutationFn: () => {
            const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
            return authService.requestOtp(normalized);
        },
        onSuccess: (data) => {
            toast.success(data.message || 'OTP sent successfully');
            setStep('otp');
        },
        onError: (error) => {
            void error;
            toast.error('Failed to send OTP');
        }
    });

    const verifyOtpMutation = useMutation({
        mutationFn: () => {
            const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
            return authService.verifyOtp(normalized, otp.trim());
        },
        onSuccess: async (data) => {
            if (!data.valid) {
                return toast.error('Invalid OTP');
            }

            try {
                const normalized = identifier.trim().includes('@') ? identifier.trim().toLowerCase() : identifier.trim();
                const loginData = await authService.login({ identifier: normalized });
                if (loginData.accessToken) {
                    setTokens(loginData.accessToken, loginData.refreshToken);
                    const userData = await userService.getMe();
                    setUser(userData);
                    reportSuccess('login-success', 'Welcome back');
                    navigate('/chat', { replace: true });
                } else if (loginData.error === 'USER_NOT_FOUND') {
                    toast.error('Account not found');
                    onSwitchToSignup?.();
                }
            } catch (err) {
                const message = err?.message;
                if (message === 'Profile incomplete') {
                    toast.error('Profile incomplete. Redirecting...');
                    onSwitchToSignup?.();
                } else {
                    toast.error('Login failed');
                }
            }
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (step === 'phone') {
            if (!identifier.trim()) return toast.error('Enter mobile or email');
            requestOtpMutation.mutate();
        } else {
            if (!otp.trim()) return toast.error('Enter OTP');
            verifyOtpMutation.mutate();
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl p-8 space-y-6"
        >
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Welcome Back</h2>
                <p className="text-gray-300">Continue to Blinx Assistant</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {step === 'phone' ? (
                    <div>
                        <Input
                            id="auth-identifier"
                            name="identifier"
                            autoComplete="username"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            disabled={requestOtpMutation.isPending}
                            placeholder="Email or Phone Number"
                        />
                        <Button
                            type="submit"
                            className="w-full mt-4"
                            loading={requestOtpMutation.isPending}
                        >
                            Continue
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="text-center space-y-1">
                            <label className="block text-sm font-medium">Verification Code</label>
                            <p className="text-xs text-gray-300">Sent to <span className="text-white">{identifier}</span></p>
                        </div>
                        <Input
                            id="auth-otp"
                            name="otp"
                            autoComplete="one-time-code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                            disabled={verifyOtpMutation.isPending}
                            placeholder="000000"
                        />
                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep('phone')}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1"
                                loading={verifyOtpMutation.isPending}
                            >
                                Verify & Login
                            </Button>
                        </div>
                    </div>
                )}
            </form>

            {
                step === 'phone' && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/10" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#1a1a1a] px-2 text-gray-300">Or continue with</span>
                            </div>
                        </div>

                        <GoogleButton />
                    </>
                )
            }

            <div className="text-center pt-4 border-t border-white/5 space-y-3">
                <p className="text-sm text-gray-300">
                    Don't have an account?{' '}
                    <button onClick={onSwitchToSignup} className="text-white font-medium hover:underline">
                        Sign up
                    </button>
                </p>
                <p className="text-[10px] text-gray-300 leading-relaxed px-4">
                    By continuing, you agree to Blinx AI's{' '}
                    <a href="/terms" className="text-gray-300 hover:text-white underline">Terms of Service</a> and{' '}
                    <a href="/privacy-policy" className="text-gray-300 hover:text-white underline">Privacy Policy</a>.
                </p>
            </div>
        </Motion.div >
    );
}
